import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount
from app.models.bookings import SeatHold, FlightBooking, TrainBooking
from app.services.wallet_loyalty import WalletService
from app.services.seat_service import SeatInventoryService
from app.tasks import release_expired_seat_holds
from decimal import Decimal

client = TestClient(app)

@pytest.fixture
def test_user():
    db = SessionLocal()
    email = "seat_test_user@travelos.com"
    user = db.query(User).filter(User.email == email).first()
    if user:
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.query(SeatHold).delete()
        db.delete(user)
        db.commit()

    user = User(email=email)
    db.add(user)
    db.commit()
    db.refresh(user)

    wallet = WalletAccount(user_id=user.id, balance=Decimal("100000.00"), currency="INR")
    db.add(wallet)
    db.commit()

    yield user

    # Cleanup
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    if user:
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.query(SeatHold).delete()
        db.delete(user)
        db.commit()
    db.close()


def test_seat_availability_endpoint(test_user):
    # Test flights in LIVE mode (live provider Indigo)
    response_live = client.get("/api/v1/bookings/seats/availability?vertical=flights&reference=AI101&provider_name=IndiGo")
    assert response_live.status_code == 200
    data_live = response_live.json()
    assert "seats" in data_live
    assert data_live["seat_map_type"] == "LIVE"

    # Test flights in DEMO mode (demo provider)
    response_demo = client.get("/api/v1/bookings/seats/availability?vertical=flights&reference=AI101&provider_name=demo")
    assert response_demo.status_code == 200
    data_demo = response_demo.json()
    assert "seats" in data_demo
    assert data_demo["seat_map_type"] == "DEMO"

    # Test trains
    response_train = client.get("/api/v1/bookings/seats/availability?vertical=trains&reference=12001&provider_name=local")
    assert response_train.status_code == 200
    data_train = response_train.json()
    assert "seats" in data_train
    assert len(data_train["seats"]) > 0


def test_hold_validation_passenger_matching(test_user):
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": test_user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "vertical": "flights",
        "amount": 5400,  # 5000 base + 200 seat + 200 seat = 5400 (counts mismatch)
        "details": {
            "origin": "DEL",
            "destination": "BOM",
            "airline_code": "AI",
            "flight_number": "101",
            "cabin_class": "ECONOMY",
            "provider_name": "IndiGo",
            "offer_id": "offer_abc",
            "seat_numbers": ["3C", "3D"],  # 2 seats (aisle = ₹200 each)
            "passengers": [{"name": "Passenger 1", "age": 30}],  # 1 passenger
            "finalFareBeforePromo": 5000
        }
    }
    response = client.post("/api/v1/bookings/hold", json=payload, headers=headers)
    assert response.status_code == 400
    assert "Selected seat count (2) must match passenger count (1)" in response.json()["detail"]


def test_hold_validation_duplicates(test_user):
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": test_user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "vertical": "flights",
        "amount": 5400,
        "details": {
            "origin": "DEL",
            "destination": "BOM",
            "airline_code": "AI",
            "flight_number": "101",
            "cabin_class": "ECONOMY",
            "provider_name": "IndiGo",
            "offer_id": "offer_abc",
            "seat_numbers": ["3C", "3C"],  # duplicates
            "passengers": [
                {"name": "Passenger 1", "age": 30},
                {"name": "Passenger 2", "age": 28}
            ],
            "finalFareBeforePromo": 5000
        }
    }
    response = client.post("/api/v1/bookings/hold", json=payload, headers=headers)
    assert response.status_code == 400
    assert "Duplicate seats in selection are not allowed" in response.json()["detail"]


def test_hold_validation_pricing_tampering(test_user):
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": test_user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}

    # Seat 1A is extra legroom (₹1,200). If client claims amount is 5150
    # backend should reject due to price tampering mismatch (should be 5000 + 1200 = 6200)
    payload = {
        "vertical": "flights",
        "amount": 5150,  # Tampered total
        "details": {
            "origin": "DEL",
            "destination": "BOM",
            "airline_code": "AI",
            "flight_number": "101",
            "cabin_class": "ECONOMY",
            "provider_name": "IndiGo",
            "offer_id": "offer_abc",
            "seat_numbers": ["1A"],  # Row 1 is Extra Legroom (₹1,200)
            "passengers": [{"name": "Passenger 1", "age": 30}],
            "finalFareBeforePromo": 5000
        }
    }

    response = client.post("/api/v1/bookings/hold", json=payload, headers=headers)
    assert response.status_code == 400
    assert "recalculated amount" in response.json()["detail"]


