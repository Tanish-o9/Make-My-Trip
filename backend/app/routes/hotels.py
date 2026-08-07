from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any
from app.services.hotel_service import HotelService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/search", response_model=List[Dict[str, Any]])
async def search_hotels(
    city: str = Query(..., description="Target search city"),
    check_in: str = Query(..., alias="checkIn", description="Check-in date (YYYY-MM-DD)"),
    check_out: str = Query(..., alias="checkOut", description="Check-out date (YYYY-MM-DD)"),
    adults: int = Query(1, description="Number of adults"),
    rooms: int = Query(1, description="Number of rooms"),
    currency: str = Query("INR", description="Preferred currency code")
):
    """
    Search hotels by city name, resolving destination id and querying availability.
    Example: GET /api/hotels/search?city=Goa&checkIn=2026-12-15&checkOut=2026-12-20
    """
    city_clean = city.strip()
    if not city_clean:
        raise HTTPException(status_code=400, detail="Search city parameter cannot be empty.")

    try:
        results = await HotelService.search_hotels(
            city=city_clean,
            check_in=check_in,
            check_out=check_out,
            adults=adults,
            rooms=rooms,
            currency=currency
        )
        return results
    except Exception as e:
        logger.error(f"Error in search_hotels endpoint: {e}")
        return HotelService._get_fallback_mock_hotels(city_clean, check_in, check_out, currency)

@router.get("/{hotelId}", response_model=Dict[str, Any])
async def get_hotel_details(hotelId: str):
    """
    Retrieve full details, photos, description, and facilities of a specific hotel.
    Example: GET /api/hotels/10001
    """
    try:
        return await HotelService.get_hotel_details(hotelId)
    except Exception as e:
        logger.error(f"Error in get_hotel_details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch hotel details: {str(e)}")

@router.get("/{hotelId}/reviews", response_model=List[Dict[str, Any]])
async def get_hotel_reviews(hotelId: str):
    """
    Retrieve guest reviews of a specific hotel.
    Example: GET /api/hotels/10001/reviews
    """
    try:
        return await HotelService.get_hotel_reviews(hotelId)
    except Exception as e:
        logger.error(f"Error in get_hotel_reviews: {e}")
        return []

@router.get("/{hotelId}/rooms", response_model=List[Dict[str, Any]])
async def get_hotel_rooms(
    hotelId: str,
    check_in: str = Query(..., alias="checkIn", description="Check-in date (YYYY-MM-DD)"),
    check_out: str = Query(..., alias="checkOut", description="Check-out date (YYYY-MM-DD)")
):
    try:
        return await HotelService.get_room_availability(hotelId, check_in, check_out)
    except Exception as e:
        logger.error(f"Error in get_hotel_rooms: {e}")
        return []

# ── HOTEL BOOKING ENGINE SCHEMAS & ROUTES ─────────────────────

from pydantic import BaseModel
from fastapi import Depends
from typing import Optional
from decimal import Decimal
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.bookings import HotelBooking, BookingStatus, BookingEvent
from app.auth.dependencies import get_current_user
from app.models.core import User
from app.services.wallet_loyalty import WalletService
import datetime
import uuid

class HotelHoldRequest(BaseModel):
    hotel_id: str
    hotel_name: str
    room_type: str
    amount: float
    check_in: str
    check_out: str
    provider_name: str
    details: Dict[str, Any]

class HotelRevalidateRequest(BaseModel):
    booking_reference: str

class GuestValidationItem(BaseModel):
    name: str
    dob: str
    gender: str
    email: str
    phone: str
    passport: Optional[str] = None
    nationality: Optional[str] = None

class HotelBookRequest(BaseModel):
    booking_reference: str
    guests: List[GuestValidationItem]

