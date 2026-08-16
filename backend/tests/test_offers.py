import pytest
import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database import SessionLocal
from app.models.core import User, LoyaltyAccount
from app.models.showcase import Offer

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_auth_token(email="test_offers_user@example.com"):
    # Login or register user to get token
    # Let's request token from existing login or mock
    # We can use TestClient to register and login
    email = email
    password = "testpassword123"
    
    # Check if user exists, if not create
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        from app.auth.jwt import hash_password
        user = User(email=email, password_hash=hash_password(password), role="user", email_verified=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        
    # Ensure loyalty account exists
    loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user.id).first()
    if not loyalty:
        loyalty = LoyaltyAccount(user_id=user.id, points_balance=1500) # Gold member
        db.add(loyalty)
        db.commit()
    db.close()
    
    # Login
    response = client.post("/api/v1/auth/token", data={"username": email, "password": password})
    assert response.status_code == 200
    token = response.json()["access_token"]
    return f"Bearer {token}"

def test_unauthenticated_offers():
    response = client.get("/api/v1/offers/active")
    assert response.status_code == 401

def test_active_offers_list(db_session):
    headers = {"Authorization": get_auth_token()}
    response = client.get("/api/v1/offers/active", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "offers" in data
    offers = data["offers"]
    assert len(offers) > 0
    
    # Verify offer fields
    for o in offers:
        assert "id" in o
        assert "title" in o
        assert "description" in o
        assert "category" in o
        assert "discount_type" in o
        assert "discount_value" in o
        assert "coupon_code" in o
        assert "valid_until" in o
        assert "cta_route" in o

def test_active_offers_category_filter():
    headers = {"Authorization": get_auth_token()}
    response = client.get("/api/v1/offers/active?category=flights", headers=headers)
    assert response.status_code == 200
    data = response.json()
    for o in data["offers"]:
        assert o["category"] == "flights"

def test_offers_filtering_expired_and_inactive(db_session):
    # Insert an expired offer and an inactive offer
    expired = Offer(
        category="flights",
        title="Expired Flight Deal",
        description="Expired",
        promo_code="EXPIRED_123",
        valid_to=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        active=True
    )
    inactive = Offer(
        category="hotels",
        title="Inactive Hotel Deal",
        description="Inactive",
        promo_code="INACTIVE_123",
        valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=5),
        active=False
    )
    db_session.add(expired)
    db_session.add(inactive)
    db_session.commit()
    
    try:
        headers = {"Authorization": get_auth_token()}
        response = client.get("/api/v1/offers/active", headers=headers)
        assert response.status_code == 200
        codes = [o["coupon_code"] for o in response.json()["offers"]]
        assert "EXPIRED_123" not in codes
        assert "INACTIVE_123" not in codes
    finally:
        # Clean up
        db_session.delete(expired)
        db_session.delete(inactive)
        db_session.commit()

def test_offers_loyalty_personalization(db_session):
    # Test for Silver tier (0 points)
    silver_headers = {"Authorization": get_auth_token("silver_user@example.com")}
    db = db_session
    user = db.query(User).filter(User.email == "silver_user@example.com").first()
    if user:
        loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user.id).first()
        if loyalty:
            loyalty.points_balance = 0
            db.commit()
            
    response_silver = client.get("/api/v1/offers/active", headers=silver_headers)
    assert response_silver.status_code == 200
    silver_offers = response_silver.json()["offers"]
    
    # Test for Platinum tier (6000 points)
    plat_headers = {"Authorization": get_auth_token("plat_user@example.com")}
    user_plat = db.query(User).filter(User.email == "plat_user@example.com").first()
    if user_plat:
        loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user_plat.id).first()
        if loyalty:
            loyalty.points_balance = 6000
            db.commit()
            
    response_plat = client.get("/api/v1/offers/active", headers=plat_headers)
    assert response_plat.status_code == 200
    plat_offers = response_plat.json()["offers"]
    
    # Check if platinum title has visual indicator
    plat_titles = [o["title"] for o in plat_offers]
    silver_titles = [o["title"] for o in silver_offers]
    
    # Since at least flights/hotels are seeded:
    has_plat_indicator = any("Platinum Special" in t for t in plat_titles)
    has_silver_indicator = any("Platinum Special" in t for t in silver_titles)
    
    assert has_plat_indicator is True
    assert has_silver_indicator is False
