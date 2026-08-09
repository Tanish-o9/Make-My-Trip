from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.bookings import CabBooking, BookingStatus, BookingEvent
from app.auth.dependencies import get_current_user
from app.models.core import User
import uuid
import datetime
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cabs", tags=["cabs"])

# Schemas
class CabSearchRequest(BaseModel):
    pickup_address: str
    drop_address: str
    trip_type: Optional[str] = "one_way"
    pickup_time: Optional[str] = None

class CabEstimateRequest(BaseModel):
    pickup_address: str
    drop_address: str
    cab_type: str

class CabBookRequest(BaseModel):
    pickup_address: str
    drop_address: str
    cab_type: str
    amount: float
    pickup_time: Optional[str] = None

class CabCancelRequest(BaseModel):
    booking_reference: str

class CabShareRequest(BaseModel):
    booking_reference: str
    phone_number: str

# Endpoints
@router.post("/search")
async def search_cabs(req: CabSearchRequest, db: Session = Depends(get_db)):
    distance = max(5.0, float(abs(len(req.pickup_address) - len(req.drop_address)) + 4.5))
    duration_mins = max(10.0, distance * 2.2)
    
    vehicles = [
        {"cab_type": "Mini", "driver_name": "Ramesh Kumar", "vehicle_model": "Maruti Alto", "plate": "DL-1C-A-1234", "fare": round(15.0 * distance + 50.0), "eta_mins": 3, "provider": "Local"},
        {"cab_type": "Sedan", "driver_name": "Suresh Singh", "vehicle_model": "Maruti Dzire", "plate": "DL-1C-B-5678", "fare": round(18.0 * distance + 60.0), "eta_mins": 5, "provider": "Uber"},
        {"cab_type": "SUV", "driver_name": "Gurpreet Singh", "vehicle_model": "Ertiga", "plate": "DL-1C-C-9012", "fare": round(24.0 * distance + 80.0), "eta_mins": 7, "provider": "Ola"},
        {"cab_type": "Luxury", "driver_name": "Deepak Sharma", "vehicle_model": "Toyota Camry", "plate": "DL-1C-D-3456", "fare": round(45.0 * distance + 150.0), "eta_mins": 10, "provider": "Uber"},
        {"cab_type": "EV", "driver_name": "Amit Patel", "vehicle_model": "Tata Nexon EV", "plate": "DL-1C-E-7890", "fare": round(20.0 * distance + 70.0), "eta_mins": 4, "provider": "Local"}
    ]
    
    return {
        "pickup": req.pickup_address,
        "drop": req.drop_address,
        "distance_km": distance,
        "duration_mins": duration_mins,
        "options": vehicles
    }

@router.post("/estimate")
async def estimate_cab_fare(req: CabEstimateRequest, db: Session = Depends(get_db)):
    distance = max(5.0, float(abs(len(req.pickup_address) - len(req.drop_address)) + 4.5))
    base_fare = 50.0
    distance_fare = distance * 15.0
    surge_multiplier = 1.15
    taxes = (base_fare + distance_fare) * 0.05
    final_fare = round((base_fare + distance_fare) * surge_multiplier + taxes)
    
    return {
        "base_fare": base_fare,
        "distance_fare": distance_fare,
        "surge_multiplier": surge_multiplier,
        "taxes": taxes,
        "final_fare": final_fare,
        "currency": "INR"
    }

