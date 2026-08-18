import datetime
from typing import Optional
from enum import Enum as PyEnum
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, Enum, JSON, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class BookingStatus(PyEnum):
    HOLD = "hold"
    PENDING_APPROVAL = "pending_approval"
    PENDING_ADMIN_APPROVAL = "pending_admin_approval"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"
    COMPLETED = "completed"
    REFUND_INITIATED = "refund_initiated"
    REFUNDED = "refunded"
    REJECTED = "rejected"
    CANCELLATION_REQUEST_SENT = "cancellation_request_sent"
    REFUND_REQUEST_SENT = "refund_request_sent"
    PAYMENT_PENDING = "payment_pending"
    PAYMENT_CONFIRMED = "payment_confirmed"
    PAYMENT_FAILED = "payment_failed"
    VEHICLE_HANDED_OVER = "vehicle_handed_over"
    TRIP_ACTIVE = "trip_active"
    RETURNED = "returned"
    OFFER_SELECTED = "offer_selected"
    AWAITING_HUMAN_PAYMENT_APPROVAL = "awaiting_human_payment_approval"
    PAYMENT_PROCESSING = "payment_processing"
    PAYMENT_CAPTURED_PROVIDER_PENDING = "payment_captured_provider_pending"
    EXPIRED = "expired"

class BookingMixin:
    """Common columns shared across all booking verticals"""
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)
    version_id: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    booking_reference: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.HOLD, index=True, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR")

    __mapper_args__ = {
        "version_id_col": version_id
    }
    pricing_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)  # Breakdown: base, taxes, fees, discount
    cancellation_policy_ref: Mapped[str] = mapped_column(String(255), nullable=True)
    held_until: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True) # Checkout hold TTL timer
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    linked_booking_reference: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)



class FlightBooking(Base, BookingMixin):
    __tablename__ = "flight_bookings"

    origin: Mapped[str] = mapped_column(String(10), nullable=False) # IATA code
    destination: Mapped[str] = mapped_column(String(10), nullable=False)
    departure_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    arrival_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    airline_code: Mapped[str] = mapped_column(String(50), nullable=False)
    flight_number: Mapped[str] = mapped_column(String(20), nullable=False)
    cabin_class: Mapped[str] = mapped_column(String(50), default="ECONOMY") # ECONOMY, BUSINESS, FIRST
    passenger_details: Mapped[list] = mapped_column(JSON, nullable=False) # JSON list of names, passport, age


class HotelBooking(Base, BookingMixin):
    __tablename__ = "hotel_bookings"

    hotel_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hotel_id: Mapped[str] = mapped_column(String(100), nullable=False)
    check_in: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    check_out: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    room_type: Mapped[str] = mapped_column(String(100), nullable=False)
    guest_details: Mapped[list] = mapped_column(JSON, nullable=False) # names, ages
    address: Mapped[str] = mapped_column(String(500), nullable=True)


class TrainBooking(Base, BookingMixin):
    __tablename__ = "train_bookings"

    train_number: Mapped[str] = mapped_column(String(20), nullable=False)
    train_name: Mapped[str] = mapped_column(String(100), nullable=False)
    origin_station: Mapped[str] = mapped_column(String(100), nullable=False)
    destination_station: Mapped[str] = mapped_column(String(100), nullable=False)
    departure_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    coach_class: Mapped[str] = mapped_column(String(20), nullable=False) # 1A, 2A, 3A, SL
    passenger_details: Mapped[list] = mapped_column(JSON, nullable=False)


class BusBooking(Base, BookingMixin):
    __tablename__ = "bus_bookings"

    operator_name: Mapped[str] = mapped_column(String(100), nullable=False)
    bus_type: Mapped[str] = mapped_column(String(50), nullable=False) # AC Sleeper, Seater
    origin: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    departure_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    seat_numbers: Mapped[list] = mapped_column(JSON, nullable=False)


