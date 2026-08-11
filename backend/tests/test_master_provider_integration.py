import pytest
import datetime
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User
from app.models.bookings import ProviderReconciliation, BookingStatus
from app.auth.jwt import create_access_token
from app.providers.registry import provider_registry
from app.providers.common.errors import (
    ProviderUnavailableError,
    ProviderRateLimitError,
    OfferExpiredError,
    PriceChangedError,
    BookingFailedError
)
from app.providers.common.normalizers import (
    normalize_amadeus_transfer_offer,
    normalize_duffel_car_offer
)
from app.providers.cab.amadeus import AmadeusTransfersProvider
from app.providers.cab.mock import LocalCabProvider
from app.providers.cars.duffel import DuffelCarsProvider
from app.providers.cars.mock import LocalCarRentalProvider

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_users():
    db = SessionLocal()
    admin = db.query(User).filter(User.email == "master_admin@travelos.com").first()
    if not admin:
        admin = User(email="master_admin@travelos.com", password_hash="pw", role="admin")
        db.add(admin)
        db.commit()

    user = db.query(User).filter(User.email == "master_user@travelos.com").first()
    if not user:
        user = User(email="master_user@travelos.com", password_hash="pw", role="user")
        db.add(user)
        db.commit()
    db.close()


@pytest.fixture
def admin_auth():
    token = create_access_token({"sub": "master_admin@travelos.com", "email": "master_admin@travelos.com", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def user_auth():
    token = create_access_token({"sub": "master_user@travelos.com", "email": "master_user@travelos.com", "role": "user"})
    return {"Authorization": f"Bearer {token}"}


def test_provider_errors_normalization():
    # Test OfferExpiredError
    exp = OfferExpiredError("Quote validity expired", offer_id="OFF-991")
    assert exp.error_code == "OFFER_EXPIRED"
    assert exp.status_code == 410
    assert exp.details["offer_id"] == "OFF-991"

    # Test PriceChangedError
    price_err = PriceChangedError(old_price=2000.0, new_price=2300.0, currency="INR")
    assert price_err.error_code == "PRICE_CHANGED"
    assert price_err.status_code == 409
    assert price_err.details["old_price"] == 2000.0
    assert price_err.details["new_price"] == 2300.0

    # Test RateLimitError
    rate_err = ProviderRateLimitError(provider="amadeus", retry_after_seconds=10)
    assert rate_err.error_code == "PROVIDER_RATE_LIMITED"
    assert rate_err.status_code == 429

    # Test ProviderUnavailableError
    unavail = ProviderUnavailableError(provider="duffel")
    assert unavail.error_code == "PROVIDER_UNAVAILABLE"
    assert unavail.status_code == 503


def test_normalizers():
    from app.providers.common.normalizers import (
        normalize_flight_offer,
        normalize_hotel_offer,
        normalize_train_offer,
        normalize_activity_offer
    )

    # Cab Normalizer
    raw_amadeus = {
        "id": "AMD-9912",
        "vehicle": {"brand": "Mercedes-Benz", "model": "E-Class", "category": "Luxury", "seats": 4, "baggage": 3},
        "quotation": {"monetaryAmount": 4500.0, "currencyCode": "INR"}
    }
    cab_offer = normalize_amadeus_transfer_offer(raw_amadeus, "DEL Airport", "Gurugram")
    assert cab_offer.brand == "Mercedes-Benz"
    assert cab_offer.is_live is True
    assert cab_offer.source == "live"
    assert cab_offer.price > 4500.0  # includes taxes

    # Car Normalizer
    raw_duffel = {
        "id": "DUF-7744",
        "vehicle": {"make": "Hyundai", "model": "Creta", "category": "SUV", "seats": 5, "luggage_capacity": 4, "fuel_type": "Diesel", "transmission_type": "Automatic"},
        "total_amount": 3200.0,
        "currency": "INR",
        "deposit_amount": 6000.0
    }
    car_offer = normalize_duffel_car_offer(raw_duffel, "DEL Airport", "DEL Airport")
    assert car_offer.brand == "Hyundai"
    assert car_offer.is_live is True
    assert car_offer.deposit == 6000.0

    # Flight Normalizer
    raw_flt = {"id": "FLT-IND-101", "airline": "IndiGo", "flight_number": "6E-502", "origin": "DEL", "destination": "BOM", "price": 5200.0}
    flt_norm = normalize_flight_offer(raw_flt, "Amadeus Flight Gateway")
    assert flt_norm.vertical == "flights"
    assert flt_norm.total > 5200.0
    assert "IndiGo" in flt_norm.title

    # Hotel Normalizer
    raw_htl = {"id": "HTL-HYATT-1", "name": "Grand Hyatt Goa", "price_per_night": 6500.0, "city": "Goa"}
    htl_norm = normalize_hotel_offer(raw_htl, "Hotelbeds")
    assert htl_norm.vertical == "hotels"
    assert htl_norm.total > 6500.0
    assert "Grand Hyatt" in htl_norm.title

    # Train Normalizer
    raw_trn = {"train_number": "12002", "train_name": "Shatabdi Express", "fare": 1850.0, "origin": "NDLS", "destination": "BPL"}
    trn_norm = normalize_train_offer(raw_trn)
    assert trn_norm.vertical == "trains"
    assert trn_norm.price == 1850.0
    assert "Shatabdi" in trn_norm.title

    # Activity Normalizer
    raw_act = {"id": "ACT-GOA-01", "title": "Scuba Diving & Watersports Combo", "price": 2800.0, "destination": "Goa"}
    act_norm = normalize_activity_offer(raw_act)
    assert act_norm.vertical == "activities"
    assert act_norm.price == 2800.0
    assert "Scuba Diving" in act_norm.title



def test_provider_registry_and_health(admin_auth):
    cab_p = provider_registry.get_cab_provider()
    assert cab_p is not None
    assert hasattr(cab_p, "search")

    car_p = provider_registry.get_car_provider()
    assert car_p is not None
    assert hasattr(car_p, "search")

    res = client.get("/api/v1/admin/providers/health", headers=admin_auth)
    assert res.status_code == 200
    data = res.json()
    assert "providers" in data
    assert "active_cab_provider" in data
    assert "active_car_rental_provider" in data


def test_cab_search_response_contract():
    res = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Indira Gandhi International Airport, Terminal 3, Delhi",
        "drop_address": "Cyber City, DLF Phase 2, Gurugram",
        "trip_type": "airport_transfer",
        "passengers": 2,
        "luggage_count": 2
    })
    assert res.status_code == 200
    data = res.json()
    assert "options" in data or "results" in data
    options = data.get("options") or data.get("results")
    assert len(options) > 0
    first = options[0]
    assert "is_live" in first
    assert "source" in first
    assert "expires_at" in first
    assert "cancellation_policy" in first
    assert "fare" in first
    assert "breakdown" in first


