import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount, Trip, TripMember, TripInvitation, TripExpense, TripExpenseSplit
from app.auth.jwt import create_access_token
from decimal import Decimal

client = TestClient(app)

@pytest.fixture
def test_users():
    db = SessionLocal()
    
    # Setup test User A (Owner)
    email_a = "owner_test@travelos.com"
    user_a = db.query(User).filter(User.email == email_a).first()
    if user_a:
        db.query(WalletAccount).filter(WalletAccount.user_id == user_a.id).delete()
        db.delete(user_a)
        db.commit()
    user_a = User(email=email_a, password_hash="hash", role="user", is_active=True)
    db.add(user_a)
    db.commit()
    db.refresh(user_a)
    
    # Setup test User B (Member)
    email_b = "member_test@travelos.com"
    user_b = db.query(User).filter(User.email == email_b).first()
    if user_b:
        db.query(WalletAccount).filter(WalletAccount.user_id == user_b.id).delete()
        db.delete(user_b)
        db.commit()
    user_b = User(email=email_b, password_hash="hash", role="user", is_active=True)
    db.add(user_b)
    db.commit()
    db.refresh(user_b)

    # Setup test User C (Stranger)
    email_c = "stranger_test@travelos.com"
    user_c = db.query(User).filter(User.email == email_c).first()
    if user_c:
        db.query(WalletAccount).filter(WalletAccount.user_id == user_c.id).delete()
        db.delete(user_c)
        db.commit()
    user_c = User(email=email_c, password_hash="hash", role="user", is_active=True)
    db.add(user_c)
    db.commit()
    db.refresh(user_c)

    user_a_id = user_a.id
    user_b_id = user_b.id
    user_c_id = user_c.id
    db.close()
    
    yield user_a, user_b, user_c

    # Teardown
    db = SessionLocal()
    # Delete test invitations
    db.query(TripInvitation).delete()
    # Delete test splits
    db.query(TripExpenseSplit).delete()
    # Delete test expenses
    db.query(TripExpense).delete()
    # Delete members
    db.query(TripMember).delete()
    # Delete trips
    db.query(Trip).filter(Trip.user_id.in_([user_a_id, user_b_id, user_c_id])).delete()
    
    db.query(WalletAccount).filter(WalletAccount.user_id.in_([user_a_id, user_b_id, user_c_id])).delete()
    for uid in [user_a_id, user_b_id, user_c_id]:
        u = db.query(User).filter(User.id == uid).first()
        if u:
            db.delete(u)
    db.commit()
    db.close()


def test_group_creation_and_membership(test_users):
    user_a, user_b, user_c = test_users
    
    token_a = create_access_token(data={"sub": user_a.email, "role": "user", "type": "access"})
    token_b = create_access_token(data={"sub": user_b.email, "role": "user", "type": "access"})
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # 1. Create trip as User A (Tanish)
    trip_payload = {
        "name": "GOA FRIENDS TRIP",
        "destination": "Goa",
        "start_date": "2026-12-15",
        "end_date": "2026-12-20",
        "booking_references": []
    }
    res = client.post("/api/v1/dashboard/trips", json=trip_payload, headers=headers_a)
    print("CREATE TRIP RESPONSE:", res.status_code, res.text)
    assert res.status_code == 200
    trip_id = res.json()["id"]
    
    # Verify owner membership was auto-created
    res = client.get(f"/api/v1/trips/{trip_id}/members", headers=headers_a)
    assert res.status_code == 200
    members = res.json()
    assert len(members) == 1
    assert members[0]["username"] == "owner_test"
    assert members[0]["role"] == "OWNER"

    # 2. Generate UUID invitation
    invite_payload = {"email": "Rahul@travelos.com"}
    res = client.post(f"/api/v1/trips/{trip_id}/invite", json=invite_payload, headers=headers_a)
    assert res.status_code == 200
    invite_token = res.json()["token"]
    assert invite_token is not None

    # Verify stranger cannot accept with fake token
    res = client.post("/api/v1/trips/join/accept", json={"token": "fake_token"}, headers=headers_b)
    assert res.status_code == 404

    # 3. User B accepts the invitation
    res = client.post("/api/v1/trips/join/accept", json={"token": invite_token}, headers=headers_b)
    assert res.status_code == 200
    assert "Successfully joined" in res.json()["message"]

    # Verify User B is now a member
    res = client.get(f"/api/v1/trips/{trip_id}/members", headers=headers_a)
    mems = res.json()
    assert len(mems) == 2
    assert any(m["username"] == "member_test" and m["role"] == "MEMBER" for m in mems)


