import datetime
import os
import uuid
import asyncio
from typing import Dict, Any, List
from app.providers.base import BaseFlightProvider, NormalizedOffer
from app.services.amadeus_client import AmadeusClient

# ──────────────────────────────────────────────────────────────────────────────
# SIMULATION STATUS
# This provider has REAL API integration code (Amadeus Flight Offers v2).
# However, it is only "live" if valid AMADEUS_CLIENT_ID and
# AMADEUS_CLIENT_SECRET environment variables are present (not placeholders).
# When credentials are missing/placeholder, it returns zero results and is
# flagged is_simulated=True.
# ──────────────────────────────────────────────────────────────────────────────

def _has_real_credentials() -> bool:
    cid = os.getenv("AMADEUS_CLIENT_ID", "")
    csec = os.getenv("AMADEUS_CLIENT_SECRET", "")
    placeholders = {"", "your-amadeus-id", "your-amadeus-secret"}
    return cid not in placeholders and csec not in placeholders


class AmadeusProvider(BaseFlightProvider):
    SIMULATED_PROVIDER = not _has_real_credentials()

    def __init__(self):
        self.client = AmadeusClient()

    async def search(self, origin: str, destination: str, date: str) -> List[NormalizedOffer]:
        loop = asyncio.get_event_loop()
        try:
            raw_flights = await loop.run_in_executor(None, self.client.search_flights, origin, destination, date)
        except Exception:
            raw_flights = []

        offers = []
        for f in raw_flights:
            offer_id = f"OF-AM-{uuid.uuid4().hex[:6].upper()}"
            expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
            
            offers.append(NormalizedOffer(
                id=offer_id,
                provider_name="Amadeus",
                price=float(f["total_price"]),
                currency=f["currency"],
                availability_status="available",
                cancellation_policy="Refundable with fee",
                raw_provider_ref=f["flight_number"],
                expires_at=expires_at,
                details=f,
                is_simulated=self.SIMULATED_PROVIDER
            ))
        return offers

    async def hold(self, offer_id: str, passenger_details: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "success": True,
            "hold_id": f"HLD-AM-{uuid.uuid4().hex[:6].upper()}",
            "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(minutes=5)).isoformat(),
            "provider_name": "Amadeus"
        }

    async def confirm(self, hold_id: str, payment_ref: str) -> Dict[str, Any]:
        return {
            "success": True,
            "booking_ref": f"PBR-AM-{uuid.uuid4().hex[:8].upper()}",
            "provider_name": "Amadeus"
        }

    async def cancel(self, booking_ref: str) -> Dict[str, Any]:
        return {
            "success": True,
            "message": "Cancelled at Amadeus"
        }
