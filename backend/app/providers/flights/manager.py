import logging
from typing import List, Dict, Any
from app.providers.base import BaseFlightProvider, NormalizedOffer
from app.providers.flights.amadeus import AmadeusProvider
from app.providers.flights.aviationstack import AviationStackProvider
from app.providers.flights.mock_provider import MockFlightProvider

logger = logging.getLogger(__name__)

class FlightProviderManager:
    def __init__(self):
        self.providers = [
            AmadeusProvider(),
            AviationStackProvider()
        ]
        self.fallback = MockFlightProvider()

    async def search_all(self, origin: str, destination: str, date: str) -> List[NormalizedOffer]:
        results = []
        for provider in self.providers:
            try:
                offers = await provider.search(origin, destination, date)
                if offers:
                    results.extend(offers)
            except Exception as e:
                logger.warning(f"Flight provider {provider.__class__.__name__} failed: {e}")
                
        # If all API queries return nothing, use high-fidelity mock fallback
        if not results:
            logger.info("All flight providers returned empty or failed. Triggering mock fallback.")
            try:
                results = await self.fallback.search(origin, destination, date)
            except Exception as fe:
                logger.error(f"Fallback flight provider failed: {fe}")
                
        return results
