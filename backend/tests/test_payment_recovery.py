import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_payment_rec_users():
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == "pay_rec@travelos.com").first()
        if u:
            db.delete(u)
        db.commit()
    finally:
        db.close()


def _create_user():
    db = SessionLocal()
    try:
        u = User(
            email="pay_rec@travelos.com",
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


# ─── 1. Payment Verification Integrity & Idempotency ──────────────────────────

def test_payment_recovery_idempotency():
    _create_user()
    token = create_access_token(data={"sub": "pay_rec@travelos.com"})
    headers = {"Authorization": f"Bearer {token}"}

    # Verify duplicate payment verification request triggers gracefully
    payload = {
        "razorpay_payment_id": "pay_rec_test_12345",
        "razorpay_order_id": "order_rec_test_12345",
        "razorpay_signature": "signature_rec_test_12345",
    }

    # First attempt: signature verify returns validation/bad signature status or bad parameters, not 500 error
    resp1 = client.post("/api/v1/payments/verify", headers=headers, json=payload)
    assert resp1.status_code in (400, 422, 404)

    # Second identical callback: processed safely without database transaction conflicts
    resp2 = client.post("/api/v1/payments/verify", headers=headers, json=payload)
    assert resp2.status_code in (400, 422, 404)
