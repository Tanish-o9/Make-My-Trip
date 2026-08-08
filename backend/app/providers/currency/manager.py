import json
import logging
from typing import Dict, Any, List, Optional
from app.providers.currency.exchange_rate import ExchangeRateProvider
from app.utils.redis_client import redis_client
from app.services.resilience import CircuitBreaker

logger = logging.getLogger(__name__)

currency_breaker = CircuitBreaker("CurrencyAPI", max_failures=3, cooldown_seconds=60)


class CurrencyManager:
    def __init__(self):
        self.provider = ExchangeRateProvider()

    async def get_conversion_rate(self, base: str = "USD", target: str = "INR") -> float:
        """Single rate with static fallback."""
        cache_key = f"currency:rate:{base.upper()}:{target.upper()}"

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    return float(cached)
            except Exception:
                pass

        try:
            rate = await currency_breaker.call_async(
                lambda: self.provider.get_live_rate(base, target)
            )
        except Exception as e:
            logger.warning(f"CurrencyManager rate fetch failed: {e}")
            rate = 0.0

        if rate <= 0.0:
            rate = self.provider._static_rate(base, target)
            logger.info(f"Static fallback rate for {base}/{target}: {rate}")

        if redis_client:
            try:
                redis_client.setex(cache_key, 1800, str(rate))
            except Exception:
                pass

        return rate

    async def get_all_rates(self, base: str = "USD") -> Dict[str, float]:
        """All rates from a base currency."""
        cache_key = f"currency:all:{base.upper()}"

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        try:
            rates = await currency_breaker.call_async(
                lambda: self.provider.get_all_rates(base)
            )
        except Exception as e:
            logger.warning(f"CurrencyManager all-rates failed: {e}")
            rates = self.provider._static_rates(base)

        if not rates:
            rates = self.provider._static_rates(base)

        if redis_client:
            try:
                redis_client.setex(cache_key, 1800, json.dumps(rates))
            except Exception:
                pass

        return rates

    async def convert_amount(self, base: str, target: str, amount: float) -> Dict[str, Any]:
        """Convert amount from base to target currency."""
        try:
            result = await currency_breaker.call_async(
                lambda: self.provider.convert(base, target, amount)
            )
            return result
        except Exception as e:
            logger.warning(f"CurrencyManager convert failed: {e}")
            rate = self.provider._static_rate(base, target)
            return {
                "base": base.upper(),
                "target": target.upper(),
                "amount": amount,
                "rate": rate,
                "converted_amount": round(amount * rate, 4),
                "source": "static_fallback",
            }

    async def get_historical_rate(self, base: str, target: str, date: str) -> Dict[str, Any]:
        """Historical exchange rate for a specific date."""
        cache_key = f"currency:historical:{base.upper()}:{target.upper()}:{date}"

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        try:
            result = await currency_breaker.call_async(
                lambda: self.provider.get_historical_rate(base, target, date)
            )
        except Exception as e:
            logger.warning(f"CurrencyManager historical rate failed: {e}")
            result = {
                "base": base.upper(),
                "target": target.upper(),
                "date": date,
                "rate": self.provider._static_rate(base, target),
                "source": "static_fallback",
            }

        if redis_client and result:
            try:
                redis_client.setex(cache_key, 86400, json.dumps(result))
            except Exception:
                pass

        return result
