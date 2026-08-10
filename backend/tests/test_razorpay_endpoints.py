import pytest
import sys
import datetime
import hmac
import hashlib
import json
from decimal import Decimal
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.core import User
from app.models.bookings import BookingStatus, FlightBooking
from app.models.payments import Payment, PaymentTransaction, TransactionEventType, PaymentStatus, Refund, RefundStatus, ProcessedWebhookEvent
from app.auth.dependencies import get_current_user
from app.payments.client import razorpay_client
from app.payments.config import settings

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db_and_auth():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    user = db.query(User).filter(User.email == "razor_test@travelos.com").first()
    if not user:
        user = User(email="razor_test@travelos.com", role="user")
        db.add(user)
        db.commit()
        db.refresh(user)
    
    app.dependency_overrides[get_current_user] = lambda: user
    
    yield user
    
    app.dependency_overrides.clear()
    
    from app.models.bookings import BookingTicket, BookingInvoice
    db.query(BookingTicket).delete()
    db.query(BookingInvoice).delete()
    db.query(ProcessedWebhookEvent).delete()
    db.query(Refund).delete()
    db.query(PaymentTransaction).delete()
    db.query(Payment).delete()
    db.query(FlightBooking).filter(FlightBooking.user_id == user.id).delete()
    db.commit()
    db.close()
    try:
        from app.utils.redis_client import redis_client
        if redis_client:
            redis_client.delete(
                "processed_webhook:evt_capture_12345",
                "processed_webhook:evt_replay_uuid_999",
                "processed_webhook:evt_tampered_1",
                "processed_webhook:evt_failed_outoforder"
            )
    except Exception:
        pass


