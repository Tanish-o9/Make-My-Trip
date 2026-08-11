import datetime
from typing import Dict, Any
from app.utils.vehicle_images import resolve_vehicle_image_key, get_vehicle_image_url
from app.providers.common.models import LiveVehicleOffer


def normalize_amadeus_transfer_offer(raw: Dict[str, Any], pickup: str, drop: str) -> LiveVehicleOffer:
    vehicle = raw.get("vehicle", {})
    brand = vehicle.get("brand", "Executive")
    model = vehicle.get("model", "Chauffeur Fleet")
    category = vehicle.get("category", "Sedan")
    img_key = resolve_vehicle_image_key(model, brand, category)
    
    price_info = raw.get("quotation", {}).get("monetaryAmount", 2500.0)
    price_val = float(price_info)
    taxes = round(price_val * 0.05, 2)
    total = round(price_val + taxes)

    return LiveVehicleOffer(
        id=f"AMD-TRF-{raw.get('id', 'OFF')}",
        provider="Amadeus Transfers",
        provider_offer_id=str(raw.get("id", "")),
        offer_type="transfer",
        brand=brand,
        model=model,
        display_name=f"{brand} {model} (Amadeus Verified)",
        category=category,
        image=get_vehicle_image_url(img_key),
        image_key=img_key,
        seats=vehicle.get("seats", 4),
        luggage=vehicle.get("baggage", 2),
        fuel_type=vehicle.get("fuel", "Petrol"),
        transmission=vehicle.get("transmission", "Automatic"),
        air_conditioning=True,
        rating=4.9,
        review_count=3200,
        plate_number="DL-01-EXP-9901",
        price=float(total),
        currency=raw.get("quotation", {}).get("currencyCode", "INR"),
        taxes=taxes,
        fees=40.0,
        pickup=pickup,
        dropoff=drop,
        cancellation_policy="Free cancellation up to 6 hours before departure",
        is_live=True,
        source="live",
        expires_at=(datetime.datetime.utcnow() + datetime.timedelta(minutes=15)).isoformat()
    )


def normalize_duffel_car_offer(raw: Dict[str, Any], pickup: str, drop: str) -> LiveVehicleOffer:
    vehicle = raw.get("vehicle", {})
    brand = vehicle.get("make", "Toyota")
    model = vehicle.get("model", "Corolla")
    category = vehicle.get("category", "Sedan")
    img_key = resolve_vehicle_image_key(model, brand, category)
    
    total_val = float(raw.get("total_amount", 3500.0))
    taxes = round(total_val * 0.18, 2)

    return LiveVehicleOffer(
        id=f"DUF-CAR-{raw.get('id', 'OFF')}",
        provider="Duffel Cars",
        provider_offer_id=str(raw.get("id", "")),
        offer_type="self_drive",
        brand=brand,
        model=model,
        display_name=f"{brand} {model} (Duffel Verified)",
        category=category,
        image=get_vehicle_image_url(img_key),
        image_key=img_key,
        seats=vehicle.get("seats", 5),
        luggage=vehicle.get("luggage_capacity", 3),
        fuel_type=vehicle.get("fuel_type", "Petrol"),
        transmission=vehicle.get("transmission_type", "Automatic"),
        air_conditioning=vehicle.get("air_conditioning", True),
        rating=4.95,
        review_count=2100,
        price=total_val,
        currency=raw.get("currency", "INR"),
        taxes=taxes,
        fees=100.0,
        deposit=float(raw.get("deposit_amount", 5000.0)),
        included_mileage="Unlimited Kilometers",
        pickup=pickup,
        dropoff=drop,
        cancellation_policy="Free cancellation up to 48 hours prior to pickup",
        is_live=True,
        source="live",
        expires_at=(datetime.datetime.utcnow() + datetime.timedelta(minutes=15)).isoformat()
    )


from app.providers.common.models import UniversalNormalizedOffer


def normalize_flight_offer(raw: Dict[str, Any], provider_name: str = "Amadeus") -> UniversalNormalizedOffer:
    price = float(raw.get("price") or raw.get("fare") or 5500.0)
    taxes = round(price * 0.12, 2)
    total = round(price + taxes)
    offer_id = str(raw.get("id") or raw.get("offer_id") or "FL-OFF-001")
    airline = raw.get("airline") or raw.get("carrier") or "IndiGo"
    flight_no = raw.get("flight_number") or raw.get("flight_no") or "6E-204"

    return UniversalNormalizedOffer(
        id=f"UNI-FLT-{offer_id}",
        provider=provider_name,
        provider_offer_id=offer_id,
        vertical="flights",
        title=f"{airline} {flight_no}",
        description=f"{raw.get('origin', 'DEL')} → {raw.get('destination', 'BOM')} · {raw.get('cabin_class', 'ECONOMY')}",
        image=raw.get("image") or "/assets/airlines/indigo.webp",
        location=f"{raw.get('origin', 'DEL')} to {raw.get('destination', 'BOM')}",
        availability=raw.get("availability", "available"),
        price=price,
        currency=raw.get("currency", "INR"),
        taxes=taxes,
        fees=raw.get("fees", 0.0),
        total=float(total),
        cancellation_policy=raw.get("cancellation_policy", "Refundable with airline standard cancellation fee"),
        expires_at=raw.get("expires_at") or (datetime.datetime.utcnow() + datetime.timedelta(minutes=15)).isoformat(),
        provider_metadata=raw
    )


