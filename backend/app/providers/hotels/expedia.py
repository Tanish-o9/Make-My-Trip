import datetime
import uuid
import random
from typing import Dict, Any, List
from app.providers.base import BaseHotelProvider, NormalizedOffer
from app.database import SessionLocal
from app.models.search_entities import City, HotelProperty, HotelRoom

class ExpediaProvider(BaseHotelProvider):
    SIMULATED_PROVIDER = True

    async def search(self, destination: str, check_in: str, check_out: str) -> List[NormalizedOffer]:
        import json
        db = SessionLocal()
        offers = []
        try:
            city_name = destination.split(" ")[0] if destination else "Goa"
            city_obj = db.query(City).filter(City.name.like(f"%{city_name}%")).first()
            if city_obj:
                props = db.query(HotelProperty).filter(HotelProperty.city_id == city_obj.id).all()
            else:
                props = db.query(HotelProperty).all()

            # Dynamic price multipliers
            weekend_multiplier = 1.0
            season_multiplier = 1.0
            try:
                check_in_dt = datetime.datetime.strptime(check_in, "%Y-%m-%d")
                check_out_dt = datetime.datetime.strptime(check_out, "%Y-%m-%d")
                
                # Check for weekend nights (Friday or Saturday night)
                curr = check_in_dt
                while curr < check_out_dt:
                    if curr.weekday() in [4, 5]:  # Friday, Saturday
                        weekend_multiplier = 1.20
                        break
                    curr += datetime.timedelta(days=1)
                
                # Seasonality multiplier
                month = check_in_dt.month
                if month in [12, 1]:  # Winter peak
                    if city_name in ["Goa", "Manali", "Shimla", "Srinagar", "Leh", "Darjeeling"]:
                        season_multiplier = 1.40
                    else:
                        season_multiplier = 1.15
                elif month in [6, 7]:  # Monsoon low / summer hills peak
                    if city_name in ["Goa", "Jaipur", "Udaipur"]:
                        season_multiplier = 0.75
                    elif city_name in ["Manali", "Shimla", "Srinagar", "Leh", "Darjeeling"]:
                        season_multiplier = 1.25
            except Exception:
                pass

            for p in props:
                room = db.query(HotelRoom).filter(HotelRoom.hotel_id == p.id).first()
                base_price = float(room.price) if room else 4500.0
                
                # Calculate dynamic final price
                price = base_price * weekend_multiplier * season_multiplier * 1.05
                price = round(price / 50) * 50
                
                # Parse metadata JSON from description
                try:
                    desc_data = json.loads(p.description)
                    text = desc_data.get("text", p.description)
                    guest_review_score = desc_data.get("guest_review_score", 8.5)
                    review_count = desc_data.get("review_count", 250)
                    category = desc_data.get("category", "Hotel")
                    breakfast_included = desc_data.get("breakfast_included", False)
                    free_cancellation = desc_data.get("free_cancellation", False)
                    distance_from_center = desc_data.get("distance_from_center", 2.0)
                    lat = desc_data.get("lat", city_obj.lat if city_obj else 0.0)
                    lng = desc_data.get("lng", city_obj.lng if city_obj else 0.0)
                except Exception:
                    text = p.description
                    guest_review_score = 8.5
                    review_count = 120
                    category = "Hotel"
                    breakfast_included = False
                    free_cancellation = False
                    distance_from_center = 3.5
                    lat = city_obj.lat if city_obj else 0.0
                    lng = city_obj.lng if city_obj else 0.0

                offer_id = f"OF-EX-{uuid.uuid4().hex[:6].upper()}"
                expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
                
                h_detail = {
                    "hotel_id": p.id,
                    "name": p.name,
                    "rating": p.star_rating,
                    "address": p.address,
                    "amenities": p.amenities_json,
                    "details": text,
                    "room_type": room.room_type if room else "Standard Room",
                    "guest_review_score": guest_review_score,
                    "review_count": review_count,
                    "category": category,
                    "breakfast_included": breakfast_included,
                    "free_cancellation": free_cancellation,
                    "distance_from_center": distance_from_center,
                    "lat": lat,
                    "lng": lng
                }

                offers.append(NormalizedOffer(
                    id=offer_id,
                    provider_name="Expedia",
                    price=price,
                    currency="INR",
                    availability_status="available",
                    cancellation_policy="Free Cancellation" if free_cancellation else "Non-Refundable",
                    raw_provider_ref=f"EX-{p.id}",
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
            "hold_id": f"HLD-EX-{uuid.uuid4().hex[:6].upper()}",
            "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(minutes=5)).isoformat(),
            "provider_name": "Expedia"
        }

    async def confirm(self, hold_id: str, payment_ref: str) -> Dict[str, Any]:
        return {
            "success": True,
            "booking_ref": f"PBR-EX-{uuid.uuid4().hex[:8].upper()}",
            "provider_name": "Expedia"
        }

    async def cancel(self, booking_ref: str) -> Dict[str, Any]:
        return {
            "success": True,
            "message": "Cancelled at Expedia"
        }