@router.post("/book")
async def book_cab(
    req: CabBookRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking_ref = f"BK-CB-{uuid.uuid4().hex[:8].upper()}"
    pickup_dt = datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
    if req.pickup_time:
        try:
            pickup_dt = datetime.datetime.strptime(req.pickup_time, "%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
            
    booking = CabBooking(
        booking_reference=booking_ref,
        user_id=current_user.id,
        status=BookingStatus.CONFIRMED,
        # BUG-011 FIX: Compute fare server-side — never trust client-submitted amount
        total_amount=round((max(5.0, float(abs(len(req.pickup_address) - len(req.drop_address)) + 4.5))) * {
            "Mini": 15.0, "Sedan": 18.0, "SUV": 24.0, "Luxury": 45.0, "EV": 20.0
        }.get(req.cab_type, 15.0) + {"Mini": 50, "Sedan": 60, "SUV": 80, "Luxury": 150, "EV": 70}.get(req.cab_type, 50)),
        currency="INR",
        pricing_snapshot={"fare": req.amount},
        provider_name="Uber" if req.cab_type in ["Sedan", "Luxury"] else "Local",
        cab_type=req.cab_type,
        pickup_address=req.pickup_address,
        drop_address=req.drop_address,
        pickup_time=pickup_dt
    )
    
    db.add(booking)
    db.add(BookingEvent(
        booking_reference=booking_ref,
        event_type="driver_assigned",
        description=f"Driver assigned for {req.cab_type} ride. Driver: Ramesh Kumar (9876543210)."
    ))
    db.commit()
    db.refresh(booking)
    
    return {
        "booking_reference": booking.booking_reference,
        "status": "driver_assigned",
        "driver": {
            "driver_name": "Ramesh Kumar",
            "rating": 4.8,
            "vehicle_model": "Maruti Dzire",
            "vehicle_color": "White",
            "plate": "DL-1C-B-5678",
            "phone": "9876543210"
        }
    }

@router.post("/cancel")
async def cancel_cab(
    req: CabCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
    # BUG-012 FIX: Ensure user owns this booking (IDOR prevention)
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking.")
        
    booking.status = BookingStatus.CANCELLED
    db.add(BookingEvent(
        booking_reference=req.booking_reference,
        event_type="cancelled",
        description="Cab ride cancelled by passenger."
    ))
    db.commit()
    
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "status": "cancelled"
    }

@router.get("/history")
async def cab_ride_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bookings = db.query(CabBooking).filter(CabBooking.user_id == current_user.id).all()
    return [
        {
            "booking_reference": b.booking_reference,
            "cab_type": b.cab_type,
            "pickup_address": b.pickup_address,
            "drop_address": b.drop_address,
            "pickup_time": b.pickup_time,
            "status": b.status,
            "amount": b.total_amount
        }
        for b in bookings
    ]

@router.get("/{booking_reference}")
async def get_cab_booking(
    booking_reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
        
    # BUG-012g FIX: Enforce user ownership of booking (IDOR prevention)
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")
        
    events = db.query(BookingEvent).filter(BookingEvent.booking_reference == booking_reference).order_by(BookingEvent.created_at.asc()).all()
    
    return {
        "booking_reference": booking.booking_reference,
        "cab_type": booking.cab_type,
        "pickup_address": booking.pickup_address,
        "drop_address": booking.drop_address,
        "pickup_time": booking.pickup_time,
        "status": booking.status,
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

@router.get("/{booking_reference}/track")
async def track_cab_ride(
    booking_reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
        
    # BUG-012g FIX: Enforce user ownership of booking (IDOR prevention)
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")
        
    return {
        "booking_reference": booking.booking_reference,
        "driver_coordinates": {"lat": 28.6139, "lng": 77.2090},
        "eta_mins": 4,
        "distance_remaining_km": 1.8,
        "traffic_status": "Heavy Traffic",
        "route": [
            {"lat": 28.6139, "lng": 77.2090},
            {"lat": 28.6145, "lng": 77.2105},
            {"lat": 28.6152, "lng": 77.2120}
        ]
    }

@router.post("/share")
async def share_cab_ride(
    req: CabShareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
        
    # BUG-012g FIX: Enforce user ownership of booking (IDOR prevention)
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")
        
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "shared_link": f"https://travelos.com/track/{booking.booking_reference}?token={uuid.uuid4().hex[:8]}"
    }