def test_valid_order_creation(setup_db_and_auth):
    user = setup_db_and_auth
    
    db = SessionLocal()
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-RAZORPAY-1",
        user_id=user.id,
        status=BookingStatus.HOLD,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[]
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    
    original_create = razorpay_client.order.create
    razorpay_client.order.create = MagicMock(return_value={
        "id": "order_mocked_12345",
        "entity": "order",
        "amount": 150000,
        "amount_paid": 0,
        "amount_due": 150000,
        "currency": "INR",
        "receipt": "BK-TEST-RAZORPAY-1",
        "status": "created",
        "attempts": 0,
        "notes": [],
        "created_at": 1690000000
    })
    
    try:
        payload = {
            "booking_id": "BK-TEST-RAZORPAY-1",
            "amount": 1500.00,
            "currency": "INR",
            "method": "card",
            "human_approved": True
        }
        response = client.post("/api/v1/payments/create-order", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["razorpay_order_id"] == "order_mocked_12345"
        assert data["amount"] == 1500.00
        assert data["currency"] == "INR"
        assert "razorpay_key_id" in data
        
        db.refresh(booking)
        assert booking.status == BookingStatus.PAYMENT_PENDING
        
        payment = db.query(Payment).filter(Payment.booking_id == "BK-TEST-RAZORPAY-1").first()
        assert payment is not None
        assert payment.status == PaymentStatus.CREATED
        
    finally:
        razorpay_client.order.create = original_create
        db.close()


def test_qr_code_creation_in_create_order(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-RAZORPAY-QR",
        user_id=user.id,
        status=BookingStatus.HOLD,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[]
    )
    db.add(booking)
    db.commit()
    
    original_create = razorpay_client.order.create
    original_qr_create = razorpay_client.qrcode.create
    
    razorpay_client.order.create = MagicMock(return_value={"id": "order_qr_123"})
    razorpay_client.qrcode.create = MagicMock(return_value={
        "id": "qr_real_9988",
        "image_url": "https://razorpay.com/mock-qr.png"
    })
    
    try:
        payload = {
            "booking_id": "BK-TEST-RAZORPAY-QR",
            "amount": 1500.00,
            "currency": "INR",
            "method": "upi",
            "human_approved": True
        }
        response = client.post("/api/v1/payments/create-order", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["qr_code_id"] == "qr_real_9988"
        assert data["qr_code_url"] == "https://razorpay.com/mock-qr.png"
        
        payment = db.query(Payment).filter(Payment.booking_id == "BK-TEST-RAZORPAY-QR").first()
        assert payment is not None
        assert payment.qr_code_id == "qr_real_9988"
        assert payment.qr_code_url == "https://razorpay.com/mock-qr.png"
        
    finally:
        razorpay_client.order.create = original_create
        razorpay_client.qrcode.create = original_qr_create
        db.close()


def test_verify_signature_success(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-VERIFY-1",
        user_id=user.id,
        status=BookingStatus.PAYMENT_PENDING,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[]
    )
    db.add(booking)
    
    payment = Payment(
        booking_id="BK-TEST-VERIFY-1",
        user_id=user.id,
        amount=1500.00,
        status=PaymentStatus.CREATED,
        razorpay_order_id="order_to_verify_1"
    )
    db.add(payment)
    db.commit()
    
    # Calculate correct signature with settings secret
    secret = settings.RAZORPAY_KEY_SECRET or "whsec_razorpay_test_secret"
    message = "order_to_verify_1|pay_verified_123"
    sig = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    
    payload = {
        "razorpay_order_id": "order_to_verify_1",
        "razorpay_payment_id": "pay_verified_123",
        "razorpay_signature": sig
    }
    
    response = client.post("/api/v1/payments/verify", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "captured"
    
    db.refresh(payment)
    assert payment.status == PaymentStatus.CAPTURED
    assert payment.razorpay_payment_id == "pay_verified_123"
    
    db.refresh(booking)
    assert booking.status == BookingStatus.CONFIRMED
    db.close()


def test_verify_signature_tampered(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-VERIFY-2",
        user_id=user.id,
        status=BookingStatus.PAYMENT_PENDING,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[]
    )
    db.add(booking)
    
    payment = Payment(
        booking_id="BK-TEST-VERIFY-2",
        user_id=user.id,
        amount=1500.00,
        status=PaymentStatus.CREATED,
        razorpay_order_id="order_to_verify_2"
    )
    db.add(payment)
    db.commit()
    
    payload = {
        "razorpay_order_id": "order_to_verify_2",
        "razorpay_payment_id": "pay_verified_123",
        "razorpay_signature": "tampered_signature_string"
    }
    
    response = client.post("/api/v1/payments/verify", json=payload)
    assert response.status_code == 400
    
    db.refresh(payment)
    assert payment.status == PaymentStatus.FAILED
    db.close()


def test_webhook_captured_success(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-WEBHOOK-1",
        user_id=user.id,
        status=BookingStatus.PAYMENT_PENDING,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[]
    )
    db.add(booking)
    
    payment = Payment(
        booking_id="BK-TEST-WEBHOOK-1",
        user_id=user.id,
        amount=1500.00,
        status=PaymentStatus.CREATED,
        razorpay_order_id="order_webhook_1"
    )
    db.add(payment)
    db.commit()
    
    webhook_payload = {
        "entity": "event",
        "event": "payment.captured",
        "id": "evt_capture_12345",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_captured_123",
                    "amount": 150000,
                    "currency": "INR",
                    "order_id": "order_webhook_1",
                    "method": "upi"
                }
            }
        }
    }
    
    body_str = json.dumps(webhook_payload)
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "whsec_razorpay_test_secret"
    sig = hmac.new(secret.encode(), body_str.encode(), hashlib.sha256).hexdigest()
    
    response = client.post(
        "/api/v1/payments/webhook/razorpay",
        content=body_str,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
    )
    
    assert response.status_code == 200
    
    db.refresh(payment)
    assert payment.status == PaymentStatus.CAPTURED
    assert payment.razorpay_payment_id == "pay_captured_123"
    
    db.refresh(booking)
    assert booking.status == BookingStatus.CONFIRMED
    db.close()


def test_webhook_idempotency_replay(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-WEBHOOK-REPLAY",
        user_id=user.id,
        status=BookingStatus.PAYMENT_PENDING,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[]
    )
    db.add(booking)
    
    payment = Payment(
        booking_id="BK-TEST-WEBHOOK-REPLAY",
        user_id=user.id,
        amount=1500.00,
        status=PaymentStatus.CREATED,
        razorpay_order_id="order_replay_1"
    )
    db.add(payment)
    db.commit()
    
    webhook_payload = {
        "entity": "event",
        "event": "payment.captured",
        "id": "evt_replay_uuid_999",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_replay_123",
                    "amount": 150000,
                    "currency": "INR",
                    "order_id": "order_replay_1",
                    "method": "upi"
                }
            }
        }
    }
    
    body_str = json.dumps(webhook_payload)
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "whsec_razorpay_test_secret"
    sig = hmac.new(secret.encode(), body_str.encode(), hashlib.sha256).hexdigest()
    
    response1 = client.post(
        "/api/v1/payments/webhook/razorpay",
        content=body_str,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
    )
    assert response1.status_code == 200
    
    response2 = client.post(
        "/api/v1/payments/webhook/razorpay",
        content=body_str,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
    )
    assert response2.status_code == 200
    assert response2.json()["status"] == "ignored"
    db.close()


