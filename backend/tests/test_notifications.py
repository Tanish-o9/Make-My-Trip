import datetime
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User, NotificationPreference
from app.models.audit import Notification, NotificationDelivery
from app.services.notification_service import NotificationService
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_notifications_data():
    """Ensure clean notification test data."""
    db = SessionLocal()
    try:
        test_emails = [
            "notif_user1@travelos.com",
            "notif_user2@travelos.com",
            "admin_notif_test@travelos.com",
        ]
        for email in test_emails:
            user = db.query(User).filter(User.email == email).first()
            if user:
                db.query(NotificationDelivery).filter(
                    NotificationDelivery.notification_id.in_(
                        db.query(Notification.id).filter(Notification.user_id == user.id)
                    )
                ).delete(synchronize_session=False)
                db.query(Notification).filter(Notification.user_id == user.id).delete()
                db.query(NotificationPreference).filter(NotificationPreference.user_id == user.id).delete()
                db.delete(user)
        db.commit()
    finally:
        db.close()


def _create_user(email="notif_user1@travelos.com", role="user"):
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=hash_password("NotifPass123!"),
            email_verified=True,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id
    finally:
        db.close()


# ─── 1. Notification Creation ───────────────────────────────────────────────────

def test_01_notification_creation():
    uid = _create_user("notif_user1@travelos.com")
    db = SessionLocal()
    try:
        notif = NotificationService.send_notification(
            db=db,
            user_id=uid,
            notification_type="BOOKING_CONFIRMED",
            title="Flight Confirmed",
            message="Your flight DEL -> BOM is confirmed.",
            booking_reference="TOS-FL-100",
            vertical="flight",
        )
        assert notif.id is not None
        assert notif.title == "Flight Confirmed"
        assert notif.is_read is False
    finally:
        db.close()


# ─── 2. Notification Retrieval ─────────────────────────────────────────────────

def test_02_notification_retrieval():
    uid = _create_user("notif_user1@travelos.com")
    db = SessionLocal()
    try:
        NotificationService.send_notification(
            db=db, user_id=uid, notification_type="PAYMENT_SUCCESS",
            title="Payment Received", message="INR 12,000 paid."
        )
    finally:
        db.close()

    token = create_access_token(data={"sub": "notif_user1@travelos.com"})
    resp = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Payment Received"


# ─── 3. User Ownership & IDOR Protection ───────────────────────────────────────

def test_03_user_ownership_and_idor():
    u1 = _create_user("notif_user1@travelos.com")
    u2 = _create_user("notif_user2@travelos.com")

    db = SessionLocal()
    try:
        n2 = NotificationService.send_notification(
            db=db, user_id=u2, notification_type="TRIP_STARTED",
            title="User 2 Trip", message="Private message."
        )
        n2_id = n2.id
    finally:
        db.close()

    token1 = create_access_token(data={"sub": "notif_user1@travelos.com"})

    # User 1 sees 0 notifications
    resp1 = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {token1}"})
    assert len(resp1.json()) == 0

    # User 1 cannot mark User 2's notification as read (IDOR guard -> 404)
    resp_mark = client.post(f"/api/v1/notifications/{n2_id}/read", headers={"Authorization": f"Bearer {token1}"})
    assert resp_mark.status_code == 404


# ─── 4. Mark Single as Read ────────────────────────────────────────────────────

