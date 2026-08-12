import uuid
import datetime
from typing import Dict, Any, List, Optional
from app.providers.cab.base import CabProvider
from app.providers.cab_provider import NormalizedCabOffer, NormalizedCabQuote, NormalizedCabBookingResult
from app.database import SessionLocal
from app.models.search_entities import CabVehicle, City
from app.utils.vehicle_images import resolve_vehicle_image_key, get_vehicle_image_url


class LocalCabProvider(CabProvider):
    """Local / First-Party deterministic fleet provider (330 vehicles across 22 cities)"""
    
    def __init__(self):
        self.name = "Ghumne Chale Local Fleet"
        self.is_live = False

    async def search(
        self,
        pickup_address: str,
        drop_address: str,
        trip_type: str,
        pickup_date: Optional[str] = None,
        pickup_time: Optional[str] = None,
        return_date: Optional[str] = None,
        return_time: Optional[str] = None,
        passengers: int = 1,
        luggage_count: int = 0,
        hourly_duration: Optional[int] = 4,
        flight_number: Optional[str] = None,
        terminal: Optional[str] = None,
        category: Optional[str] = None,
    ) -> List[NormalizedCabOffer]:
        db = SessionLocal()
        try:
            distance_km = 24.5
            duration_mins = 45
            if trip_type == "round_trip":
                distance_km = 49.0
                duration_mins = 90
            elif trip_type == "hourly":
                distance_km = float((hourly_duration or 4) * 10.0)
                duration_mins = (hourly_duration or 4) * 60

            p_lower = pickup_address.lower()
            matched_city = None
            cities = db.query(City).all()
            for c in cities:
                if c.name.lower() in p_lower:
                    matched_city = c
                    break

            query = db.query(CabVehicle).filter(CabVehicle.availability_status == "available")
            if matched_city:
                city_vehicles = query.filter(CabVehicle.city_id == matched_city.id).all()
                db_vehicles = city_vehicles if city_vehicles else query.all()
            else:
                db_vehicles = query.all()

            if not db_vehicles:
                class MockCab:
                    def __init__(self, d):
                        for k, v in d.items():
                            setattr(self, k, v)

                mock_data = [
                    {"id": 1, "provider": "Ghumne Chale Mini", "type": "Hatchback", "category": "Hatchback", "brand": "Maruti Suzuki", "model": "Swift", "display_name": "Maruti Suzuki Swift", "variant": "ZXi Plus", "image_key": "swift", "base_fare": 150.0, "price_per_km": 13.0, "per_hour_rate": 180.0, "seating_capacity": 4, "luggage_capacity": 2, "fuel_type": "Petrol", "transmission": "Manual", "ac_available": True, "rating": 4.8, "review_count": 1420, "image_url": "/assets/vehicles/swift.webp", "thumbnail_url": "/assets/vehicles/swift.webp", "eta_minutes": 3, "driver_name": "Ramesh Kumar", "plate_number": "DL-01-AB-1234"},
                    {"id": 2, "provider": "Ola Prime Sedan", "type": "Sedan", "category": "Sedan", "brand": "Maruti Suzuki", "model": "Dzire", "display_name": "Maruti Suzuki Dzire", "variant": "ZXi Auto", "image_key": "dzire", "base_fare": 200.0, "price_per_km": 16.0, "per_hour_rate": 220.0, "seating_capacity": 4, "luggage_capacity": 3, "fuel_type": "Petrol", "transmission": "Automatic", "ac_available": True, "rating": 4.9, "review_count": 2840, "image_url": "/assets/vehicles/dzire.webp", "thumbnail_url": "/assets/vehicles/dzire.webp", "eta_minutes": 5, "driver_name": "Suresh Singh", "plate_number": "DL-01-CD-5678"},
                    {"id": 3, "provider": "Ghumne Chale SUV", "type": "SUV", "category": "SUV", "brand": "Hyundai", "model": "Creta", "display_name": "Hyundai Creta", "variant": "SX(O) Diesel", "image_key": "creta", "base_fare": 300.0, "price_per_km": 21.0, "per_hour_rate": 320.0, "seating_capacity": 5, "luggage_capacity": 4, "fuel_type": "Diesel", "transmission": "Automatic", "ac_available": True, "rating": 4.9, "review_count": 1920, "image_url": "/assets/vehicles/creta.webp", "thumbnail_url": "/assets/vehicles/creta.webp", "eta_minutes": 7, "driver_name": "Gurpreet Singh", "plate_number": "DL-01-EF-9012"}
                ]
                db_vehicles = [MockCab(m) for m in mock_data]

            offers: List[NormalizedCabOffer] = []
            seen_models = set()
            expiry = (datetime.datetime.utcnow() + datetime.timedelta(minutes=15)).isoformat()

            for vh in db_vehicles:
                if vh.seating_capacity < passengers:
                    continue
                if luggage_count > 0 and vh.luggage_capacity < luggage_count:
                    continue
                if category and category.lower() != "all":
                    if (vh.category or vh.type).lower() != category.lower():
                        continue

                model_key = f"{vh.brand}_{vh.model}"
                if model_key in seen_models:
                    continue
                seen_models.add(model_key)

                base_charge = float(vh.base_fare)
                distance_charge = round(distance_km * float(vh.price_per_km), 2)
                driver_allowance = 350.0 if trip_type == "round_trip" else 0.0
                toll_parking = 150.0 if trip_type == "round_trip" else (100.0 if trip_type == "airport_transfer" else 60.0)
                platform_fee = 40.0

                if trip_type == "hourly":
                    hours = hourly_duration or 4
                    base_charge = float(vh.per_hour_rate) * hours
                    distance_charge = 0.0
                    toll_parking = 50.0

                subtotal = base_charge + distance_charge + driver_allowance + toll_parking + platform_fee
                gst = round(subtotal * 0.05, 2)
                total_fare = round(subtotal + gst)

                image_key = getattr(vh, "image_key", None) or resolve_vehicle_image_key(vh.model, vh.brand, vh.category)
                image_url = get_vehicle_image_url(image_key)

                offers.append(NormalizedCabOffer(
                    id=f"CAB-OFF-{vh.id}-{uuid.uuid4().hex[:4]}",
                    provider=getattr(vh, "provider", "Ghumne Chale Fleet"),
                    provider_offer_id=f"LOCAL-{vh.id}",
                    brand=vh.brand,
                    model=vh.model,
                    display_name=getattr(vh, "display_name", f"{vh.brand} {vh.model}"),
                    variant=getattr(vh, "variant", "Standard"),
                    category=getattr(vh, "category", getattr(vh, "type", "Sedan")),
                    image_key=image_key,
                    image_url=image_url,
                    thumbnail_url=image_url,
                    seating_capacity=vh.seating_capacity,
                    luggage_capacity=vh.luggage_capacity,
                    fuel_type=getattr(vh, "fuel_type", "Petrol"),
                    transmission=getattr(vh, "transmission", "Manual"),
                    ac_available=getattr(vh, "ac_available", True),
                    rating=getattr(vh, "rating", 4.8),
                    review_count=getattr(vh, "review_count", 1200),
                    plate_number=getattr(vh, "plate_number", "DL-01-AB-1234"),
                    eta_mins=getattr(vh, "eta_minutes", 5),
                    driver_name=getattr(vh, "driver_name", "Verified Chauffeur"),
                    fare=float(total_fare),
                    currency="INR",
                    breakdown={
                        "base_fare": base_charge,
                        "distance_charge": distance_charge,
                        "driver_allowance": driver_allowance,
                        "toll_parking": toll_parking,
                        "platform_fee": platform_fee,
                        "gst": gst,
                        "total_fare": total_fare
                    },
                    cancellation_policy="Free cancellation up to 2 hours before pickup (95% refund)",
                    is_live=False,
                    source="demo",
                    expires_at=expiry
                ))
            return offers
        finally:
            db.close()

    async def get_quote(self, offer_id: str, current_price: Optional[float] = None) -> NormalizedCabQuote:
        expiry = (datetime.datetime.utcnow() + datetime.timedelta(minutes=10)).isoformat()
        price = current_price or 1450.0
        base = round(price * 0.2)
        dist = round(price * 0.6)
        gst = round(price * 0.05)
        toll = 100.0
        plat = 40.0
        return NormalizedCabQuote(
            quote_id=f"QUO-{uuid.uuid4().hex[:8].upper()}",
            offer_id=offer_id,
            provider=self.name,
            provider_offer_id=offer_id,
            base_fare=float(base),
            distance_charge=float(dist),
            driver_allowance=0.0,
            toll_parking=float(toll),
            platform_fee=float(plat),
            gst=float(gst),
            total_fare=float(price),
            currency="INR",
            expires_at=expiry,
            is_price_changed=False
        )

    async def create_booking(
        self,
        offer_id: str,
        passenger_details: Dict[str, Any],
        idempotency_key: str,
        amount: float
    ) -> NormalizedCabBookingResult:
        ref = f"CAB-{uuid.uuid4().hex[:8].upper()}"
        return NormalizedCabBookingResult(
            success=True,
            booking_reference=ref,
            provider_booking_ref=f"PBR-LOC-{uuid.uuid4().hex[:6].upper()}",
            provider=self.name,
            status="CONFIRMED",
            driver_name="Rameshwar Sharma",
            driver_phone="+91 98765 43210",
            vehicle_number="DL-01-AB-1234",
            reconciliation_required=False,
            message="Chauffeur confirmed and dispatched."
        )

    async def cancel_booking(self, booking_ref: str, reason: Optional[str] = None) -> Dict[str, Any]:
        return {
            "success": True,
            "booking_reference": booking_ref,
            "status": "CANCELLED",
            "refund_percentage": 0.95,
            "message": "Cab booking cancelled successfully at local fleet provider."
        }

    async def get_tracking(self, booking_ref: str) -> Dict[str, Any]:
        return {
            "booking_reference": booking_ref,
            "driver_name": "Rameshwar Sharma",
            "driver_phone": "+91 98765 43210",
            "vehicle_number": "DL-01-AB-1234",
            "vehicle_model": "Maruti Suzuki Dzire",
            "status": "DRIVER_ON_THE_WAY",
            "current_location": {"lat": 28.5562, "lng": 77.1000},
            "pickup_location": {"lat": 28.5562, "lng": 77.0999},
            "eta_mins": 6,
            "remaining_distance_km": 2.4,
            "simulated": True
        }
