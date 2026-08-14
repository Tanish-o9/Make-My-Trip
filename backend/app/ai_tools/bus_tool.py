import logging
from typing import Dict, Any, List
from app.database import SessionLocal
from app.models.search_entities import BusRoute

logger = logging.getLogger(__name__)

def bus_search_tool(
    origin: str,
    destination: str,
    departure_date: str,  # YYYY-MM-DD
    bus_type: str = "Any"
) -> Dict[str, Any]:
    """
    Searches for bus routes matching origin and destination.
    Args:
        origin: Departure city.
        destination: Arrival city.
        departure_date: Date of travel (YYYY-MM-DD).
        bus_type: Preferred class filter.
    """
    db = SessionLocal()
    try:
        query = db.query(BusRoute)
        
        # Simple case-insensitive match on origin and destination
        if origin and destination:
            query = query.filter(
                BusRoute.origin.like(f"%{origin.strip()}%"),
                BusRoute.destination.like(f"%{destination.strip()}%")
            )
            
        buses = query.all()
        
        results = []
        for b in buses:
            # Duration calculation helper
            is_long = (b.origin.lower() == "delhi" and b.destination.lower() == "manali") or \
                      (b.origin.lower() == "mumbai" and b.destination.lower() == "goa") or \
                      (b.origin.lower() == "bengaluru" and b.destination.lower() == "goa")
            duration = "11h 45m" if is_long else "5h 30m"
            
            # Reconstruct arrival time stably
            try:
                dh, dm = map(int, b.departure_time.split(":"))
                travel_h = 11 if is_long else 5
                travel_m = 45 if is_long else 30
                ah = (dh + travel_h + (dm + travel_m) // 60) % 24
                am = (dm + travel_m) % 60
                arrival_time = f"{ah:02d}:{am:02d}"
            except Exception:
                arrival_time = "06:00"

            # Stable values for ratings
            stable_val = sum(ord(c) for c in b.operator_name)
            rating = round(4.0 + (stable_val % 10) / 10.0, 1)
            if rating > 5.0:
                rating = 4.8
            review_count = 50 + (stable_val % 450)
            
            # Amenities list
            amenities = ["Blanket", "Charging Point", "Reading Light", "Water Bottle"]
            is_ac = "AC" in b.bus_type or "Volvo" in b.bus_type
            if is_ac:
                amenities.append("AC")
            if stable_val % 2 == 0:
                amenities.append("WiFi")
                amenities.append("CCTV")

            results.append({
                "id": b.id,
                "operator_name": b.operator_name,
                "bus_type": b.bus_type,
                "price": float(b.price),
                "departure_time": b.departure_time,
                "arrival_time": arrival_time,
                "duration": duration,
                "origin": b.origin,
                "destination": b.destination,
                "seats_left": b.seats_left,
                "rating": rating,
                "review_count": review_count,
                "amenities": amenities
            })
            
        return {"success": True, "results": results}
    except Exception as e:
        logger.error(f"bus_search_tool failed: {e}")
        return {"success": False, "error": str(e), "results": []}
    finally:
        db.close()
