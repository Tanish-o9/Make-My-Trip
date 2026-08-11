import pytest
import datetime
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount
from app.models.showcase import Offer
from app.models.bookings import BookingStatus, CabBooking, TrainBooking, PriceDropClaim
from app.models.mybiz import Organization, EmployeeLink
from app.models.wishlist import WishlistItem

client = TestClient(app)

@pytest.fixture
def test_user_and_wallet():
    """Seeds a test user with a funded wallet account"""
    db = SessionLocal()
    # Check if user already exists
    user = db.query(User).filter(User.email == "corp_employee@travelos.com").first()
    if not user:
        user = User(email="corp_employee@travelos.com")
        db.add(user)
        db.commit()
        db.refresh(user)

    # Ensure funded wallet
    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).first()
    if not wallet:
        wallet = WalletAccount(user_id=user.id, balance=Decimal("15000.00"))
        db.add(wallet)
    else:
        wallet.balance = Decimal("15000.00")
    db.commit()
    db.refresh(wallet)
    
    # Override get_current_user dependency for testing
    from app.auth.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = lambda: user
    
    yield user, wallet
    app.dependency_overrides.clear()
    db.close()


def test_booking_holds_and_state_transitions(test_user_and_wallet):
    user, wallet = test_user_and_wallet
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Post hold for cab booking
    hold_payload = {
        "vertical": "cabs",
        "amount": 2500.00,
        "user_id": user.id,
        "details": {
            "provider_name": "Ola",
            "cab_type": "SUV",
            "pickup_address": "Terminal 3, DEL",
            "drop_address": "Connaught Place, Delhi"
        }
    }
    response = client.post("/api/v1/bookings/hold", json=hold_payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    ref = data["booking_reference"]
    assert data["status"] == "hold"
    assert data["total_amount"] == 2500.00

    # 2. Confirm booking using wallet balance
    confirm_payload = {
        "booking_reference": ref,
        "vertical": "cabs",
        "payment_method": "wallet"
    }
    response_confirm = client.post(
        f"/api/v1/bookings/confirm?booking_reference={ref}&vertical=cabs&payment_method=wallet",
        headers=headers
    )
    assert response_confirm.status_code == 200
    confirm_data = response_confirm.json()
    assert confirm_data["status"] == "confirmed"

    # Verify wallet was debited (15000 - 2500 = 12500)
    db = SessionLocal()
    wallet_db = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).first()
    assert wallet_db.balance == Decimal("12500.00")

    # 3. Generate invoice text summary
    invoice_resp = client.get(f"/api/v1/bookings/{ref}/invoice?vertical=cabs")
    assert invoice_resp.status_code == 200
    assert "TRAVEL OS INVOICE" in invoice_resp.json()["invoice_text"]

    # 4. Cancel booking and check refund credits (timelines represent 100% refund minus 5% fee)
    response_cancel = client.post(f"/api/v1/bookings/cancel?booking_reference={ref}&vertical=cabs")
    assert response_cancel.status_code == 200
    cancel_data = response_cancel.json()
    assert cancel_data["status"] == "cancelled"
    # Refund processed = 2500 * 0.95 = 2375.00
    assert cancel_data["refund_processed"] == 2375.00
    
    # Wallet balance should now be 12500 + 2375 = 14875.00
    db.refresh(wallet_db)
    assert wallet_db.balance == Decimal("14875.00")
    db.close()


