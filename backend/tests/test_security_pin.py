import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, UserPaymentPin
from app.auth.jwt import hash_password, create_access_token

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
    assert verify_resp.json()["verified"] is True


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

    # Enable PIN
    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    # Attempt to confirm booking without PIN
    resp = client.post(
        "/api/v1/bookings/confirm?booking_reference=REF_TEST_99&vertical=flights&payment_method=wallet",
        headers=headers
    )
    assert resp.status_code == 400
    assert "PIN required" in resp.json()["detail"] or "PIN" in resp.json()["detail"]


def test_10_topup_blocked_without_valid_pin(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    # Enable PIN
    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    # Topup without PIN -> HTTP 400
    resp = client.post(
        "/api/v1/wallet-loyalty/wallet/topup",
        json={"amount": 500, "description": "Test topup"},
        headers=headers
    )
    assert resp.status_code == 400
    assert "security pin required" in resp.json()["detail"].lower()


def test_11_correct_pin_allows_payment_and_topup(pin_test_user):
    user, token = pin_test_user
    headers = {"Authorization": f"Bearer {token}"}

    # Enable PIN
    client.post("/api/v1/wallet/security-pin", json={"pin": "1234"}, headers=headers)

    # Topup with correct PIN
    topup_headers = {**headers, "X-Payment-PIN": "1234"}
    resp = client.post(
        "/api/v1/wallet-loyalty/wallet/topup",
        json={"amount": 1000, "description": "Test topup with pin", "pin": "1234"},
        headers=topup_headers
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True
