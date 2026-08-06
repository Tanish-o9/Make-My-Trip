import os
import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class ExchangeRateProvider:
    def __init__(self):
        self.api_key = os.getenv("EXCHANGE_RATE_API_KEY", "")

    async def get_live_rate(self, base: str = "USD", target: str = "INR") -> float:
        if not self.api_key or self.api_key in ["", "your-key"]:
            logger.info("Exchange Rate API Key not configured. Returning 0.0.")
            return 0.0

        url = f"https://v6.exchangerate-api.com/v6/{self.api_key}/pair/{base}/{target}"
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, timeout=3.0)
                resp.raise_for_status()
                data = resp.json()
            return float(data.get("conversion_rate", 0.0))
        except Exception as e:
            logger.warning(f"Exchange Rate API query failed for {base}/{target}: {e}")
            return 0.0
