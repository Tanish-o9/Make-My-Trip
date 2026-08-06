import logging
from app.providers.currency.exchange_rate import ExchangeRateProvider

logger = logging.getLogger(__name__)

class CurrencyManager:
    def __init__(self):
        self.provider = ExchangeRateProvider()

    async def get_conversion_rate(self, base: str = "USD", target: str = "INR") -> float:
        rate = await self.provider.get_live_rate(base, target)
        if rate <= 0.0:
            logger.info(f"Exchange Rate API returned empty. Falling back to static conversion rate for {base}/{target}.")
            # Static database fallback rates
            if base == "USD" and target == "INR":
                rate = 84.50
            elif base == "EUR" and target == "INR":
                rate = 91.20
            else:
                rate = 1.0
        return rate
