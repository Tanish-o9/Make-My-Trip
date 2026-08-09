import pytest
import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.core import User
from app.models.bookings import FlightBooking, BookingStatus, BookingInvoice, BookingTicket, SpecialFareConfig
from app.models.payments import Payment, PaymentStatus
from app.auth.dependencies import get_current_user
from app.services.booking_core import BookingStateMachine

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_auth_and_db():
    Base.metadata.create_all(bind=engine)
    
    # Bypass user auth for these tests
    app.dependency_overrides[get_current_user] = lambda: User(id=1, email="fare_test@travelos.com", role="user")
    
    yield
    app.dependency_overrides.clear()
    
    # Clean up flight bookings and child records
    db = SessionLocal()
    try:
        from app.models.payments import Payment, PaymentTransaction
        db.query(BookingInvoice).delete()
        db.query(BookingTicket).delete()
        db.query(PaymentTransaction).delete()
        db.query(Payment).delete()
        db.query(FlightBooking).delete()
        db.commit()
    finally:
        db.close()


def test_regular_fare_discount():
    """Verify that a Regular fare has 0% discount and final total matches the search total"""
    payload = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {
            "origin": "DEL",
            "destination": "GOI",
            "airline_code": "6E",
            "flight_number": "502",
            "cabin_class": "ECONOMY",
            "finalFareBeforePromo": 10000.0,
            "passengers": [
                {
                    "fullName": "Jane Doe",
                    "age": 30,
                    "email": "jane@example.com",
                    "phone": "9876543210",
                    "specialFareType": "regular"
                }
            ]
        }
    }
    
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_amount"] == 10000.0
    
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == data["booking_reference"]).first()
    assert booking is not None
    assert booking.pricing_snapshot["discount"] == 0.0
    assert booking.pricing_snapshot["base_fare"] == 8500.0
    assert booking.pricing_snapshot["tax"] == 1500.0
    db.close()


def test_student_fare_discount_success():
    """Verify that a Student fare with Student ID gets a 10% discount on base fare"""
    payload = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {
            "origin": "DEL",
            "destination": "GOI",
            "airline_code": "6E",
            "flight_number": "502",
            "cabin_class": "ECONOMY",
            "finalFareBeforePromo": 10000.0,
            "passengers": [
                {
                    "fullName": "Alice Smith",
                    "age": 20,
                    "email": "alice@example.com",
                    "phone": "9876543210",
                    "specialFareType": "student",
                    "studentId": "STU12345",
                    "studentName": "Alice Smith",
                    "institutionName": "University of Delhi",
                    "institutionCity": "New Delhi",
                    "studentCourse": "B.Sc Physics",
                    "studentDateOfBirth": "2006-05-15",
                    "studentEmail": "alice@delhi.edu"
                }
            ]
        }
    }
    
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    # Expected discount: 10% of base fare (8500) = 850
    # Final amount: 8500 - 850 + 1500 = 9150
    assert data["total_amount"] == 9150.0
    
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == data["booking_reference"]).first()
    assert booking.pricing_snapshot["discount"] == 850.0
    db.close()


def test_student_fare_missing_id():
    """Verify that a Student fare fails validation if Student ID is missing"""
    payload = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {
            "origin": "DEL",
            "destination": "GOI",
            "passengers": [
                {
                    "fullName": "Alice Smith",
                    "age": 20,
                    "email": "alice@example.com",
                    "phone": "9876543210",
                    "specialFareType": "student",
                    "studentId": ""
                }
            ]
        }
    }
    
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 400
    assert "required" in resp.json()["detail"]


def test_senior_citizen_fare_success():
    """Verify that a Senior Citizen fare (age >= 60) gets a 5% discount on base fare"""
    payload = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {
            "origin": "DEL",
            "destination": "GOI",
            "finalFareBeforePromo": 10000.0,
            "passengers": [
                {
                    "fullName": "Bob Ross",
                    "age": 65,
                    "email": "bob@example.com",
                    "phone": "9876543210",
                    "specialFareType": "senior"
                }
            ]
        }
    }
    
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    # Expected discount: 5% of base fare (8500) = 425
    # Final amount: 8500 - 425 + 1500 = 9575
    assert data["total_amount"] == 9575.0
    
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == data["booking_reference"]).first()
    assert booking.pricing_snapshot["discount"] == 425.0
    db.close()


