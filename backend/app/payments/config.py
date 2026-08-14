import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class RazorpaySettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PAYMENT_MODE: str = "test"
    RAZORPAY_TEST_KEY_ID: str = "rzp_test_TKNqtYMraXbefU"
    RAZORPAY_TEST_KEY_SECRET: str = "BJa1JWIiisFRf1mTPN5gPlfD"
    RAZORPAY_LIVE_KEY_ID: Optional[str] = None
    RAZORPAY_LIVE_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = "demo_secret"

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # Duffel settings
    DUFFEL_API_KEY: Optional[str] = None
    DUFFEL_BASE_URL: str = "https://api.duffel.com"
    DUFFEL_VERSION: str = "v2"

settings = RazorpaySettings()

# Resolve keys based on PAYMENT_MODE
mode = os.getenv("PAYMENT_MODE", settings.PAYMENT_MODE).lower()
if mode == "live":
    settings.RAZORPAY_KEY_ID = os.getenv("RAZORPAY_LIVE_KEY_ID") or settings.RAZORPAY_LIVE_KEY_ID or ""
    settings.RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_LIVE_KEY_SECRET") or settings.RAZORPAY_LIVE_KEY_SECRET or ""
else:
    settings.RAZORPAY_KEY_ID = os.getenv("RAZORPAY_TEST_KEY_ID") or settings.RAZORPAY_TEST_KEY_ID or "rzp_test_TKNqtYMraXbefU"
    settings.RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_TEST_KEY_SECRET") or settings.RAZORPAY_TEST_KEY_SECRET or "BJa1JWIiisFRf1mTPN5gPlfD"

# Fallbacks for test mode
if not settings.RAZORPAY_KEY_ID or "placeholder" in settings.RAZORPAY_KEY_ID or "your-razorpay" in settings.RAZORPAY_KEY_ID:
    settings.RAZORPAY_KEY_ID = "rzp_test_TKNqtYMraXbefU"

if not settings.RAZORPAY_KEY_SECRET or "placeholder" in settings.RAZORPAY_KEY_SECRET or "your-razorpay" in settings.RAZORPAY_KEY_SECRET:
    settings.RAZORPAY_KEY_SECRET = "BJa1JWIiisFRf1mTPN5gPlfD"

if not settings.RAZORPAY_WEBHOOK_SECRET or "placeholder" in settings.RAZORPAY_WEBHOOK_SECRET or "your-razorpay" in settings.RAZORPAY_WEBHOOK_SECRET:
    settings.RAZORPAY_WEBHOOK_SECRET = "demo_secret"


def validate_live_safety_gates() -> None:
    """Verifies all safety criteria are met before live transaction processing."""
    mode = os.getenv("PAYMENT_MODE", settings.PAYMENT_MODE).lower()
    if mode == "live":
        live_id = os.getenv("RAZORPAY_LIVE_KEY_ID") or settings.RAZORPAY_LIVE_KEY_ID
        live_secret = os.getenv("RAZORPAY_LIVE_KEY_SECRET") or settings.RAZORPAY_LIVE_KEY_SECRET
        
        if not live_id or not live_secret:
            raise RuntimeError("SAFETY GATE VIOLATION: Live payment keys are missing in live mode!")
        if live_id.startswith("rzp_test_"):
            raise RuntimeError("SAFETY GATE VIOLATION: Test Key ID configured under Live payment mode!")
        
        # Verify webhook secret and signature verification is configured
        webhook_sec = os.getenv("RAZORPAY_WEBHOOK_SECRET") or settings.RAZORPAY_WEBHOOK_SECRET
        if not webhook_sec or webhook_sec == "demo_secret":
            raise RuntimeError("SAFETY GATE VIOLATION: Production webhook secret is not configured or using default demo value!")

