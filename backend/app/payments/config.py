from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class RazorpaySettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    RAZORPAY_KEY_ID: str = "rzp_test_your_razorpay_key"
    RAZORPAY_KEY_SECRET: str = "your-razorpay-secret"
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = "your-razorpay-webhook-secret"

settings = RazorpaySettings()