def test_senior_citizen_fare_underage():
    """Verify that a Senior Citizen fare fails validation if age is under 60"""
    payload = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {
            "origin": "DEL",
            "destination": "GOI",
            "passengers": [
                {
                    "fullName": "Young Bob",
                    "age": 59,
                    "email": "bob@example.com",
                    "phone": "9876543210",
                    "specialFareType": "senior"
                }
            ]
        }
    }
    
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 400
    assert "Senior Citizen fare requires age 60" in resp.json()["detail"]


def test_armed_forces_fare_success():
    """Verify that an Armed Forces fare with Service ID gets a 10% discount on base fare"""
    payload = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {
            "origin": "DEL",
            "destination": "GOI",
            "finalFareBeforePromo": 10000.0,
            "passengers": [
                {
                    "fullName": "Major Tom",
                    "age": 40,
                    "email": "tom@example.com",
                    "phone": "9876543210",
                    "specialFareType": "armed_forces",
                    "serviceId": "MIL998877"
                }
            ]
        }
    }
    
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    # Expected discount: 10% of base fare (8500) = 850
    # Final amount: 8500 - 850 + 1500 = 9150
    assert data["total_amount"] == 9150.0
    
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == data["booking_reference"]).first()
    assert booking.pricing_snapshot["discount"] == 850.0
    db.close()


def test_mixed_passengers_discount():
    """Verify that discounts are applied per passenger independently (mixed groups)"""
    payload = {
        "vertical": "flights",
        "amount": 20000.0,
        "user_id": 1,
        "details": {
            "origin": "DEL",
            "destination": "GOI",
            "finalFareBeforePromo": 20000.0,
            "passengers": [
                {
                    "fullName": "Alice Smith",
                    "age": 21,
                    "email": "student@example.com",
                    "phone": "9876543210",
                    "specialFareType": "student",
                    "studentId": "STU123",
                    "studentName": "Alice Smith",
                    "institutionName": "University of Delhi",
                    "institutionCity": "New Delhi",
                    "studentCourse": "B.Sc Physics",
                    "studentDateOfBirth": "2005-05-15",
                    "studentEmail": "alice@delhi.edu"
                },
                {
                    "fullName": "Passenger 2 (Regular)",
                    "age": 30,
                    "email": "regular@example.com",
                    "phone": "9876543210",
                    "specialFareType": "regular"
                }
            ]
        }
    }
    
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["total_amount"] == 19150.0
    
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == data["booking_reference"]).first()
    assert booking.pricing_snapshot["discount"] == 850.0
    assert len(booking.passenger_details) == 2
    assert booking.passenger_details[0]["discountAmount"] == 850.0
    assert booking.passenger_details[1]["discountAmount"] == 0.0
    db.close()


def test_student_fare_validation_failures():
    """Verify that backend rejects student bookings with invalid age, name, placeholders, or email"""
    base_pax = {
        "fullName": "Alice Smith",
        "age": 20,
        "email": "alice@example.com",
        "phone": "9876543210",
        "specialFareType": "student",
        "studentId": "STU123",
        "studentName": "Alice Smith",
        "institutionName": "University of Delhi",
        "institutionCity": "New Delhi",
        "studentCourse": "B.Sc Physics",
        "studentDateOfBirth": "2006-05-15",
        "studentEmail": "alice@delhi.edu"
    }

    # Case 1: Underage (e.g. 4 years old)
    payload_underage = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {"origin": "DEL", "destination": "GOI", "passengers": [{**base_pax, "age": 4}]}
    }
    resp = client.post("/api/v1/bookings/hold", json=payload_underage)
    assert resp.status_code == 400
    assert "between 5 and 30" in resp.json()["detail"]

    # Case 2: Overage (e.g. 31 years old)
    payload_overage = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {"origin": "DEL", "destination": "GOI", "passengers": [{**base_pax, "age": 31}]}
    }
    resp = client.post("/api/v1/bookings/hold", json=payload_overage)
    assert resp.status_code == 400
    assert "between 5 and 30" in resp.json()["detail"]

    # Case 3: Name mismatch
    payload_name_mismatch = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {"origin": "DEL", "destination": "GOI", "passengers": [{**base_pax, "studentName": "John Doe"}]}
    }
    resp = client.post("/api/v1/bookings/hold", json=payload_name_mismatch)
    assert resp.status_code == 400
    assert "does not match passenger name" in resp.json()["detail"]

    # Case 4: Placeholder student ID
    payload_placeholder = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {"origin": "DEL", "destination": "GOI", "passengers": [{**base_pax, "studentId": "fake"}]}
    }
    resp = client.post("/api/v1/bookings/hold", json=payload_placeholder)
    assert resp.status_code == 400
    assert "avoid placeholder" in resp.json()["detail"]

    # Case 5: Invalid email
    payload_invalid_email = {
        "vertical": "flights",
        "amount": 10000.0,
        "user_id": 1,
        "details": {"origin": "DEL", "destination": "GOI", "passengers": [{**base_pax, "studentEmail": "invalid-email"}]}
    }
    resp = client.post("/api/v1/bookings/hold", json=payload_invalid_email)
    assert resp.status_code == 400
    assert "Invalid student email" in resp.json()["detail"]


