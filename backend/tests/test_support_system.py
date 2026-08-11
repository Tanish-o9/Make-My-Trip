import io
import datetime
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.models.bookings import FlightBooking, BookingStatus
from app.models.audit import Notification
from app.routes.crm import SupportTicket, TicketReply
from app.routes.support import _ticket_rate_limit, _message_rate_limit
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_support_test_data():
    """Ensure clean support ticket test data and clear rate limiters."""
    _ticket_rate_limit.clear()
    _message_rate_limit.clear()

    db = SessionLocal()
    try:
        test_emails = [
            "support_user1@travelos.com",
            "support_user2@travelos.com",
            "admin_support_test@travelos.com",
        ]
        for email in test_emails:
            user = db.query(User).filter(User.email == email).first()
            if user:
                db.query(TicketReply).filter(
                    TicketReply.ticket_id.in_(
                        db.query(SupportTicket.id).filter(SupportTicket.user_id == user.id)
                    )
                ).delete(synchronize_session=False)
                db.query(SupportTicket).filter(SupportTicket.user_id == user.id).delete()
                db.query(FlightBooking).filter(FlightBooking.user_id == user.id).delete()
                db.query(Notification).filter(Notification.user_id == user.id).delete()
                db.delete(user)
        db.commit()
    finally:
        db.close()


def _create_user(email="support_user1@travelos.com", role="user"):
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=hash_password("SupportPass123!"),
            email_verified=True,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id
    finally:
        db.close()


# ─── 1. Create Ticket ──────────────────────────────────────────────────────────

def test_01_create_ticket_format():
    _create_user("support_user1@travelos.com")
    token = create_access_token(data={"sub": "support_user1@travelos.com"})

    resp = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "subject": "Luggage inquiry",
            "category": "FLIGHT",
            "description": "How many bags can I carry on Indigo flight 6E-204?",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["ticket_ref"].startswith("SUP-")
    assert data["status"] == "OPEN"
    assert data["priority"] == "LOW"


# ─── 2. Get Own Tickets ────────────────────────────────────────────────────────

def test_02_get_own_tickets():
    _create_user("support_user1@travelos.com")
    token = create_access_token(data={"sub": "support_user1@travelos.com"})

    client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token}"},
        json={"subject": "T1", "category": "HOTEL", "description": "Desc 1"},
    )
    client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token}"},
        json={"subject": "T2", "category": "CAB", "description": "Desc 2"},
    )

    resp = client.get("/api/v1/support/tickets", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# ─── 3. IDOR Rejection ─────────────────────────────────────────────────────────

def test_03_idor_rejection():
    _create_user("support_user1@travelos.com")
    _create_user("support_user2@travelos.com")

    token1 = create_access_token(data={"sub": "support_user1@travelos.com"})
    token2 = create_access_token(data={"sub": "support_user2@travelos.com"})

    res_create = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token1}"},
        json={"subject": "Private ticket", "category": "PAYMENT", "description": "Credit card dispute"},
    )
    tref = res_create.json()["ticket_ref"]

    # User 2 cannot access ticket
    res_get = client.get(f"/api/v1/support/tickets/{tref}", headers={"Authorization": f"Bearer {token2}"})
    assert res_get.status_code == 404

    # User 2 cannot reply to ticket
    res_reply = client.post(
        f"/api/v1/support/tickets/{tref}/messages",
        headers={"Authorization": f"Bearer {token2}"},
        json={"message": "Hacked reply"},
    )
    assert res_reply.status_code == 404


# ─── 4. Send Message & 5. Agent Reply ──────────────────────────────────────────

def test_04_05_conversation_messaging():
    _create_user("support_user1@travelos.com")
    _create_user("admin_support_test@travelos.com", role="admin")

    token_user = create_access_token(data={"sub": "support_user1@travelos.com"})
    token_admin = create_access_token(data={"sub": "admin_support_test@travelos.com"})

    # Customer creates ticket
    res_create = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token_user}"},
        json={"subject": "Hotel WiFi", "category": "HOTEL", "description": "Password not working in room 302"},
    )
    tref = res_create.json()["ticket_ref"]

    # Agent replies
    res_agent = client.post(
        f"/api/v1/support/tickets/{tref}/messages",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"message": "The guest password was reset to: TravelGuest2026"},
    )
    assert res_agent.status_code == 200
    assert res_agent.json()["author_role"] == "support"

    # Customer replies back
    res_cust = client.post(
        f"/api/v1/support/tickets/{tref}/messages",
        headers={"Authorization": f"Bearer {token_user}"},
        json={"message": "Connected successfully, thank you!"},
    )
    assert res_cust.status_code == 200
    assert res_cust.json()["author_role"] == "customer"

    # Check conversation thread
    res_thread = client.get(f"/api/v1/support/tickets/{tref}", headers={"Authorization": f"Bearer {token_user}"})
    assert len(res_thread.json()["replies"]) == 3


# ─── 6. Status Changes & 7. Priority Changes ───────────────────────────────────

