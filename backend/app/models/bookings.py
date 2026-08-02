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
    EXPIRED = "expired"

class BookingMixin:
    """Common columns shared across all booking verticals"""
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_reference: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.HOLD, index=True, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
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
    airline_code: Mapped[str] = mapped_column(String(10), nullable=False)
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

    provider_name: Mapped[str] = mapped_column(String(100), nullable=False) # Uber, Ola, local
    cab_type: Mapped[str] = mapped_column(String(50), nullable=False) # Sedan, SUV
    pickup_address: Mapped[str] = mapped_column(String(500), nullable=False)
    drop_address: Mapped[str] = mapped_column(String(500), nullable=False)
    pickup_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)


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



