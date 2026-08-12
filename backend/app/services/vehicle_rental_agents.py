import random
from app.ai_router.router import llm_router

def recommendation_agent(vehicles: list, destination: str) -> list:
    """Ranks available vehicles based on the destination type (hill/beach/adventure vs city)"""
    dest_lower = destination.lower()
    is_hill_or_adventure = any(x in dest_lower for x in [
        "goa", "manali", "leh", "ladakh", "shimla", "rishikesh", 
        "darjeeling", "ooty", "kerala", "hill", "mountain", "beach", "adventure"
    ])
    
    def sort_key(v):
        v_type = v["type"].lower()
        if is_hill_or_adventure:
            # Prefer SUVs and Bikes for rugged terrain / beach travel
            if "suv" in v_type:
                return 0
            elif "bike" in v_type or "motorcycle" in v_type:
                return 1
            elif "ev" in v_type:
                return 2
            else:
                return 3
        else:
            # Prefer EVs and Hatchbacks for city driving
            if "ev" in v_type:
                return 0
            elif "hatchback" in v_type:
                return 1
            elif "sedan" in v_type:
                return 2
            else:
                return 3
                
    return sorted(vehicles, key=sort_key)


def pricing_agent(vehicles: list) -> list:
    """Calculates surge pricing and attaches dynamic pricing badges if active"""
    for v in vehicles:
        if v.get("id", 1) % 2 == 0:
            v["surge_active"] = True
            v["original_price"] = v["price_per_day"]
            v["price_per_day"] = round(v["price_per_day"] * 1.18, 2)
            v["surge_badge"] = "High demand — prices may rise"
        else:
            v["surge_active"] = False
            v["surge_badge"] = None
            
        # Dynamically scale delivery fee based on distance (logistics cost)
        if v.get("delivery_required"):
            dist = v.get("nearest_hub_distance", 0.0)
            base_fee = v.get("delivery_fee", 250.0)
            # Rs. 12.50 per km distance surcharge
            v["delivery_fee"] = round(base_fee + (dist * 12.50), 2)
            
    return vehicles


def routing_agent(location: str) -> dict:
    """Finds the nearest rental depot hub if pick up is not doorstep delivery"""
    loc_lower = location.lower()
    if "airport" in loc_lower:
        return {
            "hub_name": "Airport Arrival Terminal Depot Hub", 
            "distance_km": 0.4, 
            "address": "Terminal 1 & 3 Ground Floor Car Rental Canopy"
        }
    elif "railway" in loc_lower or "station" in loc_lower:
        return {
            "hub_name": "Junction Railway Station Depot Hub", 
            "distance_km": 0.7, 
            "address": "Main Exit Platform 1 West Side Parking Yard"
        }
    else:
        return {
            "hub_name": "Downtown Central Depot Hub", 
            "distance_km": 2.5, 
            "address": "Block 4C, Commercial Center Market Lane"
        }


def fuel_agent(booking_ref: str) -> dict:
    """Simulates vehicle fuel telemetry and finds the nearest fuel station"""
    val = sum(ord(c) for c in booking_ref) % 20
    fuel_level = 75 + val  # Deterministic level between 75% and 95%
    return {
        "fuel_level_percent": fuel_level,
        "nearest_station": "Bharat Petroleum Station - 1.2 km away",
        "telemetry_status": f"Fuel: {fuel_level}% | Next Station: BP Station (1.2 km)"
    }


def ev_charging_agent(booking_ref: str) -> dict:
    """Simulates EV battery telemetry and finds the nearest EV charging station"""
    val = sum(ord(c) for c in booking_ref) % 20
    charge_level = 80 + val  # Battery charge level between 80% and 100%
    return {
        "charge_level_percent": charge_level,
        "nearest_charger": "Tata Power EZ EV Charger - 0.7 km away",
        "telemetry_status": f"Battery: {charge_level}% | Charger: Tata EZ Charger (0.7 km)"
    }


# Knowledge-base of FAQs for vehicle rental support RAG
VEHICLE_FAQ = {
    "deposit": "A fully refundable security deposit of ₹5,000 is required for self-drive bookings, which will be credited back to your original source of payment within 24 hours of vehicle return.",
    "license": "You must present a valid, original Indian Driving License (LVM category) or an International Driving Permit. Temporary or learner licenses are not accepted.",
    "fuel": "For self-drive rentals, the vehicle must be returned with the same fuel level as received. Refueling charges will apply otherwise.",
    "cancellation": "Free cancellation is allowed up to 24 hours prior to the scheduled pickup time. Cancellations within 24 hours attract a 1-day rental charge penalty.",
    "driver": "Chauffeur-driven rentals include driver lodging and boarding. The driver is scheduled for a maximum of 12 hours or 300km per calendar day.",
    "insurance": "All rental vehicles are fully covered under comprehensive motor insurance. Customer liability in case of accidents is capped at the security deposit amount.",
    "gps": "All our vehicles are equipped with active GPS tracking and speed limiters set to 80 km/h for passenger safety compliance."
}

def support_rag_bot(query: str) -> str:
    """Provides vector-like FAQ RAG grounding for vehicle support queries"""
    query_lower = query.lower()
    for key, ans in VEHICLE_FAQ.items():
        if key in query_lower:
            return ans
            
    # Fallback to LLM completion grounded in standard vehicle rental guidelines
    prompt = f"""
    You are the Ghumne Chale Vehicle Rental Support RAG Assistant. 
    Answer this user query: "{query}"
    
    Grounded FAQs:
    - Refundable security deposit: ₹5,000 (returned in 24 hours)
    - Valid Indian LVM Driving License required (no learner permits)
    - Return with same fuel level
    - Free cancellation up to 24 hours prior to trip
    - Comprehensive insurance is included
    
    Provide a professional, concise, and helpful response. Maximum 2-3 sentences.
    """
    try:
        response = llm_router.complete(prompt=prompt, task_type="simple")
        return response
    except Exception as e:
        return "I can assist you with security deposit, driving license rules, fuel policy, or cancellation terms. What would you like to know?"
