import uuid
import datetime
from typing import Dict, Any, List, Optional
from app.providers.cars.base import CarRentalProvider
from app.providers.car_rental_provider import NormalizedCarRentalOffer, NormalizedCarRentalQuote, NormalizedCarRentalBookingResult
from app.utils.vehicle_images import get_vehicle_image_url


class LocalCarRentalProvider(CarRentalProvider):
    """Local first-party self-drive fleet provider"""

    def __init__(self):
        self.name = "Ghumne Chale Drive"
        self.is_live = False

    async def search(
        self,
        pickup_location: str,
        drop_location: str,
        pickup_date: str,
        pickup_time: str,
        return_date: str,
        return_time: str,
        driver_age: int = 25,
        driver_country: str = "India",
        category: Optional[str] = None,
        transmission: Optional[str] = None,
        fuel_type: Optional[str] = None,
    ) -> List[NormalizedCarRentalOffer]:
        expiry = (datetime.datetime.utcnow() + datetime.timedelta(minutes=20)).isoformat()
        
        try:
            d1 = datetime.datetime.fromisoformat(pickup_date).date()
            d2 = datetime.datetime.fromisoformat(return_date).date()
            days = max(1, (d2 - d1).days)
        except Exception:
            days = 2

        fleet_templates = [
            {"brand": "Hyundai", "model": "Grand i10 Nios", "category": "Hatchback", "seats": 4, "luggage": 2, "fuel": "Petrol", "trans": "Manual", "daily": 1400.0, "image_key": "grand-i10", "deposit": 3000.0},
            {"brand": "Maruti Suzuki", "model": "Swift", "category": "Hatchback", "seats": 4, "luggage": 2, "fuel": "Petrol", "trans": "Manual", "daily": 1500.0, "image_key": "swift", "deposit": 3000.0},
            {"brand": "Maruti Suzuki", "model": "Dzire", "category": "Sedan", "seats": 4, "luggage": 3, "fuel": "Petrol", "trans": "Automatic", "daily": 1850.0, "image_key": "dzire", "deposit": 4000.0},
            {"brand": "Hyundai", "model": "Verna Turbo", "category": "Sedan", "seats": 4, "luggage": 3, "fuel": "Petrol", "trans": "Automatic", "daily": 2600.0, "image_key": "verna", "deposit": 5000.0},
            {"brand": "Hyundai", "model": "Creta", "category": "SUV", "seats": 5, "luggage": 4, "fuel": "Diesel", "trans": "Automatic", "daily": 2800.0, "image_key": "creta", "deposit": 6000.0},
            {"brand": "Mahindra", "model": "XUV700", "category": "SUV", "seats": 6, "luggage": 4, "fuel": "Diesel", "trans": "Automatic", "daily": 3800.0, "image_key": "xuv700", "deposit": 8000.0},
            {"brand": "Toyota", "model": "Innova Crysta", "category": "MPV", "seats": 7, "luggage": 5, "fuel": "Diesel", "trans": "Automatic", "daily": 4200.0, "image_key": "innova-crysta", "deposit": 8000.0},
            {"brand": "Tata", "model": "Nexon EV", "category": "EV", "seats": 4, "luggage": 3, "fuel": "EV", "trans": "Automatic", "daily": 2400.0, "image_key": "nexon-ev", "deposit": 5000.0},
            {"brand": "Mercedes-Benz", "model": "E-Class", "category": "Luxury", "seats": 4, "luggage": 3, "fuel": "Petrol", "trans": "Automatic", "daily": 8500.0, "image_key": "mercedes-e-class", "deposit": 25000.0}
        ]

        offers: List[NormalizedCarRentalOffer] = []
        for tmpl in fleet_templates:
            if category and category.lower() != "all" and tmpl["category"].lower() != category.lower():
                continue
            if transmission and transmission.lower() != "all" and tmpl["trans"].lower() != transmission.lower():
                continue
            if fuel_type and fuel_type.lower() != "all" and tmpl["fuel"].lower() != fuel_type.lower():
                continue

            rate = tmpl["daily"]
            subtotal = rate * days
            gst = round(subtotal * 0.18, 2)
            total = round(subtotal + gst)
            img = get_vehicle_image_url(tmpl["image_key"])

            offers.append(NormalizedCarRentalOffer(
                id=f"CAR-LOC-{uuid.uuid4().hex[:6].upper()}",
                provider=self.name,
                provider_offer_id=f"OFF-DRV-{tmpl['image_key']}",
                brand=tmpl["brand"],
                model=tmpl["model"],
                display_name=f"{tmpl['brand']} {tmpl['model']} Self-Drive",
                category=tmpl["category"],
                image_key=tmpl["image_key"],
                image_url=img,
                thumbnail_url=img,
                seating_capacity=tmpl["seats"],
                luggage_capacity=tmpl["luggage"],
                fuel_type=tmpl["fuel"],
                transmission=tmpl["trans"],
                air_conditioning=True,
                rating=4.85,
                review_count=1420,
                daily_rate=rate,
                total_price=float(total),
                currency="INR",
                included_mileage="Unlimited Kilometers",
                security_deposit=tmpl["deposit"],
                insurance_options=[
                    {"code": "basic", "name": "Basic CDW (₹500/day)", "price_per_day": 500.0, "excess": 10000.0},
                    {"code": "premium", "name": "Zero-Dep Premium Cover (₹950/day)", "price_per_day": 950.0, "excess": 0.0}
                ],
                cancellation_policy="Free cancellation up to 24 hours prior to pickup",
                pickup_location=pickup_location,
                drop_location=drop_location or pickup_location,
                is_live=False,
                source="demo",
                expires_at=expiry
            ))
        return offers

    async def get_vehicle(self, offer_id: str) -> Optional[NormalizedCarRentalOffer]:
        search_res = await self.search("Delhi Hub", "Delhi Hub", "2026-08-15", "10:00", "2026-08-17", "10:00")
        for o in search_res:
            if o.id == offer_id or o.provider_offer_id == offer_id:
                return o
        return search_res[0] if search_res else None

    async def get_quote(
        self,
        offer_id: str,
        rental_days: int = 2,
        insurance_code: Optional[str] = "basic",
        current_price: Optional[float] = None
    ) -> NormalizedCarRentalQuote:
        expiry = (datetime.datetime.utcnow() + datetime.timedelta(minutes=15)).isoformat()
        daily = 2200.0
        base = daily * rental_days
        ins_rate = 500.0 if insurance_code == "basic" else (950.0 if insurance_code == "premium" else 0.0)
        ins_fee = ins_rate * rental_days
        plat = 100.0
        subtotal = base + ins_fee + plat
        gst = round(subtotal * 0.18, 2)
        total = round(subtotal + gst)

        return NormalizedCarRentalQuote(
            quote_id=f"CAR-QUO-{uuid.uuid4().hex[:8].upper()}",
            offer_id=offer_id,
            provider=self.name,
            provider_offer_id=offer_id,
            rental_days=rental_days,
            daily_rate=daily,
            base_rental=base,
            insurance_fee=ins_fee,
            platform_fee=plat,
            gst=gst,
            total_payable=float(total),
            security_deposit=5000.0,
            currency="INR",
            expires_at=expiry,
            is_price_changed=False
        )

    async def create_booking(
        self,
        quote_id: str,
        driver_details: Dict[str, Any],
        idempotency_key: str,
        amount: float
    ) -> NormalizedCarRentalBookingResult:
        ref = f"CAR-{uuid.uuid4().hex[:8].upper()}"
        return NormalizedCarRentalBookingResult(
            success=True,
            booking_reference=ref,
            provider_booking_ref=f"PBR-CAR-{uuid.uuid4().hex[:6].upper()}",
            provider=self.name,
            status="CONFIRMED",
            pickup_hub="Airport T3 Self-Drive Terminal Hub",
            pickup_instructions="Present your original Driving License & Aadhaar/Passport at Hub Counter 4.",
            voucher_url=f"/api/v1/cars/{ref}/voucher",
            reconciliation_required=False,
            message="Self-drive vehicle reserved and key handover scheduled."
        )

    async def cancel_booking(self, booking_ref: str, reason: Optional[str] = None) -> Dict[str, Any]:
        return {
            "success": True,
            "booking_reference": booking_ref,
            "status": "CANCELLED",
            "refund_percentage": 1.0,
            "message": "Self-drive rental cancelled without penalty."
        }
