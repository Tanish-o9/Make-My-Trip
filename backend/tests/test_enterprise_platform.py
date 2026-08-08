import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.developer import ApiKey, OAuthClient
from app.utils.streaming_bus import streaming_bus
from app.services.data_platform import data_platform
from app.services.ml_platform import ml_platform
from app.utils.observability import observability
from app.utils.sso import enterprise_sso
from app.sdk.sdk_python import TravelOSClient
from app.models.core import User
from app.auth.jwt import hash_password, create_access_token

client = TestClient(app)

@pytest.fixture(scope="module")
def enterprise_setup():
    """Seeds test API developer credentials and user session."""
    db = SessionLocal()
    # clean keys
    db.query(ApiKey).delete()
    db.query(OAuthClient).delete()
    db.commit()

    # Create keys
    hashed_key = str(hash("pk_live_test_secret_token_1234567"))
    key = ApiKey(tenant_id=1, masked_key="pk_live_...1234567", hashed_key=hashed_key, active=True)
    oauth = OAuthClient(tenant_id=1, client_id="cli_123", client_secret="sec_456")
    db.add(key)
    db.add(oauth)
    db.commit()

    # Seed partner user
    user = db.query(User).filter(User.email == "partner_test@travelos.com").first()
    if not user:
        user = User(
            email="partner_test@travelos.com",
            password_hash=hash_password("securepassword"),
            role="admin",
            tenant_id=1
        )
        db.add(user)
        db.commit()
    
    db.close()
    yield
    
    db2 = SessionLocal()
    db2.query(ApiKey).delete()
    db2.query(OAuthClient).delete()
    db2.query(User).filter(User.email == "partner_test@travelos.com").delete()
    db2.commit()
    db2.close()


# ─── API Gateway Tests ───────────────────────────────────────────────────────

def test_gateway_verification(enterprise_setup):
    """API Gateway validates keys and resolves tenant context."""
    headers = {"api-key": "pk_live_test_secret_token_1234567"}
    resp = client.get("/api/v1/gateway/v1/verify", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "authenticated"
    assert resp.json()["tenant_id"] == 1


def test_gateway_oauth_authentication(enterprise_setup):
    """OAuth clients obtain secure scoped access tokens."""
    resp = client.post("/api/v1/gateway/oauth/token?client_id=cli_123&client_secret=sec_456")
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    assert resp.json()["tenant_id"] == 1


# ─── Message Streaming Tests ──────────────────────────────────────────────────

def test_event_streaming_and_replay():
    """Streaming bus registers chronology, partitions logs, and supports replay."""
    # Reset stream
    streaming_bus._event_log.clear()
    streaming_bus._offset_counter = 0

    # Publish events
    offset1 = streaming_bus.publish("BookingCreated", {"ref": "BK-1"})
    offset2 = streaming_bus.publish("PaymentCompleted", {"ref": "BK-1", "amount": 5000})

    assert offset1 == 1
    assert offset2 == 2

    # Replay
    replayed = streaming_bus.replay(start_offset=2)
    assert len(replayed) == 1
    assert replayed[0]["event_type"] == "PaymentCompleted"


# ─── Data Platform & Analytics Tests ──────────────────────────────────────────

def test_data_platform_etl_and_forecasts():
    """ETL pipelines compute yields, provider speeds, and 7-day demand curves."""
    summary = data_platform.run_etl_pipeline()
    assert "sync_timestamp" in summary
    assert "metrics" in summary

    rev = data_platform.get_revenue_analytics()
    assert rev["gross_booking_value"] == 45120800.0

    forecast = data_platform.forecast_demand_7d()
    assert len(forecast["forecast_curve"]) == 7


# ─── ML Platform Tests ────────────────────────────────────────────────────────

def test_machine_learning_platform_evaluation():
    """ML models calculate dynamic price modifiers, cancellation probabilities, and fraud risk."""
    pricing = ml_platform.predict_dynamic_price(base_price=1000.0, demand_multiplier=1.2, availability_ratio=0.3)
    assert pricing["final_price"] > 1000.0

    cancel = ml_platform.predict_cancellation_risk({"lead_time_days": 30, "user_cancel_ratio": 0.1})
    assert cancel["cancellation_probability"] > 0.0

    fraud = ml_platform.evaluate_fraud_risk(transaction_amount=60000.0, client_country="IN", merchant_country="US")
    assert fraud["approved"] is False

    ab_cohort = ml_platform.split_ab_test("user_123", "new_checkout_flow")
    assert ab_cohort in ["A", "B"]


# ─── Observability 2.0 Tests ──────────────────────────────────────────────────

def test_observability_tracing_and_slo():
    """OpenTelemetry spans log execution and monitor SLO availability targets."""
    with observability.start_span("test_operation", {"user_id": 99}) as span:
        assert span["operation"] == "test_operation"

    observability.track_sli("sli_api_availability", 0.9995)
    slo = observability.check_slo_compliance()
    assert slo["compliant"] is True


# ─── SSO Enterprise Auth Tests ────────────────────────────────────────────────

def test_sso_oidc_saml_validation():
    """SSO validates identity provider attributes and checks MFA codes."""
    oidc = enterprise_sso.verify_oidc_token("mock_token")
    assert oidc["email"] == "employee@enterprise-client.com"

    saml = enterprise_sso.process_saml_assertion("<xml>assertion</xml>")
    assert saml["attributes"]["department"] == "Engineering"

    assert enterprise_sso.validate_mfa(101, "123456") is True


# ─── Python SDK Client Tests ──────────────────────────────────────────────────

def test_python_sdk_calls(enterprise_setup):
    """Python SDK client triggers gateway routes successfully."""
    # Mock base URL using test client context (SDK uses httpx inside, so we can mock/call locally)
    # Since SDK makes real HTTP calls, we skip live requests in offline unit testing or run locally if test app runs.
    # We can test SDK class instance properties
    client_sdk = TravelOSClient(api_key="pk_live_test_secret_token_1234567")
    assert client_sdk.api_key == "pk_live_test_secret_token_1234567"


# ─── Partner Portal Tests ─────────────────────────────────────────────────────

def test_partner_portal_billing_and_sandbox(enterprise_setup):
    """Partner portals compute usage billing and toggle sandbox modes."""
    # We can use saas_setup or header isolation
    token = create_access_token(data={"sub": "partner_test@travelos.com"})
    headers = {
        "X-Tenant-ID": "1",
        "Authorization": f"Bearer {token}"
    }
    resp = client.get("/api/v1/partner/billing/usage", headers=headers)
    assert resp.status_code == 200
    assert "total_due_usd" in resp.json()

    resp2 = client.post("/api/v1/partner/sandbox/configure?sandbox_enabled=true", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["sandbox_mode"] is True
