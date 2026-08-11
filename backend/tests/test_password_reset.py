import datetime
import hashlib
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db, SessionLocal
from app.models.core import User, EmailVerification, RefreshToken
from app.auth.jwt import hash_password, verify_password

client = TestClient(app)

PURPOSE_PASSWORD_RESET = "PASSWORD_RESET"
PURPOSE_EMAIL_VERIFICATION = "EMAIL_VERIFICATION"


@pytest.fixture(autouse=True)
def clean_test_data():
    """Ensure clean test data before each test."""
    db = SessionLocal()
    try:
        test_emails = [
            "reset_test_user@example.com",
            "reset_cooldown@example.com",
            "reset_attempts@example.com",
            "reset_expired@example.com",
            "reset_reuse@example.com",
            "reset_isolation@example.com",
            "reset_session@example.com",
            "unknown_user@example.com",
        ]
        for email in test_emails:
            user = db.query(User).filter(User.email == email).first()
            if user:
                db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
                db.query(EmailVerification).filter(EmailVerification.user_id == user.id).delete()
                db.delete(user)
            db.query(EmailVerification).filter(EmailVerification.email == email).delete()
        db.commit()
    finally:
        db.close()


def _create_user(email="reset_test_user@example.com", password="OldPassword1", role="user"):
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=hash_password(password),
            email_verified=True,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id
    finally:
        db.close()


def _get_active_otp(email, purpose=PURPOSE_PASSWORD_RESET):
    db = SessionLocal()
    try:
        rec = (
            db.query(EmailVerification)
            .filter(
                EmailVerification.email == email,
                EmailVerification.purpose == purpose,
                EmailVerification.is_used == False,
            )
            .order_by(EmailVerification.created_at.desc())
            .first()
        )
        if not rec:
            return None
        target_hash = rec.code_hash
        for i in range(1000000):
            c = f"{i:06d}"
            if hashlib.sha256(c.encode()).hexdigest() == target_hash:
                return c
        return None
    finally:
        db.close()


# ─── 1. Forgot password request ──────────────────────────────────────────────────

def test_01_forgot_password_success():
    _create_user("reset_test_user@example.com")
    with patch("app.routes.auth._send_password_reset_email") as mock_send:
        resp = client.post("/api/v1/auth/forgot-password", json={"email": "reset_test_user@example.com"})
    assert resp.status_code == 200
    assert "password reset code" in resp.json()["message"].lower()
    mock_send.assert_called_once()


# ─── 2. Unknown email (anti-enumeration) ────────────────────────────────────────

def test_02_forgot_password_unknown_email():
    with patch("app.routes.auth._send_password_reset_email") as mock_send:
        resp = client.post("/api/v1/auth/forgot-password", json={"email": "unknown_user@example.com"})
    assert resp.status_code == 200
    assert "password reset code" in resp.json()["message"].lower()
    mock_send.assert_not_called()


# ─── 3. Valid reset OTP verification ──────────────────────────────────────────

def test_03_valid_reset_otp():
    _create_user("reset_test_user@example.com")
    with patch("app.routes.auth._send_password_reset_email"):
        client.post("/api/v1/auth/forgot-password", json={"email": "reset_test_user@example.com"})

    otp = _get_active_otp("reset_test_user@example.com")
    assert otp is not None

    resp = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_test_user@example.com",
        "code": otp,
        "new_password": "NewSecurePassword1",
        "confirm_password": "NewSecurePassword1",
    })
    assert resp.status_code == 200
    assert resp.json().get("success") is True


# ─── 4. Invalid OTP rejection ──────────────────────────────────────────────────

def test_04_invalid_otp_rejection():
    _create_user("reset_test_user@example.com")
    with patch("app.routes.auth._send_password_reset_email"):
        client.post("/api/v1/auth/forgot-password", json={"email": "reset_test_user@example.com"})

    resp = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_test_user@example.com",
        "code": "000000",
        "new_password": "NewSecurePassword1",
        "confirm_password": "NewSecurePassword1",
    })
    assert resp.status_code == 400
    assert "incorrect" in resp.json()["detail"].lower()


# ─── 5. Expired OTP rejection ──────────────────────────────────────────────────

