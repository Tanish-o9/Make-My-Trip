import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, RefreshToken
from app.auth.jwt import hash_password, decode_token, hash_token

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_user():
    db = SessionLocal()
    # Ensure test user exists
    user = db.query(User).filter(User.email == "security_test@travelos.com").first()
    if not user:
        user = User(
            email="security_test@travelos.com",
            password_hash=hash_password("securepassword"),
            role="user",
            preferred_language="en",
            preferred_currency="INR"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    yield user
    # Clean up tokens
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
    db.commit()
    db.close()


def test_auth_token_generation_on_login():
    resp = client.post(
        "/api/v1/auth/token",
        data={"username": "security_test@travelos.com", "password": "securepassword"},
        headers={"X-Device-Id": "device_pc_1"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

    # Verify database entry
    db = SessionLocal()
    t_hash = hash_token(data["refresh_token"])
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == t_hash).first()
    assert db_token is not None
    assert db_token.device_id == "device_pc_1"
    assert db_token.revoked is False
    db.close()


def test_auth_token_refresh_and_rotation():
    # Login first
    login_resp = client.post(
        "/api/v1/auth/token",
        data={"username": "security_test@travelos.com", "password": "securepassword"},
        headers={"X-Device-Id": "device_phone_1"}
    )
    orig_tokens = login_resp.json()
    orig_refresh = orig_tokens["refresh_token"]

    # Call refresh
    refresh_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": orig_refresh, "device_id": "device_phone_1"}
    )
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    assert new_tokens["refresh_token"] != orig_refresh

    db = SessionLocal()
    # Check that original refresh token is now revoked
    orig_hash = hash_token(orig_refresh)
    orig_db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == orig_hash).first()
    assert orig_db_token.revoked is True

    # Check that new refresh token is active
    new_hash = hash_token(new_tokens["refresh_token"])
    new_db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == new_hash).first()
    assert new_db_token is not None
    assert new_db_token.revoked is False
    db.close()


def test_auth_token_replay_attack_prevention():
    # Login
    login_resp = client.post(
        "/api/v1/auth/token",
        data={"username": "security_test@travelos.com", "password": "securepassword"},
        headers={"X-Device-Id": "device_phone_2"}
    )
    orig_tokens = login_resp.json()
    orig_refresh = orig_tokens["refresh_token"]

    # First Refresh (valid rotation)
    r1_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": orig_refresh, "device_id": "device_phone_2"}
    )
    assert r1_resp.status_code == 200
    r1_tokens = r1_resp.json()

    # Replay Attack: attempt to refresh AGAIN using the original (already rotated) token
    r2_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": orig_refresh, "device_id": "device_phone_2"}
    )
    assert r2_resp.status_code == 401
    assert "compromised" in r2_resp.json()["detail"].lower()

    # Check that the system auto-revoked ALL user sessions due to replay detection
    db = SessionLocal()
    active_tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == orig_db_user_id(orig_tokens["access_token"]),
        RefreshToken.revoked == False
    ).all()
    assert len(active_tokens) == 0
    db.close()


def test_multi_device_sessions_revocation():
    # Login Device 1
    resp1 = client.post(
        "/api/v1/auth/token",
        data={"username": "security_test@travelos.com", "password": "securepassword"},
        headers={"X-Device-Id": "device_ipad_1"}
    )
    token1 = resp1.json()["access_token"]

    # Login Device 2
    client.post(
        "/api/v1/auth/token",
        data={"username": "security_test@travelos.com", "password": "securepassword"},
        headers={"X-Device-Id": "device_macbook_1"}
    )

    # Get active sessions via API
    sess_resp = client.get(
        "/api/v1/auth/sessions",
        headers={"Authorization": f"Bearer {token1}"}
    )
    assert sess_resp.status_code == 200
    sessions = sess_resp.json()
    assert len(sessions) >= 2

    # Revoke one session
    target_session_id = sessions[0]["id"]
    revoke_resp = client.post(
        "/api/v1/auth/sessions/revoke",
        json={"session_id": target_session_id},
        headers={"Authorization": f"Bearer {token1}"}
    )
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["success"] is True

    # Verify session revoked in DB
    db = SessionLocal()
    db_token = db.query(RefreshToken).filter(RefreshToken.id == target_session_id).first()
    assert db_token.revoked is True
    db.close()


def orig_db_user_id(token: str) -> int:
    payload = decode_token(token)
    return payload.get("id")


