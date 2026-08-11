import concurrent.futures
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(scope="module")
def concurrent_users():
    """Seed test users for concurrent load simulation."""
    db = SessionLocal()
    emails = [f"concurrent_tester_{i}@travelos.com" for i in range(10)]
    for email in emails:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                password_hash=hash_password("ConcurrentSecurePass123!"),
                email_verified=True,
                role="user",
            )
            db.add(u)
    db.commit()
    db.close()
    yield emails
    db = SessionLocal()
    for email in emails:
        u = db.query(User).filter(User.email == email).first()
        if u:
            db.delete(u)
    db.commit()
    db.close()


# ─── 1. Concurrent Flight Searches ────────────────────────────────────────────

def test_concurrent_searches(concurrent_users):
    tokens = [create_access_token(data={"sub": email}) for email in concurrent_users]

    def perform_search(token):
        with TestClient(app) as test_client:
            resp = test_client.get(
                "/api/v1/search?vertical=flights&origin=DEL&destination=BOM&date=2026-10-15&passengers=1",
                headers={"Authorization": f"Bearer {token}"}
            )
            return resp.status_code


    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(perform_search, tokens))

    assert len(results) == 10
    assert all(status == 200 for status in results)


# ─── 2. Concurrent Frontend Telemetry Ingestion ────────────────────────────────

def test_concurrent_frontend_telemetry_reporting():
    def submit_telemetry(idx):
        with TestClient(app) as test_client:
            resp = test_client.post(
                "/api/v1/admin/monitoring/frontend-metrics",
                json={
                    "metric_type": "performance",
                    "path": f"/route-{idx}",
                    "duration_ms": 12.5 * idx,
                }
            )
            return resp.status_code

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(submit_telemetry, range(10)))

    assert len(results) == 10
    assert all(status == 200 for status in results)
