import pytest
import datetime
import time
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, UserPaymentPin, UsedPaymentAuthToken
from app.auth.jwt import hash_password, create_access_token
from app.services import security_pin_service

client = TestClient(app)

@pytest.fixture
def pin_test_user():
    db = SessionLocal()
    email = f"pin_user_{datetime.datetime.utcnow().timestamp()}@travelos.com"
    user = User(
        email=email,
        password_hash=hash_password("PinSecretPass123"),
        role="user",
        email_verified=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.email, "email": user.email, "role": user.role})
    
    yield user, token

    # Cleanup
    db.query(UsedPaymentAuthToken).filter(UsedPaymentAuthToken.user_id == user.id).delete()
    db.query(UserPaymentPin).filter(UserPaymentPin.user_id == user.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()
    db.close()


@pytest.fixture
def second_pin_user():
    db = SessionLocal()
    email = f"pin_user_b_{datetime.datetime.utcnow().timestamp()}@travelos.com"
    user = User(
        email=email,
        password_hash=hash_password("OtherPass123!"),
        role="user",
        email_verified=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.email, "email": user.email, "role": user.role})
    yield user, token

    db.query(UsedPaymentAuthToken).filter(UsedPaymentAuthToken.user_id == user.id).delete()
    db.query(UserPaymentPin).filter(UserPaymentPin.user_id == user.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()
    db.close()


def test_01_set_pin(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["pin_enabled"] is True

    # Verify status
    status_resp = client.get("/api/v1/wallet/security-pin", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["pin_enabled"] is True


def test_02_correct_pin(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    verify_resp = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "1234", "purpose": "booking_payment"}, headers=headers)
    assert verify_resp.status_code == 200
    data = verify_resp.json()
    assert data["verified"] is True
    assert "payment_authorization_token" in data
    assert data["expires_in"] == 300


def test_03_wrong_pin(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    verify_resp = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "9999"}, headers=headers)
    assert verify_resp.status_code == 400
    assert "Incorrect security PIN" in verify_resp.json()["detail"]


def test_04_three_failed_attempts_temporary_lock(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    # Attempt 1 -> wrong
    r1 = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "0000"}, headers=headers)
    assert r1.status_code == 400

    # Attempt 2 -> wrong
    r2 = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "1111"}, headers=headers)
    assert r2.status_code == 400

    # Attempt 3 -> wrong -> locked!
    r3 = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "2222"}, headers=headers)
    assert r3.status_code == 429
    assert "Too many incorrect attempts" in r3.json()["detail"]

    # Subsequent attempt with correct PIN is blocked while locked
    r4 = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "1234"}, headers=headers)
    assert r4.status_code == 429
    assert "Too many incorrect attempts" in r4.json()["detail"]


def test_05_change_pin(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    change_resp = client.post("/api/v1/wallet/security-pin/change", json={"old_pin": "1234", "new_pin": "5678"}, headers=headers)
    assert change_resp.status_code == 200
    assert change_resp.json()["success"] is True

    # Old PIN fail
    r_old = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "1234"}, headers=headers)
    assert r_old.status_code == 400

    # New PIN pass
    r_new = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "5678"}, headers=headers)
    assert r_new.status_code == 200
    assert r_new.json()["verified"] is True


def test_06_remove_pin(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    remove_resp = client.post("/api/v1/wallet/security-pin/remove", json={"pin": "1234"}, headers=headers)
    assert remove_resp.status_code == 200

    status_resp = client.get("/api/v1/wallet/security-pin", headers=headers)
    assert status_resp.json()["pin_enabled"] is False


def test_07_unauthorized_request():
    resp = client.get("/api/v1/wallet/security-pin")
    assert resp.status_code == 401

    resp_post = client.post("/api/v1/wallet/security-pin", json={"pin": "1234"})
    assert resp_post.status_code == 401


def test_08_invalid_pin_format(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    # Less than 4 digits
    r1 = client.post("/api/v1/wallet/security-pin", json={"pin": "123"}, headers=headers)
    assert r1.status_code in [400, 422]

    # Non-digits
    r2 = client.post("/api/v1/wallet/security-pin", json={"pin": "abcd"}, headers=headers)
    assert r2.status_code in [400, 422]


def test_09_payment_blocked_without_valid_pin(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    resp = client.post(
        "/api/v1/wallet-loyalty/wallet/topup",
        json={"amount": 500},
        headers=headers
    )
    assert resp.status_code == 400


def test_10_token_issued_after_valid_pin(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "4321"}, headers=headers)

    verify_resp = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "4321", "purpose": "wallet_topup"}, headers=headers)
    assert verify_resp.status_code == 200
    data = verify_resp.json()
    assert data["verified"] is True
    assert "payment_authorization_token" in data
    assert len(data["payment_authorization_token"]) > 20