def test_06_07_status_and_priority_updates():
    _create_user("support_user1@travelos.com")
    _create_user("admin_support_test@travelos.com", role="admin")

    token_user = create_access_token(data={"sub": "support_user1@travelos.com"})
    token_admin = create_access_token(data={"sub": "admin_support_test@travelos.com"})

    res_create = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token_user}"},
        json={"subject": "Train booking issue", "category": "TRAIN", "description": "Berth query"},
    )
    tref = res_create.json()["ticket_ref"]

    # Priority update
    res_pri = client.patch(
        f"/api/v1/support/admin/tickets/{tref}/priority",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"priority": "HIGH"},
    )
    assert res_pri.status_code == 200
    assert res_pri.json()["priority"] == "HIGH"

    # Status update
    res_stat = client.patch(
        f"/api/v1/support/admin/tickets/{tref}/status",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"status": "WAITING_FOR_CUSTOMER"},
    )
    assert res_stat.status_code == 200
    assert res_stat.json()["status"] == "WAITING_FOR_CUSTOMER"


# ─── 8. Agent Assignment ───────────────────────────────────────────────────────

def test_08_agent_assignment():
    _create_user("support_user1@travelos.com")
    _create_user("admin_support_test@travelos.com", role="admin")

    token_user = create_access_token(data={"sub": "support_user1@travelos.com"})
    token_admin = create_access_token(data={"sub": "admin_support_test@travelos.com"})

    res_create = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token_user}"},
        json={"subject": "Car rental GPS", "category": "CAR_RENTAL", "description": "Need navigation unit"},
    )
    tref = res_create.json()["ticket_ref"]

    res_assign = client.patch(
        f"/api/v1/support/admin/tickets/{tref}/assign",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"agent_email": "support.sarah@travelos.com"},
    )
    assert res_assign.status_code == 200
    assert res_assign.json()["assigned_to"] == "support.sarah@travelos.com"


# ─── 9. Internal Note Privacy ──────────────────────────────────────────────────

def test_09_internal_note_privacy():
    _create_user("support_user1@travelos.com")
    _create_user("admin_support_test@travelos.com", role="admin")

    token_user = create_access_token(data={"sub": "support_user1@travelos.com"})
    token_admin = create_access_token(data={"sub": "admin_support_test@travelos.com"})

    res_create = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token_user}"},
        json={"subject": "Activity reschedule", "category": "ACTIVITY", "description": "Scuba diving date change"},
    )
    tref = res_create.json()["ticket_ref"]

    # Admin adds internal note
    client.post(
        f"/api/v1/support/admin/tickets/{tref}/internal-notes",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"note": "CONFIDENTIAL: Tour operator agreed to waive the $50 change fee."},
    )

    # Customer viewing ticket MUST NOT see the internal note
    res_cust = client.get(f"/api/v1/support/tickets/{tref}", headers={"Authorization": f"Bearer {token_user}"})
    for reply in res_cust.json()["replies"]:
        assert not reply["is_internal_note"]
        assert "CONFIDENTIAL" not in reply["message"]


# ─── 10. Booking-Linked Ticket ─────────────────────────────────────────────────

def test_10_booking_linked_ticket():
    uid = _create_user("support_user1@travelos.com")
    token = create_access_token(data={"sub": "support_user1@travelos.com"})

    # Create mock booking
    db = SessionLocal()
    booking = FlightBooking(
        booking_reference="TOS-FL-7788",
        user_id=uid,
        origin="DEL",
        destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=2),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=2, hours=2),
        airline_code="6E",
        flight_number="6E-101",
        total_amount=9500.0,
        currency="INR",
        status=BookingStatus.CONFIRMED,
        passenger_details=[{"name": "Verified Traveler"}],
        pricing_snapshot={"base": 8000, "taxes": 1500},
    )
    db.add(booking)
    db.commit()
    db.close()

    # Create booking-linked ticket
    res_create = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "subject": "Meal preference on booking",
            "category": "FLIGHT",
            "booking_reference": "TOS-FL-7788",
            "description": "Request vegetarian meal for 6E-101.",
        },
    )
    assert res_create.status_code == 201
    data = res_create.json()
    assert data["booking_reference"] == "TOS-FL-7788"
    assert data["vertical"] == "flight"
    assert data["payment_status"] == "PAID"


# ─── 11. Attachment Validation ─────────────────────────────────────────────────

def test_11_attachment_validation():
    _create_user("support_user1@travelos.com")
    token = create_access_token(data={"sub": "support_user1@travelos.com"})

    res_create = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token}"},
        json={"subject": "Receipt attachment", "category": "PAYMENT", "description": "Please see attached receipt"},
    )
    tref = res_create.json()["ticket_ref"]

    # 1. Valid PNG upload
    dummy_img = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"A" * 100)
    res_upload = client.post(
        f"/api/v1/support/tickets/{tref}/attachments",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("receipt.png", dummy_img, "image/png")},
    )
    assert res_upload.status_code == 200
    assert "attachment_url" in res_upload.json()

    # 2. Invalid Script upload (.sh / text) rejected
    dummy_script = io.BytesIO(b"#!/bin/bash\necho test")
    res_bad = client.post(
        f"/api/v1/support/tickets/{tref}/attachments",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("exploit.sh", dummy_script, "text/plain")},
    )
    assert res_bad.status_code == 400


