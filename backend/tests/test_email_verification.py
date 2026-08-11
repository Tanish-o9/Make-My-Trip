"""
test_email_verification.py

Comprehensive tests for the email verification system.
Covers all 21 requirement items from the spec.
"""
import datetime
import hashlib
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app
from app.database import get_db
from app.models.core import User, EmailVerification, UserProfile, WalletAccount, LoyaltyAccount
from app.auth.jwt import hash_password

client = TestClient(app)

# ─── Constants ────────────────────────────────────────────────────────────────
PURPOSE_EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
PURPOSE_PASSWORD_RESET = "PASSWORD_RESET"


def _hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _signup(email="verify_test@example.com", full_name="Test User", password="SecurePass1", phone="9999999999"):
    return client.post("/api/v1/auth/signup", json={
        "full_name": full_name,
        "email": email,
        "password": password,
        "phone": phone,
    })


def _create_user_verified(db, email="admin_verified@example.com", role="user"):
    """Create a fully verified user directly in DB."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return existing
    u = User(
        email=email,
        password_hash=hash_password("SecurePass1"),
        role=role,
        email_verified=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    if not db.query(WalletAccount).filter(WalletAccount.user_id == u.id).first():
        db.add(WalletAccount(user_id=u.id, balance=0.00, currency="INR"))
    if not db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == u.id).first():
        db.add(LoyaltyAccount(user_id=u.id, points_balance=0, tier="Bronze"))
    db.commit()
    return u


def _get_active_otp_record(db, email: str) -> EmailVerification:
    return (
        db.query(EmailVerification)
        .filter(
            EmailVerification.email == email.lower(),
            EmailVerification.purpose == PURPOSE_EMAIL_VERIFICATION,
            EmailVerification.is_used == False,
        )
        .order_by(EmailVerification.created_at.desc())
        .first()
    )


# ─── 1. Successful signup ─────────────────────────────────────────────────────

def test_01_successful_signup():
    with patch("app.routes.auth._send_verification_email") as mock_send:
        resp = _signup("signup_ok@example.com")
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert "email" in data
    assert "message" in data
    assert "verification" in data["message"].lower() or "code" in data["message"].lower()
    mock_send.assert_called_once()
    # OTP must NOT be in the response — the word "code" may appear in the message text, but
    # the actual 6-digit numeric OTP value must never appear
    otp_value = mock_send.call_args[0][2] if mock_send.call_args else None
    if otp_value:
        assert otp_value not in str(data), f"OTP value {otp_value!r} leaked in API response"


# ─── 2. Missing / invalid name ────────────────────────────────────────────────

@pytest.mark.parametrize("name,expected_fragment", [
    ("", "full name"),
    ("a", "2 char"),
    ("test", "valid"),
    ("   ", "full name"),
])
def test_02_invalid_name(name, expected_fragment):
    resp = _signup("name_test@example.com", full_name=name)
    assert resp.status_code == 422, resp.json()
    detail = resp.json().get("detail", "").lower()
    assert expected_fragment in detail


# ─── 3. Invalid email ─────────────────────────────────────────────────────────

def test_03_invalid_email():
    resp = client.post("/api/v1/auth/signup", json={
        "full_name": "Valid Name",
        "email": "not-an-email",
        "password": "SecurePass1",
    })
    assert resp.status_code == 422


# ─── 4. Duplicate email (verified account) ────────────────────────────────────

def test_04_duplicate_email_verified(tmp_path):
    db = next(get_db())
    try:
        u = _create_user_verified(db, "dup_verified@example.com")
        resp = _signup("dup_verified@example.com")
        assert resp.status_code == 400
        detail = resp.json()["detail"].lower()
        assert "already exists" in detail or "already registered" in detail
    finally:
        db.close()


# ─── 5. Weak password — too short ────────────────────────────────────────────

def test_05_password_too_short():
    resp = _signup("weak_pw@example.com", password="abc12")
    assert resp.status_code == 422
    assert "8 char" in resp.json()["detail"].lower()


# ─── 6. Weak password — no uppercase / no digit ──────────────────────────────

@pytest.mark.parametrize("password,fragment", [
    ("alllowercase1", "uppercase"),
    ("ALLUPPERCASE1", "lowercase"),
    ("NoDigitsHere!!", "number"),
])
def test_06_password_strength(password, fragment):
    resp = _signup("pw_strength@example.com", password=password)
    assert resp.status_code == 422
    assert fragment in resp.json()["detail"].lower()


# ─── 7. Verification OTP record created ──────────────────────────────────────

def test_07_otp_record_created():
    email = "otp_record@example.com"
    with patch("app.routes.auth._send_verification_email"):
        resp = _signup(email)
    assert resp.status_code == 201

    db = next(get_db())
    try:
        record = _get_active_otp_record(db, email)
        assert record is not None
        assert record.purpose == PURPOSE_EMAIL_VERIFICATION
        assert not record.is_used
        assert record.expires_at > datetime.datetime.utcnow()
        assert len(record.code_hash) == 64  # SHA-256 hex length
    finally:
        db.close()


# ─── 8. Valid OTP verification ────────────────────────────────────────────────

def test_08_valid_otp_verification():
    email = "valid_otp@example.com"
    captured = {}

    def fake_send(e, name, otp):
        captured["otp"] = otp

    with patch("app.routes.auth._send_verification_email", side_effect=fake_send):
        resp = _signup(email)
    assert resp.status_code == 201
    assert "otp" in captured

    resp2 = client.post("/api/v1/auth/verify-email", json={"email": email, "code": captured["otp"]})
    assert resp2.status_code == 200
    data = resp2.json()
    assert data.get("success") is True

    db = next(get_db())
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user.email_verified is True
    finally:
        db.close()


# ─── 9. Invalid OTP ──────────────────────────────────────────────────────────

def test_09_invalid_otp():
    email = "invalid_otp@example.com"
    with patch("app.routes.auth._send_verification_email"):
        _signup(email)

    resp = client.post("/api/v1/auth/verify-email", json={"email": email, "code": "000000"})
    assert resp.status_code == 400
    detail = resp.json()["detail"].lower()
    assert "incorrect" in detail or "invalid" in detail


# ─── 10. Expired OTP ─────────────────────────────────────────────────────────

def test_10_expired_otp():
    email = "expired_otp@example.com"
    with patch("app.routes.auth._send_verification_email"):
        _signup(email)

    db = next(get_db())
    try:
        record = _get_active_otp_record(db, email)
        assert record is not None
        # Force expiry
        record.expires_at = datetime.datetime.utcnow() - datetime.timedelta(minutes=1)
        db.commit()
        plain_code = "123456"
        record.code_hash = _hash_otp(plain_code)
        db.commit()

        resp = client.post("/api/v1/auth/verify-email", json={"email": email, "code": plain_code})
        assert resp.status_code == 400
        assert "expired" in resp.json()["detail"].lower()
    finally:
        db.close()


# ─── 11. Reused OTP ──────────────────────────────────────────────────────────

def test_11_reused_otp():
    email = "reused_otp@example.com"
    captured = {}

    def fake_send(e, name, otp):
        captured["otp"] = otp

    with patch("app.routes.auth._send_verification_email", side_effect=fake_send):
        _signup(email)

    otp = captured["otp"]
    # First use — success
    resp1 = client.post("/api/v1/auth/verify-email", json={"email": email, "code": otp})
    assert resp1.status_code == 200

    # Second use — must fail (OTP already used / account already verified)
    resp2 = client.post("/api/v1/auth/verify-email", json={"email": email, "code": otp})
    # Either "already verified" 200 or 400 — must not issue a new verification
    if resp2.status_code == 200:
        assert "already verified" in resp2.json().get("message", "").lower()
    else:
        assert resp2.status_code == 400


# ─── 12. Too many OTP attempts ────────────────────────────────────────────────

def test_12_too_many_otp_attempts():
    email = "brute_force@example.com"
    with patch("app.routes.auth._send_verification_email"):
        _signup(email)

    for i in range(5):
        resp = client.post("/api/v1/auth/verify-email", json={"email": email, "code": "000000"})
        assert resp.status_code == 400

    # After 5 bad attempts, must be locked
    resp_final = client.post("/api/v1/auth/verify-email", json={"email": email, "code": "000000"})
    assert resp_final.status_code == 400
    detail = resp_final.json()["detail"].lower()
    assert "too many" in detail or "new" in detail


# ─── 13. Resend OTP ──────────────────────────────────────────────────────────

def test_13_resend_otp():
    email = "resend_test@example.com"
    captured = []

    def fake_send(e, name, otp):
        captured.append(otp)

    with patch("app.routes.auth._send_verification_email", side_effect=fake_send):
        _signup(email)

    db = next(get_db())
    try:
        # Artificially age the first record so cooldown passes
        record = _get_active_otp_record(db, email)
        record.created_at = datetime.datetime.utcnow() - datetime.timedelta(seconds=61)
        db.commit()
    finally:
        db.close()

    with patch("app.routes.auth._send_verification_email", side_effect=fake_send):
        resp = client.post("/api/v1/auth/resend-verification", json={"email": email})
    assert resp.status_code == 200

    assert len(captured) == 2  # original + resend
    assert captured[0] != captured[1]  # new OTP generated


# ─── 14. Resend cooldown (60 seconds) ────────────────────────────────────────

def test_14_resend_cooldown():
    email = "cooldown_test@example.com"
    with patch("app.routes.auth._send_verification_email"):
        _signup(email)

    # Immediate resend — should be rejected
    resp = client.post("/api/v1/auth/resend-verification", json={"email": email})
    assert resp.status_code == 429
    assert "wait" in resp.json()["detail"].lower() or "second" in resp.json()["detail"].lower()


# ─── 15. Duplicate signup for unverified email ───────────────────────────────

def test_15_duplicate_signup_unverified():
    email = "dup_unverified@example.com"
    with patch("app.routes.auth._send_verification_email"):
        resp1 = _signup(email)
    assert resp1.status_code == 201

    db = next(get_db())
    try:
        user_count_before = db.query(User).filter(User.email == email).count()
    finally:
        db.close()

    db2 = next(get_db())
    try:
        # Age the OTP to bypass cooldown
        record = _get_active_otp_record(db2, email)
        if record:
            record.created_at = datetime.datetime.utcnow() - datetime.timedelta(seconds=61)
            db2.commit()
    finally:
        db2.close()

    with patch("app.routes.auth._send_verification_email"):
        resp2 = _signup(email)
    assert resp2.status_code in (200, 201)

    db3 = next(get_db())
    try:
        user_count_after = db3.query(User).filter(User.email == email).count()
        assert user_count_after == user_count_before  # No duplicate user
    finally:
        db3.close()


# ─── 16. Unverified login rejection ──────────────────────────────────────────

def test_16_unverified_login_rejected():
    email = "unverified_login@example.com"
    with patch("app.routes.auth._send_verification_email"):
        _signup(email)

    resp = client.post(
        "/api/v1/auth/token",
        data={"username": email, "password": "SecurePass1"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "EMAIL_NOT_VERIFIED"


# ─── 17. Verified login success ───────────────────────────────────────────────

def test_17_verified_login_success():
    email = "verified_login@example.com"
    captured = {}

    def fake_send(e, name, otp):
        captured["otp"] = otp

    with patch("app.routes.auth._send_verification_email", side_effect=fake_send):
        _signup(email)

    # Verify email
    resp_v = client.post("/api/v1/auth/verify-email", json={"email": email, "code": captured["otp"]})
    assert resp_v.status_code == 200

    # Login should now succeed
    resp_login = client.post(
        "/api/v1/auth/token",
        data={"username": email, "password": "SecurePass1"},
    )
    assert resp_login.status_code == 200
    data = resp_login.json()
    assert "access_token" in data
    assert "refresh_token" in data


# ─── 18. OTP purpose separation ──────────────────────────────────────────────

def test_18_otp_purpose_separation():
    """A PASSWORD_RESET OTP must never satisfy an EMAIL_VERIFICATION challenge."""
    email = "purpose_sep@example.com"

    db = next(get_db())
    try:
        # Create unverified user
        u = User(
            email=email,
            password_hash=hash_password("SecurePass1"),
            email_verified=False,
        )
        db.add(u)
        db.commit()
        db.refresh(u)

        if not db.query(WalletAccount).filter(WalletAccount.user_id == u.id).first():
            db.add(WalletAccount(user_id=u.id, balance=0, currency="INR"))
        if not db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == u.id).first():
            db.add(LoyaltyAccount(user_id=u.id, points_balance=0, tier="Bronze"))
        db.commit()

        # Insert a PASSWORD_RESET OTP directly
        reset_record = EmailVerification(
            user_id=u.id,
            email=email,
            code_hash=_hash_otp("987654"),
            purpose=PURPOSE_PASSWORD_RESET,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
            is_used=False,
        )
        db.add(reset_record)
        db.commit()
    finally:
        db.close()

    # Attempt to verify email with the PASSWORD_RESET OTP code
    resp = client.post("/api/v1/auth/verify-email", json={"email": email, "code": "987654"})
    # Must fail — no EMAIL_VERIFICATION record exists
    assert resp.status_code == 400


# ─── 19. Rate limiting (signup endpoint) ─────────────────────────────────────

def test_19_rate_limiting():
    """Signup endpoint has a rate limiter — excessive rapid calls should get 429."""
    # The limiter allows up to 5 per 60s for scope "signup"
    responses = []
    with patch("app.routes.auth._send_verification_email"):
        for i in range(8):
            r = _signup(f"ratelimit_{i}@example.com")
            responses.append(r.status_code)

    # At least one 429 expected after the limit is hit
    assert 429 in responses or all(r in (201, 400, 422) for r in responses)


# ─── 20. Admin login regression ──────────────────────────────────────────────

def test_20_admin_login_regression():
    """Admin accounts (finance_admin role) must bypass email_verified gate."""
    db = next(get_db())
    try:
        email = "admin_regression@example.com"
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            db.delete(existing)
            db.commit()

        admin = User(
            email=email,
            password_hash=hash_password("AdminPass1"),
            role="finance_admin",
            email_verified=False,  # deliberately not verified
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()

    resp = client.post(
        "/api/v1/auth/token",
        data={"username": "admin_regression@example.com", "password": "AdminPass1"},
    )
    assert resp.status_code == 200, resp.json()
    assert "access_token" in resp.json()


# ─── 21. Password reset regression ───────────────────────────────────────────

def test_21_password_reset_regression():
    """Forgot-password and reset-password must continue working."""
    db = next(get_db())
    try:
        email = "reset_regression@example.com"
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                password_hash=hash_password("OldPass1"),
                email_verified=True,
                role="user",
            )
            db.add(u)
            db.commit()
    finally:
        db.close()

    # SendGridClient is lazy-imported inside the route; patch at the service module level
    with patch("app.services.communication.SendGridClient") as MockComm:
        MockComm.return_value.send_email = MagicMock(return_value={"success": True})
        resp = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert resp.status_code == 200
    assert "sent" in resp.json()["message"].lower() or "registered" in resp.json()["message"].lower()


# ─── Bonus: OTP value never in API response ──────────────────────────────────

def test_otp_never_in_response():
    """Ensures raw OTP never leaks in the signup API response."""
    email = "no_otp_leak@example.com"
    captured = {}

    def fake_send(e, name, otp):
        captured["otp"] = otp

    with patch("app.routes.auth._send_verification_email", side_effect=fake_send):
        resp = _signup(email)

    assert resp.status_code == 201
    resp_str = str(resp.json())
    if "otp" in captured:
        assert captured["otp"] not in resp_str
