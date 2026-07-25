import os
import json
import logging
import hashlib
from typing import Dict, Any, List
import redis
import datetime

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

def _get_redis_client():
    try:
        return redis.Redis.from_url(REDIS_URL, socket_timeout=2)
    except Exception:
        return None

def flight_search_tool(
    origin: str,
    destination: str,
    departure_date: str,  # YYYY-MM-DD
    passengers: int = 1,
    cabin_class: str = "ECONOMY"
) -> Dict[str, Any]:
    """
    Searches for flights matching criteria via flight inventory systems.
    Args:
        origin: IATA code for departure city (e.g., DEL, BOM).
        destination: IATA code for arrival city (e.g., GOI, BLR).
        departure_date: Date of departure (YYYY-MM-DD).
        passengers: Number of tickets needed.
        cabin_class: Cabin preference (ECONOMY, BUSINESS, FIRST).
    """
    origin = origin.upper().strip()
    destination = destination.upper().strip()
    cabin_class = cabin_class.upper().strip()

    # 1. Check Redis Cache
    cache_key = f"flights:{origin}:{destination}:{departure_date}:{passengers}:{cabin_class}"
    r = _get_redis_client()
    if r:
        try:
            cached = r.get(cache_key)
            if cached:
                logger.info("Flight search cache hit!")
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Failed to query flight cache: {e}")

    # 2. Amadeus Client Logic (Simulated / Fallback to Mock)
    client_id = os.getenv("AMADEUS_CLIENT_ID")
    client_secret = os.getenv("AMADEUS_CLIENT_SECRET")
    
    if client_id and client_secret:
        # In a real system, you would execute an OAuth handshake and retrieve flight details
        # We will write a concrete handler in services/amadeus.py for the full integration
        pass

    # 3. High-fidelity Flight Generator (using DB FlightRoute if seeded, else mock)
    from app.database import SessionLocal
    from app.models.search_entities import FlightRoute
    
    db = SessionLocal()
    db_routes = db.query(FlightRoute).filter(
        FlightRoute.origin == origin,
        FlightRoute.destination == destination
    ).all()
    db.close()

    flights = []
    
    # Establish a stable random seed based on details so results don't randomly morph
    seed_str = f"{origin}-{destination}-{departure_date}"
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % 100
    
    if db_routes:
        for idx, r in enumerate(db_routes):
            class_multiplier = {"ECONOMY": 1.0, "BUSINESS": 2.5, "FIRST": 4.0}.get(cabin_class, 1.0)
            total_fare = float(r.base_price) * class_multiplier * passengers
            
            dep_hour_min = r.departure_time or "08:00"
            departure_time = datetime.datetime.strptime(f"{departure_date} {dep_hour_min}", "%Y-%m-%d %H:%M")
            arrival_time = departure_time + datetime.timedelta(minutes=150)
            
            flights.append({
                "flight_number": r.flight_number,
                "airline": r.airline_name,
                "airline_code": r.airline_code,
                "origin": origin,
                "destination": destination,
                "departure_time": departure_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "arrival_time": arrival_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "duration_minutes": 150,
                "layovers": [],
                "cabin_class": cabin_class,
                "price_per_passenger": float(total_fare / passengers),
                "total_price": float(total_fare),
                "currency": "INR"
            })
    else:
        airlines = [
            {"code": "6E", "name": "IndiGo", "base_price": 4500},
            {"code": "AI", "name": "Air India", "base_price": 5200},
            {"code": "UK", "name": "Vistara", "base_price": 6000},
            {"code": "QP", "name": "Akasa Air", "base_price": 4300}
        ]

        for idx, air in enumerate(airlines):
            flight_num = f"{air['code']}-{(seed + idx * 17) % 900 + 100}"
            
            # Calculate price based on seed details and class multiplier
            class_multiplier = {"ECONOMY": 1.0, "BUSINESS": 2.5, "FIRST": 4.0}.get(cabin_class, 1.0)
            base = air["base_price"] + (seed % 15) * 100
            total_fare = float(base) * class_multiplier * passengers
            
            # Layover configurations
            layovers = []
            duration_mins = 150 # Direct
            if idx == 1: # Air India layover
                layovers.append({"city": "BOM", "duration_mins": 90})
                duration_mins = 300
                total_fare -= 400 # Layovers are often cheaper
                
            departure_time = datetime.datetime.strptime(f"{departure_date} 08:00", "%Y-%m-%d %H:%M") + datetime.timedelta(hours=idx * 3)
            arrival_time = departure_time + datetime.timedelta(minutes=duration_mins)

            flights.append({
                "flight_number": flight_num,
                "airline": air["name"],
                "airline_code": air["code"],
                "origin": origin,
                "destination": destination,
                "departure_time": departure_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "arrival_time": arrival_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "duration_minutes": duration_mins,
                "layovers": layovers,
                "cabin_class": cabin_class,
                "price_per_passenger": float(total_fare / passengers),
                "total_price": float(total_fare),
                "currency": "INR"
            })

    # Sort flights by price
    flights = sorted(flights, key=lambda f: f["total_price"])

    response = {
        "success": True,
        "search_parameters": {
            "origin": origin,
            "destination": destination,
            "departure_date": departure_date,
            "passengers": passengers,
            "cabin_class": cabin_class
        },
        "results": flights
    }

    # Cache response in Redis
    if r:
        try:
            r.setex(cache_key, 600, json.dumps(response)) # 10 minutes cache TTL for price sensitivity
        except Exception as e:
            logger.warning(f"Failed to cache flight results: {e}")

    return response
