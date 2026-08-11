import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import create_access_token
from app.providers.providers_registry import providers_registry
from app.providers.cab_provider import LocalCabProvider, AmadeusTransfersProvider
from app.providers.car_rental_provider import LocalCarRentalProvider, DuffelCarsProvider

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_users():
    db = SessionLocal()
    # Admin User
    admin = db.query(User).filter(User.email == "provider_admin@travelos.com").first()
    if not admin:
        admin = User(email="provider_admin@travelos.com", password_hash="pw", role="admin")
        db.add(admin)
        db.commit()

    # Customer User
    customer = db.query(User).filter(User.email == "car_renter@travelos.com").first()
    if not customer:
        customer = User(email="car_renter@travelos.com", password_hash="pw", role="user")
        db.add(customer)
        db.commit()
    db.close()


@pytest.fixture
def admin_auth():
    token = create_access_token({"sub": "provider_admin@travelos.com", "email": "provider_admin@travelos.com", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def customer_auth():
    token = create_access_token({"sub": "car_renter@travelos.com", "email": "car_renter@travelos.com", "role": "user"})
    return {"Authorization": f"Bearer {token}"}


def test_admin_providers_health_endpoint(admin_auth, customer_auth):
    # Non-admin user gets 403
    forbidden_res = client.get("/api/v1/admin/providers/health", headers=customer_auth)
    assert forbidden_res.status_code == 403

    # Admin user gets 200 with complete health report
    res = client.get("/api/v1/admin/providers/health", headers=admin_auth)
    assert res.status_code == 200
    data = res.json()
    assert "mode" in data
    assert "active_cab_provider" in data
    assert "active_car_rental_provider" in data
    assert "providers" in data
    assert "amadeus_transfers" in data["providers"]
    assert "duffel_cars" in data["providers"]
    assert "local_fleet" in data["providers"]


@pytest.mark.asyncio
async def test_cab_provider_adapters():
    local_p = LocalCabProvider()
    offers = await local_p.search(
        pickup_address="Indira Gandhi International Airport, Delhi",
        drop_address="DLF Cyber City, Gurugram",
        trip_type="one_way",
        passengers=2
    )
    assert len(offers) > 0
    assert offers[0].is_live is False
    assert offers[0].source == "demo"
    assert offers[0].fare > 0

    quote = await local_p.get_quote(offers[0].id, offers[0].fare)
    assert quote.total_fare == offers[0].fare
    assert quote.provider == "TravelOS Local Fleet"

    amadeus_p = AmadeusTransfersProvider()
    amd_offers = await amadeus_p.search(
        pickup_address="DEL",
        drop_address="Aerocity",
        trip_type="airport_transfer",
        passengers=2
    )
    assert len(amd_offers) > 0
    assert amd_offers[0].is_live is True
    assert amd_offers[0].source == "live"


@pytest.mark.asyncio
async def test_car_rental_provider_adapters():
    local_car = LocalCarRentalProvider()
    car_offers = await local_car.search(
        pickup_location="Delhi Hub",
        drop_location="Delhi Hub",
        pickup_date="2026-08-15",
        pickup_time="10:00",
        return_date="2026-08-17",
        return_time="10:00"
    )
    assert len(car_offers) > 0
    assert car_offers[0].is_live is False
    assert "Unlimited" in car_offers[0].included_mileage

    quote = await local_car.get_quote(car_offers[0].id, 2)
    assert quote.total_payable > 0
    assert quote.provider == "TravelOS Drive"

    booking = await local_car.create_booking(quote.quote_id, {"driver_name": "Test Driver"}, "IDEM-CAR-TEST-1", quote.total_payable)
    assert booking.success is True
    assert booking.status == "CONFIRMED"

    c_res = await local_car.cancel_booking(booking.booking_reference)
    assert c_res["status"] == "CANCELLED"





def test_car_rental_api_lifecycle(customer_auth):
    # Step 1: Search
    search_res = client.post("/api/v1/cars/search", json={
        "pickup_location": "Indira Gandhi International Airport, Terminal 3",
        "drop_location": "Indira Gandhi International Airport, Terminal 3",
        "pickup_date": "2026-08-20",
        "pickup_time": "10:00",
        "return_date": "2026-08-22",
        "return_time": "10:00",
        "driver_age": 28,
        "driver_country": "India"
    })
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["success"] is True
    assert len(search_data["offers"]) > 0
    selected_offer = search_data["offers"][0]

    # Step 2: Quote
    quote_res = client.post("/api/v1/cars/quote", json={
        "offer_id": selected_offer["id"],
        "rental_days": 2,
        "insurance_code": "basic"
    })
    assert quote_res.status_code == 200
    quote_data = quote_res.json()
    assert quote_data["total_payable"] > 0

    # Step 3: Validation - Underage driver rejected
    underage_res = client.post("/api/v1/cars/book", json={
        "offer_id": selected_offer["id"],
        "quote_id": quote_data["quote_id"],
        "amount": quote_data["total_payable"],
        "driver_name": "Rohan Junior",
        "driver_phone": "+91 99999 11111",
        "driver_email": "junior@travelos.com",
        "driver_license_number": "DL-1420110012345",
        "driver_age": 16
    }, headers=customer_auth)
    assert underage_res.status_code == 400
    assert "18" in underage_res.json()["detail"]

    # Step 4: Book Successfully
    book_res = client.post("/api/v1/cars/book", json={
        "offer_id": selected_offer["id"],
        "quote_id": quote_data["quote_id"],
        "amount": quote_data["total_payable"],
        "driver_name": "Rohan Verma",
        "driver_phone": "+91 99999 11111",
        "driver_email": "rohan@travelos.com",
        "driver_license_number": "DL-1420110012345",
        "driver_age": 28,
        "idempotency_key": "IDEM-TEST-KEY-001"
    }, headers=customer_auth)
    assert book_res.status_code == 200
    booking_data = book_res.json()
    assert booking_data["success"] is True
    booking_ref = booking_data["booking_reference"]

    # Step 5: Voucher
    voucher_res = client.get(f"/api/v1/cars/{booking_ref}/voucher", headers=customer_auth)
    assert voucher_res.status_code == 200
    assert "VOUCHER" in voucher_res.json()["voucher_title"]
    assert "QR-CAR-" in voucher_res.json()["qr_verification_token"]

    # Step 6: Cancel
    cancel_res = client.post("/api/v1/cars/cancel", json={
        "booking_reference": booking_ref,
        "reason": "Trip postponed"
    }, headers=customer_auth)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"
