import pytest
from app.providers.hotels.hotelbeds import HotelBedsProvider
from app.services.activities_service import activities_service
from app.services.currency import CurrencyService
from app.services.esim_service import esim_service
from app.services.insurance import insurance_service
from app.services.visa_service import visa_service
from app.services.storage import storage_provider

# ─── HotelBeds Provider Tests ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_hotelbeds_provider_signature_and_search():
    """Hotelbeds provider computes signature hashes and resolves properties."""
    provider = HotelBedsProvider()
    assert len(provider._generate_signature()) == 64
    
    offers = await provider.search("Goa", "2026-08-10", "2026-08-15")
    assert len(offers) > 0
    assert offers[0].provider_name == "HotelBeds"


# ─── Viator Activities Service Tests ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_activities_service_fallback():
    """Viator activities service returns valid list structure during fallback."""
    results = await activities_service.search_activities("Delhi", "Museum")
    assert len(results) > 0
    assert "ACT-GYG" in results[0]["id"] or "ACT-VIATOR" in results[0]["id"]


# ─── Forex Exchange Rates Sync Tests ──────────────────────────────────────────

def test_forex_rates_fetch():
    """Forex service successfully returns base relative exchange rates."""
    rates = CurrencyService.sync_rates()
    assert "INR" in rates
    assert rates["INR"] == 1.0
    assert "USD" in rates


# ─── Airalo eSIM plans Tests ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_esim_service_list():
    """eSIM service lists international packages."""
    plans = await esim_service.list_plans("USA")
    assert len(plans) > 0
    assert "plan_name" in plans[0]


# ─── Tata AIG / ICICI Insurance Tests ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_insurance_service_issue():
    """Insurance service maps Tata AIG and ICICI adapters."""
    policy = await insurance_service.purchase_policy(
        provider_name="Tata AIG",
        plan_name="Gold Secure",
        destination="France",
        passenger_name="John Doe",
        duration_days=10
    )
    assert policy["success"] is True
    assert "POL-TA-" in policy["policy_number"]
    assert policy["provider_name"] == "Tata AIG"


# ─── Sherpa Visa Requirements Tests ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_visa_service_lookup():
    """Visa service resolves country visa document requirements."""
    rules = await visa_service.get_visa_rules("france")
    assert rules["country"] == "France"
    assert "Passport (Valid > 6 months)" in rules["required_documents"]


# ─── S3 Storage Provider Tests ────────────────────────────────────────────────

def test_s3_storage_provider_upload():
    """S3 storage provider handles upload and deletes gracefully with fallback."""
    url, blur = storage_provider.save_file(b"test_image_data", "test.png")
    assert url is not None
    assert blur is not None
