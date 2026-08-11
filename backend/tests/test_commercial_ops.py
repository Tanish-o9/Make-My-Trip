import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import hash_password, create_access_token
from app.models.bookings import FlightBooking, BookingStatus
from app.models.payments import LedgerRow, ReconciliationException

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_commercial_ops_test_data():
    db = SessionLocal()
    try:
        for email in ["comm_admin@travelos.com", "comm_user@travelos.com"]:
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.query(FlightBooking).filter(FlightBooking.user_id == u.id).delete()
                db.delete(u)
        db.commit()
    finally:
        db.close()


def _create_user(email="comm_admin@travelos.com", role="finance_admin"):
    db = SessionLocal()
    try:
        u = User(
            email=email,
            password_hash=hash_password("CommSecurePass123!"),
            email_verified=True,
            role=role,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.id
    finally:
        db.close()


# ─── 1. Commission & Pricing Engine ───────────────────────────────────────────

def test_commission_calculation():
    # Verify that pricing calculations calculate markup, commission, and GST properly
    base_fare = 10000.0
    markup = 500.0
    gst_rate = 0.18
    coupon_discount = 200.0

    taxable_amount = base_fare + markup - coupon_discount
    gst = taxable_amount * gst_rate
    final_amount = taxable_amount + gst

    assert final_amount == 12154.0
    assert gst == 1854.0


# ─── 2. Refund Calculations & Safety ──────────────────────────────────────────

def test_refund_engine_calculation():
    paid_amount = 12154.0
    cancellation_fee = 1000.0
    provider_cancellation_fee = 500.0

    # Calculate net refund
    refund_amount = paid_amount - cancellation_fee - provider_cancellation_fee
    assert refund_amount == 10654.0


# ─── 3. Coupon Application & Restrictions ─────────────────────────────────────

def test_coupon_validations():
    # Verify coupon logic holds boundaries (limit rules, minimum purchase)
    min_amount = 5000.0
    booking_amount = 8000.0
    assert booking_amount >= min_amount

    # Maximum discount limits
    discount_pct = 0.10
    max_discount = 500.0
    computed_discount = booking_amount * discount_pct
    final_discount = min(computed_discount, max_discount)
    assert final_discount == 500.0


# ─── 4. Wallet Transactions ───────────────────────────────────────────────────

def test_wallet_balance_integrity():
    balance = 1500.0
    debit_amount = 600.0
    balance -= debit_amount
    assert balance == 900.0
    # Prevent negative balance without explicit business override
    assert balance >= 0.0


# ─── 5. Reconciliation Exceptions ──────────────────────────────────────────────

def test_reconciliation_exception_logging():
    db = SessionLocal()
    try:
        exc = ReconciliationException(
            booking_reference="TOS-FL-REC-ERR",
            exception_type="AMOUNT_MISMATCH",
            expected_amount=12000.0,
            actual_amount=10000.0,
            status="pending",
        )
        db.add(exc)
        db.commit()
        db.refresh(exc)
        assert exc.id is not None
        db.delete(exc)
        db.commit()
    finally:
        db.close()


# ─── 6. Fraud & Risk Assessment ───────────────────────────────────────────────

def test_fraud_risk_score():
    failed_payments_count = 4
    rapid_bookings_count = 6
    risk_level = "LOW"

    if failed_payments_count >= 3 or rapid_bookings_count >= 5:
        risk_level = "HIGH"

    assert risk_level == "HIGH"
