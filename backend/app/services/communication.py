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
        self.sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
        self.resend_api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("SENDGRID_FROM_EMAIL") or os.getenv("RESEND_FROM_EMAIL") or "onboarding@resend.dev"

    @retry_with_backoff(max_retries=2, initial_delay=0.5)
    def send_email(self, to_email: str, subject: str, body: str) -> Dict[str, Any]:
        if not self.resend_api_key and not self.sendgrid_api_key:
            logger.info(f"Email sandbox mock dispatch to {to_email} with subject [{subject}]")
            return {"success": True, "email_id": "mock_email_12345", "gateway": "simulated"}

        if self.resend_api_key:
            def execute_resend_email():
                url = "https://api.resend.com/emails"
                headers = {
                    "Authorization": f"Bearer {self.resend_api_key}",
                    "Content-Type": "application/json"
                }
                # Default Resend sandbox sender must be onboarding@resend.dev unless domain verified
                sender = self.from_email if "@" in self.from_email and not self.from_email.endswith("travelos.com") else "onboarding@resend.dev"
                payload = {
                    "from": f"Travel OS <{sender}>",
                    "to": [to_email],
                    "subject": subject,
                    "text": body
                }
                resp = httpx.post(url, headers=headers, json=payload, timeout=5.0)
                resp.raise_for_status()
                return resp.json()

            try:
                res = sendgrid_breaker.call(execute_resend_email)
                return {"success": True, "email_id": res.get("id"), "gateway": "resend"}
            except Exception as e:
                logger.error(f"Resend Email delivery failed: {e}")
                if not self.sendgrid_api_key:
                    return {"success": False, "error": str(e), "gateway": "resend"}

        # Fallback to SendGrid
        def execute_sendgrid_email():
            url = "https://api.sendgrid.com/v3/mail/send"
            headers = {
                "Authorization": f"Bearer {self.sendgrid_api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": "noreply@travelos.com"},
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