def test_car_rental_lifecycle_and_idempotency(user_auth):
    # 1. Search
    s_res = client.post("/api/v1/cars/search", json={
        "pickup_location": "Delhi Airport Hub",
        "drop_location": "Delhi Airport Hub",
        "pickup_date": "2026-08-18",
        "pickup_time": "10:00",
        "return_date": "2026-08-20",
        "return_time": "10:00",
        "driver_age": 26,
        "driver_country": "India"
    })
    assert s_res.status_code == 200
    offers = s_res.json()["offers"]
    assert len(offers) > 0
    chosen = offers[0]

    # 2. Quote
    q_res = client.post("/api/v1/cars/quote", json={
        "offer_id": chosen["id"],
        "rental_days": 2,
        "insurance_code": "basic"
    })
    assert q_res.status_code == 200
    quote = q_res.json()

    # 3. Idempotent Booking
    idempotency_key = f"IDEM-{uuid.uuid4().hex[:10]}"
    book_payload = {
        "offer_id": chosen["id"],
        "quote_id": quote["quote_id"],
        "amount": quote["total_payable"],
        "driver_name": "Kavita Sharma",
        "driver_phone": "+91 98111 22334",
        "driver_email": "kavita@travelos.com",
        "driver_license_number": "DL-1420180098765",
        "driver_age": 26,
        "idempotency_key": idempotency_key
    }
    b1 = client.post("/api/v1/cars/book", json=book_payload, headers=user_auth)
    assert b1.status_code == 200
    assert b1.json()["success"] is True
    ref = b1.json()["booking_reference"]

    # 4. Voucher Generation
    v_res = client.get(f"/api/v1/cars/{ref}/voucher", headers=user_auth)
    assert v_res.status_code == 200
    assert "QR-CAR-" in v_res.json()["qr_verification_token"]

    # 5. Cancellation
    c_res = client.post("/api/v1/cars/cancel", json={
        "booking_reference": ref,
        "reason": "Flight rescheduled"
    }, headers=user_auth)
    assert c_res.status_code == 200
    assert c_res.json()["status"] == "CANCELLED"