def test_hold_success_and_concurrency(test_user):
    db = SessionLocal()
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": test_user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}

    # Seat 3C is aisle (₹200), base fare 5000, total 5200
    payload = {
        "vertical": "flights",
        "amount": 5200,
        "details": {
            "origin": "DEL",
            "destination": "BOM",
            "airline_code": "AI",
            "flight_number": "101",
            "cabin_class": "ECONOMY",
            "provider_name": "IndiGo",
            "offer_id": "offer_abc",
            "seat_numbers": ["3C"],
            "passengers": [{"name": "Passenger 1", "age": 30}],
            "finalFareBeforePromo": 5000
        }
    }
    response = client.post("/api/v1/bookings/hold", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    ref = data["booking_reference"]
    assert ref is not None

    # Check SeatHold DB record
    hold = db.query(SeatHold).filter(SeatHold.booking_reference == ref).first()
    assert hold is not None
    assert hold.seat_number == "3C"
    assert hold.status == "HELD"
    assert hold.seat_type == "aisle"
    assert hold.price == 200

    # Test concurrency: Try to hold the same seat 3C on the same flight segment
    payload2 = {
        "vertical": "flights",
        "amount": 5200,
        "details": {
            "origin": "DEL",
            "destination": "BOM",
            "airline_code": "AI",
            "flight_number": "101",
            "cabin_class": "ECONOMY",
            "provider_name": "IndiGo",
            "offer_id": "offer_xyz",
            "seat_numbers": ["3C"],
            "passengers": [{"name": "Passenger 2", "age": 28}],
            "finalFareBeforePromo": 5000
        }
    }
    response2 = client.post("/api/v1/bookings/hold", json=payload2, headers=headers)
    assert response2.status_code == 409
    assert "already held or booked" in response2.json()["detail"]
    db.close()


def test_payment_confirm_and_cancellation(test_user):
    db = SessionLocal()
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": test_user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}

    # Seat 3D is aisle (₹200), base fare 5000, total 5200
    payload = {
        "vertical": "flights",
        "amount": 5200,
        "details": {
            "origin": "DEL",
            "destination": "BOM",
            "airline_code": "AI",
            "flight_number": "101",
            "cabin_class": "ECONOMY",
            "provider_name": "IndiGo",
            "offer_id": "offer_abc",
            "seat_numbers": ["3D"],
            "passengers": [{"name": "Passenger 1", "age": 30}],
            "finalFareBeforePromo": 5000
        }
    }
    response = client.post("/api/v1/bookings/hold", json=payload, headers=headers)
    ref = response.json()["booking_reference"]

    # 2. Confirm booking via checkout payment (Confirm endpoint using query parameters)
    params = {
        "booking_reference": ref,
        "vertical": "flights",
        "payment_method": "wallet"
    }
    pay_response = client.post("/api/v1/bookings/confirm", params=params, headers=headers)
    assert pay_response.status_code == 200

    # Verify hold is now CONFIRMED
    db.expire_all()
    hold = db.query(SeatHold).filter(SeatHold.booking_reference == ref).first()
    assert hold.status == "CONFIRMED"

    # 3. Cancel booking (Cancel endpoint using query parameters)
    cancel_params = {
        "booking_reference": ref,
        "vertical": "flights"
    }
    cancel_response = client.post("/api/v1/bookings/cancel", params=cancel_params, headers=headers)
    assert cancel_response.status_code == 200

    # Verify hold is now RELEASED
    db.expire_all()
    hold = db.query(SeatHold).filter(SeatHold.booking_reference == ref).first()
    assert hold.status == "RELEASED"
    db.close()


def test_sla_expired_sweeper(test_user):
    db = SessionLocal()
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": test_user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}

    # Seat 4C is aisle (₹200), base fare 5000, total 5200
    payload = {
        "vertical": "flights",
        "amount": 5200,
        "details": {
            "origin": "DEL",
            "destination": "BOM",
            "airline_code": "AI",
            "flight_number": "101",
            "cabin_class": "ECONOMY",
            "provider_name": "IndiGo",
            "offer_id": "offer_abc",
            "seat_numbers": ["4C"],
            "passengers": [{"name": "Passenger 1", "age": 30}],
            "finalFareBeforePromo": 5000
        }
    }
    response = client.post("/api/v1/bookings/hold", json=payload, headers=headers)
    ref = response.json()["booking_reference"]

    # Manually expire the hold in DB
    hold = db.query(SeatHold).filter(SeatHold.booking_reference == ref).first()
    hold.expires_at = datetime.datetime.utcnow() - datetime.timedelta(seconds=1)
    db.commit()

    # Trigger background sweep task
    release_expired_seat_holds(db)

    # Verify hold is EXPIRED
    db.expire_all()
    hold = db.query(SeatHold).filter(SeatHold.booking_reference == ref).first()
    assert hold.status == "EXPIRED"
    db.close()
