import datetime
import uuid
import random
from typing import Dict, Any, List
from app.providers.base import BaseFlightProvider, NormalizedOffer

# ──────────────────────────────────────────────────────────────────────────────
# SIMULATION STATUS: FULLY SIMULATED
# TBO does not have any API integration. All offers are fabricated with random
# prices and flight numbers. This adapter exists as a scaffold for when real
# TBO API credentials become available.
#
# No real TBO API key or endpoint is configured. Every offer from this
# provider has is_simulated=True and the frontend MUST NOT show "via TBO"
# attribution for these results.
# ──────────────────────────────────────────────────────────────────────────────
SIMULATED_PROVIDER = True


class TBOProvider(BaseFlightProvider):
    SIMULATED_PROVIDER = True

    async def search(self, origin: str, destination: str, date: str) -> List[NormalizedOffer]:
        # Generate simulated flight offers with random pricing
        # These do NOT represent real TBO inventory
        airlines = ["6E", "AI", "UK"]
        offers = []
        
        for idx in range(3):
            airline = random.choice(airlines)
            flight_num = f"{airline}-{100 + idx * 53}"
            base_price = 4500.0 + idx * 1200.0 + random.randint(-200, 200)
            
            offer_id = f"OF-TB-{uuid.uuid4().hex[:6].upper()}"
            expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
            
            f_detail = {
                "flight_number": flight_num,
                "airline": airline,
                "airline_code": airline,
                "origin": origin,
                "destination": destination,
                "departure_time": f"{date}T{8 + idx*4:02d}:30:00",
                "arrival_time": f"{date}T{10 + idx*4:02d}:45:00",
                "duration_minutes": 135,
                "layovers": [],
                "cabin_class": "ECONOMY",
                "price_per_passenger": base_price,
                "total_price": base_price,
                "currency": "INR"
            }
            
            offers.append(NormalizedOffer(
                id=offer_id,
                provider_name="TBO",
                price=base_price,
                currency="INR",
                availability_status="available",
                cancellation_policy="Non-Refundable" if idx == 0 else "Refundable with fee",
                raw_provider_ref=flight_num,
                expires_at=expires_at,
                details=f_detail,
                is_simulated=True  # NO REAL API — always simulated
            ))
        return offers

    async def hold(self, offer_id: str, passenger_details: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "success": True,
            "hold_id": f"HLD-TB-{uuid.uuid4().hex[:6].upper()}",
            "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(minutes=5)).isoformat(),
            "provider_name": "TBO"
        }

    async def confirm(self, hold_id: str, payment_ref: str) -> Dict[str, Any]:
        return {
            "success": True,
            "booking_ref": f"PBR-TB-{uuid.uuid4().hex[:8].upper()}",
            "provider_name": "TBO"
        }

    async def cancel(self, booking_ref: str) -> Dict[str, Any]:
        return {
            "success": True,
            "message": "Cancelled at TBO"
        }
