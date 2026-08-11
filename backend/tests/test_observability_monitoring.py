import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_monitoring_test_data():
    """Ensure clean test data."""
    db = SessionLocal()
    try:
        for email in ["monitor_admin@travelos.com", "monitor_user@travelos.com"]:
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.delete(u)
        db.commit()
    finally:
        db.close()


def _create_user(email="monitor_admin@travelos.com", role="admin"):
    db = SessionLocal()
    try:
        u = User(
            email=email,
            password_hash=hash_password("MonitorSecure123!"),
            email_verified=True,
            role=role,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.id
    finally:
        db.close()


# ─── 1. Health & Readiness Probes ──────────────────────────────────────────────

def test_01_liveness_probe():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


def test_02_readiness_probe():
    resp = client.get("/ready")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ready"
    assert resp.json()["database"] == "connected"


# ─── 3. Admin Detailed Health ──────────────────────────────────────────────────

def test_03_admin_detailed_health():
    _create_user("monitor_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "monitor_admin@travelos.com"})

    resp = client.get("/api/v1/admin/health", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "subsystems" in data
    assert "database" in data["subsystems"]
    assert "api" in data["subsystems"]
    assert data["environment"] == "production"


# ─── 4. API Performance Metrics ───────────────────────────────────────────────

def test_04_api_performance_metrics():
    _create_user("monitor_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "monitor_admin@travelos.com"})

    resp = client.get("/api/v1/admin/monitoring/api-performance", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "monitored_endpoints" in data
    assert "global_p95_ms" in data


# ─── 5. Database Monitoring ───────────────────────────────────────────────────

def test_05_database_monitoring():
    _create_user("monitor_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "monitor_admin@travelos.com"})

    resp = client.get("/api/v1/admin/monitoring/database", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "connection_pool" in data


# ─── 6. Payment Monitoring ────────────────────────────────────────────────────

def test_06_payment_monitoring():
    _create_user("monitor_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "monitor_admin@travelos.com"})

    resp = client.get("/api/v1/admin/monitoring/payments", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "metrics" in data
    assert "success_rate" in data


# ─── 7. Provider Registry & Circuit Breaker ───────────────────────────────────

def test_07_provider_monitoring():
    _create_user("monitor_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "monitor_admin@travelos.com"})

    resp = client.get("/api/v1/admin/monitoring/providers", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "providers" in data
    assert len(data["providers"]) >= 3
    assert data["providers"][0]["circuit_breaker"] in ("CLOSED", "HALF_OPEN", "OPEN")


# ─── 8. WebSockets & Notifications Monitoring ─────────────────────────────────

def test_08_09_websockets_and_notifications():
    _create_user("monitor_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "monitor_admin@travelos.com"})

    # WebSockets
    resp_ws = client.get("/api/v1/admin/monitoring/websockets", headers={"Authorization": f"Bearer {token}"})
    assert resp_ws.status_code == 200
    assert "active_connections" in resp_ws.json()

    # Notifications
    resp_notif = client.get("/api/v1/admin/monitoring/notifications", headers={"Authorization": f"Bearer {token}"})
    assert resp_notif.status_code == 200
    assert "delivered" in resp_notif.json()


# ─── 10. Support & Security Monitoring ────────────────────────────────────────

def test_10_11_support_and_security():
    _create_user("monitor_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "monitor_admin@travelos.com"})

    # Support
    resp_sup = client.get("/api/v1/admin/monitoring/support", headers={"Authorization": f"Bearer {token}"})
    assert resp_sup.status_code == 200
    assert "sla_compliance_rate" in resp_sup.json()

    # Security
    resp_sec = client.get("/api/v1/admin/monitoring/security", headers={"Authorization": f"Bearer {token}"})
    assert resp_sec.status_code == 200
    assert "failed_login_attempts" in resp_sec.json()


# ─── 12. Alert Engine Lifecycle ───────────────────────────────────────────────

def test_12_alert_engine_lifecycle():
    _create_user("monitor_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "monitor_admin@travelos.com"})

    # 1. List alerts
    resp_list = client.get("/api/v1/admin/monitoring/alerts", headers={"Authorization": f"Bearer {token}"})
    assert resp_list.status_code == 200
    alerts = resp_list.json()["alerts"]
    assert len(alerts) >= 1
    alt_id = alerts[0]["id"]

    # 2. Acknowledge alert
    resp_ack = client.patch(
        f"/api/v1/admin/monitoring/alerts/{alt_id}/acknowledge",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_ack.status_code == 200
    assert resp_ack.json()["alert"]["status"] == "ACKNOWLEDGED"

    # 3. Resolve alert
    resp_res = client.patch(
        f"/api/v1/admin/monitoring/alerts/{alt_id}/resolve",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_res.status_code == 200
    assert resp_res.json()["alert"]["status"] == "RESOLVED"


# ─── 13. Frontend Metric Ingestion ────────────────────────────────────────────

def test_13_frontend_metric_ingestion():
    resp = client.post(
        "/api/v1/admin/monitoring/frontend-metrics",
        json={
            "metric_type": "api_failure",
            "path": "/search/flights",
            "message": "Network timeout on hotel autocomplete",
            "duration_ms": 1240.5,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


# ─── 14. RBAC & Security Protection ───────────────────────────────────────────

def test_14_rbac_security_protection():
    _create_user("monitor_user@travelos.com", role="user")
    user_token = create_access_token(data={"sub": "monitor_user@travelos.com"})

    # 1. Customer forbidden (403)
    resp_user = client.get("/api/v1/admin/health", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_user.status_code == 403

    # 2. Anonymous rejected (401)
    resp_anon = client.get("/api/v1/admin/health")
    assert resp_anon.status_code == 401
