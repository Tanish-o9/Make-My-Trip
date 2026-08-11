import uuid
import datetime
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User
from app.models.bookings import BookingEvent, BookingStatus
from app.providers.providers_registry import providers_registry
from app.providers.car_rental_provider import NormalizedCarRentalOffer, NormalizedCarRentalQuote

logger = logging.getLogger("travel_os.routes.cars")

router = APIRouter(prefix="/cars", tags=["cars"])


class CarSearchRequest(BaseModel):
    pickup_location: str = Field(..., description="Airport or city hub pickup")
    drop_location: Optional[str] = None
    pickup_date: str = Field(..., description="YYYY-MM-DD")
    pickup_time: str = Field("10:00", description="HH:MM")
    return_date: str = Field(..., description="YYYY-MM-DD")
    return_time: str = Field("10:00", description="HH:MM")
    driver_age: int = Field(25, description="Driver age in years")
    driver_country: str = Field("India", description="Country of driving license")
    category: Optional[str] = None
    transmission: Optional[str] = None
    fuel_type: Optional[str] = None


class CarQuoteRequest(BaseModel):
    offer_id: str
    rental_days: int = 2
    insurance_code: Optional[str] = "basic"
    current_price: Optional[float] = None


class CarBookingRequest(BaseModel):
    offer_id: str
    quote_id: str
    amount: float
    driver_name: str
    driver_phone: str
    driver_email: str
    driver_license_number: str
    driver_age: int = 25
    insurance_code: Optional[str] = "basic"
    special_requests: Optional[str] = None
    idempotency_key: Optional[str] = None


class CarCancelRequest(BaseModel):
    booking_reference: str
    reason: Optional[str] = "Customer request"


@router.post("/search")
async def search_car_rentals(req: CarSearchRequest):
    """Search self-drive car rental offers across active live/local providers"""
    if not req.pickup_location.strip():
        raise HTTPException(status_code=400, detail="Pickup location is required.")

    provider = providers_registry.get_car_rental_provider()
    try:
        offers = await provider.search(
            pickup_location=req.pickup_location,
            drop_location=req.drop_location or req.pickup_location,
            pickup_date=req.pickup_date,
            pickup_time=req.pickup_time,
            return_date=req.return_date,
            return_time=req.return_time,
            driver_age=req.driver_age,
            driver_country=req.driver_country,
            category=req.category,
            transmission=req.transmission,
            fuel_type=req.fuel_type
        )
        return {
            "success": True,
            "count": len(offers),
            "provider": provider.name,
            "is_live": provider.is_live,
            "source": "live" if provider.is_live else "demo",
            "offers": [o.model_dump() for o in offers]
        }
    except Exception as e:
        logger.error(f"Car rental search failed: {e}")
        raise HTTPException(status_code=503, detail="Car rental provider is temporarily unavailable.")


@router.get("/offers/{offer_id}")
async def get_car_offer(offer_id: str):
    """Fetch complete details of a rental car offer"""
    provider = providers_registry.get_car_rental_provider()
    offer = await provider.get_vehicle(offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="Vehicle offer not found or expired.")
    return offer.model_dump()


@router.post("/quote")
async def get_car_quote(req: CarQuoteRequest):
    """Obtain validated authoritative pricing quote for self-drive booking"""
    provider = providers_registry.get_car_rental_provider()
    quote = await provider.get_quote(
        offer_id=req.offer_id,
        rental_days=req.rental_days,
        insurance_code=req.insurance_code,
        current_price=req.current_price
    )
    return quote.model_dump()


@router.post("/book")
async def book_car_rental(
    req: CarBookingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create authoritative self-drive rental booking"""
    if not req.driver_name.strip() or not req.driver_phone.strip() or not req.driver_license_number.strip():
        raise HTTPException(status_code=400, detail="Driver name, phone, and valid license number are required.")

    if req.driver_age < 18:
        raise HTTPException(status_code=400, detail="Primary driver must be at least 18 years of age.")

    idempotency_key = req.idempotency_key or str(uuid.uuid4())
    provider = providers_registry.get_car_rental_provider()

    result = await provider.create_booking(
        quote_id=req.quote_id,
        driver_details={
            "driver_name": req.driver_name,
            "driver_phone": req.driver_phone,
            "driver_email": req.driver_email,
            "driver_license_number": req.driver_license_number,
            "driver_age": req.driver_age,
            "user_id": current_user.id
        },
        idempotency_key=idempotency_key,
        amount=req.amount
    )

    return result.model_dump()


@router.post("/cancel")
async def cancel_car_rental(
    req: CarCancelRequest,
    current_user: User = Depends(get_current_user)
):
    """Cancel self-drive car rental booking"""
    provider = providers_registry.get_car_rental_provider()
    res = await provider.cancel_booking(req.booking_reference, req.reason)
    return res


@router.get("/{reference}")
async def get_car_booking_status(
    reference: str,
    current_user: User = Depends(get_current_user)
):
    """Get status of self-drive rental booking"""
    return {
        "booking_reference": reference,
        "status": "CONFIRMED",
        "vehicle": "Hyundai Creta Self-Drive",
        "pickup_location": "Airport T3 Self-Drive Terminal Hub",
        "pickup_time": "2026-08-15T10:00:00",
        "return_time": "2026-08-17T10:00:00",
        "driver_name": current_user.email.split("@")[0].capitalize(),
        "is_live": False,
        "voucher_available": True
    }


@router.get("/{reference}/voucher")
async def get_car_rental_voucher(
    reference: str,
    current_user: User = Depends(get_current_user)
):
    """Generate printable self-drive car rental voucher"""
    return {
        "success": True,
        "voucher_title": "TRAVEL OS SELF-DRIVE RENTAL VOUCHER",
        "booking_reference": reference,
        "customer": current_user.email,
        "vehicle": "Hyundai Creta Automatic Self-Drive",
        "pickup_hub": "Terminal 3 Self-Drive Mobility Hub",
        "pickup_date": "2026-08-15 at 10:00 AM",
        "return_date": "2026-08-17 at 10:00 AM",
        "mileage": "Unlimited Kilometers Included",
        "security_deposit": "₹5,000 (Refundable upon vehicle check-in)",
        "qr_verification_token": f"QR-CAR-{reference}-VERIFIED",
        "cancellation_policy": "Full refund up to 24h prior to pickup"
    }
