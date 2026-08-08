import json
import logging
from decimal import Decimal
import redis
import os
from app.utils.redis_client import redis_client

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class CurrencyService:
    BASE_CURRENCY = "INR"
    # Fallback rates: Currency -> Rate relative to INR (i.e. 1 Unit of Currency = X INR)
    # E.g. USD = 83.50 (meaning $1 = 83.50 INR, so 100 INR = 100 / 83.50 USD)
    DEFAULT_RATES = {
        "INR": 1.0,
        "USD": 0.012,    # 1 INR = 0.012 USD
        "EUR": 0.011,    # 1 INR = 0.011 EUR
        "GBP": 0.0094,   # 1 INR = 0.0094 GBP
        "AED": 0.044,    # 1 INR = 0.044 AED
    }

    _redis_client = None

    @classmethod
    def _get_redis(cls):
        return redis_client

    @classmethod
    def get_rates(cls) -> dict:
        r = cls._get_redis()
        if r:
            try:
                cached = r.get("currency_rates")
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Error reading currency rates from Redis: {e}")

        # If cache miss or error, return defaults or fetch
        # Let's seed Redis if we can
        rates = cls.DEFAULT_RATES
        if r:
            try:
                r.setex("currency_rates", 86400, json.dumps(rates)) # 24 hours
            except Exception as e:
                logger.warning(f"Error setting currency rates in Redis: {e}")
        return rates

    @classmethod
    def convert(cls, amount: Decimal, to_currency: str) -> Decimal:
        if to_currency == cls.BASE_CURRENCY:
            return amount
            
        rates = cls.get_rates()
        rate = rates.get(to_currency)
        if not rate:
            # Fallback to default
            rate = cls.DEFAULT_RATES.get(to_currency, 1.0)
            
        return amount * Decimal(str(rate))

    @classmethod
    def sync_rates(cls) -> dict:
        """Fetches live exchange rates from ExchangeRate.host or OpenExchangeRates, caching in Redis."""
        api_key = os.getenv("EXCHANGERATE_HOST_API_KEY", "").strip()
        rates = cls.DEFAULT_RATES.copy()
        
        if api_key and api_key not in ["", "your-exchangerate-key"]:
            url = f"https://api.exchangerate.host/live?access_key={api_key}"
            try:
                import httpx
                resp = httpx.get(url, timeout=5.0)
                if resp.status_code == 200:
                    data = resp.json()
                    quotes = data.get("quotes", {})
                    # ExchangeRate.host returns USD-relative quotes: E.g. USDINR = 83.5
                    # We normalize rates relative to INR (BASE_CURRENCY = "INR")
                    usd_inr = float(quotes.get("USDINR", 83.5))
                    for k, val in quotes.items():
                        # Extract currency name (e.g. USDINR -> INR)
                        curr_code = k[3:] if len(k) == 6 else k
                        if curr_code == "INR":
                            rates["INR"] = 1.0
                        elif usd_inr > 0:
                            # 1 INR = (1 / usd_inr) * quote_val USD-relative
                            rates[curr_code] = round((1.0 / usd_inr) * float(val), 5)
                    logger.info("Successfully fetched live rates from ExchangeRate.host")
            except Exception as e:
                logger.error(f"Failed to fetch real exchange rates from API: {e}")
        else:
            # Sandbox market fluctuations fallback
            import random
            for curr in rates:
                if curr != cls.BASE_CURRENCY:
                    rates[curr] = rates[curr] * (1 + (random.random() - 0.5) * 0.01)

        r = cls._get_redis()
        if r:
            try:
                r.setex("currency_rates", 86400, json.dumps(rates))
                logger.info("Successfully synced currency rates to Redis")
            except Exception as e:
                logger.error(f"Failed to save synced rates to Redis: {e}")
        return rates
