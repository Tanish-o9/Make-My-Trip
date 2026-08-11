import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_recovery_test_users():
    db = SessionLocal()
    try:
        for email in ["rec_admin@travelos.com", "rec_user@travelos.com"]:
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.delete(u)
        db.commit()
    finally:
        db.close()


def _create_user(email, role="admin"):
    db = SessionLocal()
    try:
        u = User(
            email=email,
            password_hash=hash_password("RecoveryPass123!"),
            email_verified=True,
            role=role,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.id
    finally:
        db.close()


# ─── 1. Backup, Restore & Status Retrieval ────────────────────────────────────

def test_backup_restore_and_status():
    _create_user("rec_admin@travelos.com", role="admin")
    token = create_access_token(data={"sub": "rec_admin@travelos.com"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Trigger backup
    resp_b = client.post("/api/v1/admin/recovery/backup/trigger", headers=headers)
    assert resp_b.status_code == 200
    assert resp_b.json()["success"] is True
    details = resp_b.json()["backup_details"]
    assert "checksum" in details
    assert "size_bytes" in details

    # 2. Verify Restore Integrity
    resp_r = client.post("/api/v1/admin/recovery/restore/verify", headers=headers)
    assert resp_r.status_code == 200
    assert resp_r.json()["success"] is True
    assert resp_r.json()["restore_details"]["status"] == "PASSED"

    # 3. Retrieve Recovery dashboard status
    resp_s = client.get("/api/v1/admin/recovery", headers=headers)
    assert resp_s.status_code == 200
    assert resp_s.json()["backup_health"] == "HEALTHY"
    assert "rpo" in resp_s.json()


# ─── 2. Access Control Security ───────────────────────────────────────────────

def test_recovery_access_control():
    # 1. Anonymous forbidden (401)
    resp_anon = client.get("/api/v1/admin/recovery")
    assert resp_anon.status_code == 401

    # 2. Normal customer forbidden (403)
    _create_user("rec_user@travelos.com", role="user")
    token_user = create_access_token(data={"sub": "rec_user@travelos.com"})
    resp_user = client.get("/api/v1/admin/recovery", headers={"Authorization": f"Bearer {token_user}"})
    assert resp_user.status_code == 403
