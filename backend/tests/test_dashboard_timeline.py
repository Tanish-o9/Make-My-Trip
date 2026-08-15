import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.database import SessionLocal
from app.models.core import User, Trip, TripMember, TripInvitation, TripExpense, TripExpenseSplit
from app.models.audit import Notification
from app.models.bookings import FlightBooking, HotelBooking, BookingStatus
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_test_data():
    """Ensure clean test data before and after each test."""
    db = SessionLocal()
    try:
        db.query(TripExpenseSplit).delete()
        db.query(TripExpense).delete()
        db.query(TripInvitation).delete()
        db.query(TripMember).delete()
        db.query(Trip).delete()
        db.query(Notification).delete()
        db.query(FlightBooking).delete()
        db.query(HotelBooking).delete()
        db.commit()

        test_emails = [
            "dash_user1@travelos.com",
            "dash_user2@travelos.com"
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


def test_01_dashboard_auth_and_ownership():
    # 1. Unauthenticated request should fail
    resp = client.get("/api/v1/dashboard")
    assert resp.status_code == 401

    # 2. Authenticated request
    uid_a = _create_test_user("dash_user1@travelos.com")
    token_a = create_access_token(data={"sub": "dash_user1@travelos.com"})

    resp = client.get("/api/v1/dashboard", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_summary"]["email"] == "dash_user1@travelos.com"
    assert data["user_summary"]["first_name"] == "Dash_user1"


def test_02_trip_crud_and_auto_grouping():
    uid_a = _create_test_user("dash_user1@travelos.com")
    token_a = create_access_token(data={"sub": "dash_user1@travelos.com"})

    db = SessionLocal()
    try:
        # Create a flight booking departing tomorrow
        tomorrow = datetime.datetime.utcnow() + datetime.timedelta(days=1)
        fb = FlightBooking(
            booking_reference="BK-FLIGHT-TEST",
            user_id=uid_a,
            status=BookingStatus.CONFIRMED,
            total_amount=5000.0,
            currency="INR",
            pricing_snapshot={"base_fare": 5000.0, "tax": 0.0, "discount": 0.0},
            origin="DEL",
            destination="BOM",
            departure_time=tomorrow,
            arrival_time=tomorrow + datetime.timedelta(hours=2),
            airline_code="AI",
            flight_number="101",
            passenger_details=[]
        )
        db.add(fb)

        # Create a hotel booking check-in tomorrow
        hb = HotelBooking(
            booking_reference="BK-HOTEL-TEST",
            user_id=uid_a,
            status=BookingStatus.CONFIRMED,
            total_amount=4000.0,
            currency="INR",
            pricing_snapshot={"base_fare": 4000.0, "tax": 0.0, "discount": 0.0},
            hotel_name="Grand Hyatt Mumbai",
            hotel_id="HYATT-MUM",
            check_in=tomorrow,
            check_out=tomorrow + datetime.timedelta(days=2),
            room_type="Deluxe Room",
            guest_details=[],
            address="Mumbai, India"
        )
        db.add(hb)
        db.commit()
    finally:
        db.close()

    # 1. Fetching trips will trigger auto-grouping
    resp = client.get("/api/v1/dashboard/trips", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    trips = resp.json()
    
    assert len(trips) == 1
    trip = trips[0]
    assert "BOM" in trip["name"] or "Grand" in trip["name"] or "Mumbai" in trip["name"] or "Trip" in trip["name"]
    assert trip["bookings_count"] == 2
    assert "BK-FLIGHT-TEST" in trip["booking_references"]
    assert "BK-HOTEL-TEST" in trip["booking_references"]

    trip_id = trip["id"]

    # 2. Update trip (rename)
    resp = client.patch(
        f"/api/v1/dashboard/trips/{trip_id}",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": "Mumbai Weekend Getaway"}
    )
    assert resp.status_code == 200
    updated_trip = resp.json()
    assert updated_trip["name"] == "Mumbai Weekend Getaway"

    # 3. Create a manual Trip
    manual_payload = {
        "name": "Manali Family Vacation",
        "destination": "Manali",
        "start_date": "2026-09-01",
        "end_date": "2026-09-07",
        "booking_references": []
    }
    resp = client.post(
        "/api/v1/dashboard/trips",
        headers={"Authorization": f"Bearer {token_a}"},
        json=manual_payload
    )
    assert resp.status_code == 200
    man_trip = resp.json()
    assert man_trip["name"] == "Manali Family Vacation"


def test_03_trip_timeline():
    uid_a = _create_test_user("dash_user1@travelos.com")
    token_a = create_access_token(data={"sub": "dash_user1@travelos.com"})

    db = SessionLocal()
    try:
        # Create a trip in DB
        tomorrow = datetime.datetime.utcnow().date() + datetime.timedelta(days=1)
        trip = Trip(
            user_id=uid_a,
            name="Delhi Weekend",
            destination="Delhi",
            start_date=tomorrow,
            end_date=tomorrow + datetime.timedelta(days=2),
            booking_references=["BK-F1", "BK-H1"],
            is_archived=False
        )
        db.add(trip)

        fb = FlightBooking(
            booking_reference="BK-F1",
            user_id=uid_a,
            status=BookingStatus.CONFIRMED,
            total_amount=5000.0,
            currency="INR",
            pricing_snapshot={"base_fare": 5000.0, "tax": 0.0, "discount": 0.0},
            origin="BOM",
            destination="DEL",
            departure_time=datetime.datetime.combine(tomorrow, datetime.time(8, 0)),
            arrival_time=datetime.datetime.combine(tomorrow, datetime.time(10, 0)),
            airline_code="AI",
            flight_number="102",
            passenger_details=[]
        )
        db.add(fb)

        hb = HotelBooking(
            booking_reference="BK-H1",
            user_id=uid_a,
            status=BookingStatus.CONFIRMED,
            total_amount=4000.0,
            currency="INR",
            pricing_snapshot={"base_fare": 4000.0, "tax": 0.0, "discount": 0.0},
            hotel_name="Taj Mahal Palace Delhi",
            hotel_id="TAJ-DEL",
            check_in=datetime.datetime.combine(tomorrow, datetime.time(14, 0)),
            check_out=datetime.datetime.combine(tomorrow + datetime.timedelta(days=2), datetime.time(12, 0)),
            room_type="Luxury Suite",
            guest_details=[],
            address="Delhi, India"
        )
        db.add(hb)
        db.commit()
        db.refresh(trip)
        trip_id = trip.id
    finally:
        db.close()

    # Get Timeline
    resp = client.get(
        f"/api/v1/dashboard/trips/{trip_id}/timeline",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["trip"]["name"] == "Delhi Weekend"
    assert len(res_data["timeline"]) == 2
    # Verify timeline is sorted chronologically
    assert res_data["timeline"][0]["vertical"] == "flights"
    assert res_data["timeline"][1]["vertical"] == "hotels"


def test_04_document_vault_and_security():
    uid_a = _create_test_user("dash_user1@travelos.com")
    token_a = create_access_token(data={"sub": "dash_user1@travelos.com"})

    uid_b = _create_test_user("dash_user2@travelos.com")
    token_b = create_access_token(data={"sub": "dash_user2@travelos.com"})

    db = SessionLocal()
    try:
        tomorrow = datetime.datetime.utcnow().date() + datetime.timedelta(days=1)
        trip = Trip(
            user_id=uid_a,
            name="Delhi Weekend",
            destination="Delhi",
            start_date=tomorrow,
            end_date=tomorrow + datetime.timedelta(days=2),
            booking_references=["BK-F2"],
            is_archived=False
        )
        db.add(trip)

        fb = FlightBooking(
            booking_reference="BK-F2",
            user_id=uid_a,
            status=BookingStatus.CONFIRMED,
            total_amount=5000.0,
            currency="INR",
            pricing_snapshot={"base_fare": 5000.0, "tax": 0.0, "discount": 0.0},
            origin="BOM",
            destination="DEL",
            departure_time=datetime.datetime.combine(tomorrow, datetime.time(8, 0)),
            arrival_time=datetime.datetime.combine(tomorrow, datetime.time(10, 0)),
            airline_code="AI",
            flight_number="102",
            passenger_details=[]
        )
        db.add(fb)
        db.commit()
        db.refresh(trip)
        trip_id = trip.id
    finally:
        db.close()

    # 1. Fetch documents as User A (owner)
    resp = client.get(
        f"/api/v1/dashboard/trips/{trip_id}/documents",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp.status_code == 200
    docs = resp.json()
    assert len(docs) == 3 # Ticket, Invoice, Receipt
    assert docs[0]["booking_reference"] == "BK-F2"
    assert docs[0]["url"] == "/api/v1/bookings/BK-F2/pdf"

    # 2. Fetch documents as User B (not owner) - should fail with 404/403
    resp = client.get(
        f"/api/v1/dashboard/trips/{trip_id}/documents",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert resp.status_code == 404


def test_05_notifications_and_reminders():
    uid_a = _create_test_user("dash_user1@travelos.com")
    token_a = create_access_token(data={"sub": "dash_user1@travelos.com"})

    db = SessionLocal()
    try:
        # Create flight departing in 2 hours (should trigger 24h & 3h reminders)
        two_hours_from_now = datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        fb = FlightBooking(
            booking_reference="BK-FLIGHT-REMINDER",
            user_id=uid_a,
            status=BookingStatus.CONFIRMED,
            total_amount=5000.0,
            currency="INR",
            pricing_snapshot={"base_fare": 5000.0, "tax": 0.0, "discount": 0.0},
            origin="DEL",
            destination="BOM",
            departure_time=two_hours_from_now,
            arrival_time=two_hours_from_now + datetime.timedelta(hours=2),
            airline_code="AI",
            flight_number="101",
            passenger_details=[]
        )
        db.add(fb)
        db.commit()
    finally:
        db.close()

    # Trigger reminders by fetching dashboard
    resp = client.get("/api/v1/dashboard", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200

    # Fetch notifications list
    resp = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    notifs = resp.json()
    
    # Check that reminders are created
    travel_notifs = [n for n in notifs if n["notification_type"] == "TRAVEL"]
    assert len(travel_notifs) >= 1
    assert any("departing" in n["message"].lower() or "departure" in n["message"].lower() for n in travel_notifs)

    # Verify idempotency by calling dashboard again and checking count
    resp = client.get("/api/v1/dashboard", headers={"Authorization": f"Bearer {token_a}"})
    resp = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {token_a}"})
    new_notifs = resp.json()
    assert len(new_notifs) == len(notifs) # No duplicates added!
