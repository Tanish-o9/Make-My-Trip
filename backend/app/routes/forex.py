from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.bookings import ForexOrder, BookingStatus, BookingEvent
from app.auth.dependencies import get_current_user
from app.models.core import User
import uuid
import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forex", tags=["forex"])

class ForexOrderRequest(BaseModel):
    currency_pair: str # USD/INR, EUR/INR
    amount: float
    delivery_mode: str # Home Delivery, Branch Pickup

@router.get("/rates")
async def get_forex_rates():
    return {
        "USD_INR": 84.50,
        "EUR_INR": 91.20,
        "GBP_INR": 107.40,
        "AED_INR": 23.01
    }

@router.post("/order")
async def place_forex_order(
    req: ForexOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking_ref = f"BK-FX-{uuid.uuid4().hex[:8].upper()}"
    kyc_ref = f"KYC-{uuid.uuid4().hex[:6].upper()}"
    
    rate = 84.50
    if "eur" in req.currency_pair.lower():
        rate = 91.20
    elif "gbp" in req.currency_pair.lower():
        rate = 107.40
        
    booking = ForexOrder(
        booking_reference=booking_ref,
        user_id=current_user.id,
        status=BookingStatus.CONFIRMED,
        total_amount=req.amount * rate,
        currency="INR",
        pricing_snapshot={"exchange_rate": rate},
        currency_pair=req.currency_pair,
        amount=req.amount,
        rate_locked_at_order=rate,
        delivery_mode=req.delivery_mode,
        kyc_ref=kyc_ref
    )
    
    db.add(booking)
    db.add(BookingEvent(
        booking_reference=booking_ref,
        event_type="forex_ordered",
        description=f"Forex order placed for {req.amount} at rate {rate}."
    ))
    db.commit()
    db.refresh(booking)
    
    return {
        "booking_reference": booking.booking_reference,
        "kyc_ref": booking.kyc_ref,
        "status": "confirmed"
    }

@router.get("/history")
async def get_forex_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    orders = db.query(ForexOrder).filter(ForexOrder.user_id == current_user.id).all()
    return [
        {
            "booking_reference": o.booking_reference,
            "currency_pair": o.currency_pair,
            "amount": float(o.amount),
            "rate": float(o.rate_locked_at_order),
            "total_inr": float(o.total_amount),
            "status": o.status
        }
        for o in orders
    ]