def test_05_expired_otp_rejection():
    _create_user("reset_expired@example.com")
    with patch("app.routes.auth._send_password_reset_email"):
        client.post("/api/v1/auth/forgot-password", json={"email": "reset_expired@example.com"})

    # Manually expire the record
    db = SessionLocal()
    rec = db.query(EmailVerification).filter(EmailVerification.email == "reset_expired@example.com").first()
    rec.expires_at = datetime.datetime.utcnow() - datetime.timedelta(minutes=1)
    db.commit()
    db.close()

    otp = _get_active_otp("reset_expired@example.com")
    resp = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_expired@example.com",
        "code": otp or "123456",
        "new_password": "NewSecurePassword1",
        "confirm_password": "NewSecurePassword1",
    })
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


# ─── 6. OTP reuse rejection ───────────────────────────────────────────────────

def test_06_otp_reuse_rejection():
    _create_user("reset_reuse@example.com")
    with patch("app.routes.auth._send_password_reset_email"):
        client.post("/api/v1/auth/forgot-password", json={"email": "reset_reuse@example.com"})

    otp = _get_active_otp("reset_reuse@example.com")

    # First reset succeeds
    resp1 = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_reuse@example.com",
        "code": otp,
        "new_password": "NewPassword1",
        "confirm_password": "NewPassword1",
    })
    assert resp1.status_code == 200

    # Second reset with same code must fail
    resp2 = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_reuse@example.com",
        "code": otp,
        "new_password": "AnotherPassword2",
        "confirm_password": "AnotherPassword2",
    })
    assert resp2.status_code == 400
    assert "invalid or expired" in resp2.json()["detail"].lower()


# ─── 7. OTP attempt limit lockout ─────────────────────────────────────────────

def test_07_otp_attempt_limit_lockout():
    _create_user("reset_attempts@example.com")
    with patch("app.routes.auth._send_password_reset_email"):
        client.post("/api/v1/auth/forgot-password", json={"email": "reset_attempts@example.com"})

    # Submit 5 incorrect attempts
    for _ in range(5):
        resp = client.post("/api/v1/auth/reset-password", json={
            "email": "reset_attempts@example.com",
            "code": "999999",
            "new_password": "NewPassword1",
            "confirm_password": "NewPassword1",
        })
        assert resp.status_code == 400

    # Even with correct code, now locked out
    otp = _get_active_otp("reset_attempts@example.com")
    resp_locked = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_attempts@example.com",
        "code": otp or "123456",
        "new_password": "NewPassword1",
        "confirm_password": "NewPassword1",
    })
    assert resp_locked.status_code == 400


# ─── 8. Resend cooldown (60 seconds) ──────────────────────────────────────────

def test_08_resend_cooldown():
    _create_user("reset_cooldown@example.com")
    with patch("app.routes.auth._send_password_reset_email"):
        client.post("/api/v1/auth/forgot-password", json={"email": "reset_cooldown@example.com"})
        resp = client.post("/api/v1/auth/resend-password-reset", json={"email": "reset_cooldown@example.com"})
    assert resp.status_code == 429
    assert "wait" in resp.json()["detail"].lower()


# ─── 9. Password strength validation ──────────────────────────────────────────

def test_09_password_strength_policy():
    _create_user("reset_test_user@example.com")
    with patch("app.routes.auth._send_password_reset_email"):
        client.post("/api/v1/auth/forgot-password", json={"email": "reset_test_user@example.com"})
    otp = _get_active_otp("reset_test_user@example.com")

    # Short password
    r1 = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_test_user@example.com", "code": otp, "new_password": "Sh1", "confirm_password": "Sh1"
    })
    assert r1.status_code == 400
    assert "8 characters" in r1.json()["detail"]

    # No uppercase
    r2 = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_test_user@example.com", "code": otp, "new_password": "lowercaseonly1", "confirm_password": "lowercaseonly1"
    })
    assert r2.status_code == 400
    assert "uppercase" in r2.json()["detail"]

    # No number
    r3 = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_test_user@example.com", "code": otp, "new_password": "NoNumberPassword", "confirm_password": "NoNumberPassword"
    })
    assert r3.status_code == 400
    assert "number" in r3.json()["detail"]


# ─── 10. Password mismatch ────────────────────────────────────────────────────

