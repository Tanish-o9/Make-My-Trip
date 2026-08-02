import datetime
import uuid
import random
from typing import Dict, Any, List
from app.providers.base import BaseHotelProvider, NormalizedOffer
from app.database import SessionLocal
from app.models.search_entities import City, HotelProperty, HotelRoom

class HotelBedsProvider(BaseHotelProvider):
    SIMULATED_PROVIDER = True

    async def search(self, destination: str, check_in: str, check_out: str) -> List[NormalizedOffer]:
        db = SessionLocal()
        offers = []
        try:
            city_name = destination.split(" ")[0] if destination else "Goa"
            city_obj = db.query(City).filter(City.name.like(f"%{city_name}%")).first()
            if city_obj:
                props = db.query(HotelProperty).filter(HotelProperty.city_id == city_obj.id).all()
            else:
                props = db.query(HotelProperty).all()

            for p in props:
                room = db.query(HotelRoom).filter(HotelRoom.hotel_id == p.id).first()
                base_price = float(room.price) if room else 4500.0
                price = round((base_price * 0.95) / 50) * 50
                
                offer_id = f"OF-HB-{uuid.uuid4().hex[:6].upper()}"
                expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
                
                h_detail = {
                    "hotel_id": p.id,
                    "name": p.name,
                    "rating": p.star_rating,
                    "address": p.address,
                    "amenities": p.amenities_json,
                    "details": p.description,
                    "room_type": room.room_type if room else "Standard Room"
                }

                offers.append(NormalizedOffer(
                    id=offer_id,
                    provider_name="HotelBeds",
                    price=price,
                    currency="INR",
                    availability_status="available",
                    cancellation_policy="Refundable with fee",
                    raw_provider_ref=f"HB-{p.id}",
                    expires_at=expires_at,
                    details=h_detail,
                    is_simulated=True
                ))
        finally:
            db.close()
        return offers

    async def hold(self, offer_id: str, guest_details: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "success": True,
            "hold_id": f"HLD-HB-{uuid.uuid4().hex[:6].upper()}",
            "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(minutes=5)).isoformat(),
            "provider_name": "HotelBeds"
        }

    async def confirm(self, hold_id: str, payment_ref: str) -> Dict[str, Any]:
        return {
            "success": True,
            "booking_ref": f"PBR-HB-{uuid.uuid4().hex[:8].upper()}",
            "provider_name": "HotelBeds"
        }

    async def cancel(self, booking_ref: str) -> Dict[str, Any]:
        return {
            "success": True,
            "message": "Cancelled at HotelBeds"
        }