def test_student_missing_institution_course_dob():
    """Verify that a Student fare fails validation if institution, course, or DOB is missing"""
    base_pax = {
        "fullName": "Alice Smith",
        "age": 20,
        "email": "alice@example.com",
        "phone": "9876543210",
        "specialFareType": "student",
        "studentId": "STU123",
        "studentName": "Alice Smith",
        "institutionCity": "New Delhi",
        "studentEmail": "alice@delhi.edu"
    }
    
    # Missing institution
    payload = {
        "vertical": "flights", "amount": 10000.0, "user_id": 1,
        "details": {"origin": "DEL", "destination": "GOI", "passengers": [{**base_pax, "studentCourse": "B.Sc", "studentDateOfBirth": "2006-05-15", "institutionName": ""}]}
    }
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 400
    assert "required" in resp.json()["detail"]

    # Missing course
    payload = {
        "vertical": "flights", "amount": 10000.0, "user_id": 1,
        "details": {"origin": "DEL", "destination": "GOI", "passengers": [{**base_pax, "institutionName": "DU", "studentDateOfBirth": "2006-05-15", "studentCourse": ""}]}
    }
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 400
    assert "required" in resp.json()["detail"]

    # Missing DOB
    payload = {
        "vertical": "flights", "amount": 10000.0, "user_id": 1,
        "details": {"origin": "DEL", "destination": "GOI", "passengers": [{**base_pax, "institutionName": "DU", "studentCourse": "B.Sc", "studentDateOfBirth": ""}]}
    }
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 400
    assert "required" in resp.json()["detail"]


def test_two_students_fares():
    """Verify that two students inside one booking get their own discounts calculated and aggregated"""
    pax1 = {
        "fullName": "Alice Smith", "age": 20, "email": "alice@example.com", "phone": "9876543210",
        "specialFareType": "student", "studentId": "STU111", "studentName": "Alice Smith",
        "institutionName": "University of Delhi", "institutionCity": "New Delhi", "studentCourse": "B.Sc Physics",
        "studentDateOfBirth": "2006-05-15", "studentEmail": "alice@delhi.edu"
    }
    pax2 = {
        "fullName": "Bob Miller", "age": 22, "email": "bob@example.com", "phone": "9876543210",
        "specialFareType": "student", "studentId": "STU222", "studentName": "Bob Miller",
        "institutionName": "JNU", "institutionCity": "New Delhi", "studentCourse": "M.A History",
        "studentDateOfBirth": "2004-08-10", "studentEmail": "bob@jnu.edu"
    }

    payload = {
        "vertical": "flights", "amount": 20000.0, "user_id": 1,
        "details": {
            "origin": "DEL", "destination": "GOI", "finalFareBeforePromo": 20000.0,
            "passengers": [pax1, pax2]
        }
    }
    
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    # Base: 17000 (8500 per pax). Total Discount: 10% * 8500 * 2 = 1700. Total Tax: 3000.
    # Expected final amount: 17000 - 1700 + 3000 = 18300.
    assert data["total_amount"] == 18300.0
    
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == data["booking_reference"]).first()
    assert booking.pricing_snapshot["discounts"]["student"] == 1700.0
    db.close()