def test_promotions_offers_codes(test_user_and_wallet):
    user, _ = test_user_and_wallet
    
    # Seed mock offer
    db = SessionLocal()
    # Expired offer
    expired = db.query(Offer).filter(Offer.promo_code == "OLDCODE").first()
    if not expired:
        expired = Offer(
            category="flights",
            tags="EXPIRED",
            title="Expired Flight Code",
            description="Should fail validity check",
            promo_code="OLDCODE",
            valid_to=datetime.datetime.utcnow() - datetime.timedelta(days=2),
            active=True
        )
        db.add(expired)
        db.commit()

    # Valid Flight offer
    flight_promo = db.query(Offer).filter(Offer.promo_code == "FLYCHIP").first()
    if not flight_promo:
        flight_promo = Offer(
            category="flights",
            tags="FLIGHT CHIP",
            title="Valid Flight Code",
            description="Should pass validity check",
            promo_code="FLYCHIP",
            valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            active=True
        )
        db.add(flight_promo)
        db.commit()
    db.close()

    # Case 1: Expired offer
    resp = client.post(
        f"/api/v1/showcase/offers/apply?promo_code=OLDCODE&vertical=flights&order_value=5000.0&user_id={user.id}"
    )
    assert resp.status_code == 200
    assert resp.json()["applicable"] is False
    assert "expired" in resp.json()["reason"]

    # Case 2: Wrong category vertical match (Apply flight promo to cabs)
    resp_vertical = client.post(
        f"/api/v1/showcase/offers/apply?promo_code=FLYCHIP&vertical=cabs&order_value=2000.0&user_id={user.id}"
    )
    assert resp_vertical.status_code == 200
    assert resp_vertical.json()["applicable"] is False
    assert "only applicable to flights" in resp_vertical.json()["reason"]

    # Case 3: Successful apply
    resp_success = client.post(
        f"/api/v1/showcase/offers/apply?promo_code=FLYCHIP&vertical=flights&order_value=5000.0&user_id={user.id}"
    )
    assert resp_success.status_code == 200
    data = resp_success.json()
    assert data["applicable"] is True
    # 5000 * 10% = 500 discount
    assert data["discount_amount"] == 500.0
    assert data["new_total"] == 4500.0


def test_mybiz_policy_budgets(test_user_and_wallet):
    user, _ = test_user_and_wallet
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Onboard Organization & Link traveler
    db = SessionLocal()
    org = db.query(Organization).filter(Organization.name == "Gemini Inc").first()
    if not org:
        org = Organization(name="Gemini Inc", per_diem_limit=2000.0)
        db.add(org)
        db.commit()
        db.refresh(org)

    emp = db.query(EmployeeLink).filter(EmployeeLink.user_id == user.id).first()
    if not emp:
        emp = EmployeeLink(user_id=user.id, org_id=org.id, role="traveler")
        db.add(emp)
        db.commit()
    db.close()

    # 2. Hold a Cab booking for ₹3,500 (exceeds per-diem-limit of ₹2,000)
    hold_payload = {
        "vertical": "cabs",
        "amount": 3500.00,
        "user_id": user.id,
        "details": {
            "provider_name": "Ola",
            "cab_type": "Luxury Sedan",
            "pickup_address": "HQ Office",
            "drop_address": "Outstation Client"
        }
    }
    response = client.post("/api/v1/bookings/hold", json=hold_payload, headers=headers)
    ref = response.json()["booking_reference"]

    # 3. Confirm using corporate billing method
    response_confirm = client.post(
        f"/api/v1/bookings/confirm?booking_reference={ref}&vertical=cabs&payment_method=corporate_billing",
        headers=headers
    )
    assert response_confirm.status_code == 200
    confirm_data = response_confirm.json()
    # Should transition to PENDING_APPROVAL due to policy breach
    assert confirm_data["status"] == "pending_approval"
    assert "exceeded" in confirm_data["message"]

    # 4. Approver submits approval verdict
    approval_resp = client.post(
        f"/api/v1/mybiz/approvals/verdict?booking_reference={ref}&vertical=cabs&verdict=approve",
        headers=headers
    )
    assert approval_resp.status_code == 200
    assert approval_resp.json()["status"] == "confirmed"


def test_wishlist_saves_alerts(test_user_and_wallet):
    user, _ = test_user_and_wallet
    
    # 1. Add hotel listing to wishlist
    payload = {
        "user_id": user.id,
        "item_type": "hotel",
        "item_ref_id": "HT-DEL-TAJ",
        "snapshot_json": {
            "name": "Taj Palace Delhi",
            "price": 15000.0
        }
    }
    resp = client.post(f"/api/v1/wishlist?user_id={user.id}&item_type=hotel&item_ref_id=HT-DEL-TAJ", json=payload["snapshot_json"])
    assert resp.status_code == 200
    assert "Added" in resp.json()["message"]
    item_id = resp.json()["id"]

    # 2. Check price drops (simulates drops and triggers notification event pings)
    alerts_resp = client.get(f"/api/v1/wishlist/price-alerts?user_id={user.id}")
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert len(alerts) > 0
    assert alerts[0]["wishlist_item_id"] == item_id
    assert alerts[0]["price_drop"] > 0.0

    # Clean up wishlist
    del_resp = client.delete(f"/api/v1/wishlist/{item_id}")
    assert del_resp.status_code == 200


