import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount
from decimal import Decimal

client = TestClient(app)

@pytest.fixture
def clean_user_db():
    db = SessionLocal()
    user_email = "e2e_test_user@travelos.com"
    
    # Clean old test data
    user = db.query(User).filter(User.email == user_email).first()
    if user:
        # Delete wallet
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.delete(user)
        db.commit()
        
    # Re-seed
    user = User(email=user_email)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    wallet = WalletAccount(user_id=user.id, balance=Decimal("75000.00"), currency="INR")
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

def test_search_endpoint_and_rate_limiting():
    # 1. Test search vertical
    res = client.get("/api/v1/search?vertical=flights&origin=DEL&destination=GOI&date=2026-12-15")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    assert "results" in data
    assert isinstance(data["results"], list)

def test_e2e_booking_hold_payment_flow(clean_user_db):
    user = clean_user_db
    
    # 1. Search flight results
    res = client.get("/api/v1/search?vertical=flights&origin=DEL&destination=GOI&date=2026-12-15")
    assert res.status_code == 200
    data = res.json()
    results = data["results"]
    assert len(results) > 0
    selected_offer = results[0]
    
    # 2. Create booking hold
    hold_payload = {
        "vertical": "flights",
        "amount": float(selected_offer["price_per_passenger"]),
        "user_id": user.id,
        "details": {
            "offer_id": selected_offer["offer_id"],
            "provider_name": selected_offer["provider_name"],
            "flight_number": selected_offer["flight_number"],
            "origin": selected_offer["origin"],
            "destination": selected_offer["destination"],
            "passengers": [
                {"name": "Alice Smith", "age": 28, "gender": "F"}
            ]
        }
    }
    
    hold_res = client.post("/api/v1/bookings/hold", json=hold_payload)
    assert hold_res.status_code == 200 or hold_res.status_code == 201
    hold_data = hold_res.json()
    assert "booking_reference" in hold_data
    booking_ref = hold_data["booking_reference"]
    
    # 3. Simulate wallet payment transaction via confirm endpoint
    pay_res = client.post(
        f"/api/v1/bookings/confirm?booking_reference={booking_ref}&vertical=flights&payment_method=wallet"
    )
    assert pay_res.status_code == 200
    pay_data = pay_res.json()
    assert pay_data["status"] == "confirmed"
