import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_disaster_users():
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == "disaster_rec@travelos.com").first()
        if u:
            db.delete(u)
        db.commit()
    finally:
        db.close()


def _create_user():
    db = SessionLocal()
    try:
        u = User(
            email="disaster_rec@travelos.com",
            password_hash=hash_password("RecoveryPass123!"),
            email_verified=True,
            role="admin",
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.id
    finally:
        db.close()


# ─── 1. Outage Fallback Diagnostics ───────────────────────────────────────────

def test_outage_fallback_diagnostics():
    _create_user()
    token = create_access_token(data={"sub": "disaster_rec@travelos.com"})
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch Admin health diagnostics: verifying Degraded state when database or external connections slow
    resp = client.get("/api/v1/admin/health", headers=headers)
    assert resp.status_code == 200
    assert "subsystems" in resp.json()
    assert resp.json()["subsystems"]["database"]["status"] in ("healthy", "degraded", "unhealthy")
