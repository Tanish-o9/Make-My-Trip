import os
import httpx
import logging
from typing import Dict, Any
from app.services.resilience import CircuitBreaker

logger = logging.getLogger(__name__)

# Global circuit breaker for Stripe payments
stripe_breaker = CircuitBreaker("StripeAPI", max_failures=3, cooldown_seconds=60)

class StripeClient:
    def __init__(self):
        self.api_key = os.getenv("STRIPE_API_KEY")

    def create_charge(self, amount_inr: float, token: str) -> Dict[str, Any]:
        """
        Charges a customer card token.
        Returns a dictionary containing charge reference details.
        """
        if not self.api_key:
            logger.info("Stripe API key not configured. Executing sandbox simulated charge.")
            import uuid
            return {
                "success": True,
                "charge_id": f"ch_mock_{uuid.uuid4().hex[:12]}",
                "receipt_url": "https://stripe.com/receipt/mock",
                "gateway": "stripe_simulated"
            }

        def execute_stripe_charge():
            # Call Stripe standard REST API
            url = "https://api.stripe.com/v1/charges"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            # Stripe amounts are in cents (paise for INR equivalent)
            amount_paise = int(amount_inr * 100)
            data = {
                "amount": amount_paise,
                "currency": "inr",
                "source": token,
                "description": "Travel OS Booking Charge"
            }
            resp = httpx.post(url, headers=headers, data=data, timeout=8.0)
            resp.raise_for_status()
            return resp.json()

        try:
            charge = stripe_breaker.call(execute_stripe_charge)
            return {
                "success": True,
                "charge_id": charge["id"],
                "receipt_url": charge.get("receipt_url"),
                "gateway": "stripe"
            }
        except Exception as e:
            logger.error(f"Stripe Transaction failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "gateway": "stripe"
            }
