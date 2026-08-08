import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.saas import BetaFeedback
from app.models.core import User

client = TestClient(app)

@pytest.fixture(scope="module")
def beta_user_setup():
    """Seeds test administrator user."""
    db = SessionLocal()
    db.query(BetaFeedback).delete()
    
    # Check if test admin exists
    admin = db.query(User).filter(User.email == "admin@travelos.com").first()
    if not admin:
            admin = User(
                email="admin@travelos.com",
                role="admin",
                password_hash="mock_hash_pbkdf2"
            )
            db.add(admin)
            db.commit()
    db.close()
    yield
    db2 = SessionLocal()
    db2.query(BetaFeedback).delete()
    db2.commit()
    db2.close()


# ─── Beta Feedback Tests ─────────────────────────────────────────────────────

def test_feedback_submission_and_retrieval(beta_user_setup):
    """Users submit beta bugs and admins retrieve them."""
    # We can mock authentication login or inject headers
    # Create simple login request representation
    login_payload = {
        "username": "admin@travelos.com",
        "password": "mock_password"
    }
    # To bypass auth dependencies, we can inject a mock authentication check or use a pre-existing token
    # Let's request the endpoint directly. Under TestClient, we can mock current user by mapping custom override
    from app.auth.dependencies import get_current_user
    
    # Overriding dependency
    db = SessionLocal()
    admin_user = db.query(User).filter(User.email == "admin@travelos.com").first()
    db.close()
    
    app.dependency_overrides[get_current_user] = lambda: admin_user

    # Submit feedback
    payload = {
        "feedback_type": "bug",
        "message": "The calendar select button overlaps with search button on mobile viewports.",
        "screenshot_url": "https://img.imageshack.us/img1234.png"
    }
    resp = client.post("/api/v1/feedback/submit", json=payload)
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert "feedback_id" in resp.json()

    # Retrieve feedback
    resp2 = client.get("/api/v1/feedback/list")
    assert resp2.status_code == 200
    assert len(resp2.json()) == 1
    assert resp2.json()[0]["feedback_type"] == "bug"
    assert resp2.json()[0]["message"] == payload["message"]

    # Clear override
    app.dependency_overrides.clear()