def test_idor_flight_booking_access():
    # Attempt to retrieve status / modify flight booking of another user
    # 1. Login user A
    resp_a = client.post(
        "/api/v1/auth/token",
        data={"username": "security_test@travelos.com", "password": "securepassword"}
    )
    token_a = resp_a.json()["access_token"]
    
    # 2. Create another user B in DB
    db = SessionLocal()
    user_b = db.query(User).filter(User.email == "user_b@travelos.com").first()
    if not user_b:
        user_b = User(
            email="user_b@travelos.com",
            password_hash=hash_password("securepassword"),
            role="user"
        )
        db.add(user_b)
        db.commit()
        db.refresh(user_b)
        
    # Create a mock flight booking for user B
    from app.models.bookings import FlightBooking, BookingStatus
    from decimal import Decimal
    import datetime
    
    booking_ref = "BK-SEC-TEST-FL"
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == booking_ref).first()
    if not booking:
        now = datetime.datetime.utcnow()
        booking = FlightBooking(
            booking_reference=booking_ref,
            user_id=user_b.id,
            status=BookingStatus.HOLD,
            total_amount=5000.0,
            currency="INR",
            pricing_snapshot={},
            origin="DEL",
            destination="BOM",
            airline_code="AI",
            flight_number="101",
            departure_time=now,
            arrival_time=now + datetime.timedelta(hours=2),
            passenger_details=[{"name": "Test Passenger", "age": 30}]
        )
        db.add(booking)
        db.commit()
    db.close()
    
    # User A tries to check status of User B's flight booking
    resp = client.get(
        f"/api/v1/bookings/status/check?booking_reference={booking_ref}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp.status_code == 403

    # User A tries to cancel User B's flight booking
    resp = client.post(
        "/api/v1/bookings/engine/cancel-booking",
        json={"booking_reference": booking_ref},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp.status_code == 403


def test_unauthenticated_saas_endpoints_restricted():
    # Compliance exports/deletions must be authenticated
    resp1 = client.get("/api/v1/compliance/export?email=security_test@travelos.com")
    assert resp1.status_code == 401
    
    resp2 = client.delete("/api/v1/compliance/delete?email=security_test@travelos.com")
    assert resp2.status_code == 401
    
    # Audit logs and DLQ must be authenticated
    resp3 = client.get("/api/v1/audit/logs")
    assert resp3.status_code == 401
    
    resp4 = client.get("/api/v1/events/dlq")
    assert resp4.status_code == 401


def test_unauthenticated_partner_endpoints_restricted():
    # Partner billing, sandbox, and dashboard require auth
    resp1 = client.get("/api/v1/partner/billing/usage?tenant_id=1")
    assert resp1.status_code == 401
    
    resp2 = client.post("/api/v1/partner/sandbox/configure?sandbox_enabled=true&tenant_id=1")
    assert resp2.status_code == 401


def test_unauthenticated_vehicle_telemetry_restricted():
    # Telemetry and emergency endpoints must be authenticated
    resp1 = client.get("/api/v1/rent-a-ride/telemetry/BK-SOME-REF")
    assert resp1.status_code == 401
    
    resp2 = client.post("/api/v1/rent-a-ride/emergency", json={"booking_reference": "BK-SOME-REF", "issue_type": "flat_tire"})
    assert resp2.status_code == 401


def test_unauthenticated_activity_voucher_restricted():
    # Activity voucher lookup must be authenticated
    resp = client.get("/api/v1/activities/BK-AC-SOME-REF/voucher")
    assert resp.status_code == 401


def test_webhook_partner_token_validation():
    # Partner webhook update must reject invalid tokens
    payload = {
        "booking_reference": "BK-SOME-REF",
        "vertical": "flights",
        "event_type": "delay",
        "description": "Flight delayed by 2 hours"
    }
    resp = client.post(
        "/api/v1/providers/webhooks/partner-update",
        json=payload,
        headers={"X-Partner-Token": "invalid_token"}
    )
    assert resp.status_code == 401
    
    # Should reject if token header is missing
    resp = client.post(
        "/api/v1/providers/webhooks/partner-update",
        json=payload
    )
    assert resp.status_code == 401


def test_unauthenticated_media_restricted():
    # Media creation/updating/deleting must be authenticated
    resp = client.post(
        "/api/v1/media",
        data={"owner_type": "hotel", "owner_id": "H101", "alt_text": "Nice Room"}
    )
    assert resp.status_code == 401

