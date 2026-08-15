import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.database import SessionLocal
from app.models.core import User, SavedPassenger
from app.models.bookings import FlightBooking, BookingStatus
from app.auth.jwt import hash_password, create_access_token
from app.utils.encryption import encrypt_id_number, decrypt_id_number

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_test_data():
    """Ensure clean test data before and after each test."""
    db = SessionLocal()
    try:
        # Delete test passengers first to avoid foreign key issues
        db.query(SavedPassenger).delete()
        db.commit()

        test_emails = [
            "pax_user1@travelos.com",
            "pax_user2@travelos.com"
        ]
        for email in test_emails:
            user = db.query(User).filter(User.email == email).first()
            if user:
                db.delete(user)
        db.commit()
    finally:
        db.close()

def _create_test_user(email: str):
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=hash_password("Password123!"),
            email_verified=True,
            phone="+919999999999",
            phone_verified=True,
            role="user"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id
    finally:
        db.close()

# --- Test Cases ---

def test_01_create_saved_passenger():
    uid = _create_test_user("pax_user1@travelos.com")
    token = create_access_token(data={"sub": "pax_user1@travelos.com"})

    # Post a passenger
    payload = {
        "full_name": "Tanish Rajput",
        "date_of_birth": "1995-08-15",
        "gender": "male",
        "nationality": "Indian",
        "email": "tanish@travelos.com",
        "phone": "+919876543210",
        "id_type": "Passport",
        "id_number": "L12345678",
        "label": "Tanish"
    }

    resp = client.post(
        "/api/v1/passengers",
        headers={"Authorization": f"Bearer {token}"},
        json=payload
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "Tanish Rajput"
    assert data["date_of_birth"] == "1995-08-15"
    assert data["id_number"] == "L12345678"
    assert data["id_number_masked"] == "•••••5678"
    assert data["user_id"] == uid

    # Verify database storage is encrypted
    db = SessionLocal()
    try:
        db_p = db.query(SavedPassenger).filter(SavedPassenger.id == data["id"]).first()
        assert db_p is not None
        assert db_p.id_number != "L12345678" # Encrypted
        assert decrypt_id_number(db_p.id_number) == "L12345678"
    finally:
        db.close()

def test_02_get_own_saved_passengers():
    uid = _create_test_user("pax_user1@travelos.com")
    token = create_access_token(data={"sub": "pax_user1@travelos.com"})

    # Create two passengers
    p1 = {
        "full_name": "Tanish Rajput",
        "id_number": "L12345678"
    }
    p2 = {
        "full_name": "Rahul Kumar",
        "id_number": "A9876543"
    }

    client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}, json=p1)
    client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}, json=p2)

    resp = client.get("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    # Rahul is last created, so it should be first by last_used_at DESC
    assert data[0]["full_name"] == "Rahul Kumar"
    assert data[0]["id_number"] == "A9876543"
    assert data[0]["id_number_masked"] == "••••6543"
    assert data[1]["full_name"] == "Tanish Rajput"

def test_03_cannot_access_another_users_passenger():
    _create_test_user("pax_user1@travelos.com")
    token1 = create_access_token(data={"sub": "pax_user1@travelos.com"})

    _create_test_user("pax_user2@travelos.com")
    token2 = create_access_token(data={"sub": "pax_user2@travelos.com"})

    # Create passenger as User 1
    p1 = {
        "full_name": "Tanish Rajput",
        "id_number": "L12345678"
    }
    resp_create = client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token1}"}, json=p1)
    p_id = resp_create.json()["id"]

    # User 2 tries to fetch
    resp_get = client.get("/api/v1/passengers", headers={"Authorization": f"Bearer {token2}"})
    assert resp_get.status_code == 200
    data = resp_get.json()
    assert len(data) == 0 # User 2 sees 0 passengers

    # User 2 tries to update User 1's passenger
    resp_patch = client.patch(
        f"/api/v1/passengers/{p_id}",
        headers={"Authorization": f"Bearer {token2}"},
        json={"full_name": "Hacked Name"}
    )
    assert resp_patch.status_code == 404

    # User 2 tries to delete User 1's passenger
    resp_delete = client.delete(
        f"/api/v1/passengers/{p_id}",
        headers={"Authorization": f"Bearer {token2}"}
    )
    assert resp_delete.status_code == 404

