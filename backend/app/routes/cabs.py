from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.bookings import CabBooking, BookingStatus, BookingEvent
from app.models.search_entities import CabVehicle, City, Locality
from app.auth.dependencies import get_current_user
from app.models.core import User
import uuid
import datetime
import math
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cabs", tags=["cabs"])

# ── SCHEMAS ─────────────────────────────────────────────────────────────

class CabSearchRequest(BaseModel):
    pickup_address: str
    drop_address: Optional[str] = "City Center"
    trip_type: Optional[str] = "one_way" # one_way, round_trip, airport_transfer, hourly
    pickup_date: Optional[str] = None
    pickup_time: Optional[str] = None
    return_date: Optional[str] = None
    return_time: Optional[str] = None
    passengers: Optional[int] = 1
    luggage_count: Optional[int] = 1
    hourly_duration: Optional[int] = 4 # 4, 8, 12 hours
    flight_number: Optional[str] = None
    terminal: Optional[str] = None
    airport: Optional[str] = None
    category: Optional[str] = "all" # all, Hatchback, Sedan, SUV, MPV, Luxury, EV, Bike

class CabEstimateRequest(BaseModel):
    pickup_address: str
    drop_address: str
    cab_type: str
    trip_type: Optional[str] = "one_way"
    hourly_duration: Optional[int] = 4
    passengers: Optional[int] = 1

class PassengerItem(BaseModel):
    name: str
    age: Optional[int] = 30
    phone: Optional[str] = None
    is_primary: Optional[bool] = False

class CabBookRequest(BaseModel):
    pickup_address: str
    drop_address: str
    cab_type: str
    amount: float
    trip_type: Optional[str] = "one_way"
    pickup_time: Optional[str] = None
    return_time: Optional[str] = None
    passengers: Optional[int] = 1
    passenger_details: Optional[List[PassengerItem]] = None
    luggage_count: Optional[int] = 1
    flight_number: Optional[str] = None
    terminal: Optional[str] = None
    special_instructions: Optional[str] = None
    vehicle_name: Optional[str] = None

class CabCancelRequest(BaseModel):
    booking_reference: str
    reason: Optional[str] = "Change of plans"

class CabShareRequest(BaseModel):
    booking_reference: str
    phone_number: str

# ── HELPER FUNCTIONS ────────────────────────────────────────────────────

def compute_trip_metrics(pickup: str, drop: str, trip_type: str, hourly_duration: int = 4):
    p_lower = pickup.lower()
    d_lower = drop.lower() if drop else ""
    
    # Distance estimation heuristic
    is_airport = "airport" in p_lower or "airport" in d_lower or "terminal" in p_lower or "terminal" in d_lower
    is_intercity = any(city in p_lower for city in ["delhi", "mumbai", "jaipur", "agra", "goa", "bengaluru"]) and \
                    any(city in d_lower for city in ["delhi", "mumbai", "jaipur", "agra", "goa", "bengaluru"]) and \
                    not any(c in p_lower and c in d_lower for c in ["delhi", "mumbai", "jaipur", "agra", "goa", "bengaluru"])
    
    if trip_type == "hourly":
        km_package = hourly_duration * 10
        dist = float(km_package)
        dur = hourly_duration * 60
    elif is_intercity:
        dist = 220.0
        dur = 270
    elif is_airport:
        dist = 24.5
        dur = 45
    else:
        # Realistic city route distance
        raw_diff = abs(len(pickup) - len(drop or ""))
        dist = max(6.0, round(float(raw_diff % 18 + 7.5), 1))
        dur = max(15, round(dist * 2.1))
        
    if trip_type == "round_trip":
        dist = dist * 2
        dur = dur * 2 + 120 # includes waiting time
        
    return dist, int(dur)

