from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.search_entities import Locality, District, State
from typing import List, Dict, Any

router = APIRouter(prefix="/localities", tags=["localities"])

import json
from app.utils.redis_client import redis_client

# Simple in-memory query cache fallback
autocomplete_cache: Dict[str, List[Dict[str, Any]]] = {}

@router.get("/autocomplete")
def autocomplete_localities(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    query = q.strip().lower()
    if not query:
        return []
        
    cache_key = f"autocomplete:localities:{query}"
    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception:
            pass
    elif query in autocomplete_cache:
        return autocomplete_cache[query]
    
    # Query database joining Locality, District, and State
    results = db.query(Locality, District, State).join(
        District, Locality.district_id == District.id
    ).join(
        State, District.state_id == State.id
    ).filter(
        Locality.name.like(f"%{q.strip()}%")
    ).all()
    
    formatted = []
    for loc, dist, state in results:
        # Fetch the hub name if this locality is not a hub
        hub_name = None
        hub_distance = 0.0
        
        if not loc.has_rental_hub and loc.nearest_hub_locality_id:
            hub_loc = db.query(Locality).filter(Locality.id == loc.nearest_hub_locality_id).first()
            if hub_loc:
                hub_name = hub_loc.name
                # Haversine distance
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
                hub_distance = haversine(float(loc.latitude), float(loc.longitude), float(hub_loc.latitude), float(hub_loc.longitude))

        formatted.append({
            "id": loc.id,
            "name": loc.name,
            "type": loc.type,
            "district": dist.name,
            "state": state.name,
            "latitude": float(loc.latitude),
            "longitude": float(loc.longitude),
            "population_tier": loc.population_tier,
            "has_rental_hub": loc.has_rental_hub,
            "nearest_hub_locality_id": loc.nearest_hub_locality_id,
            "nearest_hub_name": hub_name,
            "nearest_hub_distance": round(hub_distance, 2),
            "delivery_radius_km": float(loc.delivery_radius_km),
            "delivery_fee_beyond_radius": float(loc.delivery_fee_beyond_radius),
            "display_name": f"{loc.name} ({loc.type.capitalize()}) — {dist.name} District, {state.name}"
        })
    
    # Sorting / Ranking logic:
    # 1. Exact match first (case-insensitive)
    # 2. Prefix match next
    # 3. Population tier (1 is metro/city, 2 is mid/town, 3 is village)
    # 4. Alphabetical
    def rank_key(item):
        name_lower = item["name"].lower()
        is_exact = 0 if name_lower == query else 1
        is_prefix = 0 if name_lower.startswith(query) else 1
        return (is_exact, is_prefix, item["population_tier"], name_lower)
    
    formatted.sort(key=rank_key)
    output = formatted[:15]
    
    # Store in query cache
    if redis_client:
        try:
            redis_client.setex(cache_key, 3600, json.dumps(output))
        except Exception:
            pass
    else:
        autocomplete_cache[query] = output
    return output
