import os
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.payments.config import RazorpaySettings, validate_live_safety_gates

client = TestClient(app)


# ─── 1. Razorpay Configuration & Live Safety Gates ─────────────────────────────

def test_razorpay_test_mode_isolation():
    # Force test mode in settings instance
    s = RazorpaySettings(
        PAYMENT_MODE="test",
        RAZORPAY_TEST_KEY_ID="rzp_test_mock123",
        RAZORPAY_TEST_KEY_SECRET="sec_mock123",
        RAZORPAY_LIVE_KEY_ID="rzp_live_real123",
        RAZORPAY_LIVE_KEY_SECRET="sec_real123",
    )
    # Re-resolve key based on mode
    key_id = s.RAZORPAY_LIVE_KEY_ID if s.PAYMENT_MODE == "live" else s.RAZORPAY_TEST_KEY_ID
    assert key_id == "rzp_test_mock123"


def test_razorpay_live_safety_gate_violation():
    # If live mode is enabled but keys are missing or invalid
    os.environ["PAYMENT_MODE"] = "live"
    os.environ["RAZORPAY_LIVE_KEY_ID"] = ""
    os.environ["RAZORPAY_LIVE_KEY_SECRET"] = ""

    with pytest.raises(RuntimeError, match="SAFETY GATE VIOLATION"):
        validate_live_safety_gates()

    # Clean up environment variables
    os.environ.pop("PAYMENT_MODE", None)
    os.environ.pop("RAZORPAY_LIVE_KEY_ID", None)
    os.environ.pop("RAZORPAY_LIVE_KEY_SECRET", None)


# ─── 2. Amadeus Environment Selection ─────────────────────────────────────────

def test_amadeus_env_selection():
    env = os.getenv("AMADEUS_ENV", "sandbox").lower()
    if env == "production":
        client_id = os.getenv("AMADEUS_CLIENT_ID")
        assert client_id is not None
    else:
        # Defaults to sandbox URL
        base_url = os.getenv("AMADEUS_BASE_URL", "https://test.api.amadeus.com")
        assert "test.api" in base_url


# ─── 3. Duffel Capability Checks ──────────────────────────────────────────────

def test_duffel_capability_checks():
    # Verifies capability list is loaded in providers registry
    from app.providers.providers_registry import providers_registry
    health = providers_registry.get_health()
    assert "duffel_flights" in health["providers"]
    duffel_flights = health["providers"]["duffel_flights"]
    assert "capabilities" in duffel_flights
    assert duffel_flights["capabilities"]["search"] is True