def calculate_vehicle_fare(veh_data: dict, distance_km: float, trip_type: str, hourly_duration: int = 4):
    base_fare = float(veh_data.get("base_fare", 200.0))
    price_per_km = float(veh_data.get("price_per_km", 16.0))
    per_hour_rate = float(veh_data.get("per_hour_rate", 220.0))
    
    if trip_type == "hourly":
        base_charge = per_hour_rate * hourly_duration
        distance_charge = 0.0
        driver_fee = 150.0
        toll_parking = 50.0
    elif trip_type == "round_trip":
        base_charge = base_fare * 1.5
        distance_charge = distance_km * price_per_km
        driver_fee = 350.0
        toll_parking = 120.0
    elif trip_type == "airport_transfer":
        base_charge = base_fare + 100.0 # airport surcharge
        distance_charge = distance_km * price_per_km
        driver_fee = 150.0
        toll_parking = 80.0 # airport toll & parking
    else: # one_way
        base_charge = base_fare
        distance_charge = distance_km * price_per_km
        driver_fee = 100.0
        toll_parking = 40.0
        
    subtotal = base_charge + distance_charge + driver_fee + toll_parking
    platform_fee = 40.0
    gst = round((subtotal + platform_fee) * 0.05, 2)
    total_payable = round(subtotal + platform_fee + gst)
    
    breakdown = {
        "base_fare": round(base_charge, 2),
        "distance_charge": round(distance_charge, 2),
        "driver_allowance": round(driver_fee, 2),
        "toll_parking_estimate": round(toll_parking, 2),
        "platform_fee": round(platform_fee, 2),
        "gst_tax": round(gst, 2),
        "subtotal": round(subtotal, 2),
        "total_payable": total_payable,
        "currency": "INR"
    }
    return total_payable, breakdown

# ── ROUTES ──────────────────────────────────────────────────────────────

