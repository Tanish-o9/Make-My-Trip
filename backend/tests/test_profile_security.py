import io
import datetime
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User, UserProfile, RefreshToken, SecurityEvent
from app.models.bookings import FlightBooking, BookingStatus
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_test_data():
    """Ensure clean test data before each test."""
    db = SessionLocal()
    try:
        test_emails = [
            "profile_user1@travelos.com",
            "profile_user2@travelos.com",
            "delete_me_user@travelos.com",
            "admin_profile_test@travelos.com",
        ]
        for email in test_emails:
            user = db.query(User).filter(User.email == email).first()
            if user:
                db.query(SecurityEvent).filter(SecurityEvent.user_id == user.id).delete()
                db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
                db.query(UserProfile).filter(UserProfile.user_id == user.id).delete()
                db.query(FlightBooking).filter(FlightBooking.user_id == user.id).delete()
                db.delete(user)
        db.commit()
        from sqlalchemy import text
        db.execute(text("DELETE FROM user_profiles WHERE user_id NOT IN (SELECT id FROM users)"))
        db.execute(text("DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users)"))
        db.execute(text("DELETE FROM security_events WHERE user_id NOT IN (SELECT id FROM users)"))
        db.commit()
    finally:
        db.close()



def _create_test_user(email="profile_user1@travelos.com", password="Password123!", role="user"):
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=hash_password(password),
            email_verified=True,
            phone="+919876543210",
            phone_verified=True,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        profile = UserProfile(
            user_id=user.id,
            full_name="Profile Test User",
            email=email,
            mobile_number="+919876543210",
        )
        db.add(profile)
        db.commit()
        return user.id
    finally:
        db.close()


# ─── 1. Get Own Profile ─────────────────────────────────────────────────────────

def test_01_get_own_profile():
    uid = _create_test_user("profile_user1@travelos.com")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "profile_user1@travelos.com"
    assert data["full_name"] == "Profile Test User"
    assert data["email_verified"] is True
    assert "password" not in data
    assert "password_hash" not in data


# ─── 2. Update Own Profile ──────────────────────────────────────────────────────

def test_02_update_own_profile():
    uid = _create_test_user("profile_user1@travelos.com")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    resp = client.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Updated Name",
            "gender": "female",
            "dob": "1995-06-15",
            "preferred_currency": "USD",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "Updated Name"
    assert data["gender"] == "female"
    assert data["dob"] == "1995-06-15"
    assert data["preferred_currency"] == "USD"


# ─── 3. Unauthorized Profile Access ───────────────────────────────────────────

def test_03_unauthorized_access():
    resp = client.get("/api/v1/users/me")
    assert resp.status_code in (401, 403)


# ─── 4. IDOR Protection ────────────────────────────────────────────────────────

def test_04_idor_protection():
    u1 = _create_test_user("profile_user1@travelos.com")
    u2 = _create_test_user("profile_user2@travelos.com")

    token1 = create_access_token(data={"sub": "profile_user1@travelos.com"})

    # User 1 calling /users/me gets only user 1's profile
    resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token1}"})
    assert resp.status_code == 200
    assert resp.json()["id"] == u1
    assert resp.json()["email"] == "profile_user1@travelos.com"


# ─── 5. Email Verification Status ──────────────────────────────────────────────

def test_05_email_verification_status():
    db = SessionLocal()
    try:
        user = User(
            email="unverified_profile@travelos.com",
            password_hash=hash_password("Pass123!"),
            email_verified=False,
            role="user",
        )
        db.add(user)
        db.commit()
    finally:
        db.close()

    token = create_access_token(data={"sub": "unverified_profile@travelos.com"})
    resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email_verified"] is False


# ─── 6. Email Change Protection ────────────────────────────────────────────────

def test_06_email_change_protection():
    _create_test_user("profile_user1@travelos.com")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    resp = client.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": "hacked_email@travelos.com"},
    )
    assert resp.status_code == 400
    assert "cannot be changed directly" in resp.json()["detail"].lower()


# ─── 7. Change Password Success ────────────────────────────────────────────────

def test_07_change_password_success():
    _create_test_user("profile_user1@travelos.com", password="OldPassword123!")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    resp = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": "OldPassword123!",
            "new_password": "NewBrandPassword123!",
            "confirm_password": "NewBrandPassword123!",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Old password fails
    old_login = client.post("/api/v1/auth/token", data={"username": "profile_user1@travelos.com", "password": "OldPassword123!"})
    assert old_login.status_code in (401, 403)

    # New password succeeds
    new_login = client.post("/api/v1/auth/token", data={"username": "profile_user1@travelos.com", "password": "NewBrandPassword123!"})
    assert new_login.status_code == 200


# ─── 8. Wrong Current Password ─────────────────────────────────────────────────

def test_08_wrong_current_password():
    _create_test_user("profile_user1@travelos.com", password="CorrectPassword1!")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    resp = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": "WrongPassword1!",
            "new_password": "NewBrandPassword123!",
            "confirm_password": "NewBrandPassword123!",
        },
    )
    assert resp.status_code == 400
    assert "incorrect" in resp.json()["detail"].lower()


# ─── 9. Weak New Password ──────────────────────────────────────────────────────

def test_09_weak_new_password():
    _create_test_user("profile_user1@travelos.com", password="CurrentPass123!")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    resp = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": "CurrentPass123!",
            "new_password": "weak",
            "confirm_password": "weak",
        },
    )
    assert resp.status_code == 400


