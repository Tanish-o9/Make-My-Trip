import os
import logging
from typing import List, Dict, Any
from app.providers.base import BaseFlightProvider, NormalizedOffer
from app.providers.flights.amadeus import AmadeusProvider
from app.providers.flights.skyscanner_rapid import SkyscannerRapidProvider

logger = logging.getLogger(__name__)


def _amadeus_is_configured() -> bool:
    cid = os.getenv("AMADEUS_CLIENT_ID", "")
    csec = os.getenv("AMADEUS_CLIENT_SECRET", "")
    placeholders = {"", "your-amadeus-id", "your-amadeus-secret"}
    return cid not in placeholders and csec not in placeholders


class FlightProviderManager:
    def __init__(self):
        # Priority 1: Skyscanner via RapidAPI (uses existing RAPIDAPI_KEY)
        # Priority 2: Amadeus (only if real credentials are configured)
        self.providers: List[BaseFlightProvider] = [SkyscannerRapidProvider()]
        if _amadeus_is_configured():
            self.providers.append(AmadeusProvider())
            logger.info("FlightProviderManager: Amadeus provider added (real credentials detected).")

    async def search_all(self, origin: str, destination: str, date: str) -> List[NormalizedOffer]:
        last_error = None
        for provider in self.providers:
            try:
                offers = await provider.search(origin, destination, date)
                if offers:
                    logger.info(f"FlightProviderManager: {provider.__class__.__name__} returned {len(offers)} offers.")
                    return offers
                else:
                    logger.warning(f"FlightProviderManager: {provider.__class__.__name__} returned 0 offers, trying next.")
            except Exception as e:
                logger.error(f"FlightProviderManager: {provider.__class__.__name__} failed: {e}")
                last_error = e
                continue

        # All providers failed — surface a clear diagnostic error
        raise last_error or ValueError(
            "No flight providers returned results. "
            "Check RAPIDAPI_KEY in backend/.env and ensure sky-scrapper.p.rapidapi.com is subscribed."
        )

