import time
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(scope="module")
def perf_user():
    """Create a test user for performance metrics verification."""
    db = SessionLocal()
    email = "perf_auditor@travelos.com"
    u = db.query(User).filter(User.email == email).first()
    if not u:
        u = User(
            email=email,
            password_hash=hash_password("PerfTestPass123!"),
            email_verified=True,
            role="admin",
        )
        db.add(u)
        db.commit()
        db.refresh(u)
    db.close()
    yield email
    db = SessionLocal()
    u = db.query(User).filter(User.email == email).first()
    if u:
        db.delete(u)
        db.commit()
    db.close()


# ─── 1. Health & Readiness Benchmarking ────────────────────────────────────────

def test_health_ready_baseline_performance():
    # 1. Health Endpoint
    t0 = time.time()
    for _ in range(5):
        resp = client.get("/health")
        assert resp.status_code == 200
    latency = (time.time() - t0) / 5
    print(f"Health avg latency: {latency*1000:.2f}ms")
    assert latency < 0.200  # P95 < 200ms target

    # 2. Readiness Probe
    t0 = time.time()
    for _ in range(5):
        resp = client.get("/ready")
        assert resp.status_code == 200
    latency = (time.time() - t0) / 5
    print(f"Readiness avg latency: {latency*1000:.2f}ms")
    assert latency < 0.200  # P95 < 200ms target


# ─── 2. Search Baseline Latency ────────────────────────────────────────────────

def test_search_baseline_performance(perf_user):
    token = create_access_token(data={"sub": perf_user})
    headers = {"Authorization": f"Bearer {token}"}

    # Flights Search
    t0 = time.time()
    resp = client.get(
        "/api/v1/search?vertical=flights&origin=DEL&destination=BOM&date=2026-10-15&passengers=1",
        headers=headers
    )
    latency = time.time() - t0
    print(f"Flight search latency: {latency*1000:.2f}ms")
    assert resp.status_code == 200
    assert latency < 2.0  # Search target < 2s



# ─── 3. User & Admin Dashboards Benchmarking ──────────────────────────────────

def test_dashboards_baseline_performance(perf_user):
    token = create_access_token(data={"sub": perf_user})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. User Dashboard /me
    t0 = time.time()
    resp_me = client.get("/api/v1/users/me", headers=headers)
    latency_me = time.time() - t0
    assert resp_me.status_code == 200
    assert latency_me < 0.500  # Normal API target < 500ms

    # 2. Admin Analytics Overview
    t0 = time.time()
    resp_an = client.get("/api/v1/admin/analytics/overview?period=last_30_days", headers=headers)
    latency_an = time.time() - t0
    assert resp_an.status_code == 200
    assert latency_an < 2.0  # Admin analytics < 2s target
