import sys
import os
import json

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.core import User
from app.models.bookings import FlightBooking, BookingInvoice, BookingTicket, SpecialFareConfig, BookingStatus
from app.auth.dependencies import get_current_user
from app.services.booking_core import BookingStateMachine

def seed_special_fares(db):
    if db.query(SpecialFareConfig).count() == 0:
        defaults = [
            SpecialFareConfig(fare_type="regular", discount_percent=0.0, verification_required=False, active=True),
            SpecialFareConfig(fare_type="student", discount_percent=10.0, minimum_age=5, maximum_age=30, verification_required=True, active=True),
            SpecialFareConfig(fare_type="senior", discount_percent=5.0, minimum_age=60, verification_required=False, active=True),
            SpecialFareConfig(fare_type="armed_forces", discount_percent=10.0, verification_required=True, active=True),
        ]
        db.add_all(defaults)
        db.commit()

def run_audit():
    print("=================================================================")
    print("STARTING E2E SPECIAL FARE & BOOKING AUDIT (4-PASSENGER FLOW)")
    print("=================================================================")

    Base.metadata.create_all(bind=engine)

    # 1. Setup authenticated user override
    test_user = User(
        id=1,
        email="audit_traveler@example.com",
        role="user"
    )
    app.dependency_overrides[get_current_user] = lambda: test_user
    client = TestClient(app)

    db = SessionLocal()

    try:
        # Check DB configs
        print("\n--- 1. Checking Database Special Fare Configs ---")
        seed_special_fares(db)
        configs = db.query(SpecialFareConfig).all()
        for c in configs:
            print(f"  Fare: {c.fare_type:<15} | Discount: {c.discount_percent}% | Min Age: {c.minimum_age} | Max Age: {c.maximum_age} | Verif Req: {c.verification_required} | Active: {c.active}")
        assert len(configs) >= 4, "Missing default special fare configs"

        # 2. Hold API stage (4 Passengers)
        print("\n--- 2. Booking Hold Stage (4 Passengers) ---")
        pax1_regular = {
            "fullName": "John Regular",
            "age": 30,
            "email": "john@example.com",
            "phone": "9876543210",
            "specialFareType": "regular"
        }
        pax2_student = {
            "fullName": "Alice Student",
            "age": 20,
            "email": "alice@example.com",
            "phone": "9876543210",
            "specialFareType": "student",
            "studentId": "STU_AUDIT_01",
            "studentName": "Alice Student",
            "institutionName": "University of Delhi",
            "institutionCity": "New Delhi",
            "studentCourse": "B.Tech CS",
            "studentDateOfBirth": "2006-04-12",
            "studentEmail": "alice@du.ac.in",
            "studentIdFile": "student_card.pdf"
        }
        pax3_senior = {
            "fullName": "Robert Senior",
            "age": 65,
            "email": "robert@example.com",
            "phone": "9876543210",
            "specialFareType": "senior"
        }
        pax4_armed = {
            "fullName": "Major Vikram Armed",
            "age": 42,
            "email": "vikram@example.com",
            "phone": "9876543210",
            "specialFareType": "armed_forces",
            "serviceId": "ARM_998877"
        }

        hold_payload = {
            "vertical": "flights",
            "amount": 40000.0,
            "user_id": test_user.id,
            "details": {
                "origin": "DEL",
                "destination": "BOM",
                "finalFareBeforePromo": 40000.0,
                "passengers": [pax1_regular, pax2_student, pax3_senior, pax4_armed]
            }
        }

        hold_resp = client.post("/api/v1/bookings/hold", json=hold_payload)
        print(f"Hold Response Code: {hold_resp.status_code}")
        assert hold_resp.status_code == 200, f"Hold failed: {hold_resp.text}"
        hold_data = hold_resp.json()
        booking_ref = hold_data["booking_reference"]
        total_amount = hold_data["total_amount"]

        print(f"  Booking Reference: {booking_ref}")
        print(f"  Hold Returned Total Amount: INR {total_amount}")
        assert total_amount == 37500.0, f"Expected total 37500.0, got {total_amount}"

        # 3. Inspect DB Booking & pricing_snapshot
        print("\n--- 3. Database pricing_snapshot Inspection ---")
        booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == booking_ref).first()
        assert booking is not None, "Booking not found in DB"
        snapshot = booking.pricing_snapshot
        print(f"  Pricing Snapshot: {json.dumps(snapshot, indent=2)}")

        assert snapshot["base_fare"] == 40000.0
        assert snapshot["tax"] == 0.0
        assert snapshot["discount"] == 2500.0
        assert snapshot["discounts"]["student"] == 1000.0
        assert snapshot["discounts"]["senior"] == 500.0
        assert snapshot["discounts"]["armed_forces"] == 1000.0
        assert snapshot["discounts"]["promo"] == 0.0
        assert snapshot["final_payable"] == 37500.0

        # Passenger details status check
        pax_details = booking.passenger_details
        print(f"  Passenger 1 ({pax_details[0]['fullName']}): FareType={pax_details[0]['specialFareType']} | Discount=INR {pax_details[0]['discountAmount']}")
        print(f"  Passenger 2 ({pax_details[1]['fullName']}): FareType={pax_details[1]['specialFareType']} | Discount=INR {pax_details[1]['discountAmount']} | Status={pax_details[1]['studentVerificationStatus']}")
        print(f"  Passenger 3 ({pax_details[2]['fullName']}): FareType={pax_details[2]['specialFareType']} | Discount=INR {pax_details[2]['discountAmount']}")
        print(f"  Passenger 4 ({pax_details[3]['fullName']}): FareType={pax_details[3]['specialFareType']} | Discount=INR {pax_details[3]['discountAmount']} | ServiceID={pax_details[3].get('serviceId')}")

        assert pax_details[1]["studentVerificationStatus"] == "pending", "Student status should be pending"

        # 4. Payment Order Creation & Tampering Protection
        print("\n--- 4. Payment Order Creation & Tampering Validation ---")
        # Tampered attempt
        tampered_resp = client.post("/api/v1/payments/create-order", json={
            "booking_id": booking_ref,
            "amount": 35000.0, # tampered!
            "currency": "INR",
            "method": "card",
            "human_approved": True
        })
        print(f"  Tampered payment order attempt: HTTP {tampered_resp.status_code} (Expected 400)")
        assert tampered_resp.status_code == 400, "Tampered amount was not rejected"

        # Legitimate order attempt
        valid_order_resp = client.post("/api/v1/payments/create-order", json={
            "booking_id": booking_ref,
            "amount": 37500.0,
            "currency": "INR",
            "method": "card",
            "human_approved": True
        })
        print(f"  Legitimate payment order attempt: HTTP {valid_order_resp.status_code}")
        assert valid_order_resp.status_code == 200, f"Valid order creation failed: {valid_order_resp.text}"
        order_data = valid_order_resp.json()
        print(f"  Payment Order ID: {order_data.get('order_id')}")

        # 5. Confirmation & Booking Success Lifecycle
        print("\n--- 5. Booking Confirmation & Core Transition ---")
        # Trigger booking confirmation via BookingStateMachine
        BookingStateMachine.transition_to(booking, BookingStatus.CONFIRMED)
        db.commit()

        # Query booking details endpoint
        details_resp = client.get(f"/api/v1/bookings/details/{booking_ref}")
        print(f"  Get Details endpoint: HTTP {details_resp.status_code}")
        assert details_resp.status_code == 200
        details_data = details_resp.json()
        print(f"  Confirmed Booking Status: {details_data.get('status')}")
        print(f"  Confirmed Booking Total Amount: INR {details_data.get('total_amount')}")
        assert details_data.get("status") in ["confirmed", "CONFIRMED"]
        assert details_data.get("total_amount") == 37500.0

        # 6. Invoice & Ticket Verification
        print("\n--- 6. Invoice & PDF Ticket Verification ---")
        invoice = db.query(BookingInvoice).filter(BookingInvoice.booking_reference == booking_ref).first()
        assert invoice is not None, "Invoice was not generated"
        print(f"  Invoice Number: {invoice.invoice_number}")
        print(f"  Invoice Base Amount: INR {invoice.base_amount}")
        print(f"  Invoice Discount Amount: INR {invoice.discount_amount}")
        print(f"  Invoice Tax Amount: INR {invoice.tax_amount}")
        print(f"  Invoice Total Amount: INR {invoice.total_amount}")

        assert float(invoice.base_amount) == 40000.0, f"Expected base 40000, got {invoice.base_amount}"
        assert float(invoice.discount_amount) == 2500.0, f"Expected discount 2500, got {invoice.discount_amount}"
        assert float(invoice.tax_amount) == 0.0, f"Expected tax 0, got {invoice.tax_amount}"
        assert float(invoice.final_amount) == 37500.0, f"Expected total 37500, got {invoice.final_amount}"

        ticket = db.query(BookingTicket).filter(BookingTicket.booking_reference == booking_ref).first()
        assert ticket is not None, "Ticket was not generated"
        print(f"  Ticket Number: {ticket.ticket_number}")
        print(f"  Ticket Passengers Count: {len(ticket.passenger_details)}")
        assert len(ticket.passenger_details) == 4

        print("\n=================================================================")
        print("ALL E2E STAGES PASSED WITH 100% MATHEMATICAL AND STATE ACCURACY!")
        print("=================================================================")
        return True

    finally:
        db.close()

if __name__ == "__main__":
    success = run_audit()
    sys.exit(0 if success else 1)