def test_expense_splitting_math(test_users):
    user_a, user_b, user_c = test_users
    
    token_a = create_access_token(data={"sub": user_a.email, "role": "user", "type": "access"})
    token_b = create_access_token(data={"sub": user_b.email, "role": "user", "type": "access"})
    token_c = create_access_token(data={"sub": user_c.email, "role": "user", "type": "access"})
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    headers_c = {"Authorization": f"Bearer {token_c}"}

    # Create trip
    trip_payload = {
        "name": "GOA FRIENDS TRIP",
        "destination": "Goa",
        "start_date": "2026-12-15",
        "end_date": "2026-12-20",
        "booking_references": []
    }
    res = client.post("/api/v1/dashboard/trips", json=trip_payload, headers=headers_a)
    trip_id = res.json()["id"]

    # Generate invite and add User B
    res = client.post(f"/api/v1/trips/{trip_id}/invite", json={}, headers=headers_a)
    invite_token = res.json()["token"]
    client.post("/api/v1/trips/join/accept", json={"token": invite_token}, headers=headers_b)

    # 1. Log equal split expense of ₹3000 (User A pays)
    expense_payload = {
        "amount": 3000.00,
        "currency": "INR",
        "category": "Food",
        "description": "Friend's Dinner",
        "payer_id": user_a.id,
        "split_type": "equal"
    }
    res = client.post(f"/api/v1/trips/{trip_id}/expenses", json=expense_payload, headers=headers_a)
    assert res.status_code == 201

    # Verify expense list calculates owes / is owed correctly
    res = client.get(f"/api/v1/trips/{trip_id}/expenses", headers=headers_a)
    data = res.json()
    assert data["total_expenses"] == 3000.00
    assert data["user_is_owed"] == 1500.00  # Rahul owes 1500 to Tanish
    assert data["user_owes"] == 0.00

    # Verify from Rahul's (User B) perspective
    res = client.get(f"/api/v1/trips/{trip_id}/expenses", headers=headers_b)
    data_b = res.json()
    assert data_b["user_owes"] == 1500.00
    assert data_b["user_is_owed"] == 0.00

    # 2. Log custom split expense of ₹1000 (User B pays, User A owes ₹700, User B owes ₹300)
    expense_custom_payload = {
        "amount": 1000.00,
        "currency": "INR",
        "category": "Transport",
        "description": "Cab ride",
        "payer_id": user_b.id,
        "split_type": "custom",
        "splits": [
            {"user_id": user_a.id, "amount": 700.00},
            {"user_id": user_b.id, "amount": 300.00}
        ]
    }
    res = client.post(f"/api/v1/trips/{trip_id}/expenses", json=expense_custom_payload, headers=headers_b)
    assert res.status_code == 201

    # Verify cumulative balances
    # Tanish (User A) is owed 1500, but owes 700.
    # Total user_is_owed should be 1500. Total user_owes should be 700.
    res = client.get(f"/api/v1/trips/{trip_id}/expenses", headers=headers_a)
    data_a_final = res.json()
    assert data_a_final["user_is_owed"] == 1500.00
    assert data_a_final["user_owes"] == 700.00

    # Rahul (User B) owes 1500, but is owed 700.
    # Total user_owes should be 1500. Total user_is_owed should be 700.
    res = client.get(f"/api/v1/trips/{trip_id}/expenses", headers=headers_b)
    data_b_final = res.json()
    assert data_b_final["user_owes"] == 1500.00
    assert data_b_final["user_is_owed"] == 700.00

    # Stranger (User C) tries to list expenses -> 403 Forbidden
    res = client.get(f"/api/v1/trips/{trip_id}/expenses", headers=headers_c)
    assert res.status_code == 403