def test_10_password_mismatch():
    _create_user("reset_test_user@example.com")
    with patch("app.routes.auth._send_password_reset_email"):
        client.post("/api/v1/auth/forgot-password", json={"email": "reset_test_user@example.com"})
    otp = _get_active_otp("reset_test_user@example.com")

    resp = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_test_user@example.com",
        "code": otp,
        "new_password": "ValidPassword1",
        "confirm_password": "DifferentPassword2",
    })
    assert resp.status_code == 400
    assert "do not match" in resp.json()["detail"].lower()


# ─── 11. Old password rejected & new password accepted ────────────────────────

def test_11_old_rejected_new_accepted():
    _create_user("reset_test_user@example.com", password="OldPassword1")
    with patch("app.routes.auth._send_password_reset_email"):
        client.post("/api/v1/auth/forgot-password", json={"email": "reset_test_user@example.com"})
    otp = _get_active_otp("reset_test_user@example.com")

    # Reset to NewPassword2
    client.post("/api/v1/auth/reset-password", json={
        "email": "reset_test_user@example.com",
        "code": otp,
        "new_password": "NewPassword2",
        "confirm_password": "NewPassword2",
    })

    # Old password login must fail
    login_old = client.post("/api/v1/auth/token", data={
        "username": "reset_test_user@example.com",
        "password": "OldPassword1",
    })
    assert login_old.status_code in (401, 403)

    # New password login must succeed
    login_new = client.post("/api/v1/auth/token", data={
        "username": "reset_test_user@example.com",
        "password": "NewPassword2",
    })
    assert login_new.status_code == 200
    assert "access_token" in login_new.json()


# ─── 12. Session revocation after reset ───────────────────────────────────────

def test_12_session_revocation_after_reset():
    user_id = _create_user("reset_session@example.com", password="InitialPass1")

    # Login to create a session token
    login_resp = client.post("/api/v1/auth/token", data={
        "username": "reset_session@example.com",
        "password": "InitialPass1",
    }, headers={"X-Device-Id": "device_pc_test"})
    assert login_resp.status_code == 200
    refresh_token = login_resp.json()["refresh_token"]

    # Reset password
    with patch("app.routes.auth._send_password_reset_email"):
        client.post("/api/v1/auth/forgot-password", json={"email": "reset_session@example.com"})
    otp = _get_active_otp("reset_session@example.com")

    client.post("/api/v1/auth/reset-password", json={
        "email": "reset_session@example.com",
        "code": otp,
        "new_password": "BrandNewPassword1",
        "confirm_password": "BrandNewPassword1",
    })

    # Old refresh token must now be revoked
    refresh_attempt = client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
        "device_id": "device_pc_test",
    })
    assert refresh_attempt.status_code in (401, 403)


# ─── 13. Purpose separation: RESET vs EMAIL_VERIFICATION ─────────────────────

def test_13_purpose_separation():
    _create_user("reset_isolation@example.com")

    # Create an EMAIL_VERIFICATION record
    db = SessionLocal()
    email_code = "112233"
    rec = EmailVerification(
        user_id=1,
        email="reset_isolation@example.com",
        code_hash=hashlib.sha256(email_code.encode()).hexdigest(),
        purpose=PURPOSE_EMAIL_VERIFICATION,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
        is_used=False,
    )
    db.add(rec)
    db.commit()
    db.close()

    # Try to use EMAIL_VERIFICATION code to reset password -> MUST FAIL
    resp = client.post("/api/v1/auth/reset-password", json={
        "email": "reset_isolation@example.com",
        "code": email_code,
        "new_password": "NewPassword1",
        "confirm_password": "NewPassword1",
    })
    assert resp.status_code == 400
    assert "invalid or expired" in resp.json()["detail"].lower()


# ─── 14. Admin login continues working ────────────────────────────────────────

def test_14_admin_login_regression():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin_reset_test@travelos.com").first()
        if not admin:
            admin = User(
                email="admin_reset_test@travelos.com",
                password_hash=hash_password("SuperAdminPass1!"),
                role="super_admin",
                email_verified=True,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()

    resp = client.post("/api/v1/auth/token", data={
        "username": "admin_reset_test@travelos.com",
        "password": "SuperAdminPass1!",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()
