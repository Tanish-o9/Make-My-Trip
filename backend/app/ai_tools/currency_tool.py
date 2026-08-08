from decimal import Decimal
from typing import Dict, Any
from app.services.currency import CurrencyService

def currency_convert_tool(amount: float, to_currency: str) -> Dict[str, Any]:
    """
    Converts currency amount from standard base (INR) to user preferred currency.
    Args:
        amount: Price in base currency (INR).
        to_currency: Target currency (USD, EUR, etc.).
    """
    from app.utils.metrics import TOOL_CALLS_TOTAL
    try:
        converted = CurrencyService.convert(Decimal(str(amount)), to_currency.upper())
        TOOL_CALLS_TOTAL.labels(tool_name="currency_convert", status="success").inc()
        return {
            "success": True,
            "original_amount": amount,
            "original_currency": "INR",
            "converted_amount": float(converted),
            "converted_currency": to_currency.upper()
        }
    except Exception as e:
        TOOL_CALLS_TOTAL.labels(tool_name="currency_convert", status="error").inc()
        return {
            "success": False,
            "error": f"Failed currency conversion: {str(e)}"
        }

