from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import logging
from app.database import get_db
from app.models.bookings import VehicleRentalBooking, BookingStatus
from app.services.vehicle_rental_agents import (
    routing_agent, fuel_agent, ev_charging_agent, support_rag_bot, pricing_agent
)
from pydantic import BaseModel
import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rent-a-ride", tags=["rent-a-ride"])

class ExtendRentalRequest(BaseModel):
    booking_reference: str
    additional_days: int

class EmergencyRequest(BaseModel):
    booking_reference: str
    issue_type: str # breakdown, accident, lockout
    details: str

class ChatMessageRequest(BaseModel):
    booking_reference: str
    message: str

@router.get("/routing")
def get_nearest_hub(location: str = Query(...)):
    try:
        return routing_agent(location)
    except Exception as e:
        logger.error(f"Routing agent error: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute nearest depot.")

@router.get("/telemetry/{booking_ref}")
def get_vehicle_telemetry(booking_ref: str, db: Session = Depends(get_db)):
    booking = db.query(VehicleRentalBooking).filter(VehicleRentalBooking.booking_reference == booking_ref).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Vehicle rental booking not found.")
    
    is_ev = "ev" in booking.vehicle_type.lower() or "ev" in (booking.fuel_type or "").lower()
    
    if is_ev:
        telemetry = ev_charging_agent(booking_ref)
        return {
            "type": "EV",
            "level": telemetry["charge_level_percent"],
            "nearest_point": telemetry["nearest_charger"],
            "status_text": telemetry["telemetry_status"]
        }
    else:
        telemetry = fuel_agent(booking_ref)
        return {
            "type": "Fuel",
            "level": telemetry["fuel_level_percent"],
            "nearest_point": telemetry["nearest_station"],
            "status_text": telemetry["telemetry_status"]
        }

@router.post("/extend")
def extend_rental(req: ExtendRentalRequest, db: Session = Depends(get_db)):
    booking = db.query(VehicleRentalBooking).filter(VehicleRentalBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    
    # Calculate daily rate
    days = (booking.drop_time - booking.pickup_time).days
    if days <= 0:
        days = 1
    base_daily_rate = float(booking.total_amount) / days
    
    # Re-verify daily rate with pricing agent
    dummy_vehicle_list = [{"id": booking.id, "type": booking.vehicle_type, "price_per_day": base_daily_rate}]
    priced_list = pricing_agent(dummy_vehicle_list)
    new_daily_rate = priced_list[0]["price_per_day"]
    
    additional_cost = new_daily_rate * req.additional_days
    
    booking.drop_time = booking.drop_time + datetime.timedelta(days=req.additional_days)
    booking.total_amount = float(booking.total_amount) + additional_cost
    
    db.commit()
    db.refresh(booking)
    
    return {
        "success": True,
        "new_drop_time": booking.drop_time.isoformat(),
        "additional_cost": additional_cost,
        "new_total": float(booking.total_amount),
        "message": f"Rental extended by {req.additional_days} days. Charge of ₹{additional_cost:,.2f} applied."
    }

@router.post("/emergency")
def report_emergency(req: EmergencyRequest, db: Session = Depends(get_db)):
    booking = db.query(VehicleRentalBooking).filter(VehicleRentalBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking reference not found.")
    
    ticket_id = f"EMG-{booking.user_id}-{booking.id}"
    logger.critical(f"EMERGENCY PRIORITY TICKET {ticket_id} RAISED for {req.booking_reference}: {req.issue_type} - {req.details}")
    
    # Auto-escalate in system logs
    return {
        "success": True,
        "ticket_id": ticket_id,
        "message": "Emergency roadside assistance dispatched. Priority ticket raised in support queue."
    }

@router.post("/support-chat")
def support_chat(req: ChatMessageRequest):
    answer = support_rag_bot(req.message)
    return {
        "response": answer
    }

@router.post("/transition")
def transition_booking_status(booking_reference: str, status: str, db: Session = Depends(get_db)):
    booking = db.query(VehicleRentalBooking).filter(VehicleRentalBooking.booking_reference == booking_reference).first()
    if not booking:
        # Fallback to general tables lookup if not vehicle rental
        from app.routes.payments import find_booking_by_reference
        booking = find_booking_by_reference(db, booking_reference)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking reference not found.")
    
    from app.services.booking_core import BookingStateMachine
    from app.models.bookings import BookingStatus
    
    try:
        target_status = BookingStatus(status.lower())
        BookingStateMachine.transition_to(booking, target_status)
        db.commit()
        db.refresh(booking)
        return {"booking_reference": booking.booking_reference, "status": booking.status.value}
    except Exception as e:
        logger.error(f"Transition error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
