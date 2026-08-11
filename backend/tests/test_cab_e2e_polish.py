import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.search_entities import CabVehicle, City
from app.models.bookings import CabBooking, BookingStatus
from app.models.core import User
from app.auth.jwt import create_access_token
from app.commands.seed import run_cabs

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_cabs_and_users():
    db = SessionLocal()
    # Ensure test city exists
    city = db.query(City).filter(City.name == "Delhi").first()
    if not city:
        city = City(name="Delhi", country="India", lat=28.6139, lng=77.2090, timezone="Asia/Kolkata")
        db.add(city)
        db.commit()

    # Ensure test user 1 exists
    user1 = db.query(User).filter(User.email == "cab_customer1@travelos.com").first()
    if not user1:
        user1 = User(email="cab_customer1@travelos.com", password_hash="pw", role="user")
        db.add(user1)
        db.commit()

    # Ensure test user 2 (adversary) exists
    user2 = db.query(User).filter(User.email == "cab_customer2@travelos.com").first()
    if not user2:
        user2 = User(email="cab_customer2@travelos.com", password_hash="pw", role="user")
        db.add(user2)
        db.commit()

    # Ensure admin user exists
    admin = db.query(User).filter(User.email == "cab_admin@travelos.com").first()
    if not admin:
        admin = User(email="cab_admin@travelos.com", password_hash="pw", role="admin")
        db.add(admin)
        db.commit()

    db.close()
    run_cabs()

@pytest.fixture
def user1_auth():
    from decimal import Decimal
    from app.models.core import WalletAccount

    db = SessionLocal()
    user = db.query(User).filter(User.email == "cab_customer1@travelos.com").first()
    if not user:
        user = User(email="cab_customer1@travelos.com", password_hash="pw", role="user")
        db.add(user)
        db.commit()
        db.refresh(user)

    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).first()
    if not wallet:
        wallet = WalletAccount(user_id=user.id, balance=Decimal("25000.00"))
        db.add(wallet)
    else:
        wallet.balance = Decimal("25000.00")
    db.commit()

    token = create_access_token({"sub": user.email, "email": user.email, "role": user.role})
    db.close()
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def user2_auth():
    db = SessionLocal()
    user = db.query(User).filter(User.email == "cab_customer2@travelos.com").first()
    if not user:
        user = User(email="cab_customer2@travelos.com", password_hash="pw", role="user")
        db.add(user)
        db.commit()
        db.refresh(user)
    token = create_access_token({"sub": user.email, "email": user.email, "role": user.role})
    db.close()
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def admin_auth():
    db = SessionLocal()
    user = db.query(User).filter(User.email == "cab_admin@travelos.com").first()
    if not user:
        user = User(email="cab_admin@travelos.com", password_hash="pw", role="admin")
        db.add(user)
        db.commit()
        db.refresh(user)
    token = create_access_token({"sub": user.email, "email": user.email, "role": user.role})
    db.close()
    return {"Authorization": f"Bearer {token}"}


# ── 1. SEARCH VALIDATION & LOCATIONS ──────────────────────────────────────────

def test_search_validation_errors():
    # Empty pickup must fail
    resp = client.post("/api/v1/cabs/search", json={"pickup_address": "", "drop_address": "Agra"})
    assert resp.status_code == 400

    # Missing drop for one-way must fail
    resp = client.post("/api/v1/cabs/search", json={"pickup_address": "Delhi Airport", "drop_address": "", "trip_type": "one_way"})
    assert resp.status_code == 400

    # Same pickup and drop must fail
    resp = client.post("/api/v1/cabs/search", json={"pickup_address": "Delhi Airport", "drop_address": "delhi airport", "trip_type": "one_way"})
    assert resp.status_code == 400

def test_location_autocomplete():
    resp = client.get("/api/v1/cabs/locations/autocomplete?query=airport")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) > 0
    assert any("Airport" in item["type"] or "Airport" in item["name"] for item in items)


# ── 2. PASSENGER & LUGGAGE CAPACITY FILTERING ─────────────────────────────────