@router.post("/search")
async def search_cabs(req: CabSearchRequest, db: Session = Depends(get_db)):
    if not req.pickup_address or not req.pickup_address.strip():
        raise HTTPException(status_code=400, detail="Pickup address is required.")
        
    if req.trip_type != "hourly" and (not req.drop_address or not req.drop_address.strip()):
        raise HTTPException(status_code=400, detail="Drop address is required for this trip type.")
        
    if req.trip_type != "hourly" and req.pickup_address.strip().lower() == req.drop_address.strip().lower():
        raise HTTPException(status_code=400, detail="Pickup and drop locations cannot be identical.")

    passengers_count = max(1, req.passengers or 1)
    luggage_count = max(0, req.luggage_count or 0)
    
    distance_km, duration_mins = compute_trip_metrics(
        req.pickup_address, req.drop_address or "", req.trip_type or "one_way", req.hourly_duration or 4
    )

    # Match city from pickup address for localized city inventory
    p_lower = req.pickup_address.lower()
    matched_city = None
    db_vehicles = []
    try:
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
    except Exception as e:
        logger.warning(f"Cab vehicle query fallback triggered: {e}")
        db.rollback()
        db_vehicles = []
    
    if not db_vehicles:
        class MockCab:
            def __init__(self, d):
                for k, v in d.items():
                    setattr(self, k, v)

        mock_data = [
            {"id": 1, "provider": "Ghumne Chale Mini", "type": "Hatchback", "category": "Hatchback", "brand": "Maruti Suzuki", "model": "Swift", "display_name": "Maruti Suzuki Swift", "variant": "ZXi Plus", "image_key": "swift", "base_fare": 150.0, "price_per_km": 13.0, "per_hour_rate": 180.0, "seating_capacity": 4, "luggage_capacity": 2, "fuel_type": "Petrol", "transmission": "Manual", "ac_available": True, "rating": 4.8, "review_count": 1420, "image_url": "/assets/vehicles/swift.webp", "thumbnail_url": "/assets/vehicles/swift.webp", "eta_minutes": 3, "driver_name": "Ramesh Kumar", "driver_rating": "4.8 ★", "plate_number": "DL-01-AB-1234"},
            {"id": 2, "provider": "Ola Prime Sedan", "type": "Sedan", "category": "Sedan", "brand": "Maruti Suzuki", "model": "Dzire", "display_name": "Maruti Suzuki Dzire", "variant": "ZXi Auto", "image_key": "dzire", "base_fare": 200.0, "price_per_km": 16.0, "per_hour_rate": 220.0, "seating_capacity": 4, "luggage_capacity": 3, "fuel_type": "Petrol", "transmission": "Automatic", "ac_available": True, "rating": 4.9, "review_count": 2840, "image_url": "/assets/vehicles/dzire.webp", "thumbnail_url": "/assets/vehicles/dzire.webp", "eta_minutes": 5, "driver_name": "Suresh Singh", "driver_rating": "4.9 ★", "plate_number": "DL-01-CD-5678"},
            {"id": 3, "provider": "Ghumne Chale SUV", "type": "SUV", "category": "SUV", "brand": "Hyundai", "model": "Creta", "display_name": "Hyundai Creta", "variant": "SX(O) Diesel", "image_key": "creta", "base_fare": 300.0, "price_per_km": 21.0, "per_hour_rate": 320.0, "seating_capacity": 5, "luggage_capacity": 4, "fuel_type": "Diesel", "transmission": "Automatic", "ac_available": True, "rating": 4.9, "review_count": 1920, "image_url": "/assets/vehicles/creta.webp", "thumbnail_url": "/assets/vehicles/creta.webp", "eta_minutes": 7, "driver_name": "Gurpreet Singh", "driver_rating": "4.9 ★", "plate_number": "DL-01-EF-9012"},
            {"id": 4, "provider": "Savaari Premier", "type": "MPV", "category": "MPV", "brand": "Toyota", "model": "Innova Crysta", "display_name": "Toyota Innova Crysta", "variant": "ZX 7-Seater", "image_key": "innova-crysta", "base_fare": 450.0, "price_per_km": 28.0, "per_hour_rate": 480.0, "seating_capacity": 7, "luggage_capacity": 5, "fuel_type": "Diesel", "transmission": "Automatic", "ac_available": True, "rating": 5.0, "review_count": 4200, "image_url": "/assets/vehicles/innova-crysta.webp", "thumbnail_url": "/assets/vehicles/innova-crysta.webp", "eta_minutes": 8, "driver_name": "Deepak Sharma", "driver_rating": "5.0 ★", "plate_number": "DL-01-GH-3456"},
            {"id": 5, "provider": "Ghumne Chale Black", "type": "Luxury", "category": "Luxury", "brand": "Mercedes-Benz", "model": "E-Class", "display_name": "Mercedes-Benz E-Class Chauffeur", "variant": "Exclusive Edition", "image_key": "mercedes-e-class", "base_fare": 1200.0, "price_per_km": 75.0, "per_hour_rate": 1400.0, "seating_capacity": 4, "luggage_capacity": 3, "fuel_type": "Petrol", "transmission": "Automatic", "ac_available": True, "rating": 5.0, "review_count": 480, "image_url": "/assets/vehicles/mercedes-e-class.webp", "thumbnail_url": "/assets/vehicles/mercedes-e-class.webp", "eta_minutes": 10, "driver_name": "Vikram Malhotra", "driver_rating": "5.0 ★", "plate_number": "DL-01-JK-7890"}
        ]
        db_vehicles = [MockCab(m) for m in mock_data]

    results = []
    seen_models = set()
    
    for vh in db_vehicles:
        # Seating capacity constraint: exclude vehicles that cannot fit passengers
        if vh.seating_capacity < passengers_count:
            continue
            
        # Luggage capacity constraint: exclude vehicles that cannot fit bags
        if luggage_count > 0 and vh.luggage_capacity < luggage_count:
            continue

        # Category filter
        if req.category and req.category.lower() != "all":
            if (vh.category or vh.type).lower() != req.category.lower():
                continue

        # Prevent duplicate models within the search result
        model_key = f"{vh.brand}_{vh.model}"
        if model_key in seen_models:
            continue
        seen_models.add(model_key)

        total_fare, breakdown = calculate_vehicle_fare(
            {
                "base_fare": float(vh.base_fare),
                "price_per_km": float(vh.price_per_km),
                "per_hour_rate": float(vh.per_hour_rate)
            },
            distance_km,
            req.trip_type or "one_way",
            req.hourly_duration or 4
        )

        resolved_image_key = getattr(vh, "image_key", None) or (vh.model.lower().replace(" ", "-") if vh.model else "default-car")
        resolved_img = getattr(vh, "image_url", None) or f"/assets/vehicles/{resolved_image_key}.webp"

        results.append({
            "id": vh.id,
            "cab_type": vh.type,
            "vehicle_type": vh.type,
            "category": vh.category or vh.type,
            "brand": vh.brand or "Maruti",
            "model": vh.model or "Dzire",
            "variant": getattr(vh, "variant", "Standard") or "Standard",
            "display_name": vh.display_name or f"{vh.brand} {vh.model}",
            "provider": vh.provider,
            "plate_number": vh.plate_number or "DL-01-AB-1234",
            "image": resolved_img,
            "image_url": resolved_img,
            "image_key": resolved_image_key,
            "thumbnail_url": getattr(vh, "thumbnail_url", resolved_img) or resolved_img,
            "seats": vh.seating_capacity,
            "seating_capacity": vh.seating_capacity,
            "luggage_capacity": vh.luggage_capacity,
            "fuel_type": vh.fuel_type or "Petrol",
            "transmission": vh.transmission or "Manual",
            "ac": vh.ac_available,
            "ac_available": vh.ac_available,
            "rating": float(vh.rating or 4.8),
            "review_count": vh.review_count or 450,
            "eta_mins": vh.eta_minutes or 5,
            "eta_minutes": vh.eta_minutes or 5,
            "fare": total_fare,
            "price": total_fare,
            "price_per_km": float(vh.price_per_km),
            "breakdown": breakdown,
            "driver_name": vh.driver_name or "Verified Chauffeur",
            "driver_rating": vh.driver_rating or "4.9 ★",
            "is_live": False,
            "source": "demo",
            "cancellation_policy": "Free cancellation up to 2 hours before pickup (95% refund)",
            "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(minutes=15)).isoformat()
        })

    # Sort results by price ascending by default
    results.sort(key=lambda x: x["fare"])

    return {
        "pickup": req.pickup_address,
        "drop": req.drop_address,
        "trip_type": req.trip_type or "one_way",
        "distance_km": distance_km,
        "duration_mins": duration_mins,
        "passengers": passengers_count,
        "luggage_count": luggage_count,
        "options": results,
        "results": results
    }

