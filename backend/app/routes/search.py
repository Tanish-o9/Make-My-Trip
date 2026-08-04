import asyncio
import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Query
from app.database import SessionLocal
from app.models.media import Media
from app.ai_tools.flight_tool import flight_search_tool
from app.models.search_entities import (
    City, Airport, TrainStation, BusTerminal, CurrencyExchange,
    CountryVisaRequirement, TollPlaza, FlightRoute, HotelProperty,
    HotelRoom, VillaProperty, HolidayPackage, TrainRoute, BusRoute,
    CabVehicle, TourActivity, CruiseItinerary, InsurancePlan, RentalVehicle, Locality, VehicleAvailability
)
from app.services.price_compare_agent import PriceCompareAgent
from app.utils.rate_limiter import RateLimiter
from fastapi import APIRouter, Query, Depends

router = APIRouter(prefix="/search", tags=["search"])

search_limiter = RateLimiter(max_requests=20, window_seconds=60, scope="search")



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
                if owner_type == "hotel":
                    # Stable hash of hotel name to pick a different image
                    hash_val = sum(ord(c) for c in name_key) if name_key else 0
                    fallback_hotel_urls = [
                        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
                        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
                        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800",
                        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800"
                    ]
                    item["primary_photo_url"] = fallback_hotel_urls[hash_val % len(fallback_hotel_urls)]
                elif owner_type == "villa":
                    # Stable hash of villa name to pick a different image
                    hash_val = sum(ord(c) for c in name_key) if name_key else 0
                    fallback_villa_urls = [
                        "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",
                        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
                        "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
                        "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800",
                        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
                        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
                        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
                        "https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=800",
                        "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800",
                        "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800"
                    ]
                    item["primary_photo_url"] = fallback_villa_urls[hash_val % len(fallback_villa_urls)]
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