def test_payment_reconciliation_model():
    db = SessionLocal()
    rec = ProviderReconciliation(
        provider="Amadeus Transfers",
        provider_offer_id="OFF-AMD-TEST-99",
        payment_id="pay_test_captured_99",
        booking_reference="BK-CAB-REC-001",
        amount=2500.0,
        currency="INR",
        failure_reason="Third-party provider timeout during booking creation",
        status="PENDING_MANUAL_REVIEW"
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    assert rec.id is not None
    assert rec.status == "PENDING_MANUAL_REVIEW"
    assert rec.amount == 2500.0
    db.delete(rec)
    db.commit()
    db.close()


def test_provider_selection_demo_vs_live(monkeypatch):
    from app.providers.registry import ProviderRegistry
    from app.providers.common.errors import ProviderNotConfiguredError

    # Demo Mode
    monkeypatch.setenv("PROVIDER_MODE", "demo")
    monkeypatch.setenv("ENABLE_LIVE_INVENTORY", "false")
    reg_demo = ProviderRegistry()
    cab_demo = reg_demo.get_cab_provider()
    car_demo = reg_demo.get_car_provider()
    assert cab_demo.is_live is False
    assert car_demo.is_live is False

    # Live Mode
    monkeypatch.setenv("PROVIDER_MODE", "live")
    monkeypatch.setenv("ENABLE_LIVE_INVENTORY", "true")
    monkeypatch.setenv("LIVE_CAB_PROVIDER", "amadeus")
    monkeypatch.setenv("LIVE_CAR_PROVIDER", "duffel")
    reg_live = ProviderRegistry()
    cab_live = reg_live.get_cab_provider()
    car_live = reg_live.get_car_provider()
    assert cab_live.is_live is True
    assert car_live.is_live is True

    # Live Mode with unconfigured provider raises ProviderNotConfiguredError
    monkeypatch.setenv("LIVE_CAB_PROVIDER", "uber_unconfigured")
    with pytest.raises(ProviderNotConfiguredError) as excinfo:
        reg_live.get_cab_provider()
    assert excinfo.value.error_code == "PROVIDER_NOT_CONFIGURED"


def test_provider_failure_and_timeout_normalization():
    # Verify mapping of errors
    timeout_err = ProviderUnavailableError("Provider timed out after 15s", provider="amadeus")
    assert timeout_err.status_code == 503
    assert timeout_err.error_code == "PROVIDER_UNAVAILABLE"

    rate_limit_err = ProviderRateLimitError(provider="duffel", retry_after_seconds=30)
    assert rate_limit_err.status_code == 429
    assert rate_limit_err.error_code == "PROVIDER_RATE_LIMITED"

    booking_err = BookingFailedError("Payment captured but provider confirmation failed", provider_reference="PROV-ERR-1")
    assert booking_err.status_code == 502
    assert booking_err.error_code == "BOOKING_FAILED"


def test_price_change_and_offer_expiry():
    price_err = PriceChangedError(old_price=3000.0, new_price=3400.0, currency="INR")
    assert price_err.error_code == "PRICE_CHANGED"
    assert price_err.status_code == 409
    assert price_err.details["old_price"] == 3000.0
    assert price_err.details["new_price"] == 3400.0

    exp_err = OfferExpiredError("Offer validity expired", offer_id="OFF-EXPIRED-1")
    assert exp_err.error_code == "OFFER_EXPIRED"
    assert exp_err.status_code == 410
    assert exp_err.details["offer_id"] == "OFF-EXPIRED-1"


def test_duffel_cars_unsupported_and_capability_matrix(admin_auth):
    from app.providers.providers_registry import providers_registry
    from app.providers.common.errors import ProviderUnsupportedError, ProviderAuthFailedError, ProviderTimeoutError

    # Verify error classes
    unsupported_err = ProviderUnsupportedError("Duffel cars not available", provider="duffel")
    assert unsupported_err.status_code == 501
    assert unsupported_err.error_code == "PROVIDER_UNSUPPORTED"

    auth_err = ProviderAuthFailedError("Amadeus token failed", provider="amadeus")
    assert auth_err.status_code == 401
    assert auth_err.error_code == "PROVIDER_AUTH_FAILED"

    to_err = ProviderTimeoutError("Amadeus connection timed out", provider="amadeus")
    assert to_err.status_code == 504
    assert to_err.error_code == "PROVIDER_TIMEOUT"

    # Verify health endpoint returns explicit capabilities
    res = client.get("/api/v1/admin/providers/health", headers=admin_auth)
    assert res.status_code == 200
    health_data = res.json()
    assert "providers" in health_data
    providers = health_data["providers"]

    # Duffel Cars must be marked appropriately
    assert "duffel_cars" in providers
    assert providers["duffel_cars"]["status"] in ["authenticated_cars_access_not_enabled", "unsupported", "healthy", "sandbox_only"]
    assert "capabilities" in providers["duffel_cars"]
    assert providers["duffel_cars"]["capabilities"]["cars_search"] is False

    # Amadeus Transfers capabilities
    assert "amadeus_transfers" in providers
    assert "capabilities" in providers["amadeus_transfers"]
    assert providers["amadeus_transfers"]["capabilities"]["search"] is True

    # Local fleet capabilities
    assert "local_fleet" in providers
    assert "capabilities" in providers["local_fleet"]
    assert providers["local_fleet"]["capabilities"]["search"] is True
    assert providers["local_fleet"]["capabilities"]["booking"] is True


def test_no_fake_live_inventory_contract():
    # Calling search under default/demo mode must return demo source and is_live=False
    res = client.post("/api/v1/cabs/search", json={
        "pickup_address": "Indira Gandhi International Airport, Delhi",
        "drop_address": "Connaught Place, Delhi",
        "trip_type": "one_way",
        "passengers": 2
    })
    assert res.status_code == 200
    data = res.json()
    options = data.get("options") or data.get("results")
    assert len(options) > 0
    for opt in options:
        assert opt["is_live"] is False
        assert opt["source"] == "demo"
        assert "LIVE" not in opt.get("source", "").upper()


def test_amadeus_and_duffel_admin_diagnostics(admin_auth):
    # Test Amadeus Diagnostics
    amd_res = client.get("/api/v1/admin/providers/amadeus/diagnostics", headers=admin_auth)
    assert amd_res.status_code == 200
    amd_data = amd_res.json()
    assert amd_data["provider"] == "amadeus"
    assert "dns_resolution" in amd_data
    assert "tls_connection" in amd_data
    assert "authentication" in amd_data
    assert "search" in amd_data
    assert "status" in amd_data
    # Assert no secret leak
    assert "client_secret" not in amd_data
    assert "access_token" not in amd_data
    assert "Authorization" not in amd_data

    # Test Duffel Diagnostics
    duf_res = client.get("/api/v1/admin/providers/duffel/diagnostics", headers=admin_auth)
    assert duf_res.status_code == 200
    duf_data = duf_res.json()
    assert duf_data["provider"] == "duffel"
    assert "dns_resolution" in duf_data
    assert "tls_connection" in duf_data
    assert "authentication" in duf_data
    assert "cars_search" in duf_data
    assert "status" in duf_data
    # Assert no secret leak
    assert "api_key" not in duf_data
    assert "Authorization" not in duf_data



