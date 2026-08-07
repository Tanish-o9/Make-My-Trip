from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.bookings import InsurancePolicy, BookingStatus, BookingEvent
from app.auth.dependencies import get_current_user
from app.models.core import User
import uuid
import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insurance", tags=["insurance"])

class InsurancePurchaseRequest(BaseModel):
    plan_name: str
    destination: str
    duration_days: int
    passenger_name: str

@router.get("/plans")
async def list_insurance_plans():
    return [
        {"plan_name": "Standard Shield", "premium": 499.0, "coverage": "Medical cover up to $50,000, Baggage delay up to $500"},
        {"plan_name": "Gold Secure", "premium": 899.0, "coverage": "Medical cover up to $100,000, Lost Baggage cover, Trip cancellation cover"},
        {"plan_name": "Platinum Elite", "premium": 1499.0, "coverage": "Unlimited Medical cover, Trip delays, Covid cover, Adventure sports cover"}
    ]

@router.post("/purchase")
async def purchase_insurance(
    req: InsurancePurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking_ref = f"BK-IS-{uuid.uuid4().hex[:8].upper()}"
    policy_num = f"POL-{uuid.uuid4().hex[:6].upper()}"
    
    plan_fare = 499.0
    if "gold" in req.plan_name.lower():
        plan_fare = 899.0
    elif "platinum" in req.plan_name.lower():
        plan_fare = 1499.0
        
    start_date = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    end_date = start_date + datetime.timedelta(days=req.duration_days)
    
    booking = InsurancePolicy(
        booking_reference=booking_ref,
        user_id=current_user.id,
        status=BookingStatus.CONFIRMED,
        total_amount=plan_fare,
        currency="INR",
        pricing_snapshot={"premium": plan_fare},
        provider_name="Tata AIG",
        policy_name=req.plan_name,
        policy_number=policy_num,
        coverage_details={"destination": req.destination, "insured": req.passenger_name},
        start_date=start_date,
        end_date=end_date
    )
    
    db.add(booking)
    db.add(BookingEvent(
        booking_reference=booking_ref,
        event_type="policy_issued",
        description=f"Insurance policy issued under number {policy_num}."
    ))
    db.commit()
    db.refresh(booking)
    
    return {
        "booking_reference": booking.booking_reference,
        "policy_number": booking.policy_number,
        "status": "issued"
    }

@router.get("/history")
async def get_insurance_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    policies = db.query(InsurancePolicy).filter(InsurancePolicy.user_id == current_user.id).all()
    return [
        {
            "booking_reference": p.booking_reference,
            "policy_name": p.policy_name,
            "policy_number": p.policy_number,
            "premium": p.total_amount,
            "status": p.status
        }
        for p in policies
    ]
