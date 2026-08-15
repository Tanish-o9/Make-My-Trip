import pytest
import datetime
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount, Trip, TripExpense
from app.models.wishlist import WishlistItem
from app.models.price_alert import PriceAlert
from app.models.bookings import FlightBooking, BookingStatus
from app.models.payments import Payment, PaymentStatus
from app.auth.jwt import create_access_token
from app.services.booking_core import BookingStateMachine

client = TestClient(app)

@pytest.fixture
def test_users():
    db = SessionLocal()
    
    # Create User A
    email_a = "user_a_test@travelos.com"
    user_a = db.query(User).filter(User.email == email_a).first()
    if user_a:
        db.query(WalletAccount).filter(WalletAccount.user_id == user_a.id).delete()
        db.delete(user_a)
        db.commit()
    user_a = User(email=email_a, password_hash="hash", role="user", is_active=True)
    db.add(user_a)
    db.commit()
    db.refresh(user_a)
    
    wallet_a = WalletAccount(user_id=user_a.id, balance=Decimal("50000.00"), currency="INR")
    db.add(wallet_a)
    db.commit()

    # Create User B
    email_b = "user_b_test@travelos.com"
    user_b = db.query(User).filter(User.email == email_b).first()
    if user_b:
        db.query(WalletAccount).filter(WalletAccount.user_id == user_b.id).delete()
        db.delete(user_b)
        db.commit()
    user_b = User(email=email_b, password_hash="hash", role="user", is_active=True)

    db.add(user_b)
    db.commit()
    db.refresh(user_b)
    
    wallet_b = WalletAccount(user_id=user_b.id, balance=Decimal("10000.00"), currency="INR")
    db.add(wallet_b)
    db.commit()

    user_a_id = user_a.id
    user_b_id = user_b.id
    db.close()
    yield user_a, user_b

    db = SessionLocal()
    db.query(WishlistItem).filter(WishlistItem.user_id.in_([user_a_id, user_b_id])).delete()
    db.query(PriceAlert).filter(PriceAlert.user_id.in_([user_a_id, user_b_id])).delete()
    
    # Delete expenses and trips
    trips = db.query(Trip).filter(Trip.user_id.in_([user_a_id, user_b_id])).all()
    trip_ids = [t.id for t in trips]
    if trip_ids:
        db.query(TripExpense).filter(TripExpense.trip_id.in_(trip_ids)).delete()
        db.query(Trip).filter(Trip.id.in_(trip_ids)).delete()
        
    db.query(WalletAccount).filter(WalletAccount.user_id.in_([user_a_id, user_b_id])).delete()
    ua = db.query(User).filter(User.id == user_a_id).first()
    if ua:
        db.delete(ua)
    ub = db.query(User).filter(User.id == user_b_id).first()
    if ub:
        db.delete(ub)
    db.commit()
    db.close()



def test_wishlist_crud_and_isolation(test_users):
    user_a, user_b = test_users
    
    token_a = create_access_token(data={"sub": user_a.email, "role": "user", "type": "access"})
    token_b = create_access_token(data={"sub": user_b.email, "role": "user", "type": "access"})
    
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # 1. Create wishlist item for User A
    payload = {
        "item_type": "flight",
        "item_ref_id": "FL-DEL-GOI-123",
        "snapshot_json": {"price": 5500.0, "airline": "IndiGo"}
    }
    res = client.post("/api/v1/wishlist", json=payload, headers=headers_a)
    assert res.status_code == 201
    item_id = res.json()["id"]
    
    # 2. Verify User A can list it
    res = client.get("/api/v1/wishlist", headers=headers_a)
    assert res.status_code == 200
    wishlist_items = res.json()
    assert len(wishlist_items) == 1
    assert wishlist_items[0]["item_ref_id"] == "FL-DEL-GOI-123"
    
    # 3. Verify cross-user isolation: User B cannot see User A's wishlist item
    res = client.get("/api/v1/wishlist", headers=headers_b)
    assert res.status_code == 200
    assert len(res.json()) == 0
    
    # 4. Verify User B cannot delete User A's wishlist item
    res = client.delete(f"/api/v1/wishlist/{item_id}", headers=headers_b)
    assert res.status_code == 403
    
    # 5. Verify User A can delete own item
    res = client.delete(f"/api/v1/wishlist/{item_id}", headers=headers_a)
    assert res.status_code == 200


def test_price_alerts_crud_and_notification(test_users, monkeypatch):
    from unittest.mock import AsyncMock
    from app.services.flight_service import FlightService
    monkeypatch.setattr(FlightService, "search_flights", AsyncMock(return_value=[{"price": 4000.0}]))
    user_a, user_b = test_users
    
    token_a = create_access_token(data={"sub": user_a.email, "role": "user", "type": "access"})
    token_b = create_access_token(data={"sub": user_b.email, "role": "user", "type": "access"})
    
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # 1. Create alert for User A
    payload = {
        "route": "Delhi → Goa",
        "vertical": "flight",
        "travel_date": "2026-08-18",
        "target_price": 5000.0,
        "current_price": 6000.0,
        "currency": "INR"
    }
    res = client.post("/api/v1/price-alerts", json=payload, headers=headers_a)
    assert res.status_code == 201
    alert_id = res.json()["id"]
    
    # 2. Try creating duplicate alert
    res = client.post("/api/v1/price-alerts", json=payload, headers=headers_a)
    assert res.status_code == 201
    assert "already exists" in res.json()["message"]
    
    # 3. List alerts
    res = client.get("/api/v1/price-alerts", headers=headers_a)
    assert res.status_code == 200
    assert len(res.json()) == 1
    
    # 4. Trigger price monitor check
    res = client.post("/api/v1/price-alerts/trigger-check", headers=headers_a)
    assert res.status_code == 200
    checked_info = res.json()
    assert checked_info["checked_count"] == 1
    assert len(checked_info["notifications_sent"]) == 1
    assert "dropped" in checked_info["notifications_sent"][0]["message"]
    
    # 5. Delete alert ownership check
    res = client.delete(f"/api/v1/price-alerts/{alert_id}", headers=headers_b)
    assert res.status_code == 403
    
    res = client.delete(f"/api/v1/price-alerts/{alert_id}", headers=headers_a)
    assert res.status_code == 200


