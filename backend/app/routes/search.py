import asyncio
from typing import Dict, Any, List
from fastapi import APIRouter, Query
from app.database import SessionLocal
from app.models.media import Media
from app.ai_tools.flight_tool import flight_search_tool
from app.models.search_entities import (
    City, Airport, TrainStation, BusTerminal, CurrencyExchange,
    CountryVisaRequirement, TollPlaza, FlightRoute, HotelProperty,
    HotelRoom, VillaProperty, HolidayPackage, TrainRoute, BusRoute,
    CabVehicle, TourActivity, CruiseItinerary, InsurancePlan
)

router = APIRouter(prefix="/search", tags=["search"])

def attach_media_to_results(results: List[Dict[str, Any]], owner_type: str) -> List[Dict[str, Any]]:
    """Helper to attach primary photo URL and base64 blur-up hash to search results"""
    db = SessionLocal()
    try:
        for item in results:
            name_key = item.get("name") or item.get("provider") or item.get("train_name") or item.get("operator_name")
            if not name_key:
                continue
                
            media = db.query(Media).filter(
                Media.owner_type == owner_type,
                Media.owner_id == name_key,
                Media.is_primary == True
            ).first()
            
            if media:
                item["primary_photo_url"] = media.url
                item["blur_hash_base64"] = media.blur_hash_base64
            else:
                # Fallback to random placeholder category images
                if owner_type == "hotel":
                    item["primary_photo_url"] = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"
                elif owner_type == "villa":
                    item["primary_photo_url"] = "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800"
                elif owner_type == "holiday":
                    item["primary_photo_url"] = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800"
                elif owner_type == "cruise":
                    item["primary_photo_url"] = "https://images.unsplash.com/photo-1548574505-5e239809ee19?w=800"
                elif owner_type == "tour":
                    item["primary_photo_url"] = "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800"
                elif owner_type == "train":
                    item["primary_photo_url"] = "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=800"
                elif owner_type == "bus":
                    item["primary_photo_url"] = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800"
                elif owner_type == "vehicle":
                    item["primary_photo_url"] = "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800"
                else:
                    item["primary_photo_url"] = "/static/uploads/default_travel.webp"
                item["blur_hash_base64"] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    finally:
        db.close()
    return results