def test_04_update_own_passenger():
    _create_test_user("pax_user1@travelos.com")
    token = create_access_token(data={"sub": "pax_user1@travelos.com"})

    p1 = {
        "full_name": "Tanish Rajput",
        "id_number": "L12345678"
    }
    resp_create = client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}, json=p1)
    p_id = resp_create.json()["id"]

    # Update passenger
    resp_patch = client.patch(
        f"/api/v1/passengers/{p_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"full_name": "Tanish R. Rajput", "id_number": "L87654321"}
    )
    assert resp_patch.status_code == 200
    data = resp_patch.json()
    assert data["full_name"] == "Tanish R. Rajput"
    assert data["id_number"] == "L87654321"

def test_05_delete_own_passenger():
    _create_test_user("pax_user1@travelos.com")
    token = create_access_token(data={"sub": "pax_user1@travelos.com"})

    p1 = {
        "full_name": "Tanish Rajput",
        "id_number": "L12345678"
    }
    resp_create = client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}, json=p1)
    p_id = resp_create.json()["id"]

    # Delete
    resp_del = client.delete(f"/api/v1/passengers/{p_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp_del.status_code == 200

    # Ensure deleted
    resp_get = client.get("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"})
    assert len(resp_get.json()) == 0

def test_06_duplicate_detection():
    _create_test_user("pax_user1@travelos.com")
    token = create_access_token(data={"sub": "pax_user1@travelos.com"})

    p1 = {
        "full_name": "Tanish Rajput",
        "email": "tanish@travelos.com",
        "id_number": "L12345678"
    }
    resp1 = client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}, json=p1)
    assert resp1.status_code == 200

    # Try creating duplicate with same email
    resp2 = client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}, json=p1)
    assert resp2.status_code == 409
    assert "already saved" in resp2.json()["detail"]

    # Try creating duplicate with force_update=True
    p1["force_update"] = True
    p1["id_number"] = "L99999999"
    resp3 = client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}, json=p1)
    assert resp3.status_code == 200
    assert resp3.json()["id_number"] == "L99999999"

def test_07_mark_passenger_used_sorting():
    _create_test_user("pax_user1@travelos.com")
    token = create_access_token(data={"sub": "pax_user1@travelos.com"})

    # Create two passengers
    p1 = client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}, json={"full_name": "Tanish Rajput"}).json()
    p2 = client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}, json={"full_name": "Rahul Kumar"}).json()

    # List: Rahul (last created) is first
    resp_list = client.get("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}).json()
    assert resp_list[0]["full_name"] == "Rahul Kumar"

    # Mark Tanish as used
    client.post(f"/api/v1/passengers/{p1['id']}/use", headers={"Authorization": f"Bearer {token}"})

    # List again: Tanish is now first
    resp_list2 = client.get("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}).json()
    assert resp_list2[0]["full_name"] == "Tanish Rajput"

def test_08_delete_does_not_affect_bookings():
    uid = _create_test_user("pax_user1@travelos.com")
    token = create_access_token(data={"sub": "pax_user1@travelos.com"})

    # Create passenger
    p = client.post("/api/v1/passengers", headers={"Authorization": f"Bearer {token}"}, json={"full_name": "Tanish Rajput"}).json()

    # Create a booking snapshot
    db = SessionLocal()
    try:
        booking = FlightBooking(
            booking_reference="BK-TEST-PAX-SNAP",
            user_id=uid,
            status=BookingStatus.CONFIRMED,
            total_amount=1500.0,
            pricing_snapshot={},
            origin="DEL",
            destination="BOM",
            departure_time=datetime.datetime.utcnow(),
            arrival_time=datetime.datetime.utcnow(),
            airline_code="AI",
            flight_number="101",
            passenger_details=[{"name": "Tanish Rajput", "age": 30}]
        )
        db.add(booking)
        db.commit()
    finally:
        db.close()

    # Delete passenger
    client.delete(f"/api/v1/passengers/{p['id']}", headers={"Authorization": f"Bearer {token}"})

    # Ensure booking passenger details remain intact
    db = SessionLocal()
    try:
        b = db.query(FlightBooking).filter(FlightBooking.booking_reference == "BK-TEST-PAX-SNAP").first()
        assert b is not None
        assert b.passenger_details[0]["name"] == "Tanish Rajput"
        # Cleanup
        db.delete(b)
        db.commit()
    finally:
        db.close()
