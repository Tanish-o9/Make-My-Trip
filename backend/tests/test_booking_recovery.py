import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_booking_rec_users():
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == "book_rec@travelos.com").first()
        if u:
            db.delete(u)
        db.commit()
    finally:
        db.close()


def _create_user():
    db = SessionLocal()
    try:
        u = User(
            email="book_rec@travelos.com",
            password_hash=hash_password("RecoveryPass123!"),
            email_verified=True,
            role="user",
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.id
    finally:
        db.close()


# ─── 1. Hold State Verification ───────────────────────────────────────────────

def test_booking_hold_expiry_recovery():
    _create_user()
    token = create_access_token(data={"sub": "book_rec@travelos.com"})
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt confirmation with empty or non-existent booking reference
    resp = client.post(
        "/api/v1/bookings/confirm",
        headers=headers,
        json={"booking_reference": "TOS-FL-EXPIRED-HOLD"},
    )
    # Expiry/not found causes bad request or unprocessable entity status
    assert resp.status_code in (400, 422, 404)
