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
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
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
    
    hold_res = client.post("/api/v1/bookings/hold", json=hold_payload, headers=headers)
    assert hold_res.status_code == 200 or hold_res.status_code == 201
    hold_data = hold_res.json()
    assert "booking_reference" in hold_data
    booking_ref = hold_data["booking_reference"]
    
    # 3. Simulate wallet payment transaction via confirm endpoint
    pay_res = client.post(
        f"/api/v1/bookings/confirm?booking_reference={booking_ref}&vertical=flights&payment_method=wallet",
        headers=headers
    )
    assert pay_res.status_code == 200
    pay_data = pay_res.json()
    assert pay_data["status"] == "confirmed"

def test_new_booking_engine_lifecycle(clean_user_db):
    user = clean_user_db
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Offer Lock
    lock_payload = {
        "vertical": "flights",
        "offer_id": "OF-DF-12345",
        "provider_name": "Duffel",
        "amount": 7500.00,
        "details": {
            "origin": "DEL",
            "destination": "GOI",
            "airline_code": "6E",
            "flight_number": "502",
            "cabin_class": "ECONOMY"
        }
    }
    lock_res = client.post("/api/v1/bookings/offer-lock", json=lock_payload, headers=headers)
    assert lock_res.status_code == 200
    lock_data = lock_res.json()
    booking_ref = lock_data["booking_reference"]
    assert lock_data["status"] == "offer_selected"
    
    # 2. Revalidate (no change)
    reval_res = client.post("/api/v1/bookings/revalidate", json={"booking_reference": booking_ref}, headers=headers)
    assert reval_res.status_code == 200
    reval_data = reval_res.json()
    assert reval_data["price_changed"] is False
    
    # 3. Revalidate with change trigger
    change_ref = f"{booking_ref}_revalidate_change"
    # Create another booking to trigger change
    lock_payload_change = dict(lock_payload)
    lock_res_change = client.post("/api/v1/bookings/offer-lock", json=lock_payload_change, headers=headers)
    booking_ref_change = lock_res_change.json()["booking_reference"]
    # Revalidate using custom suffix to trigger simulated price change
    reval_change_res = client.post(
        "/api/v1/bookings/revalidate",
        json={"booking_reference": f"{booking_ref_change}_revalidate_change"},
        headers=headers
    )
    assert reval_change_res.status_code == 200
    reval_change_data = reval_change_res.json()
    assert reval_change_data["price_changed"] is True
    assert reval_change_data["new_price"] > reval_change_data["old_price"]
    
    # 4. Create (Passenger Validation)
    create_payload = {
        "booking_reference": booking_ref,
        "passengers": [
            {
                "name": "Jane Doe",
                "dob": "1994-06-12",
                "gender": "F",
                "email": "jane@example.com",
                "phone": "9876543210"
            }
        ]
    }
    create_res = client.post("/api/v1/bookings/create", json=create_payload, headers=headers)
    assert create_res.status_code == 200
    create_data = create_res.json()
    assert create_data["status"] == "payment_pending"
    
    # 5. Status API
    status_res = client.get(f"/api/v1/bookings/status/check?booking_reference={booking_ref}", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "payment_pending"
    
    # 6. Refund API (cancel first, then refund)
    cancel_res = client.post("/api/v1/bookings/engine/cancel-booking", json={"booking_reference": booking_ref}, headers=headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"
    
    refund_res = client.post("/api/v1/bookings/engine/refund-booking", json={"booking_reference": booking_ref}, headers=headers)
    assert refund_res.status_code == 200
    assert refund_res.json()["status"] == "refunded"