def test_passenger_luggage_capacity_matrix():
    # 1 Passenger -> Can return Hatchbacks, Sedans, SUVs, MPVs
    resp1 = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Delhi Airport", "drop_address": "Connaught Place", "passengers": 1, "luggage_count": 1
    })
    assert resp1.status_code == 200
    types1 = {v["category"] for v in resp1.json()["options"]}
    assert "Hatchback" in types1 or "Sedan" in types1

    # 5 Passengers -> Excludes 4-seater hatchbacks & sedans
    resp5 = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Delhi Airport", "drop_address": "Connaught Place", "passengers": 5, "luggage_count": 2
    })
    assert resp5.status_code == 200
    for v in resp5.json()["options"]:
        assert v["seating_capacity"] >= 5

    # 7 Passengers -> Excludes 5-seaters, only 7-seater MPVs
    resp7 = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Delhi Airport", "drop_address": "Connaught Place", "passengers": 7, "luggage_count": 3
    })
    assert resp7.status_code == 200
    for v in resp7.json()["options"]:
        assert v["seating_capacity"] >= 7
        assert v["category"] in ["MPV", "SUV"]

    # 8 Bags Luggage constraint
    resp_luggage = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Delhi Airport", "drop_address": "Connaught Place", "passengers": 2, "luggage_count": 5
    })
    assert resp_luggage.status_code == 200
    for v in resp_luggage.json()["options"]:
        assert v["luggage_capacity"] >= 5


# ── 3. TRIP MODES & AUTHORITATIVE PRICING ─────────────────────────────────────

def test_trip_modes_and_breakdown():
    # One Way
    r_oneway = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Delhi Airport", "drop_address": "Cyber Hub Gurgaon", "trip_type": "one_way"
    })
    assert r_oneway.status_code == 200
    opt_ow = r_oneway.json()["options"][0]
    assert opt_ow["breakdown"]["gst_tax"] > 0
    assert opt_ow["breakdown"]["total_payable"] == opt_ow["fare"]

    # Round Trip
    r_round = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Delhi", "drop_address": "Agra", "trip_type": "round_trip"
    })
    assert r_round.status_code == 200
    opt_rt = r_round.json()["options"][0]
    assert opt_rt["breakdown"]["driver_allowance"] >= 350.0

    # Hourly
    r_hourly = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Connaught Place", "trip_type": "hourly", "hourly_duration": 8
    })
    assert r_hourly.status_code == 200
    opt_hr = r_hourly.json()["options"][0]
    assert opt_hr["fare"] > 0

    # Airport Transfer
    r_apt = client.post("/api/v1/cabs/search", json={
        "pickup_address": "DEL Airport T3", "drop_address": "Noida", "trip_type": "airport_transfer", "flight_number": "6E-2045"
    })
    assert r_apt.status_code == 200
    opt_apt = r_apt.json()["options"][0]
    assert opt_apt["breakdown"]["toll_parking_estimate"] >= 80.0


# ── 4. COMPLETE E2E LIFECYCLE, HOLD TIMER & EXPIRY ─────────────────────────────

