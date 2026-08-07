"""
Enterprise Readiness Tests — Travel OS
Tests:
  1.  Security headers present on API responses
  2.  Rate limiting configuration
  3.  CRM ticket full lifecycle
  4.  Admin analytics revenue endpoint
  5.  Admin analytics top destinations
  6.  Admin analytics provider health
  7.  Admin analytics cancellation rate
  8.  Admin analytics user stats
  9.  Admin analytics wallet stats
  10. Admin analytics AI usage pointer
  11. Admin analytics system health
  12. Storage backend factory (local)
  13. Storage file validation (type + size)
  14. RBAC role check on CRM endpoint
"""
import pytest
import io
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount, LoyaltyAccount
from app.utils.storage import get_storage_backend, validate_upload, LocalStorageBackend

client = TestClient(app)


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def enterprise_user():
    db = SessionLocal()
    email = "enterprise_test@travelos.com"
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.query(WalletAccount).filter(WalletAccount.user_id == existing.id).delete()
        db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == existing.id).delete()
        db.delete(existing)
        db.commit()

    user = User(email=email, role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    db.add(WalletAccount(user_id=user.id, balance=Decimal("5000.00"), currency="INR"))
    db.add(LoyaltyAccount(user_id=user.id, points_balance=250, tier="Silver"))
    db.commit()
    yield user

    db2 = SessionLocal()
    u = db2.query(User).filter(User.email == email).first()
    if u:
        db2.query(WalletAccount).filter(WalletAccount.user_id == u.id).delete()
        db2.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == u.id).delete()
        db2.delete(u)
        db2.commit()
    db2.close()