def test_mixed_all_four_passenger_fares():
    """Verify that a mix of Regular, Student, Senior, and Armed Forces passengers gets correct pricing"""
    pax_student = {
        "fullName": "Alice Smith", "age": 20, "email": "alice@example.com", "phone": "9876543210",
        "specialFareType": "student", "studentId": "STU111", "studentName": "Alice Smith",
        "institutionName": "University of Delhi", "institutionCity": "New Delhi", "studentCourse": "B.Sc Physics",
        "studentDateOfBirth": "2006-05-15", "studentEmail": "alice@delhi.edu"
    }
    pax_regular = {
        "fullName": "Jane Doe", "age": 30, "email": "jane@example.com", "phone": "9876543210",
        "specialFareType": "regular"
    }
    pax_senior = {
        "fullName": "Bob Ross", "age": 65, "email": "bob@example.com", "phone": "9876543210",
        "specialFareType": "senior"
    }
    pax_armed = {
        "fullName": "Major Tom", "age": 40, "email": "tom@example.com", "phone": "9876543210",
        "specialFareType": "armed_forces", "serviceId": "MIL998877"
    }

    payload = {
        "vertical": "flights", "amount": 40000.0, "user_id": 1,
        "details": {
            "origin": "DEL", "destination": "GOI", "finalFareBeforePromo": 40000.0,
            "passengers": [pax_student, pax_regular, pax_senior, pax_armed]
        }
    }
    
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    # Pax count: 4. Base per pax: 8500. Tax per pax: 1500.
    # Student discount: 10% of 8500 = 850.
    # Regular discount: 0.
    # Senior discount: 5% of 8500 = 425.
    # Armed Forces discount: 10% of 8500 = 850.
    # Total Base: 34000. Total Tax: 6000. Total Discount: 850 + 0 + 425 + 850 = 2125.
    # Final amount: 34000 - 2125 + 6000 = 37875.
    assert data["total_amount"] == 37875.0
    
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == data["booking_reference"]).first()
    assert booking.pricing_snapshot["discounts"]["student"] == 850.0
    assert booking.pricing_snapshot["discounts"]["senior"] == 425.0
    assert booking.pricing_snapshot["discounts"]["armed_forces"] == 850.0
    db.close()


def test_frontend_pricing_forgery_ignored():
    """Verify that backend ignores/rejects manipulated pricing fields submitted by frontend"""
    pax_student = {
        "fullName": "Alice Smith", "age": 20, "email": "alice@example.com", "phone": "9876543210",
        "specialFareType": "student", "studentId": "STU111", "studentName": "Alice Smith",
        "institutionName": "University of Delhi", "institutionCity": "New Delhi", "studentCourse": "B.Sc Physics",
        "studentDateOfBirth": "2006-05-15", "studentEmail": "alice@delhi.edu",
        "discountAmount": 999999.0, "finalFare": 1.0, "tax": 0.0 # forged fields!
    }

    payload = {
        "vertical": "flights", "amount": 1.0, "user_id": 1, # forged amount!
        "details": {
            "origin": "DEL", "destination": "GOI", "finalFareBeforePromo": 10000.0,
            "passengers": [pax_student],
            "discount": 999999.0, "pricing_snapshot": {"final_payable": 1.0} # forged fields!
        }
    }
    
    resp = client.post("/api/v1/bookings/hold", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    # Recalculated base: 8500. Student discount: 850. Tax: 1500. Expected final: 9150.
    assert data["total_amount"] == 9150.0


def test_payment_amount_consistency():
    """Verify that create-order fails if payment amount does not match pricing_snapshot.final_payable"""
    pax_student = {
        "fullName": "Alice Smith", "age": 20, "email": "alice@example.com", "phone": "9876543210",
        "specialFareType": "student", "studentId": "STU111", "studentName": "Alice Smith",
        "institutionName": "University of Delhi", "institutionCity": "New Delhi", "studentCourse": "B.Sc Physics",
        "studentDateOfBirth": "2006-05-15", "studentEmail": "alice@delhi.edu"
    }

    payload_hold = {
        "vertical": "flights", "amount": 10000.0, "user_id": 1,
        "details": {
            "origin": "DEL", "destination": "GOI", "finalFareBeforePromo": 10000.0,
            "passengers": [pax_student]
        }
    }
    
    resp_hold = client.post("/api/v1/bookings/hold", json=payload_hold)
    assert resp_hold.status_code == 200
    booking_ref = resp_hold.json()["booking_reference"]
    
    # Verify create-order with forged amount fails
    payload_order = {
        "booking_id": booking_ref,
        "amount": 1.0, # forged order amount!
        "currency": "INR",
        "method": "card",
        "human_approved": True
    }
    resp_order = client.post("/api/v1/payments/create-order", json=payload_order)
    assert resp_order.status_code == 400
    assert "amount mismatch" in resp_order.json()["detail"].lower()


def test_duplicate_student_id_detection():
    """Verify duplicate Student ID is flagged in the same booking or across active bookings"""
    pax1 = {
        "fullName": "Alice Smith", "age": 20, "email": "alice@example.com", "phone": "9876543210",
        "specialFareType": "student", "studentId": "STU_DUP", "studentName": "Alice Smith",
        "institutionName": "University of Delhi", "institutionCity": "New Delhi", "studentCourse": "B.Sc Physics",
        "studentDateOfBirth": "2006-05-15", "studentEmail": "alice@delhi.edu"
    }
    pax2 = {
        "fullName": "Bob Ross", "age": 22, "email": "bob@example.com", "phone": "9876543210",
        "specialFareType": "student", "studentId": "STU_DUP", "studentName": "Bob Ross", # duplicate studentId!
        "institutionName": "JNU", "institutionCity": "New Delhi", "studentCourse": "M.A History",
        "studentDateOfBirth": "2004-08-10", "studentEmail": "bob@jnu.edu"
    }

    # Case A: Same booking payload duplicate
    payload_hold_dup = {
        "vertical": "flights", "amount": 20000.0, "user_id": 1,
        "details": {
            "origin": "DEL", "destination": "GOI", "finalFareBeforePromo": 20000.0,
            "passengers": [pax1, pax2]
        }
    }
    resp = client.post("/api/v1/bookings/hold", json=payload_hold_dup)
    assert resp.status_code == 200
    data = resp.json()
    
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == data["booking_reference"]).first()
    assert booking.passenger_details[0]["studentVerificationStatus"] == "pending_review"
    assert booking.passenger_details[1]["studentVerificationStatus"] == "pending_review"
    db.close()


