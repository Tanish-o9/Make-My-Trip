import pytest
import datetime
import hashlib
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, Trip, TripMember, TripInvitation, TripPayment
from app.auth.jwt import hash_password

client = TestClient(app)

@pytest.fixture(scope="module")
def test_user():
    db = SessionLocal()
    user = db.query(User).filter(User.email == "grouptest@travelos.com").first()
    if not user:
        user = User(
            email="grouptest@travelos.com",
            password_hash=hash_password("password123"),
            role="user",
            preferred_language="en",
            preferred_currency="INR"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    db.close()
    return user

@pytest.fixture(scope="module")
def auth_headers(test_user):
    resp = client.post(
        "/api/v1/auth/token",
        data={"username": "grouptest@travelos.com", "password": "password123"},
        headers={"X-Device-Id": "device_test_group"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_create_and_manage_group_trip(auth_headers, test_user):
    db = SessionLocal()
    trip_id = None
    try:
        # 1. Create Trip
        resp = client.post(
            "/api/v1/trips",
            json={
                "name": "Goa Squad Trip 2026",
                "destination": "Goa",
                "start_date": "2026-10-10",
                "end_date": "2026-10-15",
                "budget": 40000,
                "trip_type": "Friends",
                "booking_references": []
            },
            headers=auth_headers
        )
        assert resp.status_code == 200
        trip_data = resp.json()
        trip_id = trip_data["id"]
        assert trip_id is not None
        assert trip_data["name"] == "Goa Squad Trip 2026"

        # 2. Bulk Invite members
        invite_resp = client.post(
            f"/api/v1/trips/{trip_id}/invitations",
            json={
                "members": [
                    {"name": "Rahul Rajput", "email": "rahul@example.com", "phone": "+919876543210"},
                    {"name": "Priya Sharma", "email": "priya@example.com", "phone": "+918765432109"}
                ]
            },
            headers=auth_headers
        )
        assert invite_resp.status_code == 200
        assert invite_resp.json()["count"] == 2

        # 3. List Invitations
        list_resp = client.get(
            f"/api/v1/trips/{trip_id}/invitations",
            headers=auth_headers
        )
        assert list_resp.status_code == 200
        invs = list_resp.json()
        assert len(invs) == 2
        rahul_inv = [i for i in invs if i["email"] == "rahul@example.com"][0]
        assert rahul_inv["phone_verified"] is False

        # 4. Send OTP
        otp_resp = client.post(
            f"/api/v1/trips/{trip_id}/invitations/{rahul_inv['id']}/send-otp",
            headers=auth_headers
        )
        assert otp_resp.status_code == 200
        mock_code = otp_resp.json()["mock_code"]
        assert mock_code is not None

        # 5. Verify OTP
        verify_resp = client.post(
            f"/api/v1/trips/{trip_id}/invitations/{rahul_inv['id']}/verify-otp",
            json={"code": mock_code},
            headers=auth_headers
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["success"] is True

        # Check in DB that phone is now verified
        db.expire_all()
        inv_db = db.query(TripInvitation).filter(TripInvitation.id == rahul_inv["id"]).first()
        assert inv_db.phone_verified is True

        # 6. Create payment order
        pay_order_resp = client.post(
            f"/api/v1/trips/{trip_id}/payment/create-order",
            json={"amount": 40000, "currency": "INR"},
            headers=auth_headers
        )
        assert pay_order_resp.status_code == 200
        order_data = pay_order_resp.json()
        order_id = order_data["order_id"]
        assert order_id.startswith("order_mock_") or order_id.startswith("order_")

        # 7. Verify payment
        pay_verify_resp = client.post(
            f"/api/v1/trips/{trip_id}/payment/verify",
            json={
                "razorpay_order_id": order_id,
                "razorpay_payment_id": "pay_mock_123",
                "razorpay_signature": "mock_sig"
              },
            headers=auth_headers
        )
        assert pay_verify_resp.status_code == 200
        assert pay_verify_resp.json()["payment_status"] == "SUCCESS"

        # Check trip is now Confirmed
        trip_db = db.query(Trip).filter(Trip.id == trip_id).first()
        assert trip_db.status == "Confirmed"

    finally:
        if trip_id is not None:
            # Clean up database records
            db.query(TripPayment).filter(TripPayment.trip_id == trip_id).delete()
            db.query(TripInvitation).filter(TripInvitation.trip_id == trip_id).delete()
            db.query(TripMember).filter(TripMember.trip_id == trip_id).delete()
            db.query(Trip).filter(Trip.id == trip_id).delete()
            db.commit()
        db.close()