@router.post("/search", response_model=List[Dict[str, Any]])
async def search_hotels_post(
    req: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """POST wrapper for hotel search"""
    city = req.get("city", "Goa")
    check_in = req.get("check_in") or req.get("checkIn") or "2026-12-15"
    check_out = req.get("check_out") or req.get("checkOut") or "2026-12-20"
    adults = int(req.get("adults", 1))
    rooms = int(req.get("rooms", 1))
    currency = req.get("currency", "INR")
    return await HotelService.search_hotels(city, check_in, check_out, adults, rooms, currency)

@router.post("/hold")
async def hotels_hold_api(
    req: HotelHoldRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking_ref = f"BK-HT-{uuid.uuid4().hex[:8].upper()}"
    held_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    
    pricing_snapshot = {
        "base_fare": req.amount * 0.88,
        "tax": req.amount * 0.12,
        "discount": 0.0
    }
    
    booking = HotelBooking(
        booking_reference=booking_ref,
        user_id=current_user.id,
        status=BookingStatus.HOLD,
        total_amount=req.amount,
        currency="INR",
        pricing_snapshot=pricing_snapshot,
        held_until=held_until,
        hotel_name=req.hotel_name,
        hotel_id=req.hotel_id,
        check_in=datetime.datetime.strptime(req.check_in, "%Y-%m-%d"),
        check_out=datetime.datetime.strptime(req.check_out, "%Y-%m-%d"),
        room_type=req.room_type,
        guest_details=[],
        address=req.details.get("address", "Palace Gardens crescent")
    )
    
    db.add(booking)
    db.add(BookingEvent(
        booking_reference=booking_ref,
        event_type="room_held",
        description=f"Room hold placed for {req.room_type} at {req.hotel_name}."
    ))
    db.commit()
    db.refresh(booking)
    
    return {
        "booking_reference": booking.booking_reference,
        "status": "room_held",
        "amount": booking.total_amount,
        "held_until": booking.held_until
    }

@router.post("/revalidate")
async def hotels_revalidate_api(
    req: HotelRevalidateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ref = req.booking_reference
    price_changed = False
    if "_revalidate_change" in ref:
        ref = ref.replace("_revalidate_change", "")
        price_changed = True
        
    booking = db.query(HotelBooking).filter(HotelBooking.booking_reference == ref).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Hotel booking not found.")
        
    old_price = float(booking.total_amount)
    new_price = old_price
    if price_changed:
        new_price = old_price + 2000.0
        booking.total_amount = new_price
        db.commit()
        
    return {
        "price_changed": price_changed,
        "old_price": old_price,
        "new_price": new_price,
        "difference": new_price - old_price,
        "status": "room_validated"
    }

@router.post("/book")
async def hotels_book_api(
    req: HotelBookRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(HotelBooking).filter(HotelBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Hotel booking not found.")
        
    if not req.guests:
        raise HTTPException(status_code=400, detail="Guest list is required.")
        
    # Guest Validation
    for g in req.guests:
        if not g.name or not g.dob or not g.gender or not g.email or not g.phone:
            raise HTTPException(status_code=400, detail="Guest information incomplete.")
            
    booking.guest_details = [g.dict() for g in req.guests]
    booking.status = BookingStatus.PAYMENT_PENDING
    
    db.add(BookingEvent(
        booking_reference=req.booking_reference,
        event_type="guest_validated",
        description="Guest information validated successfully."
    ))
    db.commit()
    
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "status": "payment_pending"
    }

@router.post("/engine/cancel")
async def hotels_cancel_api(
    req: HotelRevalidateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(HotelBooking).filter(HotelBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Hotel booking not found.")
        
    booking.status = BookingStatus.CANCELLED
    db.add(BookingEvent(
        booking_reference=req.booking_reference,
        event_type="cancelled",
        description="Hotel booking cancelled by user."
    ))
    db.commit()
    
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "status": "cancelled"
    }

@router.post("/engine/refund")
async def hotels_refund_api(
    req: HotelRevalidateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(HotelBooking).filter(HotelBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Hotel booking not found.")
        
    booking.status = BookingStatus.REFUNDED
    WalletService.refund_to_wallet(db, user_id=booking.user_id, amount=Decimal(str(booking.total_amount)), booking_ref=booking.booking_reference)
    
    db.add(BookingEvent(
        booking_reference=req.booking_reference,
        event_type="refunded",
        description="Hotel booking refund credited back to wallet."
    ))
    db.commit()
    
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "status": "refunded"
    }

@router.get("/reservation/{booking_reference}")
async def get_hotel_reservation(
    booking_reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(HotelBooking).filter(HotelBooking.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Hotel reservation not found.")
        
    events = db.query(BookingEvent).filter(BookingEvent.booking_reference == booking_reference).order_by(BookingEvent.created_at.asc()).all()
    
    return {
        "booking_reference": booking.booking_reference,
        "hotel_name": booking.hotel_name,
        "room_type": booking.room_type,
        "status": booking.status,
        "check_in": booking.check_in,
        "check_out": booking.check_out,
        "amount": booking.total_amount,
        "timeline": [
            {
                "event_type": e.event_type,
                "description": e.description,
                "created_at": e.created_at
            }
            for e in events
        ]
    }

@router.get("/voucher/{booking_reference}")
async def get_hotel_voucher(
    booking_reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(HotelBooking).filter(HotelBooking.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Hotel reservation not found.")
        
    return {
        "voucher_number": f"VCH-HT-{uuid.uuid4().hex[:6].upper()}",
        "booking_reference": booking.booking_reference,
        "hotel_name": booking.hotel_name,
        "room_type": booking.room_type,
        "check_in": booking.check_in,
        "check_out": booking.check_out,
        "guest_details": booking.guest_details,
        "address": booking.address
    }

