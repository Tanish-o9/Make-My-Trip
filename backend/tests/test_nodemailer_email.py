import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.services.communication import NodemailerEmailProvider, SendGridClient, get_email_provider
from app.models.core import User, EmailVerification
from app.auth.jwt import hash_password

client = TestClient(app)

# ─── Mock Helpers ─────────────────────────────────────────────────────────────

def _make_mock_response(status_code: int, json_data: dict):
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = json_data
    mock_resp.raise_for_status = MagicMock()
    if status_code >= 400:
        from httpx import HTTPStatusError, Request
        req = Request("POST", "http://test")
        mock_resp.raise_for_status.side_effect = HTTPStatusError("Error", request=req, response=mock_resp)
    return mock_resp


# ─── Tests ────────────────────────────────────────────────────────────────────

def test_nodemailer_missing_credentials():
    """Verify that Nodemailer provider returns failure when environment variables are missing."""
    with patch.dict(os.environ, {"EMAIL_SERVICE_URL": "", "EMAIL_SERVICE_SECRET": ""}):
        provider = NodemailerEmailProvider()
        res = provider.send_email(
            to_email="test@example.com",
            subject="Test",
            body="Test body"
        )
        assert res["success"] is False
        assert "SMTP configuration is incomplete" in res["error"]


def test_nodemailer_secret_validation():
    """Verify secret token header authentication validation between FastAPI and Node."""
    with patch.dict(os.environ, {
        "EMAIL_SERVICE_URL": "http://email-service:3005",
        "EMAIL_SERVICE_SECRET": "wrong_secret"
    }):
        provider = NodemailerEmailProvider()
        mock_resp = _make_mock_response(401, {"success": False, "error": "Unauthorized"})
        
        with patch("httpx.post", return_value=mock_resp) as mock_post:
            res = provider.send_email(
                to_email="test@example.com",
                subject="Test",
                body="Test body"
            )
            assert res["success"] is False
            assert "Invalid email-service secret" in res["error"]
            mock_post.assert_called_once()
            headers = mock_post.call_args[1]["headers"]
            assert headers["X-Email-Service-Secret"] == "wrong_secret"


def test_nodemailer_successful_verification_email():
    """Verify standard Nodemailer send verification email request succeeds."""
    with patch.dict(os.environ, {
        "EMAIL_SERVICE_URL": "http://email-service:3005",
        "EMAIL_SERVICE_SECRET": "correct_secret"
    }):
        provider = NodemailerEmailProvider()
        mock_resp = _make_mock_response(200, {"success": True, "message_id": "nodemailer-msg-id-123"})
        
        with patch("httpx.post", return_value=mock_resp) as mock_post:
            res = provider.send_email(
                to_email="test@example.com",
                subject="Verify",
                body="Verification code: 123456",
                otp_code="123456",
                purpose="email_verification"
            )
            assert res["success"] is True
            assert res["email_id"] == "nodemailer-msg-id-123"
            mock_post.assert_called_once()
            payload = mock_post.call_args[1]["json"]
            assert payload["otp"] == "123456"
            assert payload["email"] == "test@example.com"


def test_nodemailer_smtp_failure():
    """Verify SMTP connection or health failure inside Node.js is handled correctly."""
    with patch.dict(os.environ, {
        "EMAIL_SERVICE_URL": "http://email-service:3005",
        "EMAIL_SERVICE_SECRET": "correct_secret"
    }):
        provider = NodemailerEmailProvider()
        mock_resp = _make_mock_response(500, {"success": False, "error": "SMTP connection failed"})
        
        with patch("httpx.post", return_value=mock_resp):
            res = provider.send_email(
                to_email="test@example.com",
                subject="Verify",
                body="Verification code: 123456",
                otp_code="123456",
                purpose="email_verification"
            )
            assert res["success"] is False
            assert "SMTP connection failed" in res["error"]


def test_signup_email_delivery_failure():
    """Verify that a failure in Nodemailer delivery causes signup to return 500 error."""
    with patch.dict(os.environ, {
        "EMAIL_PROVIDER": "nodemailer",
        "EMAIL_SERVICE_URL": "http://email-service:3005",
        "EMAIL_SERVICE_SECRET": "correct_secret"
    }):
        mock_resp = _make_mock_response(500, {"success": False, "error": "SMTP delivery failed"})
        
        with patch("httpx.post", return_value=mock_resp):
            # Try to register a new user
            resp = client.post("/api/v1/auth/signup", json={
                "full_name": "Failure User",
                "email": "delivery_fail@example.com",
                "password": "SecurePassWord123!",
                "phone": "8888888888"
            })
            assert resp.status_code == 500
            assert "Unable to send the verification code" in resp.json()["detail"]


def test_forgot_password_email_delivery_failure(db_session):
    """Verify forgot-password raises 500 error when Nodemailer service is down."""
    # Seed user in DB
    email = "forgot_fail@example.com"
    existing = db_session.query(User).filter(User.email == email).first()
    if not existing:
        user = User(email=email, password_hash=hash_password("SecurePass1!"), email_verified=True)
        db_session.add(user)
        db_session.commit()

    with patch.dict(os.environ, {
        "EMAIL_PROVIDER": "nodemailer",
        "EMAIL_SERVICE_URL": "http://email-service:3005",
        "EMAIL_SERVICE_SECRET": "correct_secret"
    }):
        mock_resp = _make_mock_response(500, {"success": False, "error": "Connection Timeout"})
        with patch("httpx.post", return_value=mock_resp):
            resp = client.post("/api/v1/auth/forgot-password", json={"email": email})
            assert resp.status_code == 500
            assert "Unable to send the verification code" in resp.json()["detail"]


@pytest.fixture
def db_session():
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
