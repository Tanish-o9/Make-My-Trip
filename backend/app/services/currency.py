import json
import logging
from decimal import Decimal
import redis
import os

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
        if cls._redis_client is None:
            try:
                cls._redis_client = redis.Redis.from_url(REDIS_URL, socket_timeout=2)
            except Exception as e:
                logger.warning(f"Failed to connect to Redis for Currency Cache: {e}")
        return cls._redis_client

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
        # Celery-scheduled rate sync simulator (would call openexchangerates or similar API)
        # For now, it updates our local state cache in Redis
        rates = cls.DEFAULT_RATES.copy()
        # Stub: Simulating slight market fluctuations
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
