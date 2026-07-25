import os
import json
import logging
import hashlib
from typing import Dict, Any, List
import redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

def _get_redis_client():
    try:
        return redis.Redis.from_url(REDIS_URL, socket_timeout=2)
    except Exception:
        return None

def hotel_search_tool(
    destination: str,
    check_in: str,  # YYYY-MM-DD
    check_out: str, # YYYY-MM-DD
    guests: int = 1,
    budget_tier: str = "MIDRANGE" # BUDGET, MIDRANGE, LUXURY
) -> Dict[str, Any]:
    """
    Searches for hotel accommodations matching specific destination and criteria.
    Args:
        destination: Name of city/area (e.g., Goa, Mumbai).
        check_in: Start date (YYYY-MM-DD).
        check_out: End date (YYYY-MM-DD).
        guests: Number of travelers.
        budget_tier: Budget filtering (BUDGET, MIDRANGE, LUXURY).
    """
    destination = destination.capitalize().strip()
    budget_tier = budget_tier.upper().strip()

    # 1. Check Redis Cache
    cache_key = f"hotels:{destination}:{check_in}:{check_out}:{guests}:{budget_tier}"
    r = _get_redis_client()
    if r:
        try:
            cached = r.get(cache_key)
            if cached:
                logger.info("Hotel search cache hit!")
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Failed to query hotel cache: {e}")

    # 2. Mock Hotel Options Generator based on Destination & Budget
    seed_str = f"{destination}-{check_in}-{check_out}"
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % 100

    hotel_templates = {
        "BUDGET": [
            {"name": "Backpackers Hostel", "base_price": 800, "rating": 4.1, "amenities": ["WiFi", "Shared Kitchen", "Lounge"]},
            {"name": "Cozy Inn & Suites", "base_price": 1800, "rating": 4.0, "amenities": ["WiFi", "AC", "Free Breakfast"]}
        ],
        "MIDRANGE": [
            {"name": "Royal Residency", "base_price": 3500, "rating": 4.3, "amenities": ["WiFi", "AC", "Pool", "Room Service"]},
            {"name": "Ginger Boutique Hotel", "base_price": 4800, "rating": 4.4, "amenities": ["WiFi", "Gym", "Restaurant", "AC"]}
        ],
        "LUXURY": [
            {"name": "Taj Exotica Resort", "base_price": 18000, "rating": 4.9, "amenities": ["Private Beach", "Infinity Pool", "Spa", "Fine Dining"]},
            {"name": "The Leela Palace", "base_price": 22000, "rating": 4.8, "amenities": ["Butler Service", "Golf Course", "Spa", "AC"]}
        ]
    }

    selected_templates = hotel_templates.get(budget_tier, hotel_templates["MIDRANGE"])
    hotels = []
    
    # Calculate duration
    try:
        from datetime import datetime
        date_format = "%Y-%m-%d"
        n_nights = (datetime.strptime(check_out, date_format) - datetime.strptime(check_in, date_format)).days
        if n_nights <= 0:
            n_nights = 1
    except Exception:
        n_nights = 1

    for idx, ht in enumerate(selected_templates):
        price_per_night = ht["base_price"] + (seed % 5) * 100
        total_price = price_per_night * n_nights
        
        hotels.append({
            "hotel_id": f"ht_{seed}_{idx}",
            "name": f"{destination} {ht['name']}",
            "rating": ht["rating"],
            "price_per_night": float(price_per_night),
            "total_price": float(total_price),
            "nights": n_nights,
            "currency": "INR",
            "amenities": ht["amenities"],
            "location_summary": f"Located near key tourist spots in {destination}"
        })

    response = {
        "success": True,
        "search_parameters": {
            "destination": destination,
            "check_in": check_in,
            "check_out": check_out,
            "guests": guests,
            "budget_tier": budget_tier
        },
        "results": hotels
    }

    # Cache response in Redis
    if r:
        try:
            r.setex(cache_key, 600, json.dumps(response)) # 10 minutes cache TTL
        except Exception as e:
            logger.warning(f"Failed to cache hotel results: {e}")

    return response
