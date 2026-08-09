import pytest
import hmac
import hashlib
import uuid
import datetime
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.core import User
from app.models.bookings import FlightBooking, HotelBooking, BookingStatus, BookingInvoice, BookingTicket, BookingEvent
from app.models.payments import Payment, PaymentStatus, ProcessedWebhookEvent
from app.auth.dependencies import get_current_user
from app.services.booking_core import BookingStateMachine

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_auth_and_db():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_current_user] = lambda: User(id=1, email="test_delivery@travelos.com", role="user")
    
    with patch("app.payments.config.settings.RAZORPAY_KEY_SECRET", "whsec_razorpay_test_secret"):
        yield
        
    app.dependency_overrides.clear()
    
    db = SessionLocal()
    try:
        from app.models.payments import Payment, PaymentTransaction
        db.query(BookingInvoice).delete()
        db.query(BookingTicket).delete()
        db.query(BookingEvent).delete()
        db.query(PaymentTransaction).delete()
        db.query(ProcessedWebhookEvent).delete()
        db.query(Payment).delete()
        db.query(FlightBooking).delete()
        db.query(HotelBooking).delete()
        db.commit()
    finally:
        db.close()

def get_expected_signature(order_id: str, payment_id: str, secret: str) -> str:
    message = f"{order_id}|{payment_id}"
    return hmac.new(
        secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

def test_payment_verification_success_confirms_booking():
    db = SessionLocal()
    
    # 1. Create a Flight Booking Hold
    booking_ref = f"BK-{uuid.uuid4().hex[:8].upper()}"
    booking = FlightBooking(
        booking_reference=booking_ref,
        user_id=1,
        status=BookingStatus.HOLD,
        total_amount=5000.0,
        origin="DEL",
        destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[{"fullName": "John Doe", "age": 30}],
        pricing_snapshot={"base_fare": 4500.0, "tax": 500.0, "discount": 0.0}
    )
    db.add(booking)
    
    # 2. Create Payment record
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    payment = Payment(
        booking_id=booking_ref,
        user_id=1,
        amount=5000.0,
        status=PaymentStatus.PENDING,
        razorpay_order_id=order_id,
        payment_method="card"
    )
    db.add(payment)
    db.commit()
    
    # 3. Call verify API with correct signature
    secret = "whsec_razorpay_test_secret"
    pay_id = "pay_12345"
    sig = get_expected_signature(order_id, pay_id, secret)
    
    payload = {
        "razorpay_order_id": order_id,
        "razorpay_payment_id": pay_id,
        "razorpay_signature": sig
    }
    
    response = client.post("/api/v1/payments/verify", json=payload)
    assert response.status_code == 200
    
    # Verify booking status transitioned
    db.refresh(booking)
    assert booking.status == BookingStatus.CONFIRMED
    
    # Verify Ticket and Invoice generated
    ticket = db.query(BookingTicket).filter(BookingTicket.booking_reference == booking_ref).first()
    invoice = db.query(BookingInvoice).filter(BookingInvoice.booking_reference == booking_ref).first()
    
    assert ticket is not None
    assert ticket.pnr is not None
    assert invoice is not None
    assert invoice.final_amount == 5000.0

def test_payment_verification_signature_failure():
    db = SessionLocal()
    booking_ref = f"BK-{uuid.uuid4().hex[:8].upper()}"
    booking = FlightBooking(
        booking_reference=booking_ref,
        user_id=1,
        status=BookingStatus.HOLD,
        total_amount=5000.0,
        origin="DEL",
        destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[{"fullName": "John Doe", "age": 30}],
        pricing_snapshot={"base_fare": 4500.0, "tax": 500.0, "discount": 0.0}
    )
    db.add(booking)
    
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    payment = Payment(
        booking_id=booking_ref,
        user_id=1,
        amount=5000.0,
        status=PaymentStatus.PENDING,
        razorpay_order_id=order_id,
        payment_method="card"
    )
    db.add(payment)
    db.commit()
    
    payload = {
        "razorpay_order_id": order_id,
        "razorpay_payment_id": "pay_12345",
        "razorpay_signature": "invalid_signature"
    }
    
    response = client.post("/api/v1/payments/verify", json=payload)
    assert response.status_code == 400
    
    db.refresh(booking)
    assert booking.status == BookingStatus.HOLD

def test_confirmation_endpoint_returns_details():
    db = SessionLocal()
    booking_ref = f"BK-{uuid.uuid4().hex[:8].upper()}"
    booking = FlightBooking(
        booking_reference=booking_ref,
        user_id=1,
        status=BookingStatus.HOLD,
        total_amount=7000.0,
        origin="DEL",
        destination="GOI",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        airline_code="UK",
        flight_number="811",
        passenger_details=[{"fullName": "Sarah Conner", "age": 28}],
        pricing_snapshot={"base_fare": 6000.0, "tax": 1000.0, "discount": 0.0}
    )
    db.add(booking)
    
    # Create captured payment
    payment = Payment(
        booking_id=booking_ref,
        user_id=1,
        amount=7000.0,
        status=PaymentStatus.CAPTURED,
        payment_method="card"
    )
    db.add(payment)
    db.commit()
    
    # Confirm booking
    BookingStateMachine.transition_to(booking, BookingStatus.CONFIRMED)
    db.commit()
    
    # Call confirmation GET endpoint
    response = client.get(f"/api/v1/bookings/{booking_ref}/confirmation")
    assert response.status_code == 200
    data = response.json()
    assert data["booking_id"] == booking_ref
    assert data["booking_status"] == "confirmed"
    assert data["pnr"] is not None
    assert data["total_amount"] == 7000.0
    assert "pdf" in data["document_url"]

def test_document_owner_authorization():
    db = SessionLocal()
    booking_ref = f"BK-{uuid.uuid4().hex[:8].upper()}"
    booking = FlightBooking(
        booking_reference=booking_ref,
        user_id=2,  # Owned by User 2
        status=BookingStatus.HOLD,
        total_amount=4000.0,
        origin="BOM",
        destination="DEL",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        airline_code="UK",
        flight_number="812",
        passenger_details=[{"fullName": "John Doe", "age": 30}],
        pricing_snapshot={"base_fare": 3500.0, "tax": 500.0, "discount": 0.0}
    )
    db.add(booking)
    db.commit()
    
    # Attempting to fetch details as User 1 (dependency override sets user_id=1)
    response = client.get(f"/api/v1/bookings/{booking_ref}/confirmation")
    assert response.status_code == 403

def test_idempotency_webhook_replay():
    db = SessionLocal()
    booking_ref = f"BK-{uuid.uuid4().hex[:8].upper()}"
    booking = FlightBooking(
        booking_reference=booking_ref,
        user_id=1,
        status=BookingStatus.HOLD,
        total_amount=5000.0,
        origin="DEL",
        destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[{"fullName": "John Doe", "age": 30}],
        pricing_snapshot={"base_fare": 4500.0, "tax": 500.0, "discount": 0.0}
    )
    db.add(booking)
    
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    payment = Payment(
        booking_id=booking_ref,
        user_id=1,
        amount=5000.0,
        status=PaymentStatus.PENDING,
        razorpay_order_id=order_id,
        payment_method="card"
    )
    db.add(payment)
    db.commit()
    
    webhook_payload = {
        "event": "payment.captured",
        "id": f"evt_{uuid.uuid4().hex[:12]}",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_xyz",
                    "order_id": order_id,
                    "amount": 500000,
                    "method": "card"
                }
            }
        }
    }
    
    # Process webhook first time
    response = client.post("/api/v1/payments/webhook", json=webhook_payload)
    assert response.status_code == 200
    
    db.refresh(booking)
    assert booking.status == BookingStatus.CONFIRMED
    
    tickets_count_1 = db.query(BookingTicket).filter(BookingTicket.booking_reference == booking_ref).count()
    assert tickets_count_1 == 1
    
    # Send same webhook again (replay attack / duplicate hook)
    response2 = client.post("/api/v1/payments/webhook", json=webhook_payload)
    assert response2.status_code == 200
    
    tickets_count_2 = db.query(BookingTicket).filter(BookingTicket.booking_reference == booking_ref).count()
    assert tickets_count_2 == 1  # Should not create duplicate ticket!

