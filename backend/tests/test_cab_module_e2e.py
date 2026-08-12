import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.bookings import CabBooking, BookingStatus
from app.models.search_entities import CabVehicle, City
from app.models.core import User
from app.auth.jwt import create_access_token
import datetime
import uuid

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_cab_test_data():
    db = SessionLocal()
    user = db.query(User).filter(User.email == "cab_test_user@travelos.com").first()
    if not user:
        user = User(
            email="cab_test_user@travelos.com",
            password_hash="hashed_pw",
            role="customer"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Ensure test city exists
    city = db.query(City).filter(City.name == "Delhi").first()
    if not city:
        city = City(name="Delhi", country="India", lat=28.6139, lng=77.2090, timezone="Asia/Kolkata")
        db.add(city)
        db.commit()
        db.refresh(city)

    # Seed representative test vehicles
    test_vehs = [
        {"brand": "Honda", "model": "Activa", "type": "Bike", "category": "Bike", "seats": 1, "luggage": 1, "price": 180, "base_fare": 40.0, "price_per_km": 8.0, "per_hour": 70.0},
        {"brand": "Maruti", "model": "Swift", "type": "Hatchback", "category": "Hatchback", "seats": 4, "luggage": 2, "price": 450, "base_fare": 150.0, "price_per_km": 13.0, "per_hour": 180.0},
        {"brand": "Maruti", "model": "Dzire", "type": "Sedan", "category": "Sedan", "seats": 4, "luggage": 3, "price": 550, "base_fare": 200.0, "price_per_km": 16.0, "per_hour": 220.0},
        {"brand": "Hyundai", "model": "Creta", "type": "SUV", "category": "SUV", "seats": 5, "luggage": 4, "price": 750, "base_fare": 300.0, "price_per_km": 21.0, "per_hour": 320.0},
        {"brand": "Toyota", "model": "Innova Crysta", "type": "MPV", "category": "MPV", "seats": 7, "luggage": 5, "price": 950, "base_fare": 450.0, "price_per_km": 28.0, "per_hour": 480.0},
    ]

    for tv in test_vehs:
        existing = db.query(CabVehicle).filter(CabVehicle.model == tv["model"]).first()
        if not existing:
            v = CabVehicle(
                city_id=city.id,
                provider=f"TravelOS {tv['category']}",
                type=tv["type"],
                category=tv["category"],
                brand=tv["brand"],
                model=tv["model"],
                display_name=f"{tv['brand']} {tv['model']}",
                price=tv["price"],
                base_fare=tv["base_fare"],
                price_per_km=tv["price_per_km"],
                per_hour_rate=tv["per_hour"],
                seating_capacity=tv["seats"],
                luggage_capacity=tv["luggage"],
                fuel_type="Petrol",
                transmission="Automatic",
                ac_available=True,
                rating=4.9,
                review_count=850,
                image_url="http://example.com/cab.jpg",
                plate_number="DL-01-AB-9999",
                availability_status="available",
                seed_batch_id="test_seed"
            )
            db.add(v)
    db.commit()
    db.close()

@pytest.fixture
def auth_header():
    from decimal import Decimal
    from app.models.core import WalletAccount

    db = SessionLocal()
    user = db.query(User).filter(User.email == "cab_test_user@travelos.com").first()
    if not user:
        user = User(
            email="cab_test_user@travelos.com",
            password_hash="hashed_pw",
            role="customer"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Fund wallet so confirmation checkout succeeds
    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).first()
    if not wallet:
        wallet = WalletAccount(user_id=user.id, balance=Decimal("15000.00"))
        db.add(wallet)
    else:
        wallet.balance = Decimal("15000.00")
    db.commit()

    from app.auth.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = lambda: user
    
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})
    yield {"Authorization": f"Bearer {token}"}
    app.dependency_overrides.clear()
    db.close()