def test_11_expired_token_rejected(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    # Generate token expired 1 second ago
    expired_token = security_pin_service.generate_payment_auth_token(
        user_id=user.id,
        user_email=user.email,
        purpose="wallet_topup",
        expires_seconds=-10
    )["payment_authorization_token"]

    topup_headers = {**headers, "X-Payment-Authorization": expired_token}
    resp = client.post(
        "/api/v1/wallet-loyalty/wallet/topup",
        json={"amount": 100, "description": "Expired token topup"},
        headers=topup_headers
    )
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


def test_12_wrong_purpose_token_rejected(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    # Generate token for booking_payment
    verify_resp = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "1234", "purpose": "booking_payment"}, headers=headers)
    auth_token = verify_resp.json()["payment_authorization_token"]

    # Attempt to use booking_payment token for wallet_topup -> Fail!
    topup_headers = {**headers, "X-Payment-Authorization": auth_token}
    resp = client.post(
        "/api/v1/wallet-loyalty/wallet/topup",
        json={"amount": 100, "description": "Wrong purpose topup"},
        headers=topup_headers
    )
    assert resp.status_code == 400
    assert "invalid for purpose" in resp.json()["detail"].lower()


def test_13_wrong_user_token_rejected(pin_test_user, second_pin_user):
    user_a, token_a = pin_test_user
    user_b, token_b = second_pin_user

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers_a)
    client.post("/api/v1/wallet/security-pin", json={"pin": "5678"}, headers=headers_b)

    # User A gets authorization token
    verify_resp = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "1234", "purpose": "wallet_topup"}, headers=headers_a)
    auth_token_a = verify_resp.json()["payment_authorization_token"]

    # User B attempts to use User A's authorization token -> Fail!
    topup_headers = {**headers_b, "X-Payment-Authorization": auth_token_a}
    resp = client.post(
        "/api/v1/wallet-loyalty/wallet/topup",
        json={"amount": 100, "description": "Hacker topup attempt"},
        headers=topup_headers
    )
    assert resp.status_code == 403
    assert "belongs to a different user" in resp.json()["detail"].lower()


def test_14_token_replay_rejected(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    verify_resp = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "1234", "purpose": "wallet_topup"}, headers=headers)
    auth_token = verify_resp.json()["payment_authorization_token"]

    topup_headers = {**headers, "X-Payment-Authorization": auth_token}

    # First top-up succeeds
    resp1 = client.post(
        "/api/v1/wallet-loyalty/wallet/topup",
        json={"amount": 500, "description": "First topup"},
        headers=topup_headers
    )
    assert resp1.status_code == 200
    assert resp1.json()["success"] is True

    # Second top-up with SAME token is rejected (Replay Attack Protection)!
    resp2 = client.post(
        "/api/v1/wallet-loyalty/wallet/topup",
        json={"amount": 500, "description": "Replay topup attempt"},
        headers=topup_headers
    )
    assert resp2.status_code == 400
    assert "already been used" in resp2.json()["detail"].lower()


def test_15_topup_succeeds_with_valid_token(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    verify_resp = client.post("/api/v1/wallet/security-pin/verify", json={"pin": "1234", "purpose": "wallet_topup"}, headers=headers)
    auth_token = verify_resp.json()["payment_authorization_token"]

    topup_headers = {**headers, "X-Payment-Authorization": auth_token}
    resp = client.post(
        "/api/v1/wallet-loyalty/wallet/topup",
        json={"amount": 1500, "description": "Topup via short-lived authorization token"},
        headers=topup_headers
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True
