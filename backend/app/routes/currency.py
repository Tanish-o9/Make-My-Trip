from fastapi import APIRouter, Query, HTTPException
from typing import Dict, Any, Optional
from app.providers.currency.manager import CurrencyManager
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/currency", tags=["currency"])
currency_manager = CurrencyManager()


@router.get("/rates", response_model=Dict[str, Any])
async def get_all_rates(
    base: str = Query("USD", description="Base currency code, e.g. USD, INR, EUR"),
):
    """
    Get all currency exchange rates from a base currency.
    Example: GET /api/v1/currency/rates?base=USD
    """
    base_clean = base.strip().upper()
    if len(base_clean) != 3 or not base_clean.isalpha():
        raise HTTPException(status_code=400, detail="Base currency must be a 3-letter ISO code.")
    try:
        rates = await currency_manager.get_all_rates(base_clean)
        return {"base": base_clean, "rates": rates}
    except Exception as e:
        logger.error(f"Error in get_all_rates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/convert", response_model=Dict[str, Any])
async def convert_currency(
    from_currency: str = Query(..., alias="from", description="Source currency code, e.g. USD"),
    to_currency: str = Query(..., alias="to", description="Target currency code, e.g. INR"),
    amount: float = Query(1.0, description="Amount to convert"),
):
    """
    Convert an amount from one currency to another at live rates.
    Example: GET /api/v1/currency/convert?from=USD&to=INR&amount=100
    """
    base = from_currency.strip().upper()
    target = to_currency.strip().upper()

    if len(base) != 3 or not base.isalpha():
        raise HTTPException(status_code=400, detail="Source currency must be a 3-letter ISO code.")
    if len(target) != 3 or not target.isalpha():
        raise HTTPException(status_code=400, detail="Target currency must be a 3-letter ISO code.")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0.")

    try:
        return await currency_manager.convert_amount(base, target, amount)
    except Exception as e:
        logger.error(f"Error in convert_currency: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historical", response_model=Dict[str, Any])
async def get_historical_rate(
    from_currency: str = Query(..., alias="from", description="Base currency code"),
    to_currency: str = Query(..., alias="to", description="Target currency code"),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
):
    """
    Get historical exchange rate for a specific date.
    Example: GET /api/v1/currency/historical?from=USD&to=INR&date=2026-07-01
    """
    base = from_currency.strip().upper()
    target = to_currency.strip().upper()
    date_clean = date.strip()

    if len(base) != 3 or not base.isalpha():
        raise HTTPException(status_code=400, detail="Source currency must be a 3-letter ISO code.")
    if len(target) != 3 or not target.isalpha():
        raise HTTPException(status_code=400, detail="Target currency must be a 3-letter ISO code.")

    try:
        return await currency_manager.get_historical_rate(base, target, date_clean)
    except Exception as e:
        logger.error(f"Error in get_historical_rate: {e}")
        raise HTTPException(status_code=500, detail=str(e))