@router.post("/estimate")
async def estimate_cab_fare(req: CabEstimateRequest, db: Session = Depends(get_db)):
    distance_km, duration_mins = compute_trip_metrics(
        req.pickup_address, req.drop_address, req.trip_type or "one_way", req.hourly_duration or 4
    )
    
    # Rate card lookup
    rates = {
        "Hatchback": {"base": 140.0, "km": 13.0, "hr": 180.0},
        "Sedan": {"base": 200.0, "km": 16.0, "hr": 220.0},
        "SUV": {"base": 300.0, "km": 21.0, "hr": 320.0},
        "MPV": {"base": 380.0, "km": 25.0, "hr": 420.0},
        "Luxury": {"base": 700.0, "km": 45.0, "hr": 800.0},
        "EV": {"base": 180.0, "km": 15.0, "hr": 210.0},
        "Bike": {"base": 40.0, "km": 8.0, "hr": 70.0}
    }
    
    rate_info = rates.get(req.cab_type, rates["Sedan"])
    total_fare, breakdown = calculate_vehicle_fare(
        {
            "base_fare": rate_info["base"],
            "price_per_km": rate_info["km"],
            "per_hour_rate": rate_info["hr"]
        },
        distance_km,
        req.trip_type or "one_way",
        req.hourly_duration or 4
    )
    
    return {
        "trip_type": req.trip_type,
        "distance_km": distance_km,
        "duration_mins": duration_mins,
        "base_fare": breakdown["base_fare"],
        "distance_fare": breakdown["distance_charge"],
        "driver_allowance": breakdown["driver_allowance"],
        "toll_parking_estimate": breakdown["toll_parking_estimate"],
        "taxes": breakdown["gst_tax"],
        "final_fare": total_fare,
        "currency": "INR",
        "breakdown": breakdown
    }

