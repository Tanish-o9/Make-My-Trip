import datetime
import uuid
from typing import Dict, Any, List
from app.providers.base import BaseHotelProvider, NormalizedOffer

class MockHotelProvider(BaseHotelProvider):
    async def search(self, destination: str, check_in: str, check_out: str) -> List[NormalizedOffer]:
        offers = []
        hotel_names = [
            f"Grand Heritage Resort in {destination.capitalize()}",
            f"Backpacker Cozy Stay {destination.capitalize()}"
        ]
        
        for idx, name in enumerate(hotel_names):
            price = 5500.0 if idx == 0 else 990.0
            rating = 4.7 if idx == 0 else 4.1
            
            h_details = {
                "hotel_name": name,
                "images": ["https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800"],
                "price": price,
                "rating": rating,
                "reviews": ["Breathtaking views and cozy layout!"],
                "amenities": ["Wifi", "Breakfast", "AC"] if idx == 1 else ["Pool", "Beach Access", "Spa", "Wifi", "Breakfast"],
                "distance": 0.8 + idx * 1.5,
                "location": f"Prime Coastline, {destination.capitalize()}",
                "cancellation_policy": "Free cancellation before stay starts" if idx == 0 else "Non-Refundable",
                "room_type": "Presidential Ocean Suite" if idx == 0 else "Shared Bunk Bed"
            }
            
            offers.append(NormalizedOffer(
                id=f"OF-HMK-{uuid.uuid4().hex[:6].upper()}",
                provider_name="MockHotel",
                price=price,
                currency="INR",
                availability_status="available",
                cancellation_policy=h_details["cancellation_policy"],
                raw_provider_ref=f"MOCK-HOTEL-{idx}",
                expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
                details=h_details,
                is_simulated=True
            ))
        return offers

    async def hold(self, offer_id: str, guest_details: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {"success": True, "hold_id": f"HLD-HMK-{uuid.uuid4().hex[:6].upper()}", "provider_name": "MockHotel"}

    async def confirm(self, hold_id: str, payment_ref: str) -> Dict[str, Any]:
        return {"success": True, "booking_ref": f"PBR-HMK-{uuid.uuid4().hex[:8].upper()}", "provider_name": "MockHotel"}

    async def cancel(self, booking_ref: str) -> Dict[str, Any]:
        return {"success": True, "message": "Cancelled at MockHotel"}
