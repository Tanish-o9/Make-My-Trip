from typing import Optional, Dict, Any


class ProviderError(Exception):
    """Base exception for all external provider integration errors"""
    def __init__(self, message: str, error_code: str = "PROVIDER_ERROR", status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}


class ProviderUnavailableError(ProviderError):
    def __init__(self, message: str = "Live inventory is temporarily unavailable.", provider: str = "unknown"):
        super().__init__(message, error_code="PROVIDER_UNAVAILABLE", status_code=503, details={"provider": provider})


class ProviderRateLimitError(ProviderError):
    def __init__(self, message: str = "Provider rate limit exceeded. Please retry in a few moments.", provider: str = "unknown", retry_after_seconds: int = 5):
        super().__init__(message, error_code="PROVIDER_RATE_LIMITED", status_code=429, details={"provider": provider, "retry_after": retry_after_seconds})


class OfferExpiredError(ProviderError):
    def __init__(self, message: str = "Vehicle offer has expired. Please search again to get live pricing.", offer_id: Optional[str] = None):
        super().__init__(message, error_code="OFFER_EXPIRED", status_code=410, details={"offer_id": offer_id})


class PriceChangedError(ProviderError):
    def __init__(self, old_price: float, new_price: float, currency: str = "INR", offer_id: Optional[str] = None):
        message = f"Live fare updated from {currency} {old_price:,.2f} to {currency} {new_price:,.2f}."
        super().__init__(message, error_code="PRICE_CHANGED", status_code=409, details={
            "old_price": old_price,
            "new_price": new_price,
            "currency": currency,
            "offer_id": offer_id
        })


class BookingFailedError(ProviderError):
    def __init__(self, message: str = "Provider booking could not be completed.", provider_reference: Optional[str] = None):
        super().__init__(message, error_code="BOOKING_FAILED", status_code=502, details={"provider_reference": provider_reference})


class ProviderNotConfiguredError(ProviderError):
    def __init__(self, message: str = "Live provider is not configured.", provider: str = "unknown"):
        super().__init__(message, error_code="PROVIDER_NOT_CONFIGURED", status_code=503, details={"provider": provider})


class ProviderUnsupportedError(ProviderError):
    def __init__(self, message: str = "Requested provider operation or vertical is unsupported.", provider: str = "unknown"):
        super().__init__(message, error_code="PROVIDER_UNSUPPORTED", status_code=501, details={"provider": provider})


class ProviderAuthFailedError(ProviderError):
    def __init__(self, message: str = "Provider authentication failed.", provider: str = "unknown"):
        super().__init__(message, error_code="PROVIDER_AUTH_FAILED", status_code=401, details={"provider": provider})


class ProviderTimeoutError(ProviderError):
    def __init__(self, message: str = "Provider request timed out.", provider: str = "unknown"):
        super().__init__(message, error_code="PROVIDER_TIMEOUT", status_code=504, details={"provider": provider})


class OfferUnavailableError(ProviderError):
    def __init__(self, message: str = "Selected vehicle offer is no longer available.", offer_id: Optional[str] = None):
        super().__init__(message, error_code="OFFER_UNAVAILABLE", status_code=404, details={"offer_id": offer_id})


