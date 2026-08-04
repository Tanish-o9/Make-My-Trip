import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

# Retrieve environment variables with secure fallback to active test keys
env_key_id = os.getenv("RAZORPAY_KEY_ID")
if not env_key_id or "placeholder" in env_key_id or "your-razorpay" in env_key_id:
    env_key_id = "rzp_test_TKNqtYMraXbefU"

env_key_secret = os.getenv("RAZORPAY_KEY_SECRET")
if not env_key_secret or "placeholder" in env_key_secret or "your-razorpay" in env_key_secret:
    env_key_secret = "BJa1JWIiisFRf1mTPN5gPlfD"

env_webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
if not env_webhook_secret or "placeholder" in env_webhook_secret or "your-razorpay" in env_webhook_secret:
    env_webhook_secret = "demo_secret"

class RazorpaySettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    RAZORPAY_KEY_ID: str = env_key_id
    RAZORPAY_KEY_SECRET: str = env_key_secret
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = env_webhook_secret

settings = RazorpaySettings()
