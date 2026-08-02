import datetime
import uuid
import math
from typing import Dict, Any, List
from app.providers.base import BaseVehicleProvider, NormalizedOffer
from app.database import SessionLocal
from app.models.search_entities import City, Locality, RentalVehicle, VehicleAvailability

class FirstPartyVehicleProvider(BaseVehicleProvider):
    async def search(self, city: str, pickup: str, drop: str, type: str, self_drive: bool) -> List[NormalizedOffer]:
        db = SessionLocal()
        offers = []
        try:
            dest_clean = city.strip() if city else "Goa"
            locality_obj = db.query(Locality).filter(Locality.name.like(f"%{dest_clean}%")).first()
            if not locality_obj:
                locality_obj = db.query(Locality).filter(Locality.name == "Panaji").first()
            if not locality_obj:
                locality_obj = db.query(Locality).first()
                
            if not locality_obj:
                return []

            delivery_required = not locality_obj.has_rental_hub
            target_hub_id = locality_obj.nearest_hub_locality_id if delivery_required else locality_obj.id
            
            hub_locality = db.query(Locality).filter(Locality.id == target_hub_id).first()
            if not hub_locality:
                hub_locality = locality_obj

            vehicles_query = db.query(RentalVehicle).filter(
                RentalVehicle.hub_locality_id == hub_locality.id,
                RentalVehicle.is_active == True
            )
            
            if pickup and drop:
                try:
                    p_date = datetime.datetime.fromisoformat(pickup.split("T")[0] if "T" in pickup else pickup).date()
                    d_date = datetime.datetime.fromisoformat(drop.split("T")[0] if "T" in drop else drop).date()
                    
                    overlap_subquery = db.query(VehicleAvailability.vehicle_id).filter(
                        VehicleAvailability.start_date <= d_date,
                        VehicleAvailability.end_date >= p_date
                    ).subquery()
                    
                    vehicles_query = vehicles_query.filter(~RentalVehicle.id.in_(overlap_subquery))
                except Exception:
                    pass

            vehicles = vehicles_query.all()
            
            for vh in vehicles:
                offer_id = f"OF-VH-{uuid.uuid4().hex[:6].upper()}"
                expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
                
                delivery_fee = float(locality_obj.delivery_fee_beyond_radius) if delivery_required else 0.0
                delivery_eta_hours = 2 if delivery_required else 0
                
                v_detail = {
                    "vehicle_id": vh.id,
                    "name": vh.name,
                    "type": vh.type,
                    "brand": vh.brand,
                    "model": vh.model,
                    "price_per_day": float(vh.price_per_day),
                    "fuel_type": vh.fuel_type,
                    "transmission": vh.transmission,
                    "seating_capacity": vh.seating_capacity,
                    "self_drive_available": vh.self_drive_available,
                    "with_driver_available": vh.with_driver_available,
                    "distance_km": float(vh.distance_km),
                    "instant_confirm": vh.instant_confirm,
                    "rating": float(vh.rating),
                    "image_url": vh.image_url,
                    "delivery_required": delivery_required,
                    "delivery_fee": delivery_fee,
                    "delivery_eta_hours": delivery_eta_hours,
                    "nearest_hub_name": hub_locality.name,
                }

                offers.append(NormalizedOffer(
                    id=offer_id,
                    provider_name="FirstPartyFleet",
                    price=float(vh.price_per_day),
                    currency="INR",
                    availability_status="available",
                    cancellation_policy="Refundable (Full refund 24h prior)",
                    raw_provider_ref=f"FP-VEH-{vh.id}",
                    expires_at=expires_at,
                    details=v_detail
                ))
        finally:
            db.close()
        return offers

    async def hold(self, offer_id: str, driver_details: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "success": True,
            "hold_id": f"HLD-FP-{uuid.uuid4().hex[:6].upper()}",
            "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(minutes=5)).isoformat(),
            "provider_name": "FirstPartyFleet"
        }

    async def confirm(self, hold_id: str, payment_ref: str) -> Dict[str, Any]:
        return {
            "success": True,
            "booking_ref": f"PBR-FP-{uuid.uuid4().hex[:8].upper()}",
            "provider_name": "FirstPartyFleet"
        }

    async def cancel(self, booking_ref: str) -> Dict[str, Any]:
        return {
            "success": True,
            "message": "Cancelled at FirstPartyFleet"
        }
