import os
import uuid
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Global in-memory cache for idempotency keys to ensure flaky network retries do not double-charge.
# Maps idempotency_key -> response_dict
IDEMPOTENCY_CACHE: Dict[str, Dict[str, Any]] = {}

class PaymentProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def charge(
        self,
        amount: float,
        currency: str,
        token: str,
        description: str,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Charges a customer using the gateway token.
        Returns a dictionary containing charge reference, success status, and 3DS action if required.
        """
        pass

    @abstractmethod
    def refund(self, charge_id: str, amount: float) -> Dict[str, Any]:
        """
        Initiates a gateway refund for a previous charge.
        """
        pass

    @abstractmethod
    def authorize(
        self,
        amount: float,
        currency: str,
        token: str,
        description: str,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authorizes a transaction without capturing funds.
        """
        pass

    @abstractmethod
    def capture(self, charge_id: str, amount: float) -> Dict[str, Any]:
        """
        Captures a previously authorized payment hold.
        """
        pass

    @abstractmethod
    def void(self, charge_id: str) -> Dict[str, Any]:
        """
        Voids/Releases a previously authorized payment hold.
        """
        pass


class StripePaymentAdapter(PaymentProvider):
    @property
    def name(self) -> str:
        return "stripe"

    def charge(
        self,
        amount: float,
        currency: str,
        token: str,
        description: str,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        auth_res = self.authorize(amount, currency, token, description, idempotency_key)
        if auth_res.get("status") == "requires_action":
            return auth_res
        if not auth_res.get("success"):
            return auth_res
        return self.capture(auth_res["charge_id"], amount)

    def authorize(
        self,
        amount: float,
        currency: str,
        token: str,
        description: str,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        # Idempotency check
        if idempotency_key and idempotency_key in IDEMPOTENCY_CACHE:
            logger.info(f"Stripe: Idempotency hit for key {idempotency_key}")
            return IDEMPOTENCY_CACHE[idempotency_key]

        # Simulate Stripe hosted fields tokenization check
        if not token.startswith("tok_"):
            return {
                "success": False,
                "error": "PCI Compliance Violation: Raw card data received. Only tokenized keys permitted.",
                "gateway": self.name
            }

        # 3D Secure Step-Up Gating simulation
        if token == "tok_3ds" or amount >= 10000:
            logger.info(f"Stripe: 3D Secure validation required for amount {amount}")
            response = {
                "success": False,
                "status": "requires_action",
                "action_type": "3ds_redirect",
                "redirect_url": f"http://localhost:8000/api/v1/payments/3ds-mock-page?gateway=stripe&amount={amount}&currency={currency}&token={token}",
                "gateway": self.name,
                "charge_id": f"ch_stripe_3ds_{uuid.uuid4().hex[:12]}"
            }
            if idempotency_key:
                IDEMPOTENCY_CACHE[idempotency_key] = response
            return response

        # Standard authorization mock
        response = {
            "success": True,
            "status": "authorized",
            "charge_id": f"ch_stripe_{uuid.uuid4().hex[:12]}",
            "currency": currency.upper(),
            "amount": amount,
            "gateway": self.name
        }
        if idempotency_key:
            IDEMPOTENCY_CACHE[idempotency_key] = response
        return response

    def capture(self, charge_id: str, amount: float) -> Dict[str, Any]:
        logger.info(f"Stripe: Capturing auth hold {charge_id} for amount {amount}")
        return {
            "success": True,
            "status": "succeeded",
            "charge_id": charge_id,
            "receipt_url": "https://stripe.com/receipt/mock",
            "amount": amount,
            "gateway": self.name
        }

    def void(self, charge_id: str) -> Dict[str, Any]:
        logger.info(f"Stripe: Voiding auth hold {charge_id}")
        return {
            "success": True,
            "status": "voided",
            "charge_id": charge_id,
            "gateway": self.name
        }

    def refund(self, charge_id: str, amount: float) -> Dict[str, Any]:
        logger.info(f"Stripe: Refunding charge {charge_id} for amount {amount}")
        return {
            "success": True,
            "status": "REFUND_INITIATED",
            "gateway_refund_id": f"re_stripe_{uuid.uuid4().hex[:12]}",
            "gateway": self.name
        }


class RazorpayPaymentAdapter(PaymentProvider):
    @property
    def name(self) -> str:
        return "razorpay"

    def charge(
        self,
        amount: float,
        currency: str,
        token: str,
        description: str,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        auth_res = self.authorize(amount, currency, token, description, idempotency_key)
        if auth_res.get("status") == "requires_action":
            return auth_res
        if not auth_res.get("success"):
            return auth_res
        capture_res = self.capture(auth_res["charge_id"], amount)
        if capture_res.get("success"):
            for k, v in auth_res.items():
                if k not in capture_res:
                    capture_res[k] = v
        return capture_res

    def authorize(
        self,
        amount: float,
        currency: str,
        token: str,
        description: str,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        # Idempotency check
        if idempotency_key and idempotency_key in IDEMPOTENCY_CACHE:
            logger.info(f"Razorpay: Idempotency hit for key {idempotency_key}")
            return IDEMPOTENCY_CACHE[idempotency_key]

        # Simulate Razorpay tokenization check
        if not token.startswith("tok_"):
            return {
                "success": False,
                "error": "PCI Compliance Violation: Raw card data received. Only tokenized keys permitted.",
                "gateway": self.name
            }

        # Multi-currency support check
        converted_details = {}
        target_currency = currency.upper()
        if target_currency != "INR":
            rates = {"USD": 83.5, "EUR": 90.2}
            rate = rates.get(target_currency, 80.0)
            inr_amount = amount * rate
            converted_details = {
                "original_amount": amount,
                "original_currency": target_currency,
                "exchange_rate": rate,
                "converted_amount_inr": round(inr_amount, 2),
                "message": f"DCC: Charged {amount} {target_currency} converted at 1 {target_currency} = {rate} INR"
            }
            amount = inr_amount
            currency = "INR"

        # 3D Secure / 2FA checking
        if token == "tok_3ds" or amount >= 10000:
            logger.info(f"Razorpay: 3D Secure validation required for amount {amount}")
            response = {
                "success": False,
                "status": "requires_action",
                "action_type": "3ds_redirect",
                "redirect_url": f"http://localhost:8000/api/v1/payments/3ds-mock-page?gateway=razorpay&amount={amount}&currency={currency}&token={token}",
                "gateway": self.name,
                "charge_id": f"pay_razor_{uuid.uuid4().hex[:12]}",
                **converted_details
            }
            if idempotency_key:
                IDEMPOTENCY_CACHE[idempotency_key] = response
            return response

        response = {
            "success": True,
            "status": "authorized",
            "charge_id": f"pay_razor_{uuid.uuid4().hex[:12]}",
            "currency": currency,
            "amount": amount,
            "gateway": self.name,
            **converted_details
        }
        if idempotency_key:
            IDEMPOTENCY_CACHE[idempotency_key] = response
        return response

    def capture(self, charge_id: str, amount: float) -> Dict[str, Any]:
        logger.info(f"Razorpay: Capturing auth hold {charge_id} for amount {amount}")
        return {
            "success": True,
            "status": "succeeded",
            "charge_id": charge_id,
            "receipt_url": "https://razorpay.com/receipt/mock",
            "amount": amount,
            "gateway": self.name
        }

    def void(self, charge_id: str) -> Dict[str, Any]:
        logger.info(f"Razorpay: Voiding auth hold {charge_id}")
        return {
            "success": True,
            "status": "voided",
            "charge_id": charge_id,
            "gateway": self.name
        }

    def refund(self, charge_id: str, amount: float) -> Dict[str, Any]:
        logger.info(f"Razorpay: Refunding transaction {charge_id} for amount {amount}")
        return {
            "success": True,
            "status": "REFUND_INITIATED",
            "gateway_refund_id": f"rfnd_razor_{uuid.uuid4().hex[:12]}",
            "gateway": self.name
        }


# Factory constructor to return provider adapter
def get_payment_provider(gateway_name: str) -> PaymentProvider:
    gname = gateway_name.lower()
    if gname == "stripe":
        return StripePaymentAdapter()
    elif gname == "razorpay":
        return RazorpayPaymentAdapter()
    else:
        raise ValueError(f"Unsupported gateway provider: {gateway_name}")
