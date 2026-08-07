from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.bookings import VisaApplication, BookingStatus, BookingEvent
from app.auth.dependencies import get_current_user
from app.models.core import User
import uuid
import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/visa", tags=["visa"])

class VisaSearchRequest(BaseModel):
    country: str

class VisaApplyRequest(BaseModel):
    country: str
    visa_type: str
    first_name: str
    last_name: str
    passport_number: str
    dob: str
    email: str
    phone: str

@router.post("/search")
async def search_visa_rules(req: VisaSearchRequest):
    c = req.country.capitalize()
    return {
        "country": c,
        "required_documents": ["Passport (Valid > 6 months)", "Passport Photo (White background)", "Flight Itinerary", "Hotel Booking", "Bank Statement (Last 3 months)"],
        "processing_time_days": 5,
        "visa_fees_inr": 4500.0,
        "eligibility": "Indian citizens eligible for tourist/business e-visa"
    }

@router.post("/apply")
async def apply_visa(
    req: VisaApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking_ref = f"BK-VS-{uuid.uuid4().hex[:8].upper()}"
    
    applicant = {
        "name": f"{req.first_name} {req.last_name}",
        "passport": req.passport_number,
        "dob": req.dob,
        "email": req.email,
        "phone": req.phone
    }
    
    booking = VisaApplication(
        booking_reference=booking_ref,
        user_id=current_user.id,
        status=BookingStatus.CONFIRMED,
        total_amount=4500.0,
        currency="INR",
        pricing_snapshot={"visa_fee": 4500.0},
        country=req.country,
        visa_type=req.visa_type,
        applicant_details=applicant,
        status_notes="Submitted to embassy processing."
    )
    
    db.add(booking)
    db.add(BookingEvent(
        booking_reference=booking_ref,
        event_type="visa_submitted",
        description=f"Visa application submitted for {req.country}."
    ))
    db.commit()
    db.refresh(booking)
    
    return {
        "booking_reference": booking.booking_reference,
        "status": "submitted",
        "message": "Visa application submitted successfully."
    }

@router.get("/history")
async def get_visa_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    apps = db.query(VisaApplication).filter(VisaApplication.user_id == current_user.id).all()
    return [
        {
            "booking_reference": a.booking_reference,
            "country": a.country,
            "visa_type": a.visa_type,
            "submission_date": a.submission_date,
            "status": a.status
        }
        for a in apps
    ]

@router.get("/{booking_reference}")
async def get_visa_details(
    booking_reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(VisaApplication).filter(VisaApplication.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Visa application not found.")
        
    events = db.query(BookingEvent).filter(BookingEvent.booking_reference == booking_reference).order_by(BookingEvent.created_at.asc()).all()
    
    return {
        "booking_reference": booking.booking_reference,
        "country": booking.country,
        "visa_type": booking.visa_type,
        "status": booking.status,
        "timeline": [
            {
                "event_type": e.event_type,
                "description": e.description,
                "created_at": e.created_at
            }
            for e in events
        ]
    }
