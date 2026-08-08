import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import hash_password
from unittest.mock import patch

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_user():
    db = SessionLocal()
    user = db.query(User).filter(User.email == "cors_test@travelos.com").first()
    if not user:
        user = User(
            email="cors_test@travelos.com",
            password_hash=hash_password("corspassword"),
            role="user",
            preferred_language="en",
            preferred_currency="INR"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    yield user
    db.close()


def test_cors_options_preflight_production_origin():
    """Verify that OPTIONS preflight request from the Vercel production origin is allowed with correct headers"""
    headers = {
        "Origin": "https://make-my-trip-delta.vercel.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, x-device-id"
    }
    resp = client.options("/api/v1/auth/token", headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "https://make-my-trip-delta.vercel.app"
    assert resp.headers.get("access-control-allow-credentials") == "true"
    allow_methods = resp.headers.get("access-control-allow-methods", "").split(", ")
    assert "POST" in allow_methods
    allow_headers = [h.strip().lower() for h in resp.headers.get("access-control-allow-headers", "").split(",")]
    assert "content-type" in allow_headers
    assert "x-device-id" in allow_headers


def test_cors_options_preflight_local_origin():
    """Verify that OPTIONS preflight request from localhost is allowed with correct headers"""
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    resp = client.options("/api/v1/auth/token", headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert resp.headers.get("access-control-allow-credentials") == "true"


def test_cors_post_auth_token_success():
    """Verify that a successful login POST contains the correct CORS headers"""
    headers = {
        "Origin": "https://make-my-trip-delta.vercel.app"
    }
    data = {
        "username": "cors_test@travelos.com",
        "password": "corspassword"
    }
    resp = client.post("/api/v1/auth/token", data=data, headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "https://make-my-trip-delta.vercel.app"
    assert resp.headers.get("access-control-allow-credentials") == "true"


def test_cors_post_auth_token_invalid_credentials():
    """Verify that an unauthorized login attempt returns 401 with correct CORS headers"""
    headers = {
        "Origin": "https://make-my-trip-delta.vercel.app"
    }
    data = {
        "username": "cors_test@travelos.com",
        "password": "wrongpassword"
    }
    resp = client.post("/api/v1/auth/token", data=data, headers=headers)
    assert resp.status_code == 401
    assert resp.headers.get("access-control-allow-origin") == "https://make-my-trip-delta.vercel.app"
    assert resp.headers.get("access-control-allow-credentials") == "true"


def test_cors_post_auth_token_missing_credentials():
    """Verify that a validation failure (422) returns correct CORS headers"""
    headers = {
        "Origin": "https://make-my-trip-delta.vercel.app"
    }
    data = {
        "username": "cors_test@travelos.com"
    }
    resp = client.post("/api/v1/auth/token", data=data, headers=headers)
    assert resp.status_code == 422
    assert resp.headers.get("access-control-allow-origin") == "https://make-my-trip-delta.vercel.app"
    assert resp.headers.get("access-control-allow-credentials") == "true"


def test_cors_rate_limiting_options_bypass():
    """Verify that preflight OPTIONS requests bypass rate limiting entirely"""
    headers = {
        "Origin": "https://make-my-trip-delta.vercel.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    # Call OPTIONS 15 times, which is more than the auth limit of 10
    for _ in range(15):
        resp = client.options("/api/v1/auth/token", headers=headers)
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "https://make-my-trip-delta.vercel.app"


@patch("app.utils.tenant_context.SessionLocal")
def test_tenant_middleware_options_bypass(mock_session):
    """Verify that tenant isolation middleware is bypassed for OPTIONS and does not perform database queries"""
    headers = {
        "Origin": "https://make-my-trip-delta.vercel.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    resp = client.options("/api/v1/auth/token", headers=headers)
    assert resp.status_code == 200
    # Ensure SessionLocal was not called (which means no DB lookup was done)
    mock_session.assert_not_called()
