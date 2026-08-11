import concurrent.futures
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)


@pytest.fixture(scope="module")
def race_users():
    """Create test users for concurrency race condition checks."""
    db = SessionLocal()
    emails = ["race_tester_a@travelos.com", "race_tester_b@travelos.com"]
    for email in emails:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                password_hash=hash_password("RaceTestSecurePass123!"),
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


# ─── 1. Concurrent Payment Verification & Callback Race ────────────────────────

def test_concurrent_payment_verification_callback(race_users):
    token = create_access_token(data={"sub": race_users[0]})
    headers = {"Authorization": f"Bearer {token}"}

    def verify_payment(payload):
        with TestClient(app) as test_client:
            resp = test_client.post(
                "/api/v1/payments/verify",
                headers=headers,
                json=payload
            )
            return resp.status_code

    # Simulate two identical verification verification callback triggers concurrently
    verification_payload = {
        "razorpay_payment_id": "pay_dup_verification_12345",
        "razorpay_order_id": "order_dup_verification_12345",
        "razorpay_signature": "signature_verification_12345",
    }

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(verify_payment, verification_payload),
            executor.submit(verify_payment, verification_payload),
        ]
        results = [f.result() for f in futures]

    # Exactly one transition or clean rejects on duplicate callbacks (validation error/invalid signatures/not found)
    # The key is that they do not result in raw uncaught 500 database crashes.
    assert all(status in (400, 422, 404, 500) for status in results)
    assert 500 not in results
