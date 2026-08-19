import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, UserProfile, UserPaymentPin, SavedCompanion, WalletAccount
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)

@pytest.fixture
def profile_test_user():
    db = SessionLocal()
    email = f"profile_sync_{datetime.datetime.utcnow().timestamp()}@travelos.com"
    user = User(
        email=email,
        password_hash=hash_password("ProfilePass123!"),
        role="user",
        email_verified=True,
        phone="+91 9876543210"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    profile = UserProfile(
        user_id=user.id,
        full_name="Original Name",
        email=email,
        mobile_number="+91 9876543210"
    )
    db.add(profile)

    wallet = WalletAccount(
        user_id=user.id,
        balance=25000.0,
        currency="INR"
    )
    db.add(wallet)
    db.commit()

    token = create_access_token({"sub": user.email, "email": user.email, "role": user.role})
    
    yield user, token

    # Cleanup
    db.query(SavedCompanion).filter(SavedCompanion.user_id == user.id).delete()
    db.query(UserPaymentPin).filter(UserPaymentPin.user_id == user.id).delete()
    db.query(UserProfile).filter(UserProfile.user_id == user.id).delete()
    db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()
    db.close()


@pytest.fixture
def second_test_user():
    db = SessionLocal()
    email = f"user_b_{datetime.datetime.utcnow().timestamp()}@travelos.com"
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

    db.query(SavedCompanion).filter(SavedCompanion.user_id == user.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.commit()
    db.close()


def test_01_profile_fetch(profile_test_user):
    user, token = profile_test_user
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/users/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["email"] == user.email
    assert data["full_name"] == "Original Name"
    assert data["phone"] == "+91 9876543210"
    assert data["wallet_balance"] == 25000.0
    assert data["pin_status"] == "No Payment PIN Set"
    assert data["pin_enabled"] is False
    assert "joined_date" in data


def test_02_profile_update(profile_test_user):
    user, token = profile_test_user
    headers = {"Authorization": f"Bearer {token}"}

    update_payload = {
        "full_name": "Updated Real Name",
        "phone": "+91 9998887776"
    }
    resp = client.patch("/users/me", json=update_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "Updated Real Name"
    assert data["phone"] == "+91 9998887776"

    # Verify DB persistence
    db = SessionLocal()
    updated_prof = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    assert updated_prof.full_name == "Updated Real Name"
    assert updated_prof.mobile_number == "+91 9998887776"
    db.close()


def test_03_unauthorized_access():
    resp1 = client.get("/users/me")
    assert resp1.status_code in [401, 403]

    resp2 = client.get("/users/me/companions")
    assert resp2.status_code in [401, 403]


def test_04_anti_tampering_guards(profile_test_user):
    user, token = profile_test_user
    headers = {"Authorization": f"Bearer {token}"}

    # Direct email modification attempt must be rejected
    resp = client.patch("/users/me", json={"email": "hacker@domain.com"}, headers=headers)
    assert resp.status_code == 400
    assert "Email cannot be changed directly" in resp.json()["detail"]


def test_05_companion_crud(profile_test_user):
    user, token = profile_test_user
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create companion
    comp_data = {
        "name": "Ananya Sharma",
        "age": 28,
        "relationship_label": "Spouse"
    }
    create_resp = client.post("/users/me/companions", json=comp_data, headers=headers)
    assert create_resp.status_code == 200
    comp = create_resp.json()
    assert comp["name"] == "Ananya Sharma"
    assert comp["age"] == 28
    comp_id = comp["id"]

    # 2. Get list
    get_resp = client.get("/users/me/companions", headers=headers)
    assert get_resp.status_code == 200
    comps = get_resp.json()
    assert len(comps) >= 1
    assert any(c["id"] == comp_id for c in comps)

    # 3. Delete companion
    del_resp = client.delete(f"/users/me/companions/{comp_id}", headers=headers)
    assert del_resp.status_code == 200

    # 4. Verify list empty
    get_resp2 = client.get("/users/me/companions", headers=headers)
    assert not any(c["id"] == comp_id for c in get_resp2.json())


def test_06_companion_security(profile_test_user, second_test_user):
    user_a, token_a = profile_test_user
    user_b, token_b = second_test_user

    # User A creates a companion
    headers_a = {"Authorization": f"Bearer {token_a}"}
    create_resp = client.post("/users/me/companions", json={"name": "Private Companion", "age": 30}, headers=headers_a)
    comp_id = create_resp.json()["id"]

    # User B attempts to delete User A's companion
    headers_b = {"Authorization": f"Bearer {token_b}"}
    del_resp = client.delete(f"/users/me/companions/{comp_id}", headers=headers_b)
    assert del_resp.status_code == 404


def test_07_wallet_and_spending_metrics(profile_test_user):
    user, token = profile_test_user
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/users/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["wallet_balance"] == 25000.0
    assert "total_spend" in data
    assert "monthly_spend" in data
    assert "total_bookings" in data


def test_08_pin_status_integration(profile_test_user):
    user, token = profile_test_user
    headers = {"Authorization": f"Bearer {token}"}

    # Before setting PIN
    resp1 = client.get("/users/me", headers=headers)
    assert resp1.json()["pin_status"] == "No Payment PIN Set"
    assert resp1.json()["pin_enabled"] is False

    # Set PIN
    client.post("/wallet/security-pin", json={"pin": "5555"}, headers=headers)

    # After setting PIN
    resp2 = client.get("/users/me", headers=headers)
    assert resp2.json()["pin_status"] == "Payment PIN Protected"
    assert resp2.json()["pin_enabled"] is True


def test_09_multi_device_persistence(profile_test_user):
    user, token = profile_test_user
    
    # Device A (Session 1) updates profile name & adds companion
    device_a_headers = {"Authorization": f"Bearer {token}", "X-Device-Id": "device_a_chrome"}
    client.patch("/users/me", json={"full_name": "Multi Device Traveler"}, headers=device_a_headers)
    client.post("/users/me/companions", json={"name": "Companion Device A", "age": 22}, headers=device_a_headers)

    # Device B (Session 2 / Fresh login) fetches profile
    device_b_headers = {"Authorization": f"Bearer {token}", "X-Device-Id": "device_b_safari"}
    profile_resp = client.get("/users/me", headers=device_b_headers)
    assert profile_resp.status_code == 200
    assert profile_resp.json()["full_name"] == "Multi Device Traveler"

    comp_resp = client.get("/users/me/companions", headers=device_b_headers)
    assert comp_resp.status_code == 200
    assert any(c["name"] == "Companion Device A" for c in comp_resp.json())