@router.post("/book")
async def book_cab(
    req: CabBookRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking_ref = f"BK-CB-{uuid.uuid4().hex[:8].upper()}"
    pickup_dt = datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
    if req.pickup_time:
        try:
            pickup_dt = datetime.datetime.fromisoformat(req.pickup_time.replace("Z", ""))
        except Exception:
            pass

    distance_km, duration_mins = compute_trip_metrics(
        req.pickup_address, req.drop_address, req.trip_type or "one_way"
    )

    # Server-authoritative fare calculation
    rates = {
        "Hatchback": {"base": 140.0, "km": 13.0, "hr": 180.0},
        "Sedan": {"base": 200.0, "km": 16.0, "hr": 220.0},
        "SUV": {"base": 300.0, "km": 21.0, "hr": 320.0},
        "MPV": {"base": 380.0, "km": 25.0, "hr": 420.0},
        "Luxury": {"base": 700.0, "km": 45.0, "hr": 800.0},
        "EV": {"base": 180.0, "km": 15.0, "hr": 210.0},
        "Bike": {"base": 40.0, "km": 8.0, "hr": 70.0}
    }
    rate_info = rates.get(req.cab_type, rates["Sedan"])
    total_fare, breakdown = calculate_vehicle_fare(
        {
            "base_fare": rate_info["base"],
            "price_per_km": rate_info["km"],
            "per_hour_rate": rate_info["hr"]
        },
        distance_km,
        req.trip_type or "one_way"
    )

    pax_list = [p.dict() for p in req.passenger_details] if req.passenger_details else [
        {"name": current_user.email.split("@")[0].capitalize(), "age": 30, "is_primary": True}
    ]

    booking = CabBooking(
        booking_reference=booking_ref,
        user_id=current_user.id,
        status=BookingStatus.CONFIRMED,
        total_amount=total_fare,
        currency="INR",
        pricing_snapshot=breakdown,
        provider_name="Ghumne Chale Fleet",
        cab_type=req.cab_type,
        pickup_address=req.pickup_address,
        drop_address=req.drop_address,
        pickup_time=pickup_dt,
        trip_type=req.trip_type or "one_way",
        passengers_count=max(1, req.passengers or len(pax_list)),
        passenger_details=pax_list,
        luggage_count=req.luggage_count or 1,
        flight_number=req.flight_number,
        terminal=req.terminal,
        special_instructions=req.special_instructions,
        driver_name="Ramesh Kumar",
        driver_phone="+91 98765 43210",
        vehicle_number="DL-1C-B-5678",
        distance_km=distance_km,
        estimated_duration_mins=duration_mins
    )
    
    db.add(booking)
    db.add(BookingEvent(
        booking_reference=booking_ref,
        event_type="driver_assigned",
        description=f"Driver assigned for {req.cab_type} ride. Driver: Ramesh Kumar (+91 98765 43210)."
    ))
    db.commit()
    db.refresh(booking)
    
    return {
        "booking_reference": booking.booking_reference,
        "status": "driver_assigned",
        "trip_type": booking.trip_type,
        "total_amount": booking.total_amount,
        "driver": {
            "driver_name": booking.driver_name,
            "rating": 4.8,
            "vehicle_model": "Maruti Dzire",
            "vehicle_color": "Silver",
            "plate": booking.vehicle_number,
            "phone": booking.driver_phone
        }
    }

@router.post("/cancel")
async def cancel_cab(
    req: CabCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking.")
        
    booking.status = BookingStatus.CANCELLED
    db.add(BookingEvent(
        booking_reference=req.booking_reference,
        event_type="cancelled",
        description=f"Cab ride cancelled by passenger. Reason: {req.reason}"
    ))
    db.commit()
    
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "status": "cancelled",
        "refund_amount": float(booking.total_amount) * 0.95,
        "cancellation_fee": float(booking.total_amount) * 0.05
    }

@router.get("/history")
async def cab_ride_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bookings = db.query(CabBooking).filter(CabBooking.user_id == current_user.id).order_by(CabBooking.created_at.desc()).all()
    return [
        {
            "booking_reference": b.booking_reference,
            "cab_type": b.cab_type,
            "trip_type": b.trip_type,
            "pickup_address": b.pickup_address,
            "drop_address": b.drop_address,
            "pickup_time": b.pickup_time,
            "status": b.status,
            "amount": b.total_amount,
            "driver_name": b.driver_name,
            "vehicle_number": b.vehicle_number
        }
        for b in bookings
    ]

@router.get("/{booking_reference}")
async def get_cab_booking(
    booking_reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
        
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")
        
    events = db.query(BookingEvent).filter(BookingEvent.booking_reference == booking_reference).order_by(BookingEvent.created_at.asc()).all()
    
    return {
        "booking_reference": booking.booking_reference,
        "cab_type": booking.cab_type,
        "trip_type": booking.trip_type,
        "pickup_address": booking.pickup_address,
        "drop_address": booking.drop_address,
        "pickup_time": booking.pickup_time,
        "return_time": booking.return_time,
        "flight_number": booking.flight_number,
        "terminal": booking.terminal,
        "passengers_count": booking.passengers_count,
        "passenger_details": booking.passenger_details,
        "luggage_count": booking.luggage_count,
        "driver_name": booking.driver_name,
        "driver_phone": booking.driver_phone,
        "vehicle_number": booking.vehicle_number,
        "distance_km": float(booking.distance_km or 18.5),
        "status": booking.status,
        "amount": booking.total_amount,
        "pricing_snapshot": booking.pricing_snapshot,
        "timeline": [
            {
                "event_type": e.event_type,
                "description": e.description,
                "created_at": e.created_at
            }
            for e in events
        ]
    }

@router.get("/{booking_reference}/voucher")
async def get_cab_voucher(
    booking_reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
        
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")

    voucher_text = f"""
============================================================
              GHUMNE CHALE — CAB BOOKING VOUCHER
============================================================
Booking Ref    : {booking.booking_reference}
Status         : {str(booking.status).upper()}
Trip Type      : {str(booking.trip_type).upper()}
Vehicle Class  : {booking.cab_type}
Vehicle Plate  : {booking.vehicle_number or 'Assigned upon arrival'}
------------------------------------------------------------
TRIP DETAILS:
Pickup Location: {booking.pickup_address}
Drop Location  : {booking.drop_address}
Pickup Time    : {booking.pickup_time.strftime('%d %b %Y, %I:%M %p') if booking.pickup_time else 'As scheduled'}
Estimated Dist : {booking.distance_km} km
------------------------------------------------------------
TRAVELER & CHAUFFEUR:
Passengers     : {booking.passengers_count} Guest(s)
Luggage Bags   : {booking.luggage_count} Bag(s)
Chauffeur Name : {booking.driver_name or 'Driver will be assigned 30m before pickup'}
Contact Number : {booking.driver_phone or 'Available via live dispatch'}
------------------------------------------------------------
PAYMENT & PRICING:
Total Amount   : INR {float(booking.total_amount):,.2f}
Payment Status : PAID / AUTHORIZED
Cancellation   : Free cancellation up to 2 hours before pickup
============================================================
    Thank you for choosing Ghumne Chale Chauffeur Services!
============================================================
"""
    return {
        "booking_reference": booking.booking_reference,
        "voucher_text": voucher_text.strip(),
        "pdf_download_url": f"/api/v1/cabs/{booking.booking_reference}/voucher.pdf"
    }

@router.get("/{booking_reference}/track")
async def track_cab_ride(
    booking_reference: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
        
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")
        
    return {
        "booking_reference": booking.booking_reference,
        "driver_coordinates": {"lat": 28.6139, "lng": 77.2090},
        "eta_mins": 4,
        "distance_remaining_km": 1.8,
        "traffic_status": "Normal Traffic",
        "route": [
            {"lat": 28.6139, "lng": 77.2090},
            {"lat": 28.6145, "lng": 77.2105},
            {"lat": 28.6152, "lng": 77.2120}
        ]
    }

@router.post("/share")
async def share_cab_ride(
    req: CabShareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
        
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")
        
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "shared_link": f"https://travelos.com/track/{booking.booking_reference}?token={uuid.uuid4().hex[:8]}"
    }


# ── LOCATION AUTOCOMPLETE & STRUCTURED HUBS ───────────────────────────

STRUCTURED_CAB_HUBS = [
    {"id": "loc_del_igi", "code": "DEL", "name": "Indira Gandhi International Airport", "city": "Delhi", "type": "Airport", "terminals": ["T1", "T2", "T3"], "lat": 28.5562, "lng": 77.1000},
    {"id": "loc_bom_csmia", "code": "BOM", "name": "Chhatrapati Shivaji Maharaj International Airport", "city": "Mumbai", "type": "Airport", "terminals": ["T1", "T2"], "lat": 19.0896, "lng": 72.8656},
    {"id": "loc_blr_kia", "code": "BLR", "name": "Kempegowda International Airport", "city": "Bengaluru", "type": "Airport", "terminals": ["T1", "T2"], "lat": 13.1986, "lng": 77.7066},
    {"id": "loc_hyd_rgia", "code": "HYD", "name": "Rajiv Gandhi International Airport", "city": "Hyderabad", "type": "Airport", "terminals": ["Main Terminal"], "lat": 17.2403, "lng": 78.4294},
    {"id": "loc_ccu_nscbi", "code": "CCU", "name": "Netaji Subhash Chandra Bose Airport", "city": "Kolkata", "type": "Airport", "terminals": ["Integrated Terminal"], "lat": 22.6547, "lng": 88.4467},
    {"id": "loc_del_ndls", "code": "NDLS", "name": "New Delhi Railway Station", "city": "Delhi", "type": "Railway Station", "lat": 28.6429, "lng": 77.2195},
    {"id": "loc_bom_csmt", "code": "CSMT", "name": "Chhatrapati Shivaji Maharaj Terminus", "city": "Mumbai", "type": "Railway Station", "lat": 18.9400, "lng": 72.8353},
    {"id": "loc_blr_sbc", "code": "SBC", "name": "KSR Bengaluru City Railway Station", "city": "Bengaluru", "type": "Railway Station", "lat": 12.9781, "lng": 77.5694},
    {"id": "loc_del_isbt", "code": "ISBT", "name": "ISBT Kashmiri Gate Bus Terminal", "city": "Delhi", "type": "Bus Terminal", "lat": 28.6669, "lng": 77.2285},
    {"id": "loc_del_cp", "code": "CP", "name": "Connaught Place / Rajiv Chowk", "city": "Delhi", "type": "Major Landmark", "lat": 28.6304, "lng": 77.2177},
    {"id": "loc_ggn_cyber", "code": "CYBER", "name": "DLF Cyber Hub / Cyber City", "city": "Gurugram", "type": "Business District", "lat": 28.4950, "lng": 77.0895},
    {"id": "loc_bom_bkc", "code": "BKC", "name": "Bandra Kurla Complex (BKC)", "city": "Mumbai", "type": "Business District", "lat": 19.0660, "lng": 72.8687},
    {"id": "loc_blr_wf", "code": "WFIELD", "name": "Whitefield IT Park", "city": "Bengaluru", "type": "Business District", "lat": 12.9698, "lng": 77.7499},
    {"id": "loc_bom_taj", "code": "TAJ", "name": "The Taj Mahal Palace Hotel (Colaba)", "city": "Mumbai", "type": "Hotel", "lat": 18.9217, "lng": 72.8332},
    {"id": "loc_del_leela", "code": "LEELA", "name": "The Leela Palace (Chanakyapuri)", "city": "Delhi", "type": "Hotel", "lat": 28.5794, "lng": 77.1895}
]

@router.get("/locations/autocomplete")
async def cab_locations_autocomplete(query: Optional[str] = None):
    """Returns structured location suggestions matching airports, railway stations, business hubs, and city landmarks."""
    if not query or not query.strip():
        return STRUCTURED_CAB_HUBS[:8]
        
    q = query.strip().lower()
    matches = [
        hub for hub in STRUCTURED_CAB_HUBS
        if q in hub["name"].lower() or q in hub["city"].lower() or q in hub["code"].lower() or q in hub["type"].lower()
    ]
    return matches


# ── ADMIN DRIVER ASSIGNMENT & STATUS MANAGEMENT ──────────────────────

class AdminAssignDriverRequest(BaseModel):
    driver_name: str
    driver_phone: str
    vehicle_number: str
    vehicle_model: Optional[str] = None

class AdminUpdateCabStatusRequest(BaseModel):
    status: str
    note: Optional[str] = None

@router.post("/admin/{booking_reference}/assign-driver")
async def admin_assign_driver(
    booking_reference: str,
    req: AdminAssignDriverRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required.")
        
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
        
    booking.driver_name = req.driver_name
    booking.driver_phone = req.driver_phone
    booking.vehicle_number = req.vehicle_number
    
    db.add(BookingEvent(
        booking_reference=booking_reference,
        event_type="driver_assigned",
        description=f"Admin assigned chauffeur: {req.driver_name} ({req.driver_phone}) with vehicle {req.vehicle_number}."
    ))
    db.commit()
    db.refresh(booking)
    
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "driver_name": booking.driver_name,
        "driver_phone": booking.driver_phone,
        "vehicle_number": booking.vehicle_number
    }

@router.post("/admin/{booking_reference}/status")
async def admin_update_cab_status(
    booking_reference: str,
    req: AdminUpdateCabStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required.")
        
    booking = db.query(CabBooking).filter(CabBooking.booking_reference == booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Cab booking not found.")
        
    valid_statuses = [
        "BOOKED", "DRIVER_ASSIGNED", "DRIVER_ON_THE_WAY", "DRIVER_ARRIVED",
        "TRIP_STARTED", "TRIP_COMPLETED", "CANCELLED", "EXPIRED", "CONFIRMED"
    ]
    target = req.status.upper()
    if target not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid cab status '{req.status}'. Allowed: {valid_statuses}")
        
    booking.status = BookingStatus(target) if target in [s.value for s in BookingStatus] else BookingStatus.CONFIRMED
    db.add(BookingEvent(
        booking_reference=booking_reference,
        event_type=f"status_{target.lower()}",
        description=req.note or f"Ride status transitioned to {target} by operations administrator."
    ))
    db.commit()
    
    return {
        "success": True,
        "booking_reference": booking.booking_reference,
        "status": target
    }
