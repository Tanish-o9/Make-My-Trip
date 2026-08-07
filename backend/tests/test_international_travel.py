import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount, LoyaltyAccount
from decimal import Decimal
import io

client = TestClient(app)

@pytest.fixture
def clean_intl_user():
    db = SessionLocal()
    user_email = "intl_test_user@travelos.com"
    
    # Clean old test data
    user = db.query(User).filter(User.email == user_email).first()
    if user:
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user.id).delete()
        db.delete(user)
        db.commit()
        
    user = User(email=user_email)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    wallet = WalletAccount(user_id=user.id, balance=Decimal("10000.00"), currency="INR")
    db.add(wallet)
    loyalty = LoyaltyAccount(user_id=user.id, points_balance=1200)
    db.add(loyalty)
    db.commit()
    
    yield user
    
    db = SessionLocal()
    user = db.query(User).filter(User.email == user_email).first()
    if user:
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user.id).delete()
        db.delete(user)
        db.commit()
    db.close()

def test_international_travel_lifecycle(clean_intl_user):
    user = clean_intl_user
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Visa Engine Tests
    rules_res = client.post("/api/v1/visa/search", json={"country": "France"}, headers=headers)
    assert rules_res.status_code == 200
    assert "required_documents" in rules_res.json()
    
    apply_payload = {
        "country": "France",
        "visa_type": "Tourist",
        "first_name": "John",
        "last_name": "Doe",
        "passport_number": "L1234567",
        "dob": "1990-05-10",
        "email": "john.doe@example.com",
        "phone": "+919876543210"
    }
    apply_res = client.post("/api/v1/visa/apply", json=apply_payload, headers=headers)
    assert apply_res.status_code == 200
    booking_ref = apply_res.json()["booking_reference"]
    
    history_res = client.get("/api/v1/visa/history", headers=headers)
    assert history_res.status_code == 200
    assert len(history_res.json()) > 0
    
    details_res = client.get(f"/api/v1/visa/{booking_ref}", headers=headers)
    assert details_res.status_code == 200
    assert details_res.json()["country"] == "France"
    
    # 2. Travel Insurance Tests
    plans_res = client.get("/api/v1/insurance/plans", headers=headers)
    assert plans_res.status_code == 200
    assert len(plans_res.json()) > 0
    
    purchase_payload = {
        "plan_name": "Gold Secure",
        "destination": "France",
        "duration_days": 15,
        "passenger_name": "John Doe"
    }
    purchase_res = client.post("/api/v1/insurance/purchase", json=purchase_payload, headers=headers)
    assert purchase_res.status_code == 200
    assert "policy_number" in purchase_res.json()
    
    ins_history = client.get("/api/v1/insurance/history", headers=headers)
    assert ins_history.status_code == 200
    assert len(ins_history.json()) > 0
    
    # 3. Forex Tests
    rates_res = client.get("/api/v1/forex/rates", headers=headers)
    assert rates_res.status_code == 200
    assert "USD_INR" in rates_res.json()
    
    forex_payload = {
        "currency_pair": "USD/INR",
        "amount": 500.0,
        "delivery_mode": "Home Delivery"
    }
    forex_res = client.post("/api/v1/forex/order", json=forex_payload, headers=headers)
    assert forex_res.status_code == 200
    assert forex_res.json()["status"] == "confirmed"
    
    forex_history = client.get("/api/v1/forex/history", headers=headers)
    assert forex_history.status_code == 200
    assert len(forex_history.json()) > 0
    
    # 4. eSIM Tests
    esim_plans = client.get("/api/v1/esim/plans?country=France", headers=headers)
    assert esim_plans.status_code == 200
    assert len(esim_plans.json()) > 0
    
    esim_res = client.post("/api/v1/esim/purchase", json={"country": "France", "plan_name": "France 7-Day Lite"}, headers=headers)
    assert esim_res.status_code == 200
    assert "activation_qr_url" in esim_res.json()
    
    # 5. Travel Documents Center Tests
    docs_list = client.get("/api/v1/documents/list", headers=headers)
    assert docs_list.status_code == 200
    assert len(docs_list.json()) > 0
    
    file_payload = {"file": ("test.pdf", io.BytesIO(b"dummy pdf content"), "application/pdf")}
    upload_res = client.post("/api/v1/documents/upload?document_type=Passport", files=file_payload, headers=headers)
    assert upload_res.status_code == 200
    assert upload_res.json()["success"] is True
    
    # 6. Loyalty Rewards Tests
    loyalty_res = client.get("/api/v1/loyalty/dashboard", headers=headers)
    assert loyalty_res.status_code == 200
    loyalty_data = loyalty_res.json()
    assert loyalty_data["membership_tier"] == "Gold"
    assert loyalty_data["reward_points"] == 1200
