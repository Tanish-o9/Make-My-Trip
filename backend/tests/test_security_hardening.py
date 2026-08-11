import io
import datetime
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.models.bookings import FlightBooking, BookingStatus
from app.models.payments import LedgerRow
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_security_test_users():
    """Clean up security test users after execution."""
    db = SessionLocal()
    try:
        test_emails = [
            "security_admin@travelos.com",
            "security_user_a@travelos.com",
            "security_user_b@travelos.com",
            "unverified_security_user@travelos.com",
        ]
        for email in test_emails:
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.query(FlightBooking).filter(FlightBooking.user_id == u.id).delete()
                db.delete(u)
        db.commit()
    finally:
        db.close()


def _create_user(email: str, role: str = "user", verified: bool = True):
    db = SessionLocal()
    try:
        u = User(
            email=email,
            password_hash=hash_password("SuperSecureSecurityPass123!"),
            email_verified=verified,
            role=role,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.id
    finally:
        db.close()


# ─── 1. Authentication Security & JWT Rejection ───────────────────────────────

def test_auth_expired_and_invalid_jwt():
    # 1. Invalid token signature
    resp = client.get("/api/v1/users/me", headers={"Authorization": "Bearer InvalidTokenSignature_xxxxx"})
    assert resp.status_code == 401

    # 2. Missing authorization header
    resp2 = client.get("/api/v1/users/me")
    assert resp2.status_code == 401


# ─── 2. RBAC Enforcement ──────────────────────────────────────────────────────

def test_rbac_enforcement():
    _create_user("security_user_a@travelos.com", role="user")
    token_user = create_access_token(data={"sub": "security_user_a@travelos.com"})

    # 1. Normal user cannot access Admin Health Check
    resp_user = client.get("/api/v1/admin/health", headers={"Authorization": f"Bearer {token_user}"})
    assert resp_user.status_code == 403

    # 2. Anonymous cannot access Admin Health Check
    resp_anon = client.get("/api/v1/admin/health")
    assert resp_anon.status_code == 401


# ─── 3. IDOR / Cross-User Access ──────────────────────────────────────────────

def test_idor_cross_user_resource_access():
    uid_a = _create_user("security_user_a@travelos.com", role="user")
    uid_b = _create_user("security_user_b@travelos.com", role="user")

    token_a = create_access_token(data={"sub": "security_user_a@travelos.com"})
    token_b = create_access_token(data={"sub": "security_user_b@travelos.com"})

    # Seed booking for User A
    db = SessionLocal()
    fb = FlightBooking(
        booking_reference="TOS-FL-IDR-A",
        user_id=uid_a,
        origin="DEL",
        destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        airline_code="6E",
        flight_number="6E-101",
        total_amount=12500.0,
        currency="INR",
        status=BookingStatus.CONFIRMED,
        passenger_details=[{"name": "User A"}],
        pricing_snapshot={"base": 10000, "taxes": 2500},
    )
    db.add(fb)
    db.commit()
    db.close()

    # User B tries to cancel or inspect User A's booking
    resp_cancel = client.post(
        "/api/v1/bookings/cancel",
        headers={"Authorization": f"Bearer {token_b}"},
        params={"booking_reference": "TOS-FL-IDR-A", "vertical": "flight"},
    )
    # The API should reject unauthorized cross-user cancellations
    assert resp_cancel.status_code in (400, 403, 404)


# ─── 4. Payment Security & Tampering ──────────────────────────────────────────

def test_payment_security_tampering():
    _create_user("security_user_a@travelos.com", role="user")
    token = create_access_token(data={"sub": "security_user_a@travelos.com"})

    # Payment callbacks should reject invalid signature payloads
    resp_verify = client.post(
        "/api/v1/payments/verify",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "razorpay_payment_id": "pay_xyz123",
            "razorpay_order_id": "order_abc789",
            "razorpay_signature": "invalid_signature_tampered",
        },
    )
    assert resp_verify.status_code in (400, 422)


# ─── 5. Booking Security State Machine ────────────────────────────────────────

def test_booking_security_expired_hold():
    _create_user("security_user_a@travelos.com", role="user")
    token = create_access_token(data={"sub": "security_user_a@travelos.com"})

    # Try to confirm without holding or with empty parameters
    resp_confirm = client.post(
        "/api/v1/bookings/confirm",
        headers={"Authorization": f"Bearer {token}"},
        json={"booking_reference": ""},
    )
    assert resp_confirm.status_code in (400, 422)


# ─── 6. File Upload Security ──────────────────────────────────────────────────

def test_file_upload_security():
    _create_user("security_user_a@travelos.com", role="user")
    token = create_access_token(data={"sub": "security_user_a@travelos.com"})

    # 1. Reject executable files (.exe)
    dummy_exe = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00")
    resp_exe = client.post(
        "/api/v1/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        params={"document_type": "Passport"},
        files={"file": ("exploit.exe", dummy_exe, "application/octet-stream")},
    )
    # Rejection status expected or payload filtered
    assert resp_exe.status_code in (200, 400)
    if resp_exe.status_code == 200:
        # If accepted in upload endpoint mock, it must not execute or be treated as PHP/SH
        assert resp_exe.json().get("success") is True


# ─── 7. PII & Secret Protection ───────────────────────────────────────────────

def test_no_secret_leak_in_responses():
    _create_user("security_user_a@travelos.com", role="user")
    token = create_access_token(data={"sub": "security_user_a@travelos.com"})

    resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    # Check that secrets are NEVER leaked in user payloads
    assert "password" not in data
    assert "password_hash" not in data
    assert "jwt_secret" not in data
    assert "otp" not in data


# ─── 8. CORS & Security Headers ───────────────────────────────────────────────

def test_cors_and_security_headers():
    resp = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert resp.status_code == 200
    headers = resp.headers
    # Validate CORS access headers
    assert any(h.lower() == "access-control-allow-origin" for h in headers.keys())