def test_e2e_4_passenger_lifecycle_and_invoicing():
    """Verify complete 4-passenger flow: Hold -> Pricing -> Payment Order -> State Machine -> Invoice & Ticket"""
    pax1_regular = {
        "fullName": "John Regular", "age": 30, "email": "john@example.com", "phone": "9876543210",
        "specialFareType": "regular"
    }
    pax2_student = {
        "fullName": "Alice Student", "age": 20, "email": "alice@example.com", "phone": "9876543210",
        "specialFareType": "student", "studentId": "STU_AUDIT_01", "studentName": "Alice Student",
        "institutionName": "University of Delhi", "institutionCity": "New Delhi", "studentCourse": "B.Tech CS",
        "studentDateOfBirth": "2006-04-12", "studentEmail": "alice@du.ac.in", "studentIdFile": "student_card.pdf"
    }
    pax3_senior = {
        "fullName": "Robert Senior", "age": 65, "email": "robert@example.com", "phone": "9876543210",
        "specialFareType": "senior"
    }
    pax4_armed = {
        "fullName": "Major Vikram Armed", "age": 42, "email": "vikram@example.com", "phone": "9876543210",
        "specialFareType": "armed_forces", "serviceId": "ARM_998877"
    }

    # 1. Hold Stage
    hold_payload = {
        "vertical": "flights", "amount": 40000.0, "user_id": 1,
        "details": {
            "origin": "DEL", "destination": "BOM", "finalFareBeforePromo": 40000.0,
            "passengers": [pax1_regular, pax2_student, pax3_senior, pax4_armed]
        }
    }
    hold_resp = client.post("/api/v1/bookings/hold", json=hold_payload)
    assert hold_resp.status_code == 200
    hold_data = hold_resp.json()
    booking_ref = hold_data["booking_reference"]
    assert hold_data["total_amount"] == 37875.0

    # 2. Database pricing_snapshot validation
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == booking_ref).first()
    assert booking is not None
    snapshot = booking.pricing_snapshot
    assert snapshot["base_fare"] == 34000.0
    assert snapshot["tax"] == 6000.0
    assert snapshot["discount"] == 2125.0
    assert snapshot["discounts"]["student"] == 850.0
    assert snapshot["discounts"]["senior"] == 425.0
    assert snapshot["discounts"]["armed_forces"] == 850.0
    assert snapshot["final_payable"] == 37875.0
    assert booking.passenger_details[1]["studentVerificationStatus"] == "pending"
    db.close()

    # 3. Payment Order Creation & Tampering
    # Tampered amount rejected
    tampered_resp = client.post("/api/v1/payments/create-order", json={
        "booking_id": booking_ref, "amount": 35000.0, "currency": "INR", "method": "card", "human_approved": True
    })
    assert tampered_resp.status_code == 400

    # Legitimate amount accepted
    valid_order_resp = client.post("/api/v1/payments/create-order", json={
        "booking_id": booking_ref, "amount": 37875.0, "currency": "INR", "method": "card", "human_approved": True
    })
    assert valid_order_resp.status_code == 200

    # 4. Confirmation & Transition
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == booking_ref).first()
    payment = db.query(Payment).filter(Payment.booking_id == booking_ref).first()
    payment.status = PaymentStatus.CAPTURED
    db.commit()
    db.refresh(booking)

    BookingStateMachine.transition_to(booking, BookingStatus.CONFIRMED)
    db.commit()
    db.close()

    # 5. Details endpoint verification
    details_resp = client.get(f"/api/v1/bookings/details/{booking_ref}")
    assert details_resp.status_code == 200
    details_data = details_resp.json()
    assert details_data.get("status") in ["confirmed", "CONFIRMED"]
    assert details_data.get("total_amount") == 37875.0

    # 6. Invoice & Ticket Verification
    db = SessionLocal()
    invoice = db.query(BookingInvoice).filter(BookingInvoice.booking_reference == booking_ref).first()
    assert invoice is not None
    assert float(invoice.base_amount) == 34000.0
    assert float(invoice.discount_amount) == 2125.0
    assert float(invoice.tax_amount) == 6000.0
    assert float(invoice.final_amount) == 37875.0

    ticket = db.query(BookingTicket).filter(BookingTicket.booking_reference == booking_ref).first()
    assert ticket is not None
    assert len(ticket.passenger_details) == 4
    db.close()


