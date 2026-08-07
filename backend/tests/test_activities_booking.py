import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount
from decimal import Decimal

client = TestClient(app)

@pytest.fixture
def clean_activities_user():
    db = SessionLocal()
    user_email = "activities_test_user@travelos.com"
    
    # Clean old test data
    user = db.query(User).filter(User.email == user_email).first()
    if user:
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.delete(user)
        db.commit()
        
    user = User(email=user_email)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    wallet = WalletAccount(user_id=user.id, balance=Decimal("10000.00"), currency="INR")
    db.add(wallet)
    db.commit()
    
    yield user
    
    db = SessionLocal()
    user = db.query(User).filter(User.email == user_email).first()
    if user:
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.delete(user)
        db.commit()
    db.close()

def test_activities_booking_lifecycle(clean_activities_user):
    user = clean_activities_user
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Search Activities
    search_payload = {
        "destination": "Goa",
        "category": "Museum"
    }
    search_res = client.post("/api/v1/activities/search", json=search_payload, headers=headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert "results" in search_data
    assert len(search_data["results"]) > 0
    selected_act = search_data["results"][0]
    
    # 2. Get Details
    details_res = client.get(f"/api/v1/activities/{selected_act['id']}", headers=headers)
    assert details_res.status_code == 200
    assert "meeting_instructions" in details_res.json()
    
    # 3. Book Activity
    book_payload = {
        "activity_id": selected_act["id"],
        "activity_name": selected_act["name"],
        "location": selected_act["meeting_point"],
        "price": selected_act["price"],
        "tickets": 2,
        "activity_time": "2026-12-16 10:00:00"
    }
    book_res = client.post("/api/v1/activities/book", json=book_payload, headers=headers)
    assert book_res.status_code == 200
    book_data = book_res.json()
    booking_ref = book_data["booking_reference"]
    assert book_data["status"] == "booked"
    
    # 4. Booking History
    history_res = client.get("/api/v1/activities/history", headers=headers)
    assert history_res.status_code == 200
    assert len(history_res.json()) > 0
    
    # 5. Voucher Details
    voucher_res = client.get(f"/api/v1/activities/{booking_ref}/voucher", headers=headers)
    assert voucher_res.status_code == 200
    assert "voucher_number" in voucher_res.json()
    
    # 6. Cancel & Refund
    cancel_res = client.post("/api/v1/activities/cancel", json={"booking_reference": booking_ref}, headers=headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"
    
    refund_res = client.post("/api/v1/activities/refund", json={"booking_reference": booking_ref}, headers=headers)
    assert refund_res.status_code == 200
    assert refund_res.json()["status"] == "refunded"