def test_loyalty_rewards_awarding_and_idempotency(test_users):
    user_a, _ = test_users
    db = SessionLocal()
    
    token_a = create_access_token(data={"sub": user_a.email, "role": "user", "type": "access"})
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    # Create mock confirmed booking and payment
    import uuid
    booking_ref = f"BK-FL-{uuid.uuid4().hex[:8].upper()}"
    booking = FlightBooking(
        booking_reference=booking_ref,
        user_id=user_a.id,
        status=BookingStatus.HOLD,
        total_amount=Decimal("12000.00"),
        currency="INR",
        pricing_snapshot={"base_fare": 10000.0, "tax": 2000.0},
        origin="DEL",
        destination="GOI",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=2),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=2, hours=2.5),
        airline_code="6E",
        flight_number="101",
        passenger_details=[]
    )
    db.add(booking)
    db.commit()
    
    payment = Payment(
        booking_id=booking_ref,
        amount=12000.0,
        currency="INR",
        payment_method="wallet",
        status=PaymentStatus.CAPTURED,
        user_id=user_a.id,
        razorpay_payment_id=f"pay_{uuid.uuid4().hex[:10]}"
    )
    db.add(payment)
    db.commit()
    
    # Transition booking to CONFIRMED
    BookingStateMachine.transition_to(booking, BookingStatus.CONFIRMED)
    db.commit()
    
    # 1. Query rewards API and check points are awarded (Flight Booking -> 500 points)
    res = client.get("/api/v1/rewards", headers=headers_a)
    assert res.status_code == 200
    rewards_data = res.json()
    assert rewards_data["points"] == 500
    assert rewards_data["level"] == "Explorer"
    assert len(rewards_data["history"]) == 1
    assert "Flight Booking" in rewards_data["history"][0]["description"]
    
    # 2. Attempt duplicate point awarding using same booking_reference and vertical manually
    from app.services.wallet_loyalty import LoyaltyService
    LoyaltyService.award_booking_points(db, user_a.id, "flight", booking_ref)
    db.commit()
    
    # Verify points balance has NOT increased (remains 500)
    res = client.get("/api/v1/rewards", headers=headers_a)
    assert res.status_code == 200
    assert res.json()["points"] == 500
    
    db.delete(payment)
    db.delete(booking)
    db.commit()
    db.close()


def test_trip_expense_manager(test_users):
    user_a, user_b = test_users
    db = SessionLocal()
    
    token_a = create_access_token(data={"sub": user_a.email, "role": "user", "type": "access"})
    token_b = create_access_token(data={"sub": user_b.email, "role": "user", "type": "access"})
    
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # Create trip for User A
    trip = Trip(
        user_id=user_a.id,
        name="Goa Family Trip",
        destination="Goa",
        budget=Decimal("30000.00")
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    trip_id = trip.id
    db.close()
    
    # 1. Add valid expense
    expense_payload = {
        "amount": 12000.0,
        "currency": "INR",
        "category": "Transport",
        "description": "Delhi to Goa flight tickets",
        "expense_date": "2026-08-15"
    }
    res = client.post(f"/api/v1/trips/{trip_id}/expenses", json=expense_payload, headers=headers_a)
    assert res.status_code == 201
    expense_id = res.json()["id"]
    
    # 2. Attempt invalid category
    bad_payload = dict(expense_payload, category="Entertainment")
    res = client.post(f"/api/v1/trips/{trip_id}/expenses", json=bad_payload, headers=headers_a)
    assert res.status_code == 400
    
    # 3. Get Trip Expenses and check budget computation
    res = client.get(f"/api/v1/trips/{trip_id}/expenses", headers=headers_a)
    assert res.status_code == 200
    summary = res.json()
    assert summary["budget"] == 30000.0
    assert summary["total_expenses"] == 12000.0
    assert summary["remaining_budget"] == 18000.0
    
    # 4. Cross-user isolation: User B tries to view User A's trip expenses
    res = client.get(f"/api/v1/trips/{trip_id}/expenses", headers=headers_b)
    assert res.status_code == 403
    
    # 5. Set budget
    res = client.put(f"/api/v1/trips/{trip_id}/budget", json={"budget": 35000.0}, headers=headers_a)
    assert res.status_code == 200
    assert res.json()["budget"] == 35000.0


def test_hotel_map_and_compare():
    # 1. Search Hotels check coordinates
    res = client.get("/api/v1/hotels/search?city=Goa&checkIn=2026-12-15&checkOut=2026-12-20")
    assert res.status_code == 200
    hotels_list = res.json()
    assert len(hotels_list) > 0
    assert "latitude" in hotels_list[0]
    assert "longitude" in hotels_list[0]
    
    # 2. Hotel compare endpoint
    res = client.get("/api/v1/hotels/compare?hotelIds=10001&hotelIds=10002")
    assert res.status_code == 200
    comparison = res.json()
    assert len(comparison) == 2
    assert comparison[0]["price"] == 7500.0
    assert comparison[0]["breakfast"] == "Included"
    assert "cancellation" in comparison[0]