def test_04_mark_single_as_read():
    uid = _create_user("notif_user1@travelos.com")
    db = SessionLocal()
    try:
        n = NotificationService.send_notification(
            db=db, user_id=uid, notification_type="FLIGHT_CONFIRMED",
            title="Flight Confirmed", message="Flight details..."
        )
        n_id = n.id
    finally:
        db.close()

    token = create_access_token(data={"sub": "notif_user1@travelos.com"})
    resp = client.post(f"/api/v1/notifications/{n_id}/read", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

    db = SessionLocal()
    try:
        check = db.query(Notification).filter(Notification.id == n_id).first()
        assert check.is_read is True
        assert check.read_at is not None
    finally:
        db.close()



# ─── 5. Mark All as Read ───────────────────────────────────────────────────────

def test_05_mark_all_as_read():
    uid = _create_user("notif_user1@travelos.com")
    db = SessionLocal()
    try:
        NotificationService.send_notification(db=db, user_id=uid, notification_type="N1", title="N1", message="M1")
        NotificationService.send_notification(db=db, user_id=uid, notification_type="N2", title="N2", message="M2")
    finally:
        db.close()

    token = create_access_token(data={"sub": "notif_user1@travelos.com"})
    resp = client.post("/api/v1/notifications/read-all", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

    unread_resp = client.get("/api/v1/notifications/unread-count", headers={"Authorization": f"Bearer {token}"})
    assert unread_resp.json()["unread_count"] == 0


# ─── 6. Unread Count Accurate ──────────────────────────────────────────────────

def test_06_unread_count():
    uid = _create_user("notif_user1@travelos.com")
    db = SessionLocal()
    try:
        NotificationService.send_notification(db=db, user_id=uid, notification_type="A", title="A", message="A")
        NotificationService.send_notification(db=db, user_id=uid, notification_type="B", title="B", message="B")
    finally:
        db.close()

    token = create_access_token(data={"sub": "notif_user1@travelos.com"})
    resp = client.get("/api/v1/notifications/unread-count", headers={"Authorization": f"Bearer {token}"})
    assert resp.json()["unread_count"] == 2


# ─── 7. Vertical Notifications (Flight, Cab, Refund) ───────────────────────────

def test_07_vertical_notifications():
    uid = _create_user("notif_user1@travelos.com")
    db = SessionLocal()
    try:
        # Cab driver assigned
        n_cab = NotificationService.send_notification(
            db=db, user_id=uid, notification_type="DRIVER_ASSIGNED",
            title="Driver Assigned", message="Driver Rajesh is on the way (DL 01 AB 1234)",
            booking_reference="TOS-CAB-88", vertical="cab",
        )
        assert n_cab.vertical == "cab"

        # Refund processed
        n_ref = NotificationService.send_notification(
            db=db, user_id=uid, notification_type="PAYMENT_REFUNDED",
            title="Refund Processed", message="Refund of INR 5,000 completed.",
            booking_reference="TOS-FL-100", vertical="flight",
        )
        assert n_ref.notification_type == "PAYMENT_REFUNDED"
    finally:
        db.close()


# ─── 8. Email Delivery Resilience & Failure Tolerance ──────────────────────────

def test_08_email_failure_tolerance():
    uid = _create_user("notif_user1@travelos.com")
    db = SessionLocal()
    try:
        # Simulate email provider throwing an exception
        with patch("app.services.communication.SendGridClient.send_email", side_effect=Exception("SMTP Timeout")):
            notif = NotificationService.send_notification(
                db=db,
                user_id=uid,
                notification_type="BOOKING_CONFIRMED",
                title="Resilient Confirmation",
                message="Booking succeeded despite email outage.",
                send_email=True,
                email_recipient="notif_user1@travelos.com",
            )
        # Notification must still be created in database!
        assert notif.id is not None
        # Delivery record should reflect FAILED status
        deliv = db.query(NotificationDelivery).filter(
            NotificationDelivery.notification_id == notif.id,
            NotificationDelivery.channel == "email"
        ).first()
        assert deliv is not None
        assert deliv.status == "FAILED"
    finally:
        db.close()


# ─── 9. Notification Idempotency ───────────────────────────────────────────────

def test_09_idempotency_prevents_duplicates():
    uid = _create_user("notif_user1@travelos.com")
    db = SessionLocal()
    try:
        idemp_key = "BOOKING_CONFIRMED:TOS-UNIQUE-999"

        # First call
        n1 = NotificationService.send_notification(
            db=db, user_id=uid, notification_type="BOOKING_CONFIRMED",
            title="Confirmed 1", message="Msg 1",
            idempotency_key=idemp_key,
        )

        # Duplicate webhook / callback / retry with same key
        n2 = NotificationService.send_notification(
            db=db, user_id=uid, notification_type="BOOKING_CONFIRMED",
            title="Confirmed 2", message="Msg 2",
            idempotency_key=idemp_key,
        )

        # Must return the identical notification without inserting a duplicate
        assert n1.id == n2.id
        count = db.query(Notification).filter(Notification.idempotency_key == idemp_key).count()
        assert count == 1
    finally:
        db.close()


# ─── 10. Marketing Preference Filtering ────────────────────────────────────────

def test_10_marketing_preference_filtering():
    uid = _create_user("notif_user1@travelos.com")
    db = SessionLocal()
    try:
        pref = NotificationPreference(user_id=uid, marketing_emails=False)
        db.add(pref)
        db.commit()

        # Marketing notification should suppress email delivery
        with patch("app.services.communication.SendGridClient.send_email") as mock_mail:
            NotificationService.send_notification(
                db=db, user_id=uid, notification_type="PROMOTION",
                title="50% Off Flights", message="Special deal...",
                send_email=True, is_marketing=True,
            )
            mock_mail.assert_not_called()
    finally:
        db.close()


# ─── 11. Notification Preferences API ──────────────────────────────────────────

def test_11_notification_preferences_api():
    uid = _create_user("notif_user1@travelos.com")
    token = create_access_token(data={"sub": "notif_user1@travelos.com"})

    # Get preferences
    get_res = client.get("/api/v1/notifications/preferences", headers={"Authorization": f"Bearer {token}"})
    assert get_res.status_code == 200
    assert get_res.json()["booking_updates"] is True

    # Update preferences
    put_res = client.put(
        "/api/v1/notifications/preferences",
        headers={"Authorization": f"Bearer {token}"},
        json={"marketing_emails": True, "whatsapp_alerts": False},
    )
    assert put_res.status_code == 200
    assert put_res.json()["marketing_emails"] is True
    assert put_res.json()["whatsapp_alerts"] is False


# ─── 12. Admin Notification Monitoring ─────────────────────────────────────────

def test_12_admin_notification_monitoring():
    _create_user("notif_user1@travelos.com", role="user")
    _create_user("admin_notif_test@travelos.com", role="admin")
    admin_token = create_access_token(data={"sub": "admin_notif_test@travelos.com"})

    # Non-admin forbidden
    user_token = create_access_token(data={"sub": "notif_user1@travelos.com"})
    r_forbid = client.get("/api/v1/notifications/admin/stats", headers={"Authorization": f"Bearer {user_token}"})
    assert r_forbid.status_code == 403

    # Admin access succeeds
    r_admin = client.get("/api/v1/notifications/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_admin.status_code == 200
    data = r_admin.json()
    assert "total_notifications" in data
    assert "delivered" in data
    assert "provider_status" in data

