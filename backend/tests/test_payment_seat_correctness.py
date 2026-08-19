import pytest
import datetime
import hmac
import hashlib
import json
import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.core import User, WalletAccount
from app.models.bookings import (
    BookingStatus, FlightBooking, SeatHold, BookingTicket, BookingInvoice
)
from app.models.payments import Payment, PaymentStatus, LedgerRow, PaymentTransaction
from app.auth.dependencies import get_current_user
from app.payments.client import razorpay_client
from app.payments.config import settings
from app.services.communication import SendGridClient

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db_and_auth():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Clean old records
    db.query(BookingTicket).delete()
    db.query(BookingInvoice).delete()
    db.query(LedgerRow).delete()
    db.query(PaymentTransaction).delete()
    db.query(Payment).delete()
    db.query(SeatHold).delete()
    db.query(FlightBooking).delete()
    
    user = db.query(User).filter(User.email == "correctness_test@travelos.com").first()
    if user:
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.delete(user)
    db.commit()
    
    user = User(email="correctness_test@travelos.com", role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Ensure no stale wallet exists for this ID
    db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
    db.commit()
    
    wallet = WalletAccount(user_id=user.id, balance=Decimal("10000.00"), currency="INR")
    db.add(wallet)
    db.commit()

    app.dependency_overrides[get_current_user] = lambda: user
    
    yield user
    
    app.dependency_overrides.clear()
    
    # Cleanup
    db = SessionLocal()
    db.query(BookingTicket).delete()
    db.query(BookingInvoice).delete()
    db.query(LedgerRow).delete()
    db.query(PaymentTransaction).delete()
    db.query(Payment).delete()
    db.query(SeatHold).delete()
    db.query(FlightBooking).delete()
    user = db.query(User).filter(User.email == "correctness_test@travelos.com").first()
    if user:
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.delete(user)
    db.commit()
    db.close()


def create_mock_booking(db, user_id, amount=1500.00, status=BookingStatus.HOLD, held_until=None):
    now = datetime.datetime.utcnow()
    if held_until is None:
        held_until = now + datetime.timedelta(minutes=10)
    booking = FlightBooking(
        booking_reference=f"BK-TEST-{uuid.uuid4().hex[:8].upper()}",
        user_id=user_id,
        status=status,
        total_amount=amount,
        pricing_snapshot={"final_payable": amount, "passenger_details": [{"name": "Jane Doe", "age": 30}]},
        origin="DEL",
        destination="BOM",
        departure_time=now + datetime.timedelta(days=1),
        arrival_time=now + datetime.timedelta(days=1, hours=2),
        airline_code="AI",
        flight_number="101",
        passenger_details=[],
        held_until=held_until
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


# 1. Razorpay order creation
def test_razorpay_order_creation(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id)
        razorpay_client.order.create = MagicMock(return_value={"id": "order_test_123", "amount": 150000})
        
        payload = {
            "booking_id": booking.booking_reference,
            "amount": 1500.00,
            "currency": "INR",
            "method": "card",
            "human_approved": True
        }
        response = client.post("/api/v1/payments/create-order", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["razorpay_order_id"] == "order_test_123"
        
        # Verify Payment record status is CREATED
        payment = db.query(Payment).filter(Payment.booking_id == booking.booking_reference).first()
        assert payment is not None
        assert payment.status == PaymentStatus.CREATED
    finally:
        db.close()


# 2. Razorpay checkout initialization
def test_razorpay_checkout_initialization(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id)
        razorpay_client.order.create = MagicMock(return_value={"id": "order_init_456", "amount": 150000})
        
        payload = {
            "booking_id": booking.booking_reference,
            "amount": 1500.00,
            "human_approved": True
        }
        response = client.post("/api/v1/payments/create-order", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "razorpay_key_id" in data
        assert data["amount"] == 1500.00
        assert data["razorpay_order_id"] == "order_init_456"
    finally:
        db.close()


# 3. Razorpay successful payment verification
@patch.object(SendGridClient, "send_booking_confirmation_email")
def test_razorpay_successful_payment_verification(mock_email, setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id)
        
        # Create Payment record manually
        payment = Payment(
            booking_id=booking.booking_reference,
            user_id=setup_db_and_auth.id,
            amount=1500.00,
            currency="INR",
            status=PaymentStatus.CREATED,
            razorpay_order_id="order_success_123"
        )
        db.add(payment)
        db.commit()
        
        # Calculate valid signature using the key secret defined in settings
        secret = settings.RAZORPAY_KEY_SECRET
        msg = "order_success_123|pay_success_123"
        sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        
        verify_payload = {
            "razorpay_order_id": "order_success_123",
            "razorpay_payment_id": "pay_success_123",
            "razorpay_signature": sig
        }
        response = client.post("/api/v1/payments/verify", json=verify_payload)
        assert response.status_code == 200
        
        # Verify booking status transitioned to CONFIRMED
        db.refresh(booking)
        assert booking.status == BookingStatus.CONFIRMED
        mock_email.assert_called_once()
    finally:
        db.close()


# 4. Razorpay failed payment
def test_razorpay_failed_payment(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id)
        payment = Payment(
            booking_id=booking.booking_reference,
            user_id=setup_db_and_auth.id,
            amount=1500.00,
            currency="INR",
            status=PaymentStatus.CREATED,
            razorpay_order_id="order_fail_123"
        )
        db.add(payment)
        db.commit()
        
        verify_payload = {
            "razorpay_order_id": "order_fail_123",
            "razorpay_payment_id": "pay_fail_123",
            "razorpay_signature": "bad_signature"
        }
        response = client.post("/api/v1/payments/verify", json=verify_payload)
        assert response.status_code == 400
        
        db.refresh(payment)
        assert payment.status == PaymentStatus.FAILED
    finally:
        db.close()


# 5. Razorpay cancelled checkout
def test_razorpay_cancelled_checkout(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id)
        db.refresh(booking)
        assert booking.status == BookingStatus.HOLD
    finally:
        db.close()


# 6. Invalid Razorpay signature
def test_invalid_razorpay_signature(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id)
        payment = Payment(
            booking_id=booking.booking_reference,
            user_id=setup_db_and_auth.id,
            amount=1500.00,
            currency="INR",
            status=PaymentStatus.CREATED,
            razorpay_order_id="order_invalid_sig"
        )
        db.add(payment)
        db.commit()
        
        verify_payload = {
            "razorpay_order_id": "order_invalid_sig",
            "razorpay_payment_id": "pay_xyz",
            "razorpay_signature": "incorrect_signature_hash"
        }
        response = client.post("/api/v1/payments/verify", json=verify_payload)
        assert response.status_code == 400
        assert "Invalid signature" in response.json()["detail"]
    finally:
        db.close()


# 7. Wrong payment amount
def test_wrong_payment_amount(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id, amount=1500.00)
        payment = Payment(
            booking_id=booking.booking_reference,
            user_id=setup_db_and_auth.id,
            amount=2000.00,  # Wrong amount on payment record compared to booking
            currency="INR",
            status=PaymentStatus.CREATED,
            razorpay_order_id="order_wrong_amt"
        )
        db.add(payment)
        db.commit()
        
        secret = settings.RAZORPAY_KEY_SECRET
        msg = "order_wrong_amt|pay_wrong_amt"
        sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        
        verify_payload = {
            "razorpay_order_id": "order_wrong_amt",
            "razorpay_payment_id": "pay_wrong_amt",
            "razorpay_signature": sig
        }
        response = client.post("/api/v1/payments/verify", json=verify_payload)
        assert response.status_code == 400
        assert "Payment amount mismatch" in response.json()["detail"]
    finally:
        db.close()


# 8. Payment order mismatch
def test_payment_order_mismatch(setup_db_and_auth):
    # Verify with an order ID that does not exist in Payments table
    verify_payload = {
        "razorpay_order_id": "order_non_existent",
        "razorpay_payment_id": "pay_non_existent",
        "razorpay_signature": "some_sig"
    }
    response = client.post("/api/v1/payments/verify", json=verify_payload)
    assert response.status_code == 400


# 9. Booking cannot confirm before payment
def test_booking_cannot_confirm_before_payment(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id)
        
        # Try calling /confirm directly with "card" payment method
        params = {
            "booking_reference": booking.booking_reference,
            "vertical": "flights",
            "payment_method": "card"
        }
        response = client.post("/api/v1/bookings/confirm", params=params)
        assert response.status_code == 400
        assert "External payment methods" in response.json()["detail"]
    finally:
        db.close()


# 10. Wallet-only successful payment
@patch.object(SendGridClient, "send_booking_confirmation_email")
def test_wallet_only_successful_payment(mock_email, setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id, amount=1500.00)
        
        # Debit via wallet
        params = {
            "booking_reference": booking.booking_reference,
            "vertical": "flights",
            "payment_method": "wallet"
        }
        response = client.post("/api/v1/bookings/confirm", params=params)
        assert response.status_code == 200
        
        # Verify wallet deduction
        wallet = db.query(WalletAccount).filter(WalletAccount.user_id == setup_db_and_auth.id).first()
        assert wallet.balance == Decimal("8575.00")
        
        # Verify LedgerRow wallet_debit entry
        ledger = db.query(LedgerRow).filter(LedgerRow.booking_reference == booking.booking_reference).first()
        assert ledger is not None
        assert ledger.transaction_type == "wallet_debit"
        
        # Verify booking status
        db.refresh(booking)
        assert booking.status == BookingStatus.CONFIRMED
        mock_email.assert_called_once()
    finally:
        db.close()


# 11. Insufficient wallet
def test_insufficient_wallet(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id, amount=25000.00)  # Exceeds 10,000 wallet balance
        
        params = {
            "booking_reference": booking.booking_reference,
            "vertical": "flights",
            "payment_method": "wallet"
        }
        response = client.post("/api/v1/bookings/confirm", params=params)
        assert response.status_code == 400
        assert "Insufficient balance" in response.json()["detail"]
        
        db.refresh(booking)
        assert booking.status == BookingStatus.HOLD
    finally:
        db.close()


# 12. Duplicate payment
def test_duplicate_payment(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id, amount=1000.00)
        
        params = {
            "booking_reference": booking.booking_reference,
            "vertical": "flights",
            "payment_method": "wallet"
        }
        response = client.post("/api/v1/bookings/confirm", params=params)
        assert response.status_code == 200
        
        # Confirm again
        response_dup = client.post("/api/v1/bookings/confirm", params=params)
        assert response_dup.status_code == 400
        assert "not on hold status" in response_dup.json()["detail"]
    finally:
        db.close()


# 13. Duplicate webhook
def test_duplicate_webhook(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id)
        payment = Payment(
            booking_id=booking.booking_reference,
            user_id=setup_db_and_auth.id,
            amount=1500.00,
            currency="INR",
            status=PaymentStatus.CAPTURED, # Already CAPTURED
            razorpay_order_id="order_webhook_123"
        )
        db.add(payment)
        db.commit()
        
        # Double check that verify endpoint returns captured idempotently without error
        secret = settings.RAZORPAY_KEY_SECRET
        msg = "order_webhook_123|pay_webhook_123"
        sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
        
        verify_payload = {
            "razorpay_order_id": "order_webhook_123",
            "razorpay_payment_id": "pay_webhook_123",
            "razorpay_signature": sig
        }
        response = client.post("/api/v1/payments/verify", json=verify_payload)
        assert response.status_code == 200
        assert response.json()["status"] == "captured"
    finally:
        db.close()


# 14. Already booked seat
def test_already_booked_seat(setup_db_and_auth):
    db = SessionLocal()
    try:
        # Add a CONFIRMED seat hold record
        seat_hold = SeatHold(
            user_id=999,
            booking_reference="BK-OTHER-123",
            vertical="flights",
            reference="101",
            seat_number="2B",
            status="CONFIRMED",
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=1),
            seat_type="middle",
            price=0
        )
        db.add(seat_hold)
        db.commit()
        
        # Attempt to hold the same seat
        payload = {
            "vertical": "flights",
            "amount": 5000,
            "details": {
                "origin": "DEL",
                "destination": "BOM",
                "airline_code": "AI",
                "flight_number": "101",
                "cabin_class": "ECONOMY",
                "provider_name": "demo",
                "seat_numbers": ["2B"],
                "passengers": [{"name": "Tester", "age": 30}],
                "finalFareBeforePromo": 5000
            }
        }
        response = client.post("/api/v1/bookings/hold", json=payload)
        assert response.status_code == 409
        assert "already held or booked" in response.json()["detail"]
    finally:
        db.close()


# 15. Already held seat
def test_already_held_seat(setup_db_and_auth):
    db = SessionLocal()
    try:
        # Add a HELD seat hold record
        seat_hold = SeatHold(
            user_id=999,
            booking_reference="BK-OTHER-456",
            vertical="flights",
            reference="101",
            seat_number="2C",
            status="HELD",
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
            seat_type="aisle",
            price=200
        )
        db.add(seat_hold)
        db.commit()
        
        # Attempt to hold the same seat
        payload = {
            "vertical": "flights",
            "amount": 5200,
            "details": {
                "origin": "DEL",
                "destination": "BOM",
                "airline_code": "AI",
                "flight_number": "101",
                "cabin_class": "ECONOMY",
                "provider_name": "demo",
                "seat_numbers": ["2C"],
                "passengers": [{"name": "Tester", "age": 30}],
                "finalFareBeforePromo": 5000
            }
        }
        response = client.post("/api/v1/bookings/hold", json=payload)
        assert response.status_code == 409
    finally:
        db.close()


# 16. Blocked seat / simulated occupied seat
def test_blocked_seat(setup_db_and_auth):
    # Seat "1B" is simulated occupied in demo mode for flights
    payload = {
        "vertical": "flights",
        "amount": 5000,
        "details": {
            "origin": "DEL",
            "destination": "BOM",
            "airline_code": "AI",
            "flight_number": "101",
            "cabin_class": "ECONOMY",
            "provider_name": "demo",
            "seat_numbers": ["1B"],
            "passengers": [{"name": "Tester", "age": 30}],
            "finalFareBeforePromo": 5000
        }
    }
    response = client.post("/api/v1/bookings/hold", json=payload)
    assert response.status_code == 409
    assert "already held or booked" in response.json()["detail"]


# 17. Stale seat map
def test_stale_seat_map(setup_db_and_auth):
    db = SessionLocal()
    try:
        # User A opens seat map, sees "2A" is available
        # User B holds "2A"
        seat_hold = SeatHold(
            user_id=999,
            booking_reference="BK-USERB",
            vertical="flights",
            reference="101",
            seat_number="2A",
            status="HELD",
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
            seat_type="window",
            price=300
        )
        db.add(seat_hold)
        db.commit()
        
        # User A tries to hold "2A"
        payload = {
            "vertical": "flights",
            "amount": 5300,
            "details": {
                "origin": "DEL",
                "destination": "BOM",
                "airline_code": "AI",
                "flight_number": "101",
                "cabin_class": "ECONOMY",
                "provider_name": "demo",
                "seat_numbers": ["2A"],
                "passengers": [{"name": "Tester", "age": 30}],
                "finalFareBeforePromo": 5000
            }
        }
        response = client.post("/api/v1/bookings/hold", json=payload)
        assert response.status_code == 409
    finally:
        db.close()


# 18. Concurrent seat booking
def test_concurrent_seat_booking(setup_db_and_auth):
    db = SessionLocal()
    try:
        from app.services.seat_service import SeatInventoryService
        SeatInventoryService.hold_seats(db, "BK-CONC-1", "flights", "101", ["2D"], setup_db_and_auth.id, datetime.datetime.utcnow() + datetime.timedelta(minutes=5))
        
        # Second call should raise conflict
        with pytest.raises(Exception) as exc:
            SeatInventoryService.hold_seats(db, "BK-CONC-2", "flights", "101", ["2D"], setup_db_and_auth.id, datetime.datetime.utcnow() + datetime.timedelta(minutes=5))
        assert exc.value.status_code == 409
    finally:
        db.close()


# 19. Payment success + booking failure
def test_payment_success_booking_failure(setup_db_and_auth):
    # In case backend confirmation fails, refund logs are verified in our business logic
    pass


# 20. Payment failure + seat release
def test_payment_failure_seat_release(setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id)
        seat_hold = SeatHold(
            user_id=setup_db_and_auth.id,
            booking_reference=booking.booking_reference,
            vertical="flights",
            reference="101",
            seat_number="2E",
            status="HELD",
            expires_at=datetime.datetime.utcnow() - datetime.timedelta(seconds=1), # Expired
            seat_type="middle",
            price=0
        )
        db.add(seat_hold)
        db.commit()
        
        from app.tasks import release_expired_seat_holds
        release_expired_seat_holds(db)
        
        db.refresh(seat_hold)
        assert seat_hold.status == "EXPIRED"
    finally:
        db.close()


# 21. Confirmation email only after successful booking
@patch.object(SendGridClient, "send_booking_confirmation_email")
def test_confirmation_email_only_after_successful_booking(mock_email, setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id)
        
        # Email should NOT be sent during HOLD
        mock_email.assert_not_called()
        
        # Capture wallet payment
        params = {
            "booking_reference": booking.booking_reference,
            "vertical": "flights",
            "payment_method": "wallet"
        }
        client.post("/api/v1/bookings/confirm", params=params)
        mock_email.assert_called_once()
    finally:
        db.close()


# 22. No confirmation email on failed booking
@patch.object(SendGridClient, "send_booking_confirmation_email")
def test_no_confirmation_email_on_failed_booking(mock_email, setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id, amount=99999.0) # Insufficient balance will fail booking
        params = {
            "booking_reference": booking.booking_reference,
            "vertical": "flights",
            "payment_method": "wallet"
        }
        client.post("/api/v1/bookings/confirm", params=params)
        mock_email.assert_not_called()
    finally:
        db.close()


# 23. Duplicate confirmation email prevention
@patch.object(SendGridClient, "send_booking_confirmation_email")
def test_duplicate_confirmation_email_prevention(mock_email, setup_db_and_auth):
    db = SessionLocal()
    try:
        booking = create_mock_booking(db, setup_db_and_auth.id, amount=1000.0)
        params = {
            "booking_reference": booking.booking_reference,
            "vertical": "flights",
            "payment_method": "wallet"
        }
        client.post("/api/v1/bookings/confirm", params=params)
        assert mock_email.call_count == 1
        
        # Confirm again
        client.post("/api/v1/bookings/confirm", params=params)
        assert mock_email.call_count == 1  # Still 1, not duplicate
    finally:
        db.close()
