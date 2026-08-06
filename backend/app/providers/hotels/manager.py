import logging
from typing import List, Dict, Any
from app.providers.base import BaseHotelProvider, NormalizedOffer
from app.providers.hotels.hotelbeds import HotelBedsProvider
from app.providers.hotels.amadeus_hotels import AmadeusHotelsProvider
from app.providers.hotels.mock_provider import MockHotelProvider

logger = logging.getLogger(__name__)

class HotelProviderManager:
    def __init__(self):
        self.providers = [
            HotelBedsProvider(),
            AmadeusHotelsProvider()
        ]
        self.fallback = MockHotelProvider()

    async def search_all(self, destination: str, check_in: str, check_out: str) -> List[NormalizedOffer]:
        results = []
        for provider in self.providers:
            try:
                offers = await provider.search(destination, check_in, check_out)
                if offers:
                    results.extend(offers)
            except Exception as e:
                logger.warning(f"Hotel provider {provider.__class__.__name__} failed: {e}")
                
        # If all API queries fail or return empty, trigger mock database fallback
        if not results:
            logger.info("All hotel providers returned empty or failed. Triggering mock fallback.")
            try:
                results = await self.fallback.search(destination, check_in, check_out)
            except Exception as fe:
                logger.error(f"Fallback hotel provider failed: {fe}")
                
        return results
