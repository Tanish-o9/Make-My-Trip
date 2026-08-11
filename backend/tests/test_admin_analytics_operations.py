import datetime
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.models.bookings import FlightBooking, HotelBooking, BookingStatus
from app.models.payments import PaymentTransaction, PaymentStatus
from app.models.audit import AuditLog
from app.routes.crm import SupportTicket
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_analytics_test_data():
    """Ensure clean test data."""
    db = SessionLocal()
    try:
        test_emails = [
            "analytics_admin@travelos.com",
            "normal_user@travelos.com",
        ]
        for email in test_emails:
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.query(FlightBooking).filter(FlightBooking.user_id == u.id).delete()
                db.query(HotelBooking).filter(HotelBooking.user_id == u.id).delete()
                db.query(SupportTicket).filter(SupportTicket.user_id == u.id).delete()
                db.delete(u)
        db.commit()
    finally:
        db.close()


def _create_user(email="analytics_admin@travelos.com", role="admin"):
    db = SessionLocal()
    try:
        u = User(
            email=email,
            password_hash=hash_password("AdminSecurePass1!"),
            email_verified=True,
            role=role,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.id
    finally:
        db.close()


# ─── 1. Analytics Overview & KPIs ───────────────────────────────────────────────

def test_01_analytics_overview_kpis():
    uid = _create_user("analytics_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "analytics_admin@travelos.com"})

    # Seed verified booking
    db = SessionLocal()
    fb = FlightBooking(
        booking_reference="TOS-FL-ANL-1",
        user_id=uid,
        origin="DEL",
        destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
        airline_code="6E",
        flight_number="6E-101",
        total_amount=12500.0,
        currency="INR",
        status=BookingStatus.CONFIRMED,
        passenger_details=[{"name": "Admin Analyst"}],
        pricing_snapshot={"base": 10000, "taxes": 2500},
    )
    db.add(fb)
    db.commit()
    db.close()

    resp = client.get("/api/v1/admin/analytics/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "kpis" in data
    assert data["data_environment"] == "LIVE"
    assert data["kpis"]["confirmed_bookings"] >= 1
    assert data["kpis"]["gross_revenue"] >= 12500.0


# ─── 2. Booking Analytics Trend ────────────────────────────────────────────────

def test_02_booking_analytics_trend():
    _create_user("analytics_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "analytics_admin@travelos.com"})

    resp = client.get("/api/v1/admin/analytics/bookings?period=last_7_days", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "timeline" in data
    assert "total_period_bookings" in data


# ─── 3. Revenue by Vertical ───────────────────────────────────────────────────

def test_03_revenue_by_vertical():
    _create_user("analytics_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "analytics_admin@travelos.com"})

    resp = client.get("/api/v1/admin/analytics/verticals", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "verticals" in data
    vert_names = [v["vertical"] for v in data["verticals"]]
    assert "Flights" in vert_names
    assert "Hotels" in vert_names


# ─── 4. Booking Conversion Funnel ──────────────────────────────────────────────

def test_04_conversion_funnel():
    _create_user("analytics_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "analytics_admin@travelos.com"})

    resp = client.get("/api/v1/admin/analytics/funnel", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "funnel" in data
    assert len(data["funnel"]) == 6
    assert data["funnel"][0]["stage"] == "Search"
    assert data["funnel"][-1]["stage"] == "Booking Confirmed"


# ─── 5. Top Destinations & Routes ──────────────────────────────────────────────

def test_05_destination_analytics():
    _create_user("analytics_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "analytics_admin@travelos.com"})

    resp = client.get("/api/v1/admin/analytics/destinations", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "top_flight_routes" in data
    assert "top_hotel_destinations" in data


# ─── 6. Payment & Refund Analytics ────────────────────────────────────────────

def test_06_payment_analytics():
    _create_user("analytics_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "analytics_admin@travelos.com"})

    resp = client.get("/api/v1/admin/analytics/payments", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "success_rate" in data
    assert "gateways" in data


# ─── 7. Operations Overview ───────────────────────────────────────────────────

def test_07_operations_overview():
    _create_user("analytics_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "analytics_admin@travelos.com"})

    resp = client.get("/api/v1/admin/operations/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["system_status"] == "OPERATIONAL"
    assert "alerts" in data


# ─── 8. Operations Bookings Search ────────────────────────────────────────────

def test_08_operations_bookings_search():
    uid = _create_user("analytics_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "analytics_admin@travelos.com"})

    db = SessionLocal()
    hb = HotelBooking(
        booking_reference="TOS-HTL-OP-1",
        user_id=uid,
        hotel_id="hotel_mumbai_01",
        hotel_name="Grand Palace Mumbai",
        check_in=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        check_out=datetime.datetime.utcnow() + datetime.timedelta(days=3),
        room_type="Deluxe Sea View",
        total_amount=18000.0,
        currency="INR",
        status=BookingStatus.CONFIRMED,
        guest_details=[{"name": "Admin Tester"}],
        pricing_snapshot={"base": 15000, "taxes": 3000},
    )
    db.add(hb)
    db.commit()
    db.close()

    resp = client.get("/api/v1/admin/operations/bookings?query=TOS-HTL", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


# ─── 9. Audit Logs ─────────────────────────────────────────────────────────────

def test_09_audit_logs():
    _create_user("analytics_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "analytics_admin@travelos.com"})

    resp = client.get("/api/v1/admin/operations/audit-logs", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─── 10. CSV Export ────────────────────────────────────────────────────────────

def test_10_csv_export():
    _create_user("analytics_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "analytics_admin@travelos.com"})

    resp = client.get("/api/v1/admin/operations/export/bookings", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")
    assert "Booking Reference" in resp.text


# ─── 11. RBAC & Security Protection ───────────────────────────────────────────

def test_11_rbac_protection():
    _create_user("normal_user@travelos.com", role="user")
    user_token = create_access_token(data={"sub": "normal_user@travelos.com"})

    # 1. Normal user forbidden (403)
    resp_user = client.get("/api/v1/admin/analytics/overview", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_user.status_code == 403

    # 2. Anonymous rejected (401)
    resp_anon = client.get("/api/v1/admin/analytics/overview")
    assert resp_anon.status_code == 401
