import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class RazorpaySettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    RAZORPAY_KEY_ID: str = "rzp_test_TKNqtYMraXbefU"
    RAZORPAY_KEY_SECRET: str = "BJa1JWIiisFRf1mTPN5gPlfD"
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = "demo_secret"

settings = RazorpaySettings()

# Post-instantiation sanitization and fallback overrides to bypass Pydantic environment loading
if not settings.RAZORPAY_KEY_ID or "placeholder" in settings.RAZORPAY_KEY_ID or "your-razorpay" in settings.RAZORPAY_KEY_ID:
    settings.RAZORPAY_KEY_ID = "rzp_test_TKNqtYMraXbefU"

if not settings.RAZORPAY_KEY_SECRET or "placeholder" in settings.RAZORPAY_KEY_SECRET or "your-razorpay" in settings.RAZORPAY_KEY_SECRET:
    settings.RAZORPAY_KEY_SECRET = "BJa1JWIiisFRf1mTPN5gPlfD"

if not settings.RAZORPAY_WEBHOOK_SECRET or "placeholder" in settings.RAZORPAY_WEBHOOK_SECRET or "your-razorpay" in settings.RAZORPAY_WEBHOOK_SECRET:
    settings.RAZORPAY_WEBHOOK_SECRET = "demo_secret"
