from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.database import get_db
from app.models.search_entities import BusRoute
from app.services.seat_service import SeatInventoryService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

def get_enriched_bus(b_id, operator_name, bus_type, price, departure_time, origin, destination, seats_left, seats_map):
    is_ac = "AC" in bus_type or "Volvo" in bus_type
    is_sleeper = "Sleeper" in bus_type
    is_long = (origin.lower() == "delhi" and destination.lower() == "manali") or \
              (origin.lower() == "mumbai" and destination.lower() == "goa") or \
              (origin.lower() == "bengaluru" and destination.lower() == "goa")
              
    duration = "11h 45m" if is_long else "5h 30m"
    try:
        dh, dm = map(int, departure_time.split(":"))
        travel_h = 11 if is_long else 5
        travel_m = 45 if is_long else 30
        ah = (dh + travel_h + (dm + travel_m) // 60) % 24
        am = (dm + travel_m) % 60
        arrival_time = f"{ah:02d}:{am:02d}"
    except Exception:
        arrival_time = "06:00"

    bp_list = [
        {"name": f"{origin} ISBT", "time": departure_time, "landmark": "Gate No. 2", "address": f"Kashmere Gate ISBT, {origin}"},
        {"name": f"{origin} Bypass Toll", "time": f"{(dh + 1) % 24:02d}:{dm:02d}", "landmark": "Near NH Bypass", "address": f"Bypass Road Plaza, {origin}"}
    ]
    
    dp_list = [
        {"name": f"{destination} Bypass Toll", "time": f"{(dh + (11 if is_long else 5)) % 24:02d}:{dm:02d}", "landmark": "Bypass Entry Gate", "address": f"NH Road, {destination}"},
        {"name": f"{destination} Bus Depot", "time": arrival_time, "landmark": "Near Main Stand", "address": f"City Depot, {destination}"}
    ]
    
    stable_val = sum(ord(c) for c in operator_name)
    rating = round(4.0 + (stable_val % 10) / 10.0, 1)
    if rating > 5.0:
        rating = 4.8
    review_count = 50 + (stable_val % 450)

    amenities = ["Blanket", "Charging Point", "Reading Light", "Water Bottle"]
    if is_ac:
        amenities.append("AC")
    if stable_val % 2 == 0:
        amenities.append("WiFi")
        amenities.append("CCTV")
        
    return {
        "id": b_id,
        "operator_name": operator_name,
        "bus_type": bus_type,
        "price": price,
        "departure_time": departure_time,
        "arrival_time": arrival_time,
        "duration": duration,
        "origin": origin,
        "destination": destination,
        "seats_left": seats_left,
        "seats_map": seats_map,
        "rating": rating,
        "review_count": review_count,
        "amenities": amenities,
        "boarding_points": bp_list,
        "dropping_points": dp_list,
        "cancellation_policy": "Full refund if cancelled before 24 hours. 50% refund between 12-24 hours. No refund within 12 hours."
    }

@router.get("/{bus_id}/details", response_model=Dict[str, Any])
def get_bus_details(bus_id: str, db: Session = Depends(get_db)):
    """
    Retrieve full details, boarding/dropping points, policies of a specific bus route.
    """
    try:
        b_id_int = int(bus_id)
    except ValueError:
        b_id_int = None

    route = None
    if b_id_int is not None:
        route = db.query(BusRoute).filter(BusRoute.id == b_id_int).first()

    if not route:
        # Check fallbacks
        if bus_id == "101":
            return get_enriched_bus(101, "IntrCity SmartBus", "AC Sleeper (2+1)", 1490.0, "21:00", "Delhi", "Jaipur", 8, ["12A", "12B", "14A", "14B"])
        elif bus_id == "102":
            return get_enriched_bus(102, "Zingbus", "AC Premium Seater", 950.0, "22:30", "Delhi", "Amritsar", 15, ["5A", "5B", "7F"])
        raise HTTPException(status_code=404, detail="Bus route not found.")

    return get_enriched_bus(
        route.id, route.operator_name, route.bus_type, float(route.price),
        route.departure_time, route.origin, route.destination, route.seats_left, route.seats_map
    )

@router.get("/{bus_id}/seats", response_model=Dict[str, Any])
def get_bus_seats(bus_id: str, db: Session = Depends(get_db)):
    """
    Retrieve seat map occupancy combined with database hold locks.
    """
    try:
        b_id_int = int(bus_id)
    except ValueError:
        b_id_int = None

    route = None
    if b_id_int is not None:
        route = db.query(BusRoute).filter(BusRoute.id == b_id_int).first()

    ref = "IntrCity SmartBus"
    if route:
        ref = route.operator_name
    elif bus_id == "102":
        ref = "Zingbus"

    # Fetch seat map with DB holds overlayed
    return SeatInventoryService.get_seat_map(db=db, vertical="buses", reference=ref, is_live=False)