def test_webhook_tampered_signature(setup_db_and_auth):
    webhook_payload = {"event": "payment.captured", "id": "evt_tampered_1"}
    body_str = json.dumps(webhook_payload)
    
    response = client.post(
        "/api/v1/payments/webhook/razorpay",
        content=body_str,
        headers={"X-Razorpay-Signature": "wrong_sig_value", "Content-Type": "application/json"}
    )
    assert response.status_code == 400


def test_webhook_out_of_order_handling(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-WEBHOOK-OUTOFORDER",
        user_id=user.id,
        status=BookingStatus.PAYMENT_PENDING,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[]
    )
    db.add(booking)
    
    payment = Payment(
        booking_id="BK-TEST-WEBHOOK-OUTOFORDER",
        user_id=user.id,
        amount=1500.00,
        status=PaymentStatus.CAPTURED,
        razorpay_order_id="order_outoforder_1",
        razorpay_payment_id="pay_outoforder_xyz"
    )
    db.add(payment)
    db.commit()
    
    webhook_payload = {
        "entity": "event",
        "event": "payment.failed",
        "id": "evt_failed_outoforder",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_outoforder_xyz",
                    "amount": 150000,
                    "currency": "INR",
                    "order_id": "order_outoforder_1"
                }
            }
        }
    }
    
    body_str = json.dumps(webhook_payload)
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "whsec_razorpay_test_secret"
    sig = hmac.new(secret.encode(), body_str.encode(), hashlib.sha256).hexdigest()
    
    response = client.post(
        "/api/v1/payments/webhook/razorpay",
        content=body_str,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"
    
    db.refresh(payment)
    assert payment.status == PaymentStatus.CAPTURED
    db.close()


def test_refund_api_success(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-REFUND-1",
        user_id=user.id,
        status=BookingStatus.CONFIRMED,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[]
    )
    db.add(booking)
    
    payment = Payment(
        booking_id="BK-TEST-REFUND-1",
        user_id=user.id,
        amount=1500.00,
        status=PaymentStatus.CAPTURED,
        razorpay_order_id="order_refund_1",
        razorpay_payment_id="pay_refund_1"
    )
    db.add(payment)
    db.commit()
    
    original_refund = razorpay_client.refund.create
    razorpay_client.refund.create = MagicMock(return_value={"id": "rfnd_mocked_777"})
    
    try:
        response = client.post(
            f"/api/v1/payments/{payment.id}/refund",
            json={"amount": 500.00, "reason": "Cancellation"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert data["razorpay_refund_id"] == "rfnd_mocked_777"
        assert data["amount"] == 500.00
        
        refund = db.query(Refund).filter(Refund.razorpay_refund_id == "rfnd_mocked_777").first()
        assert refund is not None
        assert refund.amount == 500.00
        assert refund.status == RefundStatus.PENDING
        
        db.refresh(booking)
        assert booking.status == BookingStatus.REFUND_INITIATED
        
    finally:
        razorpay_client.refund.create = original_refund
        db.close()


def test_polling_payment_status(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    
    payment = Payment(
        booking_id="BK-POLLING-99",
        user_id=user.id,
        amount=1500.00,
        status=PaymentStatus.CAPTURED,
        razorpay_order_id="order_poll_1",
        razorpay_payment_id="pay_poll_1"
    )
    db.add(payment)
    db.commit()
    
    response = client.get("/api/v1/payments/status/BK-POLLING-99")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "captured"
    assert data["razorpay_order_id"] == "order_poll_1"
    assert data["razorpay_payment_id"] == "pay_poll_1"
    db.close()


def test_verify_expired_hold_rejected(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    
    # 1. Create a booking with held_until in the past
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-EXPIRED-HOLD",
        user_id=user.id,
        status=BookingStatus.PAYMENT_PENDING,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[],
        held_until=now - datetime.timedelta(minutes=10) # 10 mins ago
    )
    db.add(booking)
    
    payment = Payment(
        booking_id="BK-TEST-EXPIRED-HOLD",
        user_id=user.id,
        amount=1500.00,
        status=PaymentStatus.CREATED,
        razorpay_order_id="order_expired_1"
    )
    db.add(payment)
    db.commit()
    
    secret = settings.RAZORPAY_KEY_SECRET or "whsec_razorpay_test_secret"
    message = "order_expired_1|pay_expired_123"
    sig = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    
    payload = {
        "razorpay_order_id": "order_expired_1",
        "razorpay_payment_id": "pay_expired_123",
        "razorpay_signature": sig
    }
    
    response = client.post("/api/v1/payments/verify", json=payload)
    assert response.status_code == 400
    assert "expired" in response.json()["detail"].lower()
    
    db.refresh(payment)
    assert payment.status == PaymentStatus.FAILED
    
    db.refresh(booking)
    assert booking.status == BookingStatus.EXPIRED
    db.close()


def test_verify_amount_mismatch_rejected(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-MISMATCH",
        user_id=user.id,
        status=BookingStatus.PAYMENT_PENDING,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[],
        held_until=now + datetime.timedelta(hours=2)
    )
    db.add(booking)
    
    # Mismatched payment amount (1600.00 instead of 1500.00)
    payment = Payment(
        booking_id="BK-TEST-MISMATCH",
        user_id=user.id,
        amount=1600.00,
        status=PaymentStatus.CREATED,
        razorpay_order_id="order_mismatch_1"
    )
    db.add(payment)
    db.commit()
    
    secret = settings.RAZORPAY_KEY_SECRET or "whsec_razorpay_test_secret"
    message = "order_mismatch_1|pay_mismatch_123"
    sig = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    
    payload = {
        "razorpay_order_id": "order_mismatch_1",
        "razorpay_payment_id": "pay_mismatch_123",
        "razorpay_signature": sig
    }
    
    response = client.post("/api/v1/payments/verify", json=payload)
    assert response.status_code == 400
    assert "amount mismatch" in response.json()["detail"].lower()
    
    db.refresh(payment)
    assert payment.status == PaymentStatus.FAILED
    
    db.refresh(booking)
    assert booking.status == BookingStatus.PAYMENT_FAILED
    db.close()


def test_ticket_and_invoice_generated_exactly_once(setup_db_and_auth):
    user = setup_db_and_auth
    db = SessionLocal()
    
    now = datetime.datetime.utcnow()
    booking = FlightBooking(
        booking_reference="BK-TEST-DOCS-ONCE",
        user_id=user.id,
        status=BookingStatus.PAYMENT_PENDING,
        total_amount=1500.00,
        pricing_snapshot={"base": 1200, "tax": 300},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[]
    )
    db.add(booking)
    
    payment = Payment(
        booking_id="BK-TEST-DOCS-ONCE",
        user_id=user.id,
        amount=1500.00,
        status=PaymentStatus.CREATED,
        razorpay_order_id="order_docs_once"
    )
    db.add(payment)
    db.commit()
    
    secret = settings.RAZORPAY_KEY_SECRET or "whsec_razorpay_test_secret"
    message = "order_docs_once|pay_docs_once_123"
    sig = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    
    payload = {
        "razorpay_order_id": "order_docs_once",
        "razorpay_payment_id": "pay_docs_once_123",
        "razorpay_signature": sig
    }
    
    # First verification
    response1 = client.post("/api/v1/payments/verify", json=payload)
    assert response1.status_code == 200
    
    # Assert ticket and invoice are generated
    from app.models.bookings import BookingTicket, BookingInvoice
    tickets = db.query(BookingTicket).filter(BookingTicket.booking_reference == "BK-TEST-DOCS-ONCE").all()
    invoices = db.query(BookingInvoice).filter(BookingInvoice.booking_reference == "BK-TEST-DOCS-ONCE").all()
    assert len(tickets) == 1
    assert len(invoices) == 1
    
    # Second verification (idempotent retry)
    response2 = client.post("/api/v1/payments/verify", json=payload)
    assert response2.status_code == 200
    
    # Re-query and verify count remains 1
    tickets = db.query(BookingTicket).filter(BookingTicket.booking_reference == "BK-TEST-DOCS-ONCE").all()
    invoices = db.query(BookingInvoice).filter(BookingInvoice.booking_reference == "BK-TEST-DOCS-ONCE").all()
    assert len(tickets) == 1
    assert len(invoices) == 1
    db.close()
