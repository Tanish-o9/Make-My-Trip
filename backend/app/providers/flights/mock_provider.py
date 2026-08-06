import datetime
import uuid
import random
from typing import Dict, Any, List
from app.providers.base import BaseFlightProvider, NormalizedOffer

class MockFlightProvider(BaseFlightProvider):
    async def search(self, origin: str, destination: str, date: str) -> List[NormalizedOffer]:
        airlines = ["6E", "AI", "UK", "QP"]
        airline_names = {
            "6E": "IndiGo",
            "AI": "Air India",
            "UK": "Vistara",
            "QP": "Akasa Air"
        }
        offers = []
        for idx in range(4):
            airline = airlines[idx % len(airlines)]
            name = airline_names[airline]
            flight_num = f"{airline}-{200 + idx * 47}"
            base_price = 4200.0 + idx * 1150.0
            
            f_details = {
                "airline": name,
                "flight_number": flight_num,
                "airline_code": airline,
                "origin": origin,
                "destination": destination,
                "departure_time": f"{date}T{8 + idx*3:02d}:15:00",
                "arrival_time": f"{date}T{10 + idx*3:02d}:30:00",
                "terminal": "T2" if idx % 2 == 0 else "T3",
                "duration_minutes": 135,
                "layovers": [],
                "price_per_passenger": base_price,
                "total_price": base_price,
                "currency": "INR",
                "baggage": "15 kg",
                "cabin": "ECONOMY",
                "seats_remaining": 5 + idx,
                "logo": f"https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=50"
            }
            
            offers.append(NormalizedOffer(
                id=f"OF-MK-{uuid.uuid4().hex[:6].upper()}",
                provider_name="MockFlight",
                price=base_price,
                currency="INR",
                availability_status="available",
                cancellation_policy="Refundable with fee",
                raw_provider_ref=flight_num,
                expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
                details=f_details,
                is_simulated=True
            ))
        return offers

    async def hold(self, offer_id: str, passenger_details: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {"success": True, "hold_id": f"HLD-MK-{uuid.uuid4().hex[:6].upper()}", "provider_name": "MockFlight"}

    async def confirm(self, hold_id: str, payment_ref: str) -> Dict[str, Any]:
        return {"success": True, "booking_ref": f"PBR-MK-{uuid.uuid4().hex[:8].upper()}", "provider_name": "MockFlight"}

    async def cancel(self, booking_ref: str) -> Dict[str, Any]:
        return {"success": True, "message": "Cancelled at MockFlight"}
