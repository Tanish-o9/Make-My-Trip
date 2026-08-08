from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.bookings import ActivityBooking, BookingStatus, BookingEvent
from app.auth.dependencies import get_current_user
from app.models.core import User
from app.services.wallet_loyalty import WalletService
from decimal import Decimal
import uuid
import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/activities", tags=["activities"])

# Schemas
class ActivitySearchRequest(BaseModel):
    destination: str
    category: Optional[str] = None
    date: Optional[str] = None

class ActivityBookRequest(BaseModel):
    activity_id: str
    activity_name: str
    location: str
    price: float
    tickets: int
    activity_time: str

class ActivityCancelRequest(BaseModel):
    booking_reference: str

from app.services.activities_service import activities_service

# Endpoints
@router.post("/search")
async def search_activities(req: ActivitySearchRequest, db: Session = Depends(get_db)):
    results = await activities_service.search_activities(req.destination, req.category)
    return {
        "destination": req.destination.capitalize(),
        "results": results
    }

@router.get("/{id}")
async def get_activity_details(id: str):
    provider = "GetYourGuide" if "GYG" in id else "Viator" if "VIATOR" in id else "Klook"
    return {
        "id": id,
        "name": "Boutique Adventure & Tour Experience",
        "description": "Discover local heritage, taste fine cuisine, and capture breathtaking views guided by local experts.",
        "gallery": [
            "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800",
            "https://images.unsplash.com/photo-1505080856163-267d49b302c4?w=800"
        ],
        "included": ["Entry Ticket", "English-speaking Guide", "Bottled Water", "Hotel Pickup"],
        "excluded": ["Meals & Lunch", "Personal Souvenirs", "Tips"],
        "languages": ["English", "Spanish", "German"],
        "age_limit": "Suitable for age 5 to 70",
        "accessibility": "Stroller accessible, not wheelchair friendly",
        "provider": provider,
        "meeting_instructions": "Please arrive at the meeting point 15 minutes before slot time and show your digital voucher QR."
    }

@router.post("/book")
async def book_activity(
    req: ActivityBookRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking_ref = f"BK-AC-{uuid.uuid4().hex[:8].upper()}"
    slot_time = datetime.datetime.utcnow() + datetime.timedelta(days=2)
    try:
        slot_time = datetime.datetime.strptime(req.activity_time, "%Y-%m-%d %H:%M:%S")
    except Exception:
        pass
        
    # Book via Viator
    real_booking = await activities_service.book_activity(
        req.activity_id,
        {"first_name": current_user.email.split("@")[0], "last_name": "Traveler"}
    )
        
    booking = ActivityBooking(
        booking_reference=booking_ref,
        user_id=current_user.id,
        status=BookingStatus.CONFIRMED,
        total_amount=req.price * req.tickets,
        currency="INR",
        pricing_snapshot={"price_per_ticket": req.price, "tickets": req.tickets, "voucher_url": real_booking.get("voucher_url")},
        activity_name=req.activity_name,
        location=req.location,
        activity_time=slot_time,
        ticket_count=req.tickets,
        details={"activity_id": req.activity_id}
    )
    
    db.add(booking)
    db.add(BookingEvent(
        booking_reference=booking_ref,
        event_type="voucher_generated",
        description=f"Activity booked successfully at {req.location}."
    ))
    db.commit()
    db.refresh(booking)
    
    return {
        "booking_reference": booking.booking_reference,
        "status": "booked",
        "voucher_number": real_booking.get("booking_reference") or f"VCH-AC-{uuid.uuid4().hex[:6].upper()}",
        "meeting_point": f"Main Reception Gate, {req.location}"
    }

@router.post("/cancel")
async def cancel_activity(
    req: ActivityCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(ActivityBooking).filter(ActivityBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Activity booking not found.")
    # BUG-012d FIX: Verify booking ownership (IDOR prevention)
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking.")
        
    booking.status = BookingStatus.CANCELLED
    db.add(BookingEvent(
        booking_reference=req.booking_reference,
        event_type="cancelled",
        description="Activity booking cancelled."
    ))
    db.commit()
    
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "status": "cancelled"
    }

@router.post("/refund")
async def refund_activity(
    req: ActivityCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(ActivityBooking).filter(ActivityBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Activity booking not found.")
        
    # BUG-012h FIX: Enforce user ownership of booking (IDOR prevention)
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")
        
    booking.status = BookingStatus.REFUNDED
    WalletService.refund_to_wallet(db, user_id=booking.user_id, amount=Decimal(str(booking.total_amount)), booking_ref=booking.booking_reference)
    
    db.add(BookingEvent(
        booking_reference=req.booking_reference,
        event_type="refunded",
        description="Refund credited back to wallet."
    ))
    db.commit()
    
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "status": "refunded"
    }

@router.get("/{id}/voucher")
async def get_activity_voucher(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(ActivityBooking).filter(ActivityBooking.booking_reference == id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Activity booking not found.")
        
    # BUG-012h FIX: Enforce user ownership of booking (IDOR prevention)
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")
        
    return {
        "voucher_number": f"VCH-AC-{uuid.uuid4().hex[:6].upper()}",
        "booking_reference": booking.booking_reference,
        "activity_name": booking.activity_name,
        "location": booking.location,
        "activity_time": booking.activity_time,
        "tickets": booking.ticket_count,
        "meeting_point": f"Main Reception Gate, {booking.location}"
    }

@router.get("/history")
async def get_activities_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bookings = db.query(ActivityBooking).filter(ActivityBooking.user_id == current_user.id).all()
    return [
        {
            "booking_reference": b.booking_reference,
            "activity_name": b.activity_name,
            "location": b.location,
            "activity_time": b.activity_time,
            "tickets": b.ticket_count,
            "status": b.status,
            "amount": b.total_amount
        }
        for b in bookings
    ]