@router.get("", dependencies=[Depends(search_limiter)])
async def unified_vertical_search(
    vertical: str = Query(..., description="flights, hotels, villas, holidays, trains, buses, cabs, tours, visa, cruises, forex, insurance"),
    origin: str = Query(None),
    destination: str = Query(None),
    date: str = Query(None),
    passengers: int = Query(1),
    budget: float = Query(None),
    category: str = Query(None),
    locality_id: int = Query(None),
    pickup: str = Query(None),
    drop: str = Query(None),
    type: str = Query(None),
    selfDrive: str = Query(None),
    check_in: str = Query(None),
    check_out: str = Query(None),
    sort_by: str = Query(None),
    stops: str = Query(None),
    carrier: str = Query(None),
    amenity: str = Query(None),
    cancellation: str = Query(None),
    limit: int = Query(25),
    offset: int = Query(0)
):
    """Unified search gateway routing queries based on vertical type"""
    v = vertical.lower()
    
    if v == "flights":
        flight_offers = await PriceCompareAgent.compare_flights(origin or "DEL", destination or "GOI", date or "2026-12-15")
        flight_res = []
        for offer in flight_offers:
            f = offer.details.copy()
            f["provider_name"] = offer.provider_name
            f["price_per_passenger"] = offer.price
            f["total_price"] = offer.price * passengers
            f["offer_id"] = offer.id
            f["cancellation_policy"] = offer.cancellation_policy
            f["raw_provider_ref"] = offer.raw_provider_ref
            f["expires_at"] = offer.expires_at.isoformat()
            f["alternatives"] = offer.details.get("alternatives", [])
            f["is_simulated"] = offer.is_simulated
            
            # Compatibility helpers for frontend
            dep_dt = f.get("departure_time", "")
            arr_dt = f.get("arrival_time", "")
            f["dep"] = dep_dt.split("T")[1][:5] if "T" in dep_dt else "08:30"
            f["arr"] = arr_dt.split("T")[1][:5] if "T" in arr_dt else "10:45"
            dur_mins = f.get("duration_minutes", 150)
            f["duration"] = f"{dur_mins // 60}h {dur_mins % 60}m"
            
            flight_res.append(f)

        # Apply filters
        filtered_flights = []
        for f in flight_res:
            # stops filter
            if stops == "direct" and len(f.get("layovers", [])) > 0:
                continue
            if stops == "1stop" and len(f.get("layovers", [])) != 1:
                continue
            # carrier filter
            if carrier and carrier.upper() not in str(f.get("airline", "")).upper() and carrier.upper() not in str(f.get("airline_code", "")).upper():
                continue
            # price budget filter
            if budget and float(f.get("price_per_passenger", 0)) > float(budget):
                continue
            filtered_flights.append(f)

        # Apply sorting
        if sort_by == "price_asc":
            filtered_flights.sort(key=lambda x: x.get("price_per_passenger", 999999))
        elif sort_by == "price_desc":
            filtered_flights.sort(key=lambda x: x.get("price_per_passenger", 0), reverse=True)
        elif sort_by == "duration_asc":
            def get_dur_mins(item):
                dur_str = item.get("duration", "2h 30m")
                try:
                    parts = dur_str.split()
                    h = int(parts[0].replace("h", "")) if len(parts) > 0 else 2
                    m = int(parts[1].replace("m", "")) if len(parts) > 1 else 0
                    return h * 60 + m
                except Exception:
                    return 150
            filtered_flights.sort(key=get_dur_mins)

        # Determine the AI Pick for flights
        if filtered_flights:
            best_flight = None
            best_score = -999999
            best_reasons = []
            for f in filtered_flights:
                price = float(f.get("price_per_passenger", 5000))
                score = 10000 - price
                reasons = []
                if "Vistara" in f.get("airline", "") or "Air India" in f.get("airline", ""):
                    score += 1500
                    reasons.append("Premium Cabin Experience")
                if len(f.get("layovers", [])) == 0:
                    score += 1000
                    reasons.append("Direct Route")
                if price < 6000:
                    score += 800
                    reasons.append("Excellent Value")
                
                if score > best_score:
                    best_score = score
                    best_flight = f
                    best_reasons = reasons

            if best_flight:
                best_flight["ai_pick"] = True
                reasons_str = " & ".join(best_reasons) if best_reasons else "Optimal Balance"
                best_flight["ai_pick_reason"] = reasons_str

        # Pagination
        total_count = len(filtered_flights)
        paginated_flights = filtered_flights[offset:offset+limit]

        return {
            "vertical": "flights",
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "results": attach_media_to_results(paginated_flights, "vehicle")
        }
        
    elif v == "hotels":
        check_in_val = check_in or date or "2026-12-15"
        try:
            check_out_val = check_out or (datetime.datetime.strptime(check_in_val, "%Y-%m-%d") + datetime.timedelta(days=2)).strftime("%Y-%m-%d")
        except Exception:
            check_out_val = "2026-12-17"
        
        hotel_offers = await PriceCompareAgent.compare_hotels(destination or "Goa", check_in_val, check_out_val)
        hotel_res = []
        for offer in hotel_offers:
            h = offer.details.copy()
            h["provider_name"] = offer.provider_name
            h["price"] = offer.price
            h["offer_id"] = offer.id
            h["cancellation_policy"] = offer.cancellation_policy
            h["raw_provider_ref"] = offer.raw_provider_ref
            h["expires_at"] = offer.expires_at.isoformat()
            h["alternatives"] = offer.details.get("alternatives", [])
            h["is_simulated"] = offer.is_simulated
            
            # Extract fields flat from offer.details
            h["guest_review_score"] = offer.details.get("guest_review_score")
            h["review_count"] = offer.details.get("review_count")
            h["category"] = offer.details.get("category")
            h["breakfast_included"] = offer.details.get("breakfast_included")
            h["free_cancellation"] = offer.details.get("free_cancellation")
            h["distance_from_center"] = offer.details.get("distance_from_center")
            h["lat"] = offer.details.get("lat")
            h["lng"] = offer.details.get("lng")
            
            hotel_res.append(h)

        # Apply filters
        filtered_hotels = []
        for h in hotel_res:
            # category / star filter
            if category and category != "all":
                # Matches numeric star rating or category text
                if category.isdigit():
                    try:
                        star_val = float(h.get("rating", "4.0").split()[0])
                        if not (float(category) <= star_val < float(category) + 1):
                            continue
                    except ValueError:
                        continue
                else:
                    if category.lower() not in str(h.get("category", "")).lower():
                        continue
            
            # amenity filter
            if amenity:
                amenities_lower = [a.lower() for a in h.get("amenities", [])]
                if amenity.lower() not in amenities_lower:
                    continue

            # cancellation filter
            if cancellation == "free" and not h.get("free_cancellation", False):
                continue
            
            # budget filter
            if budget and float(h.get("price", 0)) > float(budget):
                continue
                
            filtered_hotels.append(h)

        # Apply sorting
        if sort_by == "price_asc":
            filtered_hotels.sort(key=lambda x: x.get("price", 999999))
        elif sort_by == "price_desc":
            filtered_hotels.sort(key=lambda x: x.get("price", 0), reverse=True)
        elif sort_by == "rating_desc":
            def get_rating_num(item):
                try:
                    return float(item.get("rating", "0.0").split()[0])
                except Exception:
                    return 0.0
            filtered_hotels.sort(key=get_rating_num, reverse=True)

        # Determine the AI Pick for hotels
        if filtered_hotels:
            best_hotel = None
            best_score = -999999
            best_reasons = []
            for h in filtered_hotels:
                price = float(h.get("price", 4000))
                rating_val = 4.0
                try:
                    rating_val = float(h.get("rating", "4.0").split()[0])
                except Exception:
                    pass
                
                score = (rating_val * 2000) - price
                reasons = []
                if rating_val >= 4.5:
                    score += 1500
                    reasons.append("Top-Tier Rating")
                if h.get("breakfast_included", False):
                    score += 800
                    reasons.append("Breakfast Included")
                if h.get("free_cancellation", False):
                    score += 1000
                    reasons.append("Flexible Cancellation")
                
                if score > best_score:
                    best_score = score
                    best_hotel = h
                    best_reasons = reasons

            if best_hotel:
                best_hotel["ai_pick"] = True
                reasons_str = " & ".join(best_reasons) if best_reasons else "Highly Rated"
                best_hotel["ai_pick_reason"] = reasons_str

        # Pagination
        total_count = len(filtered_hotels)
        paginated_hotels = filtered_hotels[offset:offset+limit]

        return {
            "vertical": "hotels",
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "results": attach_media_to_results(paginated_hotels, "hotel")
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

    elif v in ["rent-a-ride", "vehicle_rental"]:
        db = SessionLocal()
        try:
            # 1. Resolve Locality
            locality_obj = None
            if locality_id:
                locality_obj = db.query(Locality).filter(Locality.id == locality_id).first()
            elif destination:
                dest_clean = destination.strip()
                locality_obj = db.query(Locality).filter(Locality.name.like(f"%{dest_clean}%")).first()
            
            if not locality_obj:
                locality_obj = db.query(Locality).filter(Locality.name == "Panaji").first()
                if not locality_obj:
                    locality_obj = db.query(Locality).first()
            
            if not locality_obj:
                return {"vertical": "rent-a-ride", "results": []}

            # 2. Check nearest hub & delivery radius
            delivery_required = not locality_obj.has_rental_hub
            target_hub_id = locality_obj.nearest_hub_locality_id if delivery_required else locality_obj.id
            
            hub_locality = db.query(Locality).filter(Locality.id == target_hub_id).first()
            if not hub_locality:
                hub_locality = locality_obj
            
            # Calculate distance using Haversine formula
            import math
            def haversine(lat1, lon1, lat2, lon2):
                R = 6371.0
                phi1 = math.radians(lat1)
                phi2 = math.radians(lat2)
                delta_phi = math.radians(lat2 - lat1)
                delta_lambda = math.radians(lon2 - lon1)
                a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
                c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
                return R * c
            
            hub_distance = haversine(
                float(locality_obj.latitude), float(locality_obj.longitude),
                float(hub_locality.latitude), float(hub_locality.longitude)
            )

            # Check if out of delivery range
            if delivery_required and hub_distance > locality_obj.delivery_radius_km:
                return {
                    "vertical": "rent-a-ride",
                    "results": [],
                    "not_deliverable": True,
                    "nearest_hub_name": hub_locality.name,
                    "distance_km": round(hub_distance, 1),
                    "max_radius_km": locality_obj.delivery_radius_km
                }

            # 3. Fetch comparing vehicles from PriceCompareAgent
            vehicle_offers = await PriceCompareAgent.compare_vehicles(destination or locality_obj.name, pickup, drop, type, selfDrive == "true")
            results = []
            for offer in vehicle_offers:
                vh = offer.details.copy()
                vh["provider_name"] = offer.provider_name
                vh["price_per_day"] = offer.price
                vh["offer_id"] = offer.id
                vh["cancellation_policy"] = offer.cancellation_policy
                vh["raw_provider_ref"] = offer.raw_provider_ref
                vh["expires_at"] = offer.expires_at.isoformat()
                vh["alternatives"] = offer.details.get("alternatives", [])
                results.append(vh)

            # Apply specialist agents (recommendation + pricing)
            from app.services.vehicle_rental_agents import recommendation_agent, pricing_agent
            ranked = recommendation_agent(results, destination or locality_obj.name)
            final_results = pricing_agent(ranked)
            
            delivery_fee = float(locality_obj.delivery_fee_beyond_radius) if delivery_required else 0.0
            delivery_eta_hours = math.ceil(hub_distance / 15) if delivery_required else 0

            return {
                "vertical": "rent-a-ride",
                "results": attach_media_to_results(final_results, "vehicle"),
                "delivery_info": {
                    "delivery_required": delivery_required,
                    "delivery_fee": delivery_fee,
                    "delivery_eta_hours": delivery_eta_hours,
                    "locality_name": locality_obj.name,
                    "nearest_hub_name": hub_locality.name,
                    "nearest_hub_distance": round(hub_distance, 1)
                },
                "debug_info": {
                    "total_hub_vehicles": len(results),
                    "locality_id": locality_obj.id,
                    "hub_id": hub_locality.id
                }
            }
        finally:
            db.close()
            
        return {"vertical": "rent-a-ride", "results": []}

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


@router.get("/providers/health")
async def get_providers_health():
    """Returns the health status of all registered aggregator providers"""
    return await provider_registry.check_health()
