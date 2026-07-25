import os
import httpx
import logging
from typing import Dict, Any
from app.services.resilience import CircuitBreaker, retry_with_backoff

logger = logging.getLogger(__name__)

# Circuit breakers for communications
twilio_breaker = CircuitBreaker("TwilioAPI", max_failures=3, cooldown_seconds=60)
sendgrid_breaker = CircuitBreaker("SendGridAPI", max_failures=3, cooldown_seconds=60)

class TwilioClient:
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.phone_number = os.getenv("TWILIO_PHONE_NUMBER")

    @retry_with_backoff(max_retries=2, initial_delay=0.5)
    def send_sms(self, to_phone: str, body: str) -> Dict[str, Any]:
        if not self.account_sid or not self.auth_token or not self.phone_number:
            logger.info(f"Twilio SMS sandbox dispatch to {to_phone}: {body}")
            return {"success": True, "sms_id": "sms_mock_12345", "gateway": "twilio_simulated"}

        def execute_twilio_sms():
            url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
            auth = (self.account_sid, self.auth_token)
            data = {
                "To": to_phone,
                "From": self.phone_number,
                "Body": body
            }
            resp = httpx.post(url, auth=auth, data=data, timeout=5.0)
            resp.raise_for_status()
            return resp.json()

        try:
            res = twilio_breaker.call(execute_twilio_sms)
            return {"success": True, "sms_id": res["sid"], "gateway": "twilio"}
        except Exception as e:
            logger.error(f"Twilio SMS delivery failed: {e}")
            return {"success": False, "error": str(e), "gateway": "twilio"}


class SendGridClient:
    def __init__(self):
        self.api_key = os.getenv("SENDGRID_API_KEY")
        self.from_email = os.getenv("SENDGRID_FROM_EMAIL", "noreply@travelos.com")

    @retry_with_backoff(max_retries=2, initial_delay=0.5)
    def send_email(self, to_email: str, subject: str, body: str) -> Dict[str, Any]:
        if not self.api_key:
            logger.info(f"SendGrid Email sandbox dispatch to {to_email} with subject [{subject}]")
            return {"success": True, "email_id": "sg_mock_12345", "gateway": "sendgrid_simulated"}

        def execute_sendgrid_email():
            url = "https://api.sendgrid.com/v3/mail/send"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": self.from_email},
                "subject": subject,
                "content": [{"type": "text/plain", "value": body}]
            }
            resp = httpx.post(url, headers=headers, json=payload, timeout=5.0)
            resp.raise_for_status()
            return resp

        try:
            sendgrid_breaker.call(execute_sendgrid_email)
            return {"success": True, "gateway": "sendgrid"}
        except Exception as e:
            logger.error(f"SendGrid Email delivery failed: {e}")
            return {"success": False, "error": str(e), "gateway": "sendgrid"}