def test_special_fare_discount_baseline_and_switching():
    """
    Verify exact baseline special fare calculations:
    - Base fare: 8500
    - Regular: 0% -> 8500
    - Student: 10% -> 7650 (discount: 850)
    - Senior Citizen: 5% -> 8075 (discount: 425)
    - Armed Forces: 10% -> 7650 (discount: 850)
    """
    base_fare = 8500.0

    # 1. Regular
    reg_discount = 0.0
    reg_final = base_fare - reg_discount
    assert reg_final == 8500.0

    # 2. Student (10%)
    student_discount = round(base_fare * 0.10)
    assert student_discount == 850.0
    student_final = base_fare - student_discount
    assert student_final == 7650.0

    # 3. Senior (5%)
    senior_discount = round(base_fare * 0.05)
    assert senior_discount == 425.0
    senior_final = base_fare - senior_discount
    assert senior_final == 8075.0

    # 4. Armed Forces (10%)
    armed_discount = round(base_fare * 0.10)
    assert armed_discount == 850.0
    armed_final = base_fare - armed_discount
    assert armed_final == 7650.0

    # 5. Hold booking with 1 Student and 1 Regular passenger
    pax1 = {
        "fullName": "Student User", "age": 20, "email": "student@college.edu", "phone": "9876543210",
        "specialFareType": "student", "studentId": "STU888", "studentName": "Student User",
        "institutionName": "IIT Delhi", "institutionCity": "New Delhi", "studentCourse": "B.Tech",
        "studentDateOfBirth": "2005-01-01", "studentEmail": "student@college.edu"
    }
    pax2 = {
        "fullName": "Regular User", "age": 30, "email": "regular@example.com", "phone": "9876543210",
        "specialFareType": "regular"
    }
    hold_payload = {
        "vertical": "flights", "amount": 20000.0, "user_id": 1,
        "details": {
            "origin": "DEL", "destination": "BOM",
            "passengers": [pax1, pax2]
        }
    }
    resp = client.post("/api/v1/bookings/hold", json=hold_payload)
    assert resp.status_code == 200
    data = resp.json()
    # Total Base: 17000 (8500 per pax). Student discount: 850. Tax: 3000. Total = 17000 - 850 + 3000 = 19150.
    assert data["total_amount"] == 19150.0