def test_tracker_cache_rest():
    # 1. Lookup flight status
    resp = client.get("/api/v1/tracker?flight_number=6E-502&date=2026-12-15")
    assert resp.status_code == 200
    data = resp.json()
    assert data["flight_number"] == "6E-502"
    assert data["live_metrics"]["status"] == "On Time"


def test_multi_passenger_hold_flow(test_user_and_wallet):
    user, wallet = test_user_and_wallet
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    hold_payload = {
        "vertical": "flights",
        "amount": 15000.00,
        "user_id": user.id,
        "details": {
            "provider_name": "MockFlight",
            "airline_code": "UK",
            "flight_number": "UK-101",
            "cabin_class": "ECONOMY",
            "origin": "DEL",
            "destination": "BOM",
            "passengers": [
                {
                    "name": "Passenger One",
                    "fullName": "Passenger One",
                    "age": 25,
                    "email": "p1@example.com",
                    "phone": "+919999999999",
                    "studentFare": False,
                    "is_student": False,
                    "is_primary": True
                },
                {
                    "name": "Passenger Two",
                    "fullName": "Passenger Two",
                    "age": 30,
                    "email": "p2@example.com",
                    "phone": "+918888888888",
                    "studentFare": True,
                    "is_student": True,
                    "is_primary": False
                }
            ]
        }
    }
    response = client.post("/api/v1/bookings/hold", json=hold_payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    ref = data["booking_reference"]
    assert data["status"] == "hold"
    assert data["total_amount"] == 15000.00
    
    # Query database to verify both passengers are successfully saved
    from app.database import SessionLocal
    from app.models.bookings import FlightBooking
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == ref).first()
    assert booking is not None
    assert len(booking.passenger_details) == 2
    assert booking.passenger_details[0]["name"] == "Passenger One"
    assert booking.passenger_details[1]["name"] == "Passenger Two"
    assert booking.passenger_details[1]["studentFare"] is True
    db.close()


def test_vehicle_rental_seating_capacity_validation(test_user_and_wallet):
    user, wallet = test_user_and_wallet
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    from app.database import SessionLocal
    from app.models.search_entities import RentalVehicle, City
    db = SessionLocal()
    
    city_obj = db.query(City).first()
    if not city_obj:
        city_obj = City(
            name="Goa Test City",
            country="India",
            lat=15.4989,
            lng=73.8278,
            timezone="Asia/Kolkata"
        )
        db.add(city_obj)
        db.commit()
        db.refresh(city_obj)
        
    veh = RentalVehicle(
        city_id=city_obj.id,
        hub_locality_id=None,
        name="Test Capacity Bike",
        brand="Honda",
        model="Activa",
        type="Bike",
        vehicle_type="Bike",
        price_per_day=500.0,
        fuel_type="Petrol",
        transmission="Automatic",
        seating_capacity=2,
        self_drive_available=True,
        with_driver_available=False,
        rental_mode="self_drive",
        distance_km=1.2,
        instant_confirm=True,
        rating=4.5,
        image_url="http://example.com/bike.jpg",
        is_active=True,
        seed_batch_id="test_batch"
    )
    db.add(veh)
    db.commit()
    
    hold_payload = {
        "vertical": "rent-a-ride",
        "amount": 1500.00,
        "user_id": user.id,
        "details": {
            "vehicle_name": "Test Capacity Bike",
            "vehicle_type": "Bike",
            "pickup_time": "2026-12-15T10:00:00",
            "drop_time": "2026-12-18T10:00:00",
            "passenger_count": 3,
            "passengers": [
                {"name": "P1", "age": 30},
                {"name": "P2", "age": 28},
                {"name": "P3", "age": 25}
            ]
        }
    }
    
    try:
        response = client.post("/api/v1/bookings/hold", json=hold_payload, headers=headers)
        assert response.status_code == 400
        assert "seating capacity" in response.json()["detail"].lower()
    finally:
        db.delete(veh)
        db.commit()
        db.close()


