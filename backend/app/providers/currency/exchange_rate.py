import os
import logging
import random
import asyncio
import httpx
from typing import Dict, Any
from app.utils.http_client import async_client

logger = logging.getLogger(__name__)

BASE_URL = os.getenv("EXCHANGERATE_HOST_BASE_URL", "https://v6.exchangerate-api.com/v6")


class ExchangeRateProvider:
    def __init__(self):
        self.api_key = os.getenv("EXCHANGERATE_HOST_API_KEY", "").strip()

    def _is_configured(self) -> bool:
        return bool(self.api_key and self.api_key not in ["", "your-api-key"])

    async def _get(self, path: str) -> Dict[str, Any]:
        """Utility method to make a GET request with exponential backoff retries."""
        if not self._is_configured():
            raise ValueError("ExchangeRate API key missing.")

        url = f"{BASE_URL}/{self.api_key}/{path}"
        max_retries = 2
        delay = 0.5
        last_err = None

        for attempt in range(max_retries + 1):
            try:
                resp = await async_client.get(url, timeout=5.0)
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                last_err = e
                if attempt < max_retries:
                    sleep_time = delay * (1 + random.random() * 0.1)
                    logger.warning(f"ExchangeRate attempt {attempt+1} failed: {e}. Retrying in {sleep_time:.2f}s")
                    await asyncio.sleep(sleep_time)
                    delay *= 2.0
        raise last_err

    # ─────────────────────────────────────────────────────────
    # Live Rate (single pair)
    # ─────────────────────────────────────────────────────────

    async def get_live_rate(self, base: str = "USD", target: str = "INR") -> float:
        """Fetch a live conversion rate for a specific currency pair."""
        try:
            data = await self._get(f"pair/{base.upper()}/{target.upper()}")
            return float(data.get("conversion_rate", 0.0))
        except Exception as e:
            logger.warning(f"ExchangeRate live rate failed for {base}/{target}: {e}")
            return 0.0

    # ─────────────────────────────────────────────────────────
    # All Rates (from a base)
    # ─────────────────────────────────────────────────────────

    async def get_all_rates(self, base: str = "USD") -> Dict[str, float]:
        """Fetch all conversion rates from a base currency."""
        try:
            data = await self._get(f"latest/{base.upper()}")
            rates = data.get("conversion_rates", {})
            return {k: float(v) for k, v in rates.items()}
        except Exception as e:
            logger.warning(f"ExchangeRate all rates failed for base={base}: {e}")
            return self._static_rates(base)

    # ─────────────────────────────────────────────────────────
    # Convert Amount
    # ─────────────────────────────────────────────────────────

    async def convert(self, base: str, target: str, amount: float) -> Dict[str, Any]:
        """Convert an amount from base to target currency."""
        rate = await self.get_live_rate(base, target)
        if rate <= 0.0:
            rate = self._static_rate(base, target)
        converted = round(amount * rate, 4)
        return {
            "base": base.upper(),
            "target": target.upper(),
            "amount": amount,
            "rate": rate,
            "converted_amount": converted,
            "source": "live" if self._is_configured() else "static_fallback",
        }

    # ─────────────────────────────────────────────────────────
    # Historical Rate
    # ─────────────────────────────────────────────────────────

    async def get_historical_rate(self, base: str, target: str, date: str) -> Dict[str, Any]:
        """
        Fetch historical conversion rate for a specific date.
        date format: YYYY-MM-DD
        Uses ExchangeRate-API v6 /history endpoint.
        """
        try:
            # Parse date parts
            year, month, day = date.split("-")
            data = await self._get(f"history/{base.upper()}/{year}/{month}/{day}")
            rates = data.get("conversion_rates", {})
            rate = float(rates.get(target.upper(), 0.0))
            if rate <= 0.0:
                raise ValueError("No rate returned")
            return {
                "base": base.upper(),
                "target": target.upper(),
                "date": date,
                "rate": rate,
                "source": "historical",
            }
        except Exception as e:
            logger.warning(f"ExchangeRate historical rate failed for {base}/{target} on {date}: {e}")
            return {
                "base": base.upper(),
                "target": target.upper(),
                "date": date,
                "rate": self._static_rate(base, target),
                "source": "static_fallback",
            }

    # ─────────────────────────────────────────────────────────
    # Static Fallback Rates
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def _static_rate(base: str, target: str) -> float:
        """Approximate rates for common pairs — used when API is unconfigured/fails."""
        rates_to_inr = {
            "USD": 84.50, "EUR": 91.20, "GBP": 107.50, "JPY": 0.56,
            "AED": 23.00, "SGD": 62.50, "AUD": 54.00, "CAD": 61.50,
            "CHF": 93.00, "CNY": 11.60, "HKD": 10.80,
        }
        b = base.upper()
        t = target.upper()
        if t == "INR":
            return rates_to_inr.get(b, 1.0)
        elif b == "INR":
            return round(1.0 / rates_to_inr.get(t, 1.0), 6)
        elif b in rates_to_inr and t in rates_to_inr:
            return round(rates_to_inr[b] / rates_to_inr[t], 6)
        return 1.0

    @staticmethod
    def _static_rates(base: str) -> Dict[str, float]:
        return {
            "INR": ExchangeRateProvider._static_rate(base, "INR"),
            "USD": ExchangeRateProvider._static_rate(base, "USD"),
            "EUR": ExchangeRateProvider._static_rate(base, "EUR"),
            "GBP": ExchangeRateProvider._static_rate(base, "GBP"),
            "AED": ExchangeRateProvider._static_rate(base, "AED"),
            "SGD": ExchangeRateProvider._static_rate(base, "SGD"),
            "JPY": ExchangeRateProvider._static_rate(base, "JPY"),
        }