def test_cab_search_one_way_and_pricing_breakdown():
    payload = {
        "pickup_address": "Indira Gandhi International Airport (DEL), Terminal 3",
        "drop_address": "Connaught Place, Central Delhi",
        "trip_type": "one_way",
        "passengers": 2,
        "luggage_count": 2
    }
    response = client.post("/api/v1/cabs/search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "options" in data
    assert len(data["options"]) > 0
    
    first_opt = data["options"][0]
    assert "display_name" in first_opt
    assert "seating_capacity" in first_opt
    assert "breakdown" in first_opt
    bdown = first_opt["breakdown"]
    assert "base_fare" in bdown
    assert "distance_charge" in bdown
    assert "gst_tax" in bdown
    assert "total_payable" in bdown
    assert first_opt["seating_capacity"] >= 2

def test_cab_search_capacity_constraint_filtering():
    # When searching for 6 passengers, 1-seater bikes, 4-seater hatchbacks, and 4-seater sedans must be filtered out
    payload = {
        "pickup_address": "New Delhi Railway Station",
        "drop_address": "Cyber City Gurugram",
        "trip_type": "one_way",
        "passengers": 6,
        "luggage_count": 2
    }
    response = client.post("/api/v1/cabs/search", json=payload)
    assert response.status_code == 200
    data = response.json()
    for opt in data["options"]:
        assert opt["seating_capacity"] >= 6
        assert opt["category"] in ["SUV", "MPV", "XL", "Van"]

def test_cab_search_hourly_package():
    payload = {
        "pickup_address": "Connaught Place, New Delhi",
        "drop_address": "Local City Package",
        "trip_type": "hourly",
        "hourly_duration": 8,
        "passengers": 2
    }
    response = client.post("/api/v1/cabs/search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["trip_type"] == "hourly"
    assert data["distance_km"] == 80.0
    assert len(data["options"]) > 0

def test_cab_booking_hold_and_capacity_rejection(auth_header):
    # Attempting to hold a 4-seater sedan for 7 passengers must fail with 400 Bad Request
    hold_payload = {
        "vertical": "cabs",
        "user_id": 1,
        "amount": 1500.0,
        "details": {
            "vehicle_name": "Maruti Dzire",
            "provider_name": "Ghumne Chale Fleet",
            "cab_type": "Sedan",
            "pickup_address": "Delhi Airport T3",
            "drop_address": "Noida Sector 62",
            "passengers_count": 7,
            "passengers": [
                {"name": f"Traveler {i}", "age": 25} for i in range(7)
            ]
        }
    }
    response = client.post("/api/v1/bookings/hold", json=hold_payload, headers=auth_header)
    assert response.status_code == 400
    assert "seating capacity" in response.json()["detail"].lower()

def test_cab_booking_hold_and_confirmation_lifecycle(auth_header):
    # Valid hold for 2 passengers in a 4-seater Sedan
    hold_payload = {
        "vertical": "cabs",
        "user_id": 1,
        "amount": 750.0,
        "details": {
            "vehicle_name": "Maruti Dzire",
            "provider_name": "Ghumne Chale Fleet",
            "cab_type": "Sedan",
            "pickup_address": "Indira Gandhi International Airport (DEL), Terminal 3",
            "drop_address": "Connaught Place, Central Delhi",
            "trip_type": "airport_transfer",
            "flight_number": "6E-2045",
            "terminal": "T3",
            "passengers_count": 2,
            "passengers": [
                {"name": "Aditya Sharma", "age": 32, "is_primary": True},
                {"name": "Neha Sharma", "age": 30, "is_primary": False}
            ],
            "luggage_count": 2,
            "driver_name": "Ramesh Kumar (+91 98765 43210)",
            "vehicle_number": "DL-1C-B-5678"
        }
    }
    hold_resp = client.post("/api/v1/bookings/hold", json=hold_payload, headers=auth_header)
    assert hold_resp.status_code == 200
    hold_data = hold_resp.json()
    assert hold_data["status"] == "hold"
    booking_ref = hold_data["booking_reference"]

    # Confirm booking
    confirm_resp = client.post(f"/api/v1/bookings/confirm?booking_reference={booking_ref}&vertical=cabs", headers=auth_header)
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "confirmed"

    # Fetch Cab Voucher
    voucher_resp = client.get(f"/api/v1/cabs/{booking_ref}/voucher", headers=auth_header)
    assert voucher_resp.status_code == 200
    voucher_data = voucher_resp.json()
    assert "voucher_text" in voucher_data
    assert "CAB BOOKING VOUCHER" in voucher_data["voucher_text"]
    assert "DL-1C-B-5678" in voucher_data["voucher_text"]

def test_cab_cancellation_flow(auth_header):
    # Book via direct cab route
    book_payload = {
        "pickup_address": "Connaught Place",
        "drop_address": "Hauz Khas Village",
        "cab_type": "Sedan",
        "amount": 400.0,
        "passengers": 1
    }
    book_resp = client.post("/api/v1/cabs/book", json=book_payload, headers=auth_header)
    assert book_resp.status_code == 200
    book_data = book_resp.json()
    booking_ref = book_data["booking_reference"]

    # Cancel ride
    cancel_resp = client.post("/api/v1/cabs/cancel", json={"booking_reference": booking_ref, "reason": "Meeting rescheduled"}, headers=auth_header)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"
    assert cancel_resp.json()["refund_amount"] > 0