@pytest.fixture(scope="module")
def admin_user():
    db = SessionLocal()
    email = "admin_enterprise_test@travelos.com"
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.delete(existing)
        db.commit()

    user = User(email=email, role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user

    db2 = SessionLocal()
    u = db2.query(User).filter(User.email == email).first()
    if u:
        db2.delete(u)
        db2.commit()
    db2.close()


def _token(user: User) -> dict:
    from app.auth.jwt import create_access_token
    tok = create_access_token(data={"sub": user.email, "role": user.role or "user"})
    return {"Authorization": f"Bearer {tok}"}


# ─── 1. Security Headers ─────────────────────────────────────────────────────

def test_security_headers_present():
    """All API responses must include enterprise security headers."""
    resp = client.get("/healthz")
    assert resp.status_code == 200
    headers = resp.headers
    assert "x-frame-options" in headers, "Missing X-Frame-Options"
    assert headers["x-frame-options"] == "DENY"
    assert "x-content-type-options" in headers, "Missing X-Content-Type-Options"
    assert headers["x-content-type-options"] == "nosniff"
    assert "referrer-policy" in headers, "Missing Referrer-Policy"
    assert "content-security-policy" in headers, "Missing Content-Security-Policy"
    assert "frame-ancestors" in headers["content-security-policy"]


# ─── 2. Storage Backend Factory ──────────────────────────────────────────────

def test_storage_backend_factory_local(monkeypatch):
    """Default storage backend should be local filesystem."""
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    backend = get_storage_backend()
    assert isinstance(backend, LocalStorageBackend)


def test_storage_file_validation_valid():
    """Valid PDF should pass validation."""
    content_type = validate_upload(b"%PDF-1.4 test content", "passport.pdf")
    assert content_type == "application/pdf"


def test_storage_file_validation_invalid_type():
    """Python script should be rejected."""
    with pytest.raises(ValueError, match="not allowed"):
        validate_upload(b"print('hello')", "malicious.py")


def test_storage_file_validation_size_limit():
    """File larger than 10MB should be rejected."""
    big_file = b"x" * (11 * 1024 * 1024)
    with pytest.raises(ValueError, match="too large"):
        validate_upload(big_file, "huge.pdf")


# ─── 3. CRM Ticket Lifecycle ─────────────────────────────────────────────────

def test_crm_ticket_lifecycle(enterprise_user):
    headers = _token(enterprise_user)

    # Create ticket
    create_resp = client.post(
        "/api/v1/crm/tickets",
        json={
            "subject": "Flight booking issue",
            "category": "flight",
            "message": "I was overcharged on my booking BK-FL-XXXX.",
            "priority": "high",
        },
        headers=headers,
    )
    assert create_resp.status_code == 200
    ticket_ref = create_resp.json()["ticket_ref"]
    assert ticket_ref.startswith("TKT-")

    # List tickets — should include the new one
    list_resp = client.get("/api/v1/crm/tickets", headers=headers)
    assert list_resp.status_code == 200
    refs = [t["ticket_ref"] for t in list_resp.json()["tickets"]]
    assert ticket_ref in refs

    # Get details
    detail_resp = client.get(f"/api/v1/crm/tickets/{ticket_ref}", headers=headers)
    assert detail_resp.status_code == 200
    data = detail_resp.json()
    assert data["subject"] == "Flight booking issue"
    assert len(data["timeline"]) >= 1

    # Reply
    reply_resp = client.post(
        f"/api/v1/crm/tickets/{ticket_ref}/reply",
        json={"message": "Please check and refund.", "is_internal_note": False},
        headers=headers,
    )
    assert reply_resp.status_code == 200

    # Escalate
    esc_resp = client.post(
        f"/api/v1/crm/tickets/{ticket_ref}/escalate",
        json={"reason": "No response in 24 hours."},
        headers=headers,
    )
    assert esc_resp.status_code == 200
    assert esc_resp.json()["success"] is True

    # Close
    close_resp = client.post(f"/api/v1/crm/tickets/{ticket_ref}/close", headers=headers)
    assert close_resp.status_code == 200

    # Verify closed
    verify = client.get(f"/api/v1/crm/tickets/{ticket_ref}", headers=headers)
    assert verify.json()["status"] == "closed"


# ─── 4–11. Admin Analytics Endpoints ─────────────────────────────────────────

def test_admin_analytics_revenue(admin_user):
    headers = _token(admin_user)
    resp = client.get("/api/admin/analytics/revenue?days=30", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_revenue_inr" in data
    assert "breakdown" in data
    assert "flights" in data["breakdown"]


def test_admin_analytics_top_destinations(admin_user):
    headers = _token(admin_user)
    resp = client.get("/api/admin/analytics/top-destinations", headers=headers)
    assert resp.status_code == 200
    assert "top_destinations" in resp.json()


def test_admin_analytics_provider_health(admin_user):
    headers = _token(admin_user)
    resp = client.get("/api/admin/analytics/provider-health", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "provider_stats" in data
    assert "live_failure_rates" in data


def test_admin_analytics_cancellation_rate(admin_user):
    headers = _token(admin_user)
    resp = client.get("/api/admin/analytics/cancellation-rate", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "cancellation_rate_pct" in data
    assert "breakdown" in data


def test_admin_analytics_user_stats(admin_user):
    headers = _token(admin_user)
    resp = client.get("/api/admin/analytics/user-stats", headers=headers)
    assert resp.status_code == 200
    assert "total_registered_users" in resp.json()


def test_admin_analytics_wallet_stats(admin_user):
    headers = _token(admin_user)
    resp = client.get("/api/admin/analytics/wallet-stats", headers=headers)
    assert resp.status_code == 200
    assert "total_wallet_accounts" in resp.json()


def test_admin_analytics_ai_usage(admin_user):
    headers = _token(admin_user)
    resp = client.get("/api/admin/analytics/ai-usage", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "metrics_endpoint" in data
    assert data["metrics_endpoint"] == "/metrics"


def test_admin_analytics_system_health(admin_user):
    headers = _token(admin_user)
    resp = client.get("/api/admin/analytics/system-health", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "database" in data
    assert "redis" in data
    assert "storage_backend" in data


# ─── 12. RBAC — non-admin blocked from CRM stats ─────────────────────────────

def test_crm_stats_blocked_for_regular_user(enterprise_user):
    headers = _token(enterprise_user)
    resp = client.get("/api/v1/crm/admin/stats", headers=headers)
    assert resp.status_code == 403


# ─── 13. AI Suggested Reply (template fallback) ───────────────────────────────

def test_crm_ai_reply_for_non_support_blocked(enterprise_user):
    """Non-support users must not get AI reply access."""
    headers = _token(enterprise_user)
    resp = client.get("/api/v1/crm/tickets/TKT-FAKE1234/ai-reply", headers=headers)
    assert resp.status_code == 403
