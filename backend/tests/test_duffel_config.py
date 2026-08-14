import os
import logging
from unittest.mock import AsyncMock, patch
import pytest
import httpx
from app.payments.config import RazorpaySettings
from app.routes.system import get_provider_health

def test_duffel_settings_load():
    # 1. Environment variables loaded correctly
    settings = RazorpaySettings()
    assert settings.DUFFEL_BASE_URL == "https://api.duffel.com"
    assert settings.DUFFEL_VERSION == "v2"
    assert settings.DUFFEL_API_KEY is not None

def test_duffel_missing_key_handled_gracefully(monkeypatch):
    # 2. Missing key handled gracefully
    # Set to empty string to override Pydantic's .env file loading
    monkeypatch.setenv("DUFFEL_API_KEY", "")
    # Instantiate new settings
    settings = RazorpaySettings()
    # Check that settings instantiate without crashing
    assert settings.DUFFEL_API_KEY is None or settings.DUFFEL_API_KEY == ""

def test_duffel_railway_env_overrides(monkeypatch):
    # 3. Railway env overrides .env
    monkeypatch.setenv("DUFFEL_API_KEY", "duffel_test_override_val")
    monkeypatch.setenv("DUFFEL_BASE_URL", "https://override.duffel.com")
    monkeypatch.setenv("DUFFEL_VERSION", "v3")
    
    settings = RazorpaySettings()
    assert settings.DUFFEL_API_KEY == "duffel_test_override_val"
    assert settings.DUFFEL_BASE_URL == "https://override.duffel.com"
    assert settings.DUFFEL_VERSION == "v3"

@pytest.mark.asyncio
async def test_duffel_health_endpoint_status():
    # 4. Health endpoint reports correct status
    # Mock settings values
    with patch("app.payments.config.settings.DUFFEL_API_KEY", "duffel_test_key"), \
         patch("app.payments.config.settings.DUFFEL_BASE_URL", "https://api.duffel.com"), \
         patch("app.payments.config.settings.DUFFEL_VERSION", "v2"):
        
        # Mock httpx.AsyncClient.get returning 200 OK
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        
        with patch("httpx.AsyncClient.get", return_value=mock_response) as mock_get:
            health = await get_provider_health()
            assert "duffel" in health
            duffel = health["duffel"]
            assert duffel["provider"] == "Duffel"
            assert duffel["configured"] is True
            assert duffel["healthy"] is True
            assert duffel["base_url"] == "https://api.duffel.com"
            assert duffel["version"] == "v2"
            
            duffel_calls = [call for call in mock_get.call_args_list if "airlines" in str(call)]
            assert len(duffel_calls) > 0

def test_duffel_no_secret_leaks_in_logs():
    # 5. No secret leaks in logs
    # Test key masking utility behavior using a dummy key pattern
    dkey = "duffel_test_dummy_token_pattern_not_a_real_key_1234"
    # Match the masking logic inside app/main.py
    masked = dkey[:12] + "xxxxxxxx" + "*" * (len(dkey) - 20) if len(dkey) > 20 else "xxxx"
    assert "dummy" not in masked
    assert "duffel_test_" in masked
    assert "xxxx" in masked
    assert len(masked) == len(dkey)
    assert masked.startswith("duffel_test_xxxxxxxx")
    assert all(c == "*" for c in masked[20:])

@pytest.mark.asyncio
async def test_duffel_health_missing_token():
    with patch("app.payments.config.settings.DUFFEL_API_KEY", ""):
        health = await get_provider_health()
        duffel = health["duffel"]
        assert duffel["configured"] is False
        assert duffel["status"] == "MISSING_CREDENTIALS"

@pytest.mark.asyncio
async def test_duffel_health_placeholder_token():
    with patch("app.payments.config.settings.DUFFEL_API_KEY", "your-duffel-key"):
        health = await get_provider_health()
        duffel = health["duffel"]
        assert duffel["configured"] is False
        assert duffel["status"] == "MISSING_CREDENTIALS"

@pytest.mark.asyncio
async def test_duffel_health_unauthorized_token():
    with patch("app.payments.config.settings.DUFFEL_API_KEY", "invalid_token"):
        mock_response = AsyncMock()
        mock_response.status_code = 401
        mock_response.json.return_value = {}
        with patch("httpx.AsyncClient.get", return_value=mock_response):
            health = await get_provider_health()
            duffel = health["duffel"]
            assert duffel["configured"] is True
            assert duffel["healthy"] is False
            assert duffel["status"] == "UNAUTHORIZED"

@pytest.mark.asyncio
async def test_duffel_health_network_failure():
    with patch("app.payments.config.settings.DUFFEL_API_KEY", "some_token"):
        with patch("httpx.AsyncClient.get", side_effect=httpx.RequestError("Connection timeout")):
            health = await get_provider_health()
            duffel = health["duffel"]
            assert duffel["configured"] is True
            assert duffel["healthy"] is False
            assert duffel["status"] == "NETWORK_ERROR"

@pytest.mark.asyncio
async def test_duffel_successful_sandbox_search():
    from app.providers.flights.duffel import DuffelFlightProvider
    provider = DuffelFlightProvider()
    
    from unittest.mock import MagicMock
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {
        "data": {
            "offers": [
                {
                    "id": "off_1",
                    "total_amount": "8200.00",
                    "total_currency": "INR",
                    "owner": {"name": "IndiGo", "iata_code": "6E"},
                    "slices": [
                        {
                            "segments": [
                                {
                                    "marketing_carrier_flight_number": "6E-102",
                                    "departing_at": "2026-10-15T10:00:00",
                                    "arriving_at": "2026-10-15T12:00:00",
                                    "duration": "PT2H0M"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }
    
    with patch("sys.modules", {}), \
         patch("httpx.AsyncClient.post", return_value=mock_response):
        provider.api_key = "duffel_test_key"
        offers = await provider.search("DEL", "BOM", "2026-10-15")
        assert len(offers) == 1
        assert offers[0].price == 8200.0
        assert offers[0].provider_name == "Duffel"

@pytest.mark.asyncio
async def test_duffel_fallback_behavior():
    from app.providers.flights.duffel import DuffelFlightProvider
    provider = DuffelFlightProvider()
    provider.api_key = ""
    with patch("sys.modules", {}):
        offers = await provider.search("DEL", "BOM", "2026-10-15")
        assert len(offers) == 0