# ─── 12. Rate Limiting ─────────────────────────────────────────────────────────

def test_12_rate_limiting():
    _create_user("support_user1@travelos.com")
    token = create_access_token(data={"sub": "support_user1@travelos.com"})

    # Send 10 tickets (within limit)
    for i in range(10):
        r = client.post(
            "/api/v1/support/tickets",
            headers={"Authorization": f"Bearer {token}"},
            json={"subject": f"Spam check {i}", "category": "OTHER", "description": f"Body {i}"},
        )
        assert r.status_code == 201

    # 11th request triggers HTTP 429
    r_spam = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token}"},
        json={"subject": "Excessive request", "category": "OTHER", "description": "Too fast"},
    )
    assert r_spam.status_code == 429


# ─── 16. Ticket Reopen & 17. Ticket Close ──────────────────────────────────────

def test_16_17_close_and_reopen():
    _create_user("support_user1@travelos.com")
    token = create_access_token(data={"sub": "support_user1@travelos.com"})

    res_create = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token}"},
        json={"subject": "Inquiry completed", "category": "GENERAL", "description": "Resolved query"},
    )
    tref = res_create.json()["ticket_ref"]

    # Close ticket
    res_close = client.post(f"/api/v1/support/tickets/{tref}/close", headers={"Authorization": f"Bearer {token}"})
    assert res_close.status_code == 200
    assert res_close.json()["status"] == "CLOSED"

    # Reopen ticket
    res_reopen = client.post(f"/api/v1/support/tickets/{tref}/reopen", headers={"Authorization": f"Bearer {token}"})
    assert res_reopen.status_code == 200
    assert res_reopen.json()["status"] == "OPEN"


# ─── 18. RBAC Protection ───────────────────────────────────────────────────────

def test_18_rbac_protection():
    _create_user("support_user1@travelos.com", role="user")
    token_user = create_access_token(data={"sub": "support_user1@travelos.com"})

    # Non-admin rejected from admin endpoints (403 Forbidden)
    res_admin_tickets = client.get("/api/v1/support/admin/tickets", headers={"Authorization": f"Bearer {token_user}"})
    assert res_admin_tickets.status_code == 403

    res_admin_stats = client.get("/api/v1/support/admin/stats", headers={"Authorization": f"Bearer {token_user}"})
    assert res_admin_stats.status_code == 403


# ─── 20. Full Support E2E Flow ─────────────────────────────────────────────────

def test_20_full_support_e2e_flow():
    _create_user("support_user1@travelos.com", role="user")
    _create_user("admin_support_test@travelos.com", role="admin")

    token_user = create_access_token(data={"sub": "support_user1@travelos.com"})
    token_admin = create_access_token(data={"sub": "admin_support_test@travelos.com"})

    # 1. Customer creates ticket for payment issue
    res_create = client.post(
        "/api/v1/support/tickets",
        headers={"Authorization": f"Bearer {token_user}"},
        json={
            "subject": "Payment debited twice for booking TOS-FL-9020",
            "category": "PAYMENT",
            "booking_reference": "TOS-FL-9020",
            "description": "UPI transaction charged INR 14,000 two times.",
        },
    )
    assert res_create.status_code == 201
    tref = res_create.json()["ticket_ref"]
    assert res_create.json()["priority"] == "HIGH"

    # 2. Admin assigns ticket to specialized finance agent
    res_assign = client.patch(
        f"/api/v1/support/admin/tickets/{tref}/assign",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"agent_email": "finance.lead@travelos.com"},
    )
    assert res_assign.status_code == 200

    # 3. Agent responds with gateway verification
    res_reply = client.post(
        f"/api/v1/support/tickets/{tref}/messages",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"message": "We verified Razorpay transaction #pay_98765. The duplicate charge has been auto-reversed."},
    )
    assert res_reply.status_code == 200

    # 4. Customer acknowledges resolution
    res_ack = client.post(
        f"/api/v1/support/tickets/{tref}/messages",
        headers={"Authorization": f"Bearer {token_user}"},
        json={"message": "Received bank reversal SMS. Thanks for the quick support!"},
    )
    assert res_ack.status_code == 200

    # 5. Admin updates status to RESOLVED
    res_res = client.patch(
        f"/api/v1/support/admin/tickets/{tref}/status",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={"status": "RESOLVED"},
    )
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"

    # 6. Customer closes ticket
    res_close = client.post(f"/api/v1/support/tickets/{tref}/close", headers={"Authorization": f"Bearer {token_user}"})
    assert res_close.status_code == 200
    assert res_close.json()["status"] == "CLOSED"