def test_email_dispatch_failure_resilience():
    db = SessionLocal()
    booking_ref = f"BK-{uuid.uuid4().hex[:8].upper()}"
    booking = FlightBooking(
        booking_reference=booking_ref,
        user_id=1,
        status=BookingStatus.HOLD,
        total_amount=5000.0,
        origin="DEL",
        destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[{"fullName": "John Doe", "age": 30}],
        pricing_snapshot={"base_fare": 4500.0, "tax": 500.0, "discount": 0.0}
    )
    db.add(booking)
    
    # Create captured payment
    payment = Payment(
        booking_id=booking_ref,
        user_id=1,
        amount=5000.0,
        status=PaymentStatus.CAPTURED,
        payment_method="card"
    )
    db.add(payment)
    db.commit()
    
    # Mock Resend/SendGrid client send_email to raise Exception
    with patch("app.services.communication.SendGridClient.send_email") as mock_send:
        mock_send.side_effect = Exception("SMTP server unavailable")
        
        # Confirm booking - should NOT fail even though email failed
        BookingStateMachine.transition_to(booking, BookingStatus.CONFIRMED)
        db.commit()
        
        db.refresh(booking)
        assert booking.status == BookingStatus.CONFIRMED
        
        # Verify email failure event was logged in timeline
        evt = db.query(BookingEvent).filter(
            BookingEvent.booking_reference == booking_ref,
            BookingEvent.event_type == "email_failed"
        ).first()
        assert evt is not None
        assert "SMTP server" in evt.description