class CabBooking(Base, BookingMixin):
    __tablename__ = "cab_bookings"

    provider_name: Mapped[str] = mapped_column(String(100), nullable=False) # Uber, Ola, local, Ghumne Chale Fleet
    cab_type: Mapped[str] = mapped_column(String(50), nullable=False) # Hatchback, Sedan, SUV, MPV, Luxury, EV, Bike
    pickup_address: Mapped[str] = mapped_column(String(500), nullable=False)
    drop_address: Mapped[str] = mapped_column(String(500), nullable=False)
    pickup_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    trip_type: Mapped[Optional[str]] = mapped_column(String(50), default="one_way") # one_way, round_trip, airport_transfer, hourly
    return_time: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    flight_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    terminal: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    hourly_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    passengers_count: Mapped[int] = mapped_column(Integer, default=1)
    passenger_details: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    luggage_count: Mapped[int] = mapped_column(Integer, default=1)
    special_instructions: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    driver_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    driver_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    vehicle_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    distance_km: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    estimated_duration_mins: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    voucher_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class HolidayPackageBooking(Base, BookingMixin):
    __tablename__ = "holiday_package_bookings"

    package_name: Mapped[str] = mapped_column(String(255), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[datetime.date] = mapped_column(DateTime, nullable=False)
    end_date: Mapped[datetime.date] = mapped_column(DateTime, nullable=False)
    itinerary_summary: Mapped[str] = mapped_column(String(2000), nullable=True)
    included_services: Mapped[dict] = mapped_column(JSON, nullable=False) # flights, hotels, activities details


class ActivityBooking(Base, BookingMixin):
    __tablename__ = "activity_bookings"

    activity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    activity_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    ticket_count: Mapped[int] = mapped_column(Integer, default=1)
    details: Mapped[dict] = mapped_column(JSON, nullable=True)


class CruiseBooking(Base, BookingMixin):
    __tablename__ = "cruise_bookings"

    cruise_line: Mapped[str] = mapped_column(String(100), nullable=False)
    ship_name: Mapped[str] = mapped_column(String(100), nullable=False)
    departure_port: Mapped[str] = mapped_column(String(100), nullable=False)
    arrival_port: Mapped[str] = mapped_column(String(100), nullable=False)
    departure_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    cabin_number: Mapped[str] = mapped_column(String(20), nullable=False)


class VisaApplication(Base, BookingMixin):
    __tablename__ = "visa_applications"

    country: Mapped[str] = mapped_column(String(100), nullable=False)
    visa_type: Mapped[str] = mapped_column(String(50), nullable=False) # Tourist, Business
    applicant_details: Mapped[dict] = mapped_column(JSON, nullable=False)
    submission_date: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    status_notes: Mapped[str] = mapped_column(String(500), nullable=True)


class InsurancePolicy(Base, BookingMixin):
    __tablename__ = "insurance_policies"

    provider_name: Mapped[str] = mapped_column(String(100), nullable=False)
    policy_name: Mapped[str] = mapped_column(String(100), nullable=False)
    policy_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    coverage_details: Mapped[dict] = mapped_column(JSON, nullable=False)
    start_date: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    end_date: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)


class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    booking_reference: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False) # failed, succeeded
    failure_reason: Mapped[str] = mapped_column(String(255), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class PriceDropClaim(Base):
    __tablename__ = "price_drop_claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_reference: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    original_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    checked_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    refund_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="processed") # processed, manual_review, disputed
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class VillaBooking(Base, BookingMixin):
    __tablename__ = "villa_bookings"

    villa_name: Mapped[str] = mapped_column(String(255), nullable=False)
    bedrooms: Mapped[int] = mapped_column(Integer, nullable=False)
    max_occupancy: Mapped[int] = mapped_column(Integer, nullable=False)
    host_id: Mapped[str] = mapped_column(String(100), nullable=False)
    house_rules: Mapped[str] = mapped_column(String(1000), nullable=True)
    amenities_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    check_in: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    check_out: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)


class ForexOrder(Base, BookingMixin):
    __tablename__ = "forex_orders"

    currency_pair: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    rate_locked_at_order: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    delivery_mode: Mapped[str] = mapped_column(String(50), nullable=False) # Home Delivery, Branch Pickup
    kyc_ref: Mapped[str] = mapped_column(String(100), nullable=False)


class VehicleRentalBooking(Base, BookingMixin):
    __tablename__ = "vehicle_rental_bookings"

    city: Mapped[str] = mapped_column(String(100), nullable=False)
    pickup_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    drop_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    vehicle_name: Mapped[str] = mapped_column(String(255), nullable=False)
    vehicle_type: Mapped[str] = mapped_column(String(50), nullable=False) # Hatchback, Sedan, SUV, Bike, EV
    self_drive: Mapped[bool] = mapped_column(Boolean, default=True)
    fuel_type: Mapped[str] = mapped_column(String(50), nullable=True) # Petrol, Diesel, EV
    transmission: Mapped[str] = mapped_column(String(50), nullable=True) # Manual, Automatic
    kyc_ref: Mapped[str] = mapped_column(String(100), nullable=True)
    pickup_lat: Mapped[float] = mapped_column(Float, nullable=True)
    pickup_lng: Mapped[float] = mapped_column(Float, nullable=True)
    qr_handover_code: Mapped[str] = mapped_column(String(100), nullable=True)


class BookingEvent(Base):
    __tablename__ = "booking_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_reference: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False) # hold, cancellation, schedule_change
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class BookingTicket(Base):
    __tablename__ = "booking_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_reference: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    ticket_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    pnr: Mapped[str] = mapped_column(String(20), nullable=True)
    qr_code_data: Mapped[str] = mapped_column(String(500), nullable=True)
    pdf_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    passenger_details: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    extra_info: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class BookingInvoice(Base):
    __tablename__ = "booking_invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_reference: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    gst_number: Mapped[str] = mapped_column(String(50), default="07TRVOS9921A1Z0", nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), default="razorpay", nullable=False)
    base_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    final_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    wallet_used: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    coupon_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class SpecialFareConfig(Base):
    __tablename__ = "special_fare_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    fare_type: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False) # e.g. regular, student, senior, armed_forces
    discount_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    minimum_age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    maximum_age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    verification_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    valid_from: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    valid_until: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)


class ProviderReconciliation(Base):
    __tablename__ = "provider_reconciliations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    provider_offer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_id: Mapped[str] = mapped_column(String(100), nullable=False)
    booking_reference: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    failure_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50), default="PENDING_MANUAL_REVIEW")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class SeatHold(Base):
    __tablename__ = "seat_holds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    booking_reference: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    vertical: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # flights, trains, buses
    reference: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # flight_number, train_number, bus operator
    seat_number: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="HELD", index=True, nullable=False) # HELD, EXPIRED, CONFIRMED, RELEASED
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    seat_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    price: Mapped[Optional[float]] = mapped_column(Float, default=0.0, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