# ─── 10. Password Mismatch ────────────────────────────────────────────────────

def test_10_password_mismatch():
    _create_test_user("profile_user1@travelos.com", password="CurrentPass123!")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    resp = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": "CurrentPass123!",
            "new_password": "NewPassword123!",
            "confirm_password": "DifferentPassword123!",
        },
    )
    assert resp.status_code == 400
    assert "match" in resp.json()["detail"].lower()


# ─── 11. Session Revocation ───────────────────────────────────────────────────

def test_11_session_revocation():
    uid = _create_test_user("profile_user1@travelos.com", password="InitialPass1!")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    # Add a mock refresh token for device B
    db = SessionLocal()
    rt = RefreshToken(
        user_id=uid,
        token_hash="hash_device_b",
        device_id="device_b",
        issued_at=datetime.datetime.utcnow(),
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
        revoked=False,
    )
    db.add(rt)
    db.commit()
    db.close()

    # Change password from device A
    client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}", "X-Device-Id": "device_a"},
        json={
            "current_password": "InitialPass1!",
            "new_password": "ChangedPass123!",
            "confirm_password": "ChangedPass123!",
        },
    )

    db = SessionLocal()
    rt_check = db.query(RefreshToken).filter(RefreshToken.token_hash == "hash_device_b").first()
    assert rt_check.revoked is True
    db.close()


# ─── 12. Profile Image Validation ──────────────────────────────────────────────

def test_12_profile_image_valid_upload():
    _create_test_user("profile_user1@travelos.com")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    dummy_image = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"A" * 100)
    resp = client.post(
        "/api/v1/users/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("avatar.png", dummy_image, "image/png")},
    )
    assert resp.status_code == 200
    assert "avatar_url" in resp.json()
    assert "/static/uploads/avatars/" in resp.json()["avatar_url"]


# ─── 13. Oversized Image Rejection ─────────────────────────────────────────────

def test_13_oversized_image_rejection():
    _create_test_user("profile_user1@travelos.com")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    huge_file = io.BytesIO(b"A" * (6 * 1024 * 1024))  # 6MB
    resp = client.post(
        "/api/v1/users/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("huge.png", huge_file, "image/png")},
    )
    assert resp.status_code == 400
    assert "exceeds" in resp.json()["detail"].lower()


# ─── 14. Invalid MIME Type Rejection ───────────────────────────────────────────

def test_14_invalid_mime_rejection():
    _create_test_user("profile_user1@travelos.com")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    script_file = io.BytesIO(b"<script>alert(1)</script>")
    resp = client.post(
        "/api/v1/users/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("script.svg", script_file, "image/svg+xml")},
    )
    assert resp.status_code == 400


# ─── 15. Account Deletion Authorization ───────────────────────────────────────

def test_15_account_deletion_authorization():
    uid = _create_test_user("delete_me_user@travelos.com", password="DeletePassword1!")
    token = create_access_token(data={"sub": "delete_me_user@travelos.com"})

    # Wrong password fails
    r_bad = client.post(
        "/api/v1/users/me/delete",
        headers={"Authorization": f"Bearer {token}"},
        json={"password": "WrongPassword!", "confirm": True},
    )
    assert r_bad.status_code == 400

    # Valid deletion
    r_ok = client.post(
        "/api/v1/users/me/delete",
        headers={"Authorization": f"Bearer {token}"},
        json={"password": "DeletePassword1!", "confirm": True, "reason": "Moving abroad"},
    )
    assert r_ok.status_code == 200
    assert r_ok.json()["success"] is True

    # User marked inactive
    db = SessionLocal()
    u = db.query(User).filter(User.id == uid).first()
    assert u.is_active is False
    db.close()


# ─── 16. Historical Booking Integrity ──────────────────────────────────────────

def test_16_historical_booking_integrity():
    uid = _create_test_user("profile_user1@travelos.com")
    token = create_access_token(data={"sub": "profile_user1@travelos.com"})

    # Create mock historical booking
    db = SessionLocal()
    booking = FlightBooking(
        booking_reference="TOS-HIST-001",
        user_id=uid,
        origin="DEL",
        destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        airline_code="6E",
        flight_number="6E-204",
        cabin_class="ECONOMY",
        total_amount=15000.0,
        currency="INR",
        status=BookingStatus.CONFIRMED,
        passenger_details=[{"name": "Original Name On Ticket", "seat": "12A"}],
        pricing_snapshot={"base": 12000, "taxes": 3000},
    )
    db.add(booking)
    db.commit()
    db.close()

    # User updates name in profile
    client.patch(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"full_name": "New Married Name"},
    )

    # Booking record must remain historically intact
    db = SessionLocal()
    b = db.query(FlightBooking).filter(FlightBooking.booking_reference == "TOS-HIST-001").first()
    assert b.passenger_details[0]["name"] == "Original Name On Ticket"
    db.close()



# ─── 17. Admin Authentication Regression ──────────────────────────────────────

def test_17_admin_auth_regression():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin_profile_test@travelos.com").first()
        if not admin:
            admin = User(
                email="admin_profile_test@travelos.com",
                password_hash=hash_password("AdminSecurePass1!"),
                role="admin",
                email_verified=True,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()

    resp = client.post("/api/v1/auth/token", data={
        "username": "admin_profile_test@travelos.com",
        "password": "AdminSecurePass1!",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()