def test_full_cab_lifecycle_and_security(user1_auth, user2_auth, admin_auth):
    # Step 1: Search
    search_res = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Indira Gandhi International Airport, Delhi",
        "drop_address": "DLF Cyber City, Gurugram",
        "trip_type": "one_way",
        "passengers": 2,
        "luggage_count": 2
    })
    assert search_res.status_code == 200
    vehicle = search_res.json()["options"][0]

    # Step 2: Hold Cab
    hold_payload = {
        "vertical": "cabs",
        "amount": vehicle["fare"],
        "details": {
            "vehicle_name": vehicle["display_name"],
            "model": vehicle["model"],
            "brand": vehicle["brand"],
            "cab_type": vehicle["category"],
            "pickup_address": "Indira Gandhi International Airport, Delhi",
            "drop_address": "DLF Cyber City, Gurugram",
            "passengers_count": 2,
            "passengers": [
                {"name": "Aditya Sharma", "age": 32, "phone": "+91 98765 43210"},
                {"name": "Priya Sharma", "age": 30, "phone": "+91 98765 43211"}
            ],
            "luggage_count": 2,
            "distance_km": search_res.json()["distance_km"],
            "estimated_duration_mins": search_res.json()["duration_mins"]
        }
    }
    hold_res = client.post("/api/v1/bookings/hold", json=hold_payload, headers=user1_auth)
    assert hold_res.status_code == 200
    hold_data = hold_res.json()
    booking_ref = hold_data["booking_reference"]
    assert hold_data["status"] == "hold"
    assert "held_until" in hold_data

    # Step 3: Security / IDOR Test - User 2 cannot access or confirm User 1's booking
    idor_confirm = client.post(
        f"/api/v1/bookings/confirm?booking_reference={booking_ref}&vertical=cabs&payment_method=wallet",
        headers=user2_auth
    )
    assert idor_confirm.status_code == 403

    # Step 4: Confirm Booking with User 1
    confirm_res = client.post(
        f"/api/v1/bookings/confirm?booking_reference={booking_ref}&vertical=cabs&payment_method=wallet",
        headers=user1_auth
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "confirmed"

    # Step 5: Verify Cab Details & Chauffeur Assignment
    details_res = client.get(f"/api/v1/cabs/{booking_ref}", headers=user1_auth)
    assert details_res.status_code == 200
    details_data = details_res.json()
    assert details_data["booking_reference"] == booking_ref
    assert details_data["driver_name"] is not None
    assert details_data["vehicle_number"] is not None

    # Step 6: Tracking Simulation
    track_res = client.get(f"/api/v1/cabs/{booking_ref}/track", headers=user1_auth)
    assert track_res.status_code == 200
    track_data = track_res.json()
    assert "driver_coordinates" in track_data
    assert "eta_mins" in track_data

    # Step 7: Voucher Generation
    voucher_res = client.get(f"/api/v1/cabs/{booking_ref}/voucher", headers=user1_auth)
    assert voucher_res.status_code == 200
    voucher_data = voucher_res.json()
    assert booking_ref in voucher_data["voucher_text"]

    # Step 8: Admin Status Update & Driver Assignment
    admin_assign = client.post(
        f"/api/v1/cabs/admin/{booking_ref}/assign-driver",
        json={"driver_name": "Vikram Malhotra", "driver_phone": "+91 99887 76655", "vehicle_number": "HR 26 DQ 9999"},
        headers=admin_auth
    )
    assert admin_assign.status_code == 200
    assert admin_assign.json()["driver_name"] == "Vikram Malhotra"

    admin_status = client.post(
        f"/api/v1/cabs/admin/{booking_ref}/status",
        json={"status": "DRIVER_ON_THE_WAY", "note": "Chauffeur departed garage towards terminal."},
        headers=admin_auth
    )
    assert admin_status.status_code == 200

    # Step 9: Cancellation & Refund
    cancel_res = client.post(
        "/api/v1/cabs/cancel",
        json={"booking_reference": booking_ref, "reason": "Change of flight plans"},
        headers=user1_auth
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"
    assert cancel_res.json()["refund_amount"] > 0


def test_hold_expiration_rejection(user1_auth):
    # Create hold
    hold_payload = {
        "vertical": "cabs",
        "amount": 1800.0,
        "details": {
            "vehicle_name": "Maruti Suzuki Dzire",
            "cab_type": "Sedan",
            "pickup_address": "Delhi",
            "drop_address": "Noida",
            "passengers_count": 1
        }
    }
    hold_res = client.post("/api/v1/bookings/hold", json=hold_payload, headers=user1_auth)
    assert hold_res.status_code == 200
    ref = hold_res.json()["booking_reference"]

    # Manually expire the hold in DB to simulate passage of time past held_until
    db = SessionLocal()
    cab = db.query(CabBooking).filter(CabBooking.booking_reference == ref).first()
    cab.held_until = datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
    db.commit()
    db.close()

    # Confirming expired hold must fail with 400 Bad Request
    confirm_res = client.post(
        f"/api/v1/bookings/confirm?booking_reference={ref}&vertical=cabs&payment_method=wallet",
        headers=user1_auth
    )
    assert confirm_res.status_code == 400
    assert "expired" in confirm_res.json()["detail"].lower()


def test_city_based_inventory_isolation():
    # Searching in Delhi should prioritize Delhi vehicles
    delhi_resp = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Indira Gandhi International Airport, Delhi",
        "drop_address": "Noida",
        "trip_type": "one_way",
        "passengers": 2
    })
    assert delhi_resp.status_code == 200
    delhi_opts = delhi_resp.json()["options"]
    assert len(delhi_opts) > 0
    assert any("DL" in opt["plate_number"] for opt in delhi_opts)


def test_seeder_idempotency():
    db = SessionLocal()
    initial_count = db.query(CabVehicle).count()
    db.close()

    # Re-running seeder must NOT create duplicates
    run_cabs()

    db = SessionLocal()
    post_count = db.query(CabVehicle).count()
    assert post_count == initial_count, f"Seeder is not idempotent: count grew from {initial_count} to {post_count}"
    
    # Check no duplicate plate numbers exist
    plates = [v.plate_number for v in db.query(CabVehicle).all()]
    assert len(plates) == len(set(plates)), "Duplicate plate numbers found after re-seeding"
    db.close()
