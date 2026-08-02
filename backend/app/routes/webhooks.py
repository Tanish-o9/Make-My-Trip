import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.bookings import (
    BookingStatus, FlightBooking, HotelBooking, TrainBooking, BusBooking,
    CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication,
    CruiseBooking, InsurancePolicy, VillaBooking, ForexOrder, PaymentAttempt,
    VehicleRentalBooking, BookingEvent
)
from app.services.booking_core import BookingStateMachine
from app.utils.event_bus import emit_event
from app.routes.payments import send_websocket_update

router = APIRouter(prefix="/providers/webhooks", tags=["webhooks"])

class PartnerUpdatePayload(BaseModel):
    booking_reference: str
    vertical: str
    event_type: str  # cancellation, schedule_change, delay
    description: str
    new_time: Optional[str] = None

@router.post("/partner-update")
def partner_webhook_update(
    payload: PartnerUpdatePayload,
    db: Session = Depends(get_db)
):
    models_mapping = {
        "flights": FlightBooking, "hotels": HotelBooking, "trains": TrainBooking,
        "cabs": CabBooking, "visa": VisaApplication, "holidays": HolidayPackageBooking,
        "buses": BusBooking, "tours": ActivityBooking, "cruises": CruiseBooking,
        "insurance": InsurancePolicy, "villas": VillaBooking, "forex": ForexOrder,
        "rent-a-ride": VehicleRentalBooking, "vehicle_rental": VehicleRentalBooking
    }
    
    model_cls = models_mapping.get(payload.vertical.lower())
    if not model_cls:
        raise HTTPException(status_code=400, detail="Invalid vertical.")

    booking = db.query(model_cls).filter(model_cls.booking_reference == payload.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking reference not found.")

    # 1. Log event in booking_events audit table
    event = BookingEvent(
        booking_reference=booking.booking_reference,
        event_type=payload.event_type,
        description=payload.description
    )
    db.add(event)

    # 2. Process event type transitions
    if payload.event_type == "cancellation":
        try:
            BookingStateMachine.transition_to(booking, BookingStatus.CANCELLED)
        except ValueError as err:
            # Force transition if strictly required by provider override
            booking.status = BookingStatus.CANCELLED
        booking.pricing_snapshot["provider_cancelled"] = True
        
    elif payload.event_type == "schedule_change":
        if payload.vertical.lower() == "flights" and payload.new_time:
            booking.departure_time = datetime.datetime.fromisoformat(payload.new_time)
            booking.status = BookingStatus.RESCHEDULED
        elif payload.vertical.lower() == "hotels" and payload.new_time:
            booking.check_in = datetime.datetime.fromisoformat(payload.new_time)
            booking.status = BookingStatus.RESCHEDULED

    db.commit()

    # 3. Notify user via websocket and event bus
    send_websocket_update(f"booking_update:{booking.user_id}", {
        "booking_reference": booking.booking_reference,
        "status": booking.status.value,
        "event_type": payload.event_type,
        "message": payload.description
    })

    emit_event("provider_booking_event", {
        "booking_reference": booking.booking_reference,
        "event_type": payload.event_type,
        "description": payload.description
    })

    return {
        "success": True,
        "message": f"Webhook updates processed successfully for booking {booking.booking_reference}."
    }


@router.post("/reconcile")
def trigger_provider_reconciliation(
    db: Session = Depends(get_db)
):
    from app.services.reconciliation import reconcile_provider_bookings
    return reconcile_provider_bookings(db)