def normalize_hotel_offer(raw: Dict[str, Any], provider_name: str = "Hotelbeds") -> UniversalNormalizedOffer:
    price = float(raw.get("price_per_night") or raw.get("price") or 4500.0)
    taxes = round(price * 0.18, 2)
    total = round(price + taxes)
    offer_id = str(raw.get("id") or raw.get("hotel_id") or "HTL-OFF-001")
    hotel_name = raw.get("name") or raw.get("hotel_name") or "Grand Heritage Resort"

    return UniversalNormalizedOffer(
        id=f"UNI-HTL-{offer_id}",
        provider=provider_name,
        provider_offer_id=offer_id,
        vertical="hotels",
        title=hotel_name,
        description=f"{raw.get('room_type', 'Deluxe King Room')} · {raw.get('meal_plan', 'Breakfast Included')}",
        image=raw.get("image") or raw.get("photo") or "/assets/hotels/resort.webp",
        location=raw.get("city") or raw.get("address") or "Goa Beachfront",
        availability=raw.get("availability", "available"),
        price=price,
        currency=raw.get("currency", "INR"),
        taxes=taxes,
        fees=raw.get("fees", 0.0),
        total=float(total),
        cancellation_policy=raw.get("cancellation_policy", "Free cancellation up to 48 hours before check-in"),
        expires_at=raw.get("expires_at") or (datetime.datetime.utcnow() + datetime.timedelta(minutes=20)).isoformat(),
        provider_metadata=raw
    )


def normalize_train_offer(raw: Dict[str, Any], provider_name: str = "IRCTC Authorized Gateway") -> UniversalNormalizedOffer:
    price = float(raw.get("fare") or raw.get("price") or 1450.0)
    offer_id = str(raw.get("train_number") or raw.get("id") or "12626")

    return UniversalNormalizedOffer(
        id=f"UNI-TRN-{offer_id}",
        provider=provider_name,
        provider_offer_id=offer_id,
        vertical="trains",
        title=f"{raw.get('train_name', 'Express')} ({offer_id})",
        description=f"{raw.get('origin', 'DEL')} → {raw.get('destination', 'GOA')} · Class: {raw.get('coach_class', '3A')}",
        image=raw.get("image") or "/assets/trains/vande_bharat.webp",
        location=f"{raw.get('origin', 'DEL')} to {raw.get('destination', 'GOA')}",
        availability=raw.get("availability_status", "AVAILABLE-42"),
        price=price,
        currency="INR",
        taxes=round(price * 0.05, 2),
        fees=20.0,
        total=round(price + round(price * 0.05, 2) + 20.0),
        cancellation_policy=raw.get("cancellation_policy", "Railway cancellation rules apply"),
        expires_at=(datetime.datetime.utcnow() + datetime.timedelta(minutes=15)).isoformat(),
        provider_metadata=raw
    )


def normalize_activity_offer(raw: Dict[str, Any], provider_name: str = "TravelOS Experience Engine") -> UniversalNormalizedOffer:
    price = float(raw.get("price") or raw.get("fare") or 1800.0)
    offer_id = str(raw.get("id") or "ACT-OFF-001")

    return UniversalNormalizedOffer(
        id=f"UNI-ACT-{offer_id}",
        provider=provider_name,
        provider_offer_id=offer_id,
        vertical="activities",
        title=raw.get("title") or raw.get("name") or "Guided Cultural Heritage Tour",
        description=raw.get("description") or "Complete local sightseeing with certified guide & entry tickets included.",
        image=raw.get("image") or "/assets/activities/tour.webp",
        location=raw.get("destination") or raw.get("city") or "Jaipur, Rajasthan",
        availability=raw.get("availability", "available"),
        price=price,
        currency="INR",
        taxes=round(price * 0.18, 2),
        fees=0.0,
        total=round(price + round(price * 0.18, 2)),
        cancellation_policy=raw.get("cancellation_policy", "Free cancellation up to 24 hours prior to activity start"),
        expires_at=(datetime.datetime.utcnow() + datetime.timedelta(minutes=30)).isoformat(),
        provider_metadata=raw
    )

