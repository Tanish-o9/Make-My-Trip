import datetime
import uuid
import asyncio
from typing import Dict, Any, List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.bookings import (
    BookingStatus, FlightBooking, HotelBooking, TrainBooking, BusBooking,
    CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication,
    CruiseBooking, InsurancePolicy, VillaBooking, ForexOrder, PaymentAttempt,
    VehicleRentalBooking, BookingEvent
)
from app.services.booking_core import BookingStateMachine, CancellationPolicyEngine, InvoiceGenerator
from app.services.wallet_loyalty import WalletService
from app.utils.event_bus import emit_event
from app.models.mybiz import EmployeeLink, Organization
from app.providers.registry import provider_registry

from pydantic import BaseModel

class BookingHoldRequest(BaseModel):
    vertical: str
    amount: float
    user_id: int
    details: Dict[str, Any]

from app.auth.dependencies import get_current_user
from app.models.core import User

router = APIRouter(prefix="/bookings", tags=["bookings"])

@router.post("/hold")
async def create_booking_hold(
    req: BookingHoldRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Creates a temporary hold on any of the 12 booking verticals before payment capture"""
    vertical = req.vertical.lower()
    amount = req.amount
    user_id = current_user.id
    details = req.details

    booking_ref = f"BK-{uuid.uuid4().hex[:8].upper()}"
    
    # Check if a provider is configured and place hold first
    provider_name = details.get("provider_name")
    provider = provider_registry.get_provider(vertical, provider_name) if provider_name else None
    
    hold_id = None
    hold_ttl_minutes = 60
    if provider:
        hold_ttl_minutes = 5
        try:
            passengers = details.get("passengers", details.get("guests", [{"name": "Guest User", "age": 30}]))
            hold_res = await provider.hold(details.get("offer_id", ""), passengers)
            if not hold_res.get("success"):
                raise HTTPException(status_code=400, detail=f"Failed to place hold with {provider_name}: {hold_res.get('message', 'Unknown error')}")
            hold_id = hold_res.get("hold_id")
            details["provider_hold_id"] = hold_id
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Provider hold execution error: {str(e)}")
    
    if not provider:
        if vertical in ["cabs", "trains", "forex"]:
            hold_ttl_minutes = 10
        elif vertical in ["villas", "cruises", "holidays"]:
            hold_ttl_minutes = 120  # High consideration
        else:
            hold_ttl_minutes = 60
        
    held_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=hold_ttl_minutes)

    pricing_snapshot = {
        "base_fare": amount * 0.85,
        "tax": amount * 0.15,
        "discount": 0.0
    }

    if vertical == "flights":
        booking = FlightBooking(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            origin=details.get("origin", "DEL"), destination=details.get("destination", "GOI"),
            departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=7),
            arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=7, hours=2),
            airline_code=details.get("airline_code", "6E"), flight_number=details.get("flight_number", "502"),
            cabin_class=details.get("cabin_class", "ECONOMY"), passenger_details=details.get("passengers", [{"name": "Guest", "age": 30}])
        )
    elif vertical == "hotels":
        booking = HotelBooking(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            hotel_name=details.get("hotel_name", "Grand Hyatt Resort"), hotel_id=details.get("hotel_id", "H101"),
            check_in=datetime.datetime.utcnow() + datetime.timedelta(days=5),
            check_out=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            room_type=details.get("room_type", "Deluxe Room"), guest_details=details.get("guests", [{"name": "Guest", "age": 30}]),
            address=details.get("address", "Goa Beachfront")
        )
    elif vertical == "villas":
        booking = VillaBooking(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            villa_name=details.get("villa_name", "Oceanview Villa"), bedrooms=int(details.get("bedrooms", 3)),
            max_occupancy=int(details.get("max_occupancy", 6)), host_id=details.get("host_id", "host_992"),
            house_rules=details.get("house_rules", "No smoking, no parties"),
            amenities_json=details.get("amenities", ["Pool", "WiFi"]),
            check_in=datetime.datetime.utcnow() + datetime.timedelta(days=5),
            check_out=datetime.datetime.utcnow() + datetime.timedelta(days=10)
        )
    elif vertical == "holidays":
        booking = HolidayPackageBooking(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            package_name=details.get("package_name", "Goa Beach Getaway"), destination=details.get("destination", "Goa"),
            start_date=datetime.date.today() + datetime.timedelta(days=10),
            end_date=datetime.date.today() + datetime.timedelta(days=14),
            itinerary_summary=details.get("itinerary_summary", "Goa stay, flights & local sightseeing package."),
            included_services=details.get("included_services", {"hotel": True, "flights": True})
        )
    elif vertical == "trains":
        booking = TrainBooking(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            train_number=details.get("train_number", "12626"), train_name=details.get("train_name", "Kerala Express"),
            origin_station=details.get("origin_station", "DEL"), destination_station=details.get("destination_station", "GOA"),
            departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=7),
            coach_class=details.get("coach_class", "3A"), passenger_details=details.get("passengers", [])
        )
    elif vertical == "buses":
        booking = BusBooking(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            operator_name=details.get("operator_name", "IntrCity SmartBus"), bus_type=details.get("bus_type", "AC Sleeper"),
            origin=details.get("origin", "Delhi"), destination=details.get("destination", "Jaipur"),
            departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=2),
            seat_numbers=details.get("seat_numbers", ["12A"])
        )
    elif vertical == "cabs":
        booking = CabBooking(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            provider_name=details.get("provider_name", "Ola"), cab_type=details.get("cab_type", "SUV"),
            pickup_address=details.get("pickup_address", "Airport"), drop_address=details.get("drop_address", "Resort"),
            pickup_time=datetime.datetime.utcnow() + datetime.timedelta(days=3)
        )
    elif vertical == "tours":
        booking = ActivityBooking(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            activity_name=details.get("activity_name", "Scuba Diving Adventure"),
            location=details.get("location", "Grand Island Goa"),
            activity_time=datetime.datetime.utcnow() + datetime.timedelta(days=4),
            ticket_count=int(details.get("ticket_count", 2)), details=details
        )
    elif vertical == "visa":
        booking = VisaApplication(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            country=details.get("country", "France"), visa_type=details.get("visa_type", "Tourist"),
            applicant_details=details
        )
    elif vertical == "cruises":
        booking = CruiseBooking(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            cruise_line=details.get("cruise_line", "Royal Caribbean"), ship_name=details.get("ship_name", "Spectrum"),
            departure_port=details.get("departure_port", "Singapore"), arrival_port=details.get("arrival_port", "Penang"),
            departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=30), duration_days=int(details.get("duration_days", 5)),
            cabin_number=details.get("cabin_number", "D-204")
        )
    elif vertical == "forex":
        booking = ForexOrder(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            currency_pair=details.get("currency_pair", "USD_INR"), amount=float(details.get("amount", 1000.0)),
            rate_locked_at_order=float(details.get("rate_locked_at_order", 84.50)),
            delivery_mode=details.get("delivery_mode", "Home Delivery"), kyc_ref=details.get("kyc_ref", "KYC-88219")
        )
    elif vertical == "insurance":
        booking = InsurancePolicy(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            provider_name=details.get("provider_name", "Tata AIG"), policy_name=details.get("policy_name", "Travel Guard Gold"),
            policy_number=f"POL-{uuid.uuid4().hex[:10].upper()}", coverage_details=details,
            start_date=datetime.datetime.utcnow() + datetime.timedelta(days=2),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=12)
        )
    elif vertical in ["rent-a-ride", "vehicle_rental"]:
        booking = VehicleRentalBooking(
            booking_reference=booking_ref, user_id=user_id, status=BookingStatus.HOLD,
            total_amount=amount, currency="INR", pricing_snapshot=pricing_snapshot, held_until=held_until,
            city=details.get("city", details.get("destination", "Goa")),
            pickup_time=datetime.datetime.fromisoformat(details.get("pickup_time").replace("Z", "")) if isinstance(details.get("pickup_time"), str) else datetime.datetime.utcnow() + datetime.timedelta(days=3),
            drop_time=datetime.datetime.fromisoformat(details.get("drop_time").replace("Z", "")) if isinstance(details.get("drop_time"), str) else datetime.datetime.utcnow() + datetime.timedelta(days=5),
            vehicle_name=details.get("vehicle_name", "Honda City"),
            vehicle_type=details.get("vehicle_type", "Sedan"),
            self_drive=details.get("self_drive", True),
            fuel_type=details.get("fuel_type", "Petrol"),
            transmission=details.get("transmission", "Automatic"),
            kyc_ref=details.get("kyc_ref"),
            pickup_lat=details.get("pickup_lat", 15.4989),
            pickup_lng=details.get("pickup_lng", 73.8278),
            qr_handover_code=f"QR-{uuid.uuid4().hex[:6].upper()}",
            linked_booking_reference=details.get("linked_booking_reference")
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid booking vertical specified.")

    db.add(booking)
    db.commit()
    
    if provider_name:
        event = BookingEvent(
            booking_reference=booking.booking_reference,
            event_type="hold",
            description=f"Autonomous hold placed successfully with provider {provider_name}. Hold ID: {details.get('provider_hold_id')}."
        )
        db.add(event)
        db.commit()

    db.refresh(booking)

    return {
        "booking_reference": booking.booking_reference,
        "status": booking.status.value,
        "held_until": booking.held_until,
        "total_amount": float(booking.total_amount)
    }


@router.post("/confirm")
def confirm_booking(
    booking_reference: str,
    vertical: str,
    payment_method: str = "wallet",
    card_number: str = None,
    db: Session = Depends(get_db)
):
    """Captures payment and transitions booking from HOLD to CONFIRMED"""
    models_mapping = {
        "flights": FlightBooking, "hotels": HotelBooking, "trains": TrainBooking,
        "cabs": CabBooking, "visa": VisaApplication, "holidays": HolidayPackageBooking,
        "buses": BusBooking, "tours": ActivityBooking, "cruises": CruiseBooking,
        "insurance": InsurancePolicy, "villas": VillaBooking, "forex": ForexOrder,
        "rent-a-ride": VehicleRentalBooking, "vehicle_rental": VehicleRentalBooking
    }
    
    model_cls = models_mapping.get(vertical.lower())
    if not model_cls:
        raise HTTPException(status_code=400, detail="Invalid vertical.")

    booking = db.query(model_cls).filter(model_cls.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking reference not found.")

    if booking.status != BookingStatus.HOLD:
        raise HTTPException(status_code=400, detail="Booking is not on hold status.")

    # 1. Villa Host Confirmation Approval Path
    if vertical.lower() == "villas":
        # Simulate host approval flag
        requires_host_approval = True
        if requires_host_approval:
            # Debit wallet if payment method is wallet
            if payment_method == "wallet":
                amount_dec = Decimal(str(booking.total_amount))
                WalletService.debit_for_booking(
                    db, 
                    user_id=booking.user_id, 
                    amount=amount_dec, 
                    booking_ref=booking.booking_reference
                )
                # Log wallet attempt
                pay_log = PaymentAttempt(
                    user_id=booking.user_id,
                    booking_reference=booking.booking_reference,
                    status="authorized",
                    amount=booking.total_amount
                )
                db.add(pay_log)
                
                # Add Ledger Row
                from app.models.payments import LedgerRow
                ledger_wallet = LedgerRow(
                    booking_reference=booking.booking_reference,
                    amount=float(booking.total_amount),
                    transaction_type="wallet_debit",
                    entry_type="debit",
                    description="Wallet hold for villa host confirmation"
                )
                db.add(ledger_wallet)

            BookingStateMachine.transition_to(booking, BookingStatus.PENDING_APPROVAL)
            db.commit()

            # Create ApprovalRequest ticket
            from app.models.payments import ApprovalRequest
            from app.routes.payments import get_vertical_sla_minutes
            sla_minutes = get_vertical_sla_minutes(vertical)
            approval = ApprovalRequest(
                request_type="new_booking",
                reference_id=booking.booking_reference,
                requested_by=f"user_{booking.user_id}",
                amount=float(booking.total_amount),
                reason="Villa booking requires host confirmation.",
                status="PENDING",
                payment_gateway=None,
                payment_charge_id=None,
                sla_expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=sla_minutes),
                is_sla_breached=False,
                timeout_behavior="auto_reject",
                assigned_role="Booking Approver"
            )
            db.add(approval)
            db.commit()

            emit_event("villa_host_approval_request", {
                "user_id": booking.user_id,
                "booking_reference": booking.booking_reference
            })
            return {
                "booking_reference": booking.booking_reference,
                "status": booking.status.value,
                "message": "Villa booking requires host confirmation. Host approval requested."
            }

    # 2. Corporate Travel myBiz Policy Check
    employee = db.query(EmployeeLink).filter(EmployeeLink.user_id == booking.user_id).first()
    if employee and payment_method == "corporate_billing":
        org = db.query(Organization).filter(Organization.id == employee.org_id).first()
        if org:
            limit = float(org.per_diem_limit)
            amount = float(booking.total_amount)
            if amount > limit:
                BookingStateMachine.transition_to(booking, BookingStatus.PENDING_APPROVAL)
                db.commit()

                # Create ApprovalRequest ticket
                from app.models.payments import ApprovalRequest
                from app.routes.payments import get_vertical_sla_minutes
                sla_minutes = get_vertical_sla_minutes(vertical)
                approval = ApprovalRequest(
                    request_type="new_booking",
                    reference_id=booking.booking_reference,
                    requested_by=f"user_{booking.user_id}",
                    amount=float(booking.total_amount),
                    reason=f"myBiz Corporate Billing limit check: budget threshold of ₹{limit} exceeded. Awaiting manager approval.",
                    status="PENDING",
                    payment_gateway=None,
                    payment_charge_id=None,
                    sla_expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=sla_minutes),
                    is_sla_breached=False,
                    timeout_behavior="auto_reject",
                    assigned_role="Booking Approver"
                )
                db.add(approval)
                db.commit()

                emit_event("mybiz_approval_request", {
                    "user_id": booking.user_id,
                    "booking_reference": booking.booking_reference,
                    "amount": amount
                })
                return {
                    "booking_reference": booking.booking_reference,
                    "status": booking.status.value,
                    "message": f"Travel budget threshold of ₹{limit} exceeded. Awaiting manager approval."
                }

    # 3. Regular Wallet Deductions
    amount_dec = Decimal(str(booking.total_amount))
    try:
        if payment_method == "wallet":
            WalletService.debit_for_booking(
                db, 
                user_id=booking.user_id, 
                amount=amount_dec, 
                booking_ref=booking.booking_reference
            )
        
        pay_log = PaymentAttempt(
            user_id=booking.user_id,
            booking_reference=booking.booking_reference,
            status="succeeded",
            amount=booking.total_amount
        )
        db.add(pay_log)
        
        BookingStateMachine.transition_to(booking, BookingStatus.CONFIRMED)
        db.commit()

        emit_event("booking_confirmed", {
            "user_id": booking.user_id,
            "booking_reference": booking.booking_reference,
            "amount": float(booking.total_amount)
        })

    except Exception as e:
        pay_log = PaymentAttempt(
            user_id=booking.user_id,
            booking_reference=booking.booking_reference,
            status="failed",
            failure_reason=str(e),
            amount=booking.total_amount
        )
        db.add(pay_log)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Checkout failed: {str(e)}")

    return {
        "booking_reference": booking.booking_reference,
        "status": booking.status.value,
        "message": "Payment captured and reservation locked successfully."
    }


@router.post("/cancel")
def cancel_booking(
    booking_reference: str,
    vertical: str,
    refund_to: str = "wallet",
    is_goodwill: bool = False,
    custom_amount: float = None,
    action_type: str = "cancel",
    db: Session = Depends(get_db)
):
    """Calculates refund policies and cancels any booking vertical using RefundManager"""
    models_mapping = {
        "flights": FlightBooking, "hotels": HotelBooking, "trains": TrainBooking,
        "cabs": CabBooking, "visa": VisaApplication, "holidays": HolidayPackageBooking,
        "buses": BusBooking, "tours": ActivityBooking, "cruises": CruiseBooking,
        "insurance": InsurancePolicy, "villas": VillaBooking, "forex": ForexOrder
    }
    
    model_cls = models_mapping.get(vertical.lower())
    if not model_cls:
        raise HTTPException(status_code=400, detail="Invalid vertical.")
 
    booking = db.query(model_cls).filter(model_cls.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking reference not found.")
 
    if booking.status not in [BookingStatus.CONFIRMED, BookingStatus.PENDING_APPROVAL, BookingStatus.CANCELLATION_REQUEST_SENT, BookingStatus.REFUND_REQUEST_SENT]:
        raise HTTPException(status_code=400, detail="Only active reservations can be cancelled or refunded.")
 
    from app.services.refund_manager import RefundManager
    res = RefundManager.initiate_refund(
        db=db,
        booking=booking,
        vertical=vertical,
        refund_to=refund_to,
        is_goodwill=is_goodwill,
        custom_amount=custom_amount,
        action_type=action_type
    )
    return res


@router.get("/{booking_reference}/invoice")
def get_booking_invoice(
    booking_reference: str,
    vertical: str,
    db: Session = Depends(get_db)
):
    """Retrieves and generates itemized receipt summary invoice"""
    models_mapping = {
        "flights": FlightBooking, "hotels": HotelBooking, "trains": TrainBooking,
        "cabs": CabBooking, "visa": VisaApplication, "holidays": HolidayPackageBooking,
        "buses": BusBooking, "tours": ActivityBooking, "cruises": CruiseBooking,
        "insurance": InsurancePolicy, "villas": VillaBooking, "forex": ForexOrder,
        "rent-a-ride": VehicleRentalBooking, "vehicle_rental": VehicleRentalBooking
    }
    
    model_cls = models_mapping.get(vertical.lower())
    if not model_cls:
        raise HTTPException(status_code=400, detail="Invalid vertical.")

    booking = db.query(model_cls).filter(model_cls.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking reference not found.")

    desc = "Travel Booking"
    if vertical == "flights":
        desc = f"Flight Tickets {booking.airline_code}-{booking.flight_number}"
    elif vertical == "hotels":
        desc = f"Hotel Booking: {booking.hotel_name} ({booking.room_type})"
    elif vertical == "trains":
        desc = f"Train Tickets - Coach Class {booking.coach_class}"
    elif vertical == "cabs":
        desc = f"Local Cab Route ({booking.cab_type})"
    elif vertical == "visa":
        desc = f"Embassy Visa Processing - {booking.country}"
    elif vertical == "holidays":
        desc = f"Holiday Package: {booking.package_name}"
    elif vertical == "buses":
        desc = f"Bus Seat booking - {booking.operator_name}"
    elif vertical == "tours":
        desc = f"Activity Tickets: {booking.activity_name}"
    elif vertical == "cruises":
        desc = f"Cruise Cabin {booking.cabin_number} - {booking.ship_name}"
    elif vertical == "insurance":
        desc = f"Travel Policy Premium: {booking.policy_name}"
    elif vertical == "villas":
        desc = f"Villa Rental: {booking.villa_name}"
    elif vertical == "forex":
        desc = f"Forex exchange currency order ({booking.currency_pair})"
    elif vertical in ["rent-a-ride", "vehicle_rental"]:
        desc = f"Vehicle Rental: {booking.vehicle_name} ({booking.vehicle_type})"

    items = [
        {"name": desc, "price": float(booking.total_amount) * 0.85},
        {"name": "Tax & Processing Fees (GST)", "price": float(booking.total_amount) * 0.15}
    ]

    receipt = InvoiceGenerator.generate_invoice(booking, items)
    return {"invoice_text": receipt}


@router.get("/user/{user_id}")
def get_user_bookings(user_id: int, db: Session = Depends(get_db)):
    """Consolidates booking records across all 12 verticals for travel dashboard"""
    results = []
    
    models_mapping = {
        "flights": FlightBooking,
        "hotels": HotelBooking,
        "trains": TrainBooking,
        "cabs": CabBooking,
        "visa": VisaApplication,
        "holidays": HolidayPackageBooking,
        "buses": BusBooking,
        "tours": ActivityBooking,
        "cruises": CruiseBooking,
        "insurance": InsurancePolicy,
        "villas": VillaBooking,
        "forex": ForexOrder,
        "rent-a-ride": VehicleRentalBooking,
        "vehicle_rental": VehicleRentalBooking
    }
    
    for vertical, model_cls in models_mapping.items():
        bookings = db.query(model_cls).filter(model_cls.user_id == user_id).all()
        for b in bookings:
            details = {
                "booking_reference": b.booking_reference,
                "vertical": vertical,
                "status": b.status.value if hasattr(b.status, "value") else b.status,
                "total_amount": float(b.total_amount),
                "currency": b.currency,
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "held_until": b.held_until.isoformat() if b.held_until else None,
            }
            if vertical == "flights":
                details.update({
                    "title": f"Flight {b.airline_code}-{b.flight_number}",
                    "subtitle": f"{b.origin} ➔ {b.destination}",
                    "date": b.departure_time.strftime("%Y-%m-%d") if b.departure_time else None
                })
            elif vertical == "hotels":
                details.update({
                    "title": b.hotel_name,
                    "subtitle": f"Room: {b.room_type}",
                    "date": b.check_in.strftime("%Y-%m-%d") if b.check_in else None
                })
            elif vertical == "trains":
                details.update({
                    "title": f"Train {b.train_number} - {b.train_name}",
                    "subtitle": f"{b.origin_station} ➔ {b.destination_station}",
                    "date": b.departure_time.strftime("%Y-%m-%d") if b.departure_time else None
                })
            elif vertical == "cabs":
                details.update({
                    "title": f"{b.provider_name} ({b.cab_type})",
                    "subtitle": f"{b.pickup_address} ➔ {b.drop_address}",
                    "date": b.pickup_time.strftime("%Y-%m-%d") if b.pickup_time else None
                })
            elif vertical == "visa":
                details.update({
                    "title": f"Visa Application: {b.country}",
                    "subtitle": f"Type: {b.visa_type}",
                    "date": b.created_at.strftime("%Y-%m-%d") if b.created_at else None
                })
            elif vertical == "holidays":
                details.update({
                    "title": b.package_name,
                    "subtitle": f"Destination: {b.destination}",
                    "date": b.start_date.strftime("%Y-%m-%d") if b.start_date else None
                })
            elif vertical == "buses":
                details.update({
                    "title": f"{b.operator_name} ({b.bus_type})",
                    "subtitle": f"{b.origin} ➔ {b.destination}",
                    "date": b.departure_time.strftime("%Y-%m-%d") if b.departure_time else None
                })
            elif vertical == "tours":
                details.update({
                    "title": b.activity_name,
                    "subtitle": b.location,
                    "date": b.activity_time.strftime("%Y-%m-%d") if b.activity_time else None
                })
            elif vertical == "cruises":
                details.update({
                    "title": f"{b.cruise_line} - {b.ship_name}",
                    "subtitle": f"{b.departure_port} ➔ {b.arrival_port}",
                    "date": b.departure_time.strftime("%Y-%m-%d") if b.departure_time else None
                })
            elif vertical == "insurance":
                details.update({
                    "title": f"Insurance Policy: {b.policy_name}",
                    "subtitle": f"Provider: {b.provider_name} (No: {b.policy_number})",
                    "date": b.start_date.strftime("%Y-%m-%d") if b.start_date else None
                })
            elif vertical == "villas":
                details.update({
                    "title": b.villa_name,
                    "subtitle": f"{b.bedrooms} Bedrooms, Max occupancy {b.max_occupancy}",
                    "date": b.check_in.strftime("%Y-%m-%d") if b.check_in else None
                })
            elif vertical == "forex":
                details.update({
                    "title": f"Forex Currency Order ({b.currency_pair})",
                    "subtitle": f"Lock Rate: {b.rate_locked_at_order} | Mode: {b.delivery_mode}",
                    "date": b.created_at.strftime("%Y-%m-%d") if b.created_at else None
                })
            elif vertical in ["rent-a-ride", "vehicle_rental"]:
                details.update({
                    "title": f"Vehicle Rental: {b.vehicle_name}",
                    "subtitle": f"{b.vehicle_type} | {'Self Drive' if b.self_drive else 'With Chauffeur'} | City: {b.city}",
                    "date": b.pickup_time.strftime("%Y-%m-%d") if b.pickup_time else None,
                    "self_drive": b.self_drive,
                    "pickup_time": b.pickup_time.isoformat() if b.pickup_time else None,
                    "drop_time": b.drop_time.isoformat() if b.drop_time else None,
                    "qr_handover_code": b.qr_handover_code,
                    "fuel_type": b.fuel_type,
                    "transmission": b.transmission,
                    "kyc_ref": b.kyc_ref,
                    "pickup_lat": b.pickup_lat,
                    "pickup_lng": b.pickup_lng,
                    "linked_booking_reference": b.linked_booking_reference
                })
            results.append(details)
            
    results.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return results


@router.get("/details/{booking_reference}")
def get_booking_details(booking_reference: str, db: Session = Depends(get_db)):
    """Retrieves full details of a specific booking across all 13 verticals"""
    models_mapping = {
        "flights": FlightBooking, "hotels": HotelBooking, "trains": TrainBooking,
        "cabs": CabBooking, "visa": VisaApplication, "holidays": HolidayPackageBooking,
        "buses": BusBooking, "tours": ActivityBooking, "cruises": CruiseBooking,
        "insurance": InsurancePolicy, "villas": VillaBooking, "forex": ForexOrder,
        "rent-a-ride": VehicleRentalBooking, "vehicle_rental": VehicleRentalBooking
    }
    
    booking = None
    vertical_name = None
    for name, model_cls in models_mapping.items():
        booking = db.query(model_cls).filter(model_cls.booking_reference == booking_reference).first()
        if booking:
            vertical_name = name
            break
            
    if not booking:
        raise HTTPException(status_code=404, detail="Booking reference not found.")
        
    details = {
        "booking_reference": booking.booking_reference,
        "vertical": vertical_name,
        "status": booking.status.value if hasattr(booking.status, "value") else booking.status,
        "total_amount": float(booking.total_amount),
        "currency": booking.currency,
        "created_at": booking.created_at.isoformat() if booking.created_at else None,
    }
    
    # Extract destination/city and travel dates
    if vertical_name == "flights":
        details.update({
            "destination": booking.destination,
            "origin": booking.origin,
            "start_date": booking.departure_time.date().isoformat() if booking.departure_time else None,
            "end_date": booking.arrival_time.date().isoformat() if booking.arrival_time else None
        })
    elif vertical_name == "hotels":
        details.update({
            "destination": booking.hotel_name,
            "start_date": booking.check_in.date().isoformat() if booking.check_in else None,
            "end_date": booking.check_out.date().isoformat() if booking.check_out else None
        })
    elif vertical_name == "villas":
        details.update({
            "destination": booking.villa_name,
            "start_date": booking.check_in.date().isoformat() if booking.check_in else None,
            "end_date": booking.check_out.date().isoformat() if booking.check_out else None
        })
    elif vertical_name == "holidays":
        details.update({
            "destination": booking.destination,
            "start_date": booking.start_date.isoformat() if booking.start_date else None,
            "end_date": booking.end_date.isoformat() if booking.end_date else None
        })
    elif vertical_name == "trains":
        details.update({
            "destination": booking.destination_station,
            "start_date": booking.departure_time.date().isoformat() if booking.departure_time else None
        })
    elif vertical_name == "buses":
        details.update({
            "destination": booking.destination,
            "start_date": booking.departure_time.date().isoformat() if booking.departure_time else None
        })
    elif vertical_name in ["rent-a-ride", "vehicle_rental"]:
        details.update({
            "destination": booking.city,
            "start_date": booking.pickup_time.date().isoformat() if booking.pickup_time else None,
            "end_date": booking.drop_time.date().isoformat() if booking.drop_time else None
        })
        
    return details


class PaymentApprovalCheckRequest(BaseModel):
    booking_reference: str
    vertical: str

@router.post("/payment-approval-check")
async def check_payment_approval(
    req: PaymentApprovalCheckRequest,
    db: Session = Depends(get_db)
):
    """Checks if a price hold is expired. If expired and provider exists, it auto-refreshes the quote."""
    models_mapping = {
        "flights": FlightBooking, "hotels": HotelBooking, "trains": TrainBooking,
        "cabs": CabBooking, "visa": VisaApplication, "holidays": HolidayPackageBooking,
        "buses": BusBooking, "tours": ActivityBooking, "cruises": CruiseBooking,
        "insurance": InsurancePolicy, "villas": VillaBooking, "forex": ForexOrder,
        "rent-a-ride": VehicleRentalBooking, "vehicle_rental": VehicleRentalBooking
    }
    
    model_cls = models_mapping.get(req.vertical.lower())
    if not model_cls:
        raise HTTPException(status_code=400, detail="Invalid vertical.")

    booking = db.query(model_cls).filter(model_cls.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking reference not found.")

    now = datetime.datetime.utcnow()
    
    # Check if booking is in hold states
    if booking.status not in [BookingStatus.HOLD, BookingStatus.AWAITING_HUMAN_PAYMENT_APPROVAL]:
        return {
            "expired": False,
            "price_changed": False,
            "held_until": booking.held_until.isoformat() if booking.held_until else None,
            "message": f"Booking is not in hold/awaiting state (current: {booking.status.value})."
        }

    is_expired = booking.held_until is not None and now > booking.held_until
    
    # Try to find provider name
    provider_name = None
    if hasattr(booking, "pricing_snapshot") and booking.pricing_snapshot:
        provider_name = booking.pricing_snapshot.get("provider_name")
    
    # If not in pricing_snapshot directly, search through other models
    if not provider_name:
        # Check flight airline or hotel name prefix
        if req.vertical.lower() == "flights":
            provider_name = "Amadeus" # default
        elif req.vertical.lower() == "hotels":
            provider_name = "HotelBeds" # default
        elif req.vertical.lower() in ["rent-a-ride", "vehicle_rental"]:
            provider_name = "FirstPartyFleet"

    provider = provider_registry.get_provider(req.vertical, provider_name) if provider_name else None
    
    if is_expired and provider:
        try:
            old_price = float(booking.total_amount)
            import random
            # Simulate price change (60% probability of 100-300 INR difference, 40% unchanged)
            price_delta = random.choice([0, 0, 150, -100, 200])
            if price_delta != 0:
                new_price = max(100.0, old_price + price_delta)
                booking.total_amount = new_price
                
                # Update snapshot
                snapshot_copy = dict(booking.pricing_snapshot or {})
                snapshot_copy["base_fare"] = new_price * 0.85
                snapshot_copy["tax"] = new_price * 0.15
                booking.pricing_snapshot = snapshot_copy
                
                booking.held_until = now + datetime.timedelta(minutes=5)
                db.commit()
                
                event = BookingEvent(
                    booking_reference=booking.booking_reference,
                    event_type="quote_refresh",
                    description=f"Hold expired. Price refreshed from ₹{old_price} to ₹{new_price}."
                )
                db.add(event)
                db.commit()
                
                return {
                    "expired": True,
                    "price_changed": True,
                    "old_price": old_price,
                    "new_price": new_price,
                    "held_until": booking.held_until.isoformat()
                }
            else:
                booking.held_until = now + datetime.timedelta(minutes=5)
                db.commit()
                
                event = BookingEvent(
                    booking_reference=booking.booking_reference,
                    event_type="quote_refresh",
                    description=f"Hold expired. Price unchanged at ₹{old_price}. Extended hold."
                )
                db.add(event)
                db.commit()
                
                return {
                    "expired": True,
                    "price_changed": False,
                    "held_until": booking.held_until.isoformat()
                }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to refresh hold quote: {str(e)}")
            
    elif is_expired:
        booking.held_until = now + datetime.timedelta(minutes=10)
        db.commit()
        return {
            "expired": True,
            "price_changed": False,
            "held_until": booking.held_until.isoformat()
        }

    return {
        "expired": False,
        "price_changed": False,
        "held_until": booking.held_until.isoformat() if booking.held_until else None
    }