@router.get("")
def unified_vertical_search(
    vertical: str = Query(..., description="flights, hotels, villas, holidays, trains, buses, cabs, tours, visa, cruises, forex, insurance"),
    origin: str = Query(None),
    destination: str = Query(None),
    date: str = Query(None),
    passengers: int = Query(1),
    budget: float = Query(None),
    category: str = Query(None)
):
    """Unified search gateway routing queries based on vertical type"""
    v = vertical.lower()
    
    if v == "flights":
        return flight_search_tool(origin or "DEL", destination or "GOI", date or "2026-12-15", passengers)
        
    elif v == "hotels":
        db = SessionLocal()
        try:
            city_name = (destination or "Goa").split(" ")[0]
            city_obj = db.query(City).filter(City.name.like(f"%{city_name}%")).first()
            if city_obj:
                props = db.query(HotelProperty).filter(HotelProperty.city_id == city_obj.id).all()
            else:
                props = db.query(HotelProperty).all()
            
            if props:
                results = []
                for p in props:
                    room = db.query(HotelRoom).filter(HotelRoom.hotel_id == p.id).first()
                    price = float(room.price) if room else 4500.0
                    results.append({
                        "name": p.name,
                        "rating": p.star_rating,
                        "price": price,
                        "details": p.description,
                        "address": p.address,
                        "amenities": p.amenities_json
                    })
                return {
                    "vertical": "hotels",
                    "results": attach_media_to_results(results, "hotel")
                }
        finally:
            db.close()

        results = [
            {"name": "Grand Hyatt Resort", "rating": "4.8 ★", "price": 12000, "details": "Beachfront lounge"},
            {"name": "Goa Backpackers Hostel", "rating": "4.2 ★", "price": 850, "details": "AC room near shoreline"}
        ]
        return {
            "vertical": "hotels",
            "results": attach_media_to_results(results, "hotel")
        }
        
    elif v == "villas":
        db = SessionLocal()
        try:
            city_name = (destination or "Goa").split(" ")[0]
            city_obj = db.query(City).filter(City.name.like(f"%{city_name}%")).first()
            if city_obj:
                villas = db.query(VillaProperty).filter(VillaProperty.city_id == city_obj.id).all()
            else:
                villas = db.query(VillaProperty).all()
            
            if villas:
                results = []
                for vl in villas:
                    results.append({
                        "name": vl.name,
                        "rating": vl.rating,
                        "price": float(vl.price),
                        "details": vl.details,
                        "bedrooms": vl.bedrooms,
                        "max_occupancy": vl.max_occupancy,
                        "property_type": vl.property_type,
                        "host_name": vl.host_name,
                        "house_rules": vl.house_rules
                    })
                return {
                    "vertical": "villas",
                    "results": attach_media_to_results(results, "villa")
                }
        finally:
            db.close()

        dest = (destination or "Goa").strip()
        results = [
            # --- Luxury Villas ---
            {
                "name": f"Royal Heritage Villa {dest}",
                "rating": "4.9 ★",
                "price": 19500,
                "details": f"4 Bedrooms, Private Infinity Pool, beachfront and ocean view in {dest}",
                "bedrooms": 4,
                "max_occupancy": 8,
                "property_type": "Villa"
            },
            {
                "name": f"Cloud Nine Chalet {dest}",
                "rating": "4.8 ★",
                "price": 14000,
                "details": f"3 Bedrooms, Private terrace deck & evening bonfire pit in {dest}",
                "bedrooms": 3,
                "max_occupancy": 6,
                "property_type": "Villa"
            },
            {
                "name": f"Signature Elite Estate {dest}",
                "rating": "4.9 ★",
                "price": 28000,
                "details": f"5 Bedrooms, Private Jacuzzi, BBQ facilities, & butler service in {dest}",
                "bedrooms": 5,
                "max_occupancy": 10,
                "property_type": "Villa"
            },
            # --- Homestays ---
            {
                "name": f"{dest} Village Organic Homestay",
                "rating": "4.7 ★",
                "price": 3200,
                "details": f"2 Bedrooms, Authentic home-cooked local meals & farming experience in {dest}",
                "bedrooms": 2,
                "max_occupancy": 4,
                "property_type": "Homestay"
            },
            {
                "name": f"Nani's Heritage Homestay {dest}",
                "rating": "4.8 ★",
                "price": 4500,
                "details": f"3 Bedrooms, Traditional courtyard, rich hospitality, and local tours in {dest}",
                "bedrooms": 3,
                "max_occupancy": 6,
                "property_type": "Homestay"
            },
            {
                "name": f"Green Canopy Homestay {dest}",
                "rating": "4.6 ★",
                "price": 3800,
                "details": f"2 Bedrooms, Nestled inside spice plantations, peaceful nature trails in {dest}",
                "bedrooms": 2,
                "max_occupancy": 5,
                "property_type": "Homestay"
            },
            # --- Cottages ---
            {
                "name": f"Whispering Palms Cottage {dest}",
                "rating": "4.7 ★",
                "price": 8500,
                "details": f"3 Bedrooms, Cozy wooden structure with lush garden sitout in {dest}",
                "bedrooms": 3,
                "max_occupancy": 6,
                "property_type": "Cottage"
            },
            {
                "name": f"Serene Meadow Cottage {dest}",
                "rating": "4.6 ★",
                "price": 6200,
                "details": f"2 Bedrooms, Beautiful valley views, private lawn, and fireplace in {dest}",
                "bedrooms": 2,
                "max_occupancy": 4,
                "property_type": "Cottage"
            },
            {
                "name": f"Pine Wood Cottage {dest}",
                "rating": "4.5 ★",
                "price": 5500,
                "details": f"2 Bedrooms, Rustic architecture with attic bedrooms and mountain outlook in {dest}",
                "bedrooms": 2,
                "max_occupancy": 4,
                "property_type": "Cottage"
            }
        ]
        return {
            "vertical": "villas",
            "results": attach_media_to_results(results, "villa")
        }

    elif v == "holidays":
        db = SessionLocal()
        try:
            packages = db.query(HolidayPackage).all()
            if packages:
                results = []
                for pkg in packages:
                    results.append({
                        "name": pkg.name,
                        "duration": pkg.duration,
                        "price": float(pkg.price),
                        "inclusions": pkg.inclusions,
                        "details": pkg.details
                    })
                return {
                    "vertical": "holidays",
                    "results": attach_media_to_results(results, "holiday")
                }
        finally:
            db.close()

        dest = (destination or "Goa").strip()
        results = [
            {
                "name": f"Premium {dest} Luxury Vacation",
                "duration": "5 Days / 4 Nights",
                "price": 24999,
                "inclusions": "Flights + 4-Star Resort + Guided Sightseeing + Private Transfers",
                "details": f"Experience the absolute best of {dest} with handpicked accommodations, private tour guides, and entry tickets."
            },
            {
                "name": f"{dest} Explorer Budget Adventure",
                "duration": "4 Days / 3 Nights",
                "price": 9999,
                "inclusions": "Cozy Hostel Stay + Daily Breakfast + Unlimited Scooter Rentals",
                "details": f"An adventure-packed tour of {dest} featuring local heritage trails, beach hopping, and street food tours."
            },
            {
                "name": f"Romantic {dest} Couple's Sanctuary",
                "duration": "6 Days / 5 Nights",
                "price": 32999,
                "inclusions": "Flights + 5-Star Heritage Villa + Candlelight Beach Dinner + Couples Spa",
                "details": f"A luxury getaway to {dest} curated specifically for couples to enjoy beautiful sunsets, luxury, and tranquility."
            },
            {
                "name": f"Complete {dest} Family Heritage Package",
                "duration": "7 Days / 6 Nights",
                "price": 38500,
                "inclusions": "Comfortable Hotels + All Meals + Private SUV Coach + Guide",
                "details": f"A comprehensive tour of the historical highlights, scenic hotspots, and child-friendly activities of {dest}."
            },
            {
                "name": f"Thrilling {dest} Outdoors & Trekking Trail",
                "duration": "5 Days / 4 Nights",
                "price": 14500,
                "inclusions": "Alpine Camps/Homestay + All Meals + Professional Trekking Guide + Gears",
                "details": f"Go completely off-the-beaten-path in {dest} with outdoor camping, local village hikes, bonfires, and adventure sports."
            }
        ]
        return {
            "vertical": "holidays",
            "results": attach_media_to_results(results, "holiday")
        }

    elif v == "trains":
        db = SessionLocal()
        try:
            trains = db.query(TrainRoute).all()
            if trains:
                results = []
                for t in trains:
                    results.append({
                        "train_number": t.train_number,
                        "train_name": t.train_name,
                        "class": "3A",
                        "price": t.classes_json.get("3A", 1850),
                        "duration": t.duration,
                        "classes": t.classes_json,
                        "origin_station": t.origin_station,
                        "destination_station": t.destination_station,
                        "departure_time": t.departure_time
                    })
                return {
                    "vertical": "trains",
                    "results": attach_media_to_results(results, "train")
                }
        finally:
            db.close()

        return {
            "vertical": "trains",
            "results": attach_media_to_results([
                {"train_number": "12626", "train_name": "Kerala Express", "class": "3A", "price": 1850, "duration": "30h 15m"},
                {"train_number": "22633", "train_name": "Nizamuddin Rajdhani", "class": "2A", "price": 3400, "duration": "26h 40m"}
            ], "train")
        }

    elif v == "buses":
        db = SessionLocal()
        try:
            buses = db.query(BusRoute).all()
            if buses:
                results = []
                for b in buses:
                    results.append({
                        "operator_name": b.operator_name,
                        "bus_type": b.bus_type,
                        "price": float(b.price),
                        "departure_time": b.departure_time,
                        "seats_left": b.seats_left,
                        "seats_map": b.seats_map,
                        "origin": b.origin,
                        "destination": b.destination
                    })
                return {
                    "vertical": "buses",
                    "results": attach_media_to_results(results, "bus")
                }
        finally:
            db.close()

        return {
            "vertical": "buses",
            "results": attach_media_to_results([
                {"operator_name": "IntrCity SmartBus", "bus_type": "AC Sleeper (2+1)", "price": 1490, "departure_time": "21:00", "seats_left": 8, "seats_map": ["12A", "12B", "14A", "14B"]},
                {"operator_name": "Zingbus", "bus_type": "AC Premium Seater", "price": 950, "departure_time": "22:30", "seats_left": 15, "seats_map": ["5A", "5B", "7F"]}
            ], "bus")
        }
        
    elif v == "cabs":
        db = SessionLocal()
        try:
            cabs = db.query(CabVehicle).all()
            if cabs:
                results = []
                for cb in cabs:
                    results.append({
                        "provider": cb.provider,
                        "type": cb.type,
                        "price": float(cb.price),
                        "eta_minutes": cb.eta_minutes,
                        "driver_name": cb.driver_name,
                        "driver_rating": cb.driver_rating
                    })
                return {
                    "vertical": "cabs",
                    "results": attach_media_to_results(results, "vehicle")
                }
        finally:
            db.close()

        results = [
            {"provider": "Ola Cabs", "type": "Sedan", "price": 1200, "eta_minutes": 5},
            {"provider": "Uber Intercity", "type": "SUV", "price": 1900, "eta_minutes": 8}
        ]
        return {
            "vertical": "cabs",
            "results": attach_media_to_results(results, "vehicle")
        }

    elif v == "tours":
        db = SessionLocal()
        try:
            tours = db.query(TourActivity).all()
            if tours:
                results = []
                for tr in tours:
                    results.append({
                        "name": tr.name,
                        "category": tr.category,
                        "price": float(tr.price),
                        "duration": tr.duration,
                        "details": tr.details,
                        "group_size": tr.group_size,
                        "difficulty": tr.difficulty
                    })
                return {
                    "vertical": "tours",
                    "results": attach_media_to_results(results, "tour")
                }
        finally:
            db.close()

        return {
            "vertical": "tours",
            "results": attach_media_to_results([
                {"name": "Scuba Diving & Grand Island Tour", "category": "Adventure", "price": 2999, "duration": "6 hours", "details": "Includes boat ride, diving gears, trainer, and lunch."},
                {"name": "Heritage Walk in Fontainhas", "category": "Cultural", "price": 799, "duration": "3 hours", "details": "Explore old Portuguese houses with a professional guide."}
            ], "tour")
        }
        
    elif v == "visa":
        db = SessionLocal()
        try:
            country_name = destination or "France"
            req = db.query(CountryVisaRequirement).filter(CountryVisaRequirement.country == country_name).first()
            if req:
                return {
                    "vertical": "visa",
                    "requirements": {
                        "country": req.country,
                        "rules": req.rules,
                        "checklist": req.checklist,
                        "fee": float(req.fee)
                    }
                }
        finally:
            db.close()

        return {
            "vertical": "visa",
            "requirements": {
                "country": destination or "France",
                "rules": "Indian passport holders require standard Schengen biometric visa. Processing takes 15 business days. Min bank balance required: ₹1,50,000.",
                "checklist": ["Valid passport", "2 Photos", "Flight itinerary", "Hotel vouchers", "Sufficient funds bank statement"]
            }
        }

    elif v == "cruises":
        db = SessionLocal()
        try:
            cruises = db.query(CruiseItinerary).all()
            if cruises:
                results = []
                for cr in cruises:
                    results.append({
                        "name": cr.name,
                        "cruise_line": cr.cruise_line,
                        "cabin_type": cr.cabin_type,
                        "price": float(cr.price),
                        "departure_port": cr.departure_port,
                        "duration_days": cr.duration_days
                    })
                return {
                    "vertical": "cruises",
                    "results": attach_media_to_results(results, "cruise")
                }
        finally:
            db.close()

        return {
            "vertical": "cruises",
            "results": attach_media_to_results([
                {"name": "Singapore to Penang Getaway", "cruise_line": "Royal Caribbean", "cabin_type": "Balcony Suite", "price": 45000, "departure_port": "Singapore", "duration_days": 5},
                {"name": "Goa Beachfront Coastal Cruise", "cruise_line": "Cordelia Cruises", "cabin_type": "Ocean View", "price": 28000, "departure_port": "Mumbai", "duration_days": 4}
            ], "cruise")
        }

    elif v == "forex":
        return {
            "vertical": "forex",
            "currency_pair": "USD_INR",
            "rate": 84.50,
            "lock_ttl_seconds": 600,
            "kyc_required": True,
            "delivery_modes": ["Home Delivery", "Branch Pickup"]
        }

    elif v == "insurance":
        db = SessionLocal()
        try:
            plans = db.query(InsurancePlan).all()
            if plans:
                results = []
                for p in plans:
                    results.append({
                        "provider_name": p.provider_name,
                        "policy_name": p.policy_name,
                        "price": float(p.price),
                        "coverage_amount": float(p.coverage_amount),
                        "details": p.details
                    })
                return {
                    "vertical": "insurance",
                    "results": results
                }
        finally:
            db.close()

        return {
            "vertical": "insurance",
            "results": [
                {"provider_name": "Tata AIG", "policy_name": "Travel Guard Basic", "price": 950, "coverage_amount": 5000000, "details": "Covers medical emergencies, baggage loss, trip delays."},
                {"provider_name": "HDFC Ergo", "policy_name": "Travel Shield Premium", "price": 1800, "coverage_amount": 10000000, "details": "Covers adventure sports, dental treatments, passport loss."}
            ]
        }
        
    else:
        return {"vertical": v, "results": [], "message": "Booking vertical currently under construction."}


@router.get("/combo")
async def combo_fanout_search(
    origin: str = "DEL",
    destination: str = "GOI",
    date: str = "2026-12-15"
):
    """Simulates parallel concurrent fan-out queries to Flights, Hotels, and Visas"""
    async def fetch_flights():
        await asyncio.sleep(0.05)
        return flight_search_tool(origin, destination, date)

    async def fetch_hotels():
        await asyncio.sleep(0.05)
        results = [
            {"name": "Grand Hyatt Resort", "price": 12000, "rating": "4.8 ★"},
            {"name": "Goa Backpackers Hostel", "price": 850, "rating": "4.2 ★"}
        ]
        return {
            "hotel_options": attach_media_to_results(results, "hotel")
        }

    async def fetch_visa():
        await asyncio.sleep(0.05)
        return {"visa_guidelines": f"Schengen guidelines for traveling to {destination}."}

    flights, hotels, visa = await asyncio.gather(
        fetch_flights(),
        fetch_hotels(),
        fetch_visa()
    )

    return {
        "search_parameters": {"origin": origin, "destination": destination, "date": date},
        "flights": flights,
        "hotels": hotels,
        "visa": visa
    }
