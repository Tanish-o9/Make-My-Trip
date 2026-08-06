import os
import httpx
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class GoogleMapsProvider:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")

    async def get_directions(self, origin: str, destination: str) -> Dict[str, Any]:
        if not self.api_key or self.api_key in ["", "your-key"]:
            logger.info("Google Maps API Key not configured. Returning empty.")
            return {}

        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": origin,
            "destination": destination,
            "key": self.api_key
        }
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, params=params, timeout=4.0)
                resp.raise_for_status()
                data = resp.json()
                
            routes = data.get("routes", [])
            if not routes:
                return {}
                
            leg = routes[0].get("legs", [{}])[0]
            return {
                "distance": leg.get("distance", {}).get("text", "15 km"),
                "duration": leg.get("duration", {}).get("text", "30 mins"),
                "travel_time_seconds": leg.get("duration", {}).get("value", 1800),
                "steps": [s.get("html_instructions", "") for s in leg.get("steps", [])]
            }
        except Exception as e:
            logger.warning(f"Google Directions API query failed: {e}")
            return {}

    async def get_places_nearby(self, location: str, query_type: str) -> List[Dict[str, Any]]:
        if not self.api_key or self.api_key in ["", "your-key"]:
            logger.info("Google Places API Key not configured. Returning empty.")
            return []

        url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        params = {
            "query": f"{query_type} in {location}",
            "key": self.api_key
        }
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, params=params, timeout=4.0)
                resp.raise_for_status()
                data = resp.json()
                
            results = data.get("results", [])
            places = []
            for r in results[:5]:
                places.append({
                    "name": r.get("name", "Local Spot"),
                    "rating": r.get("rating", 4.2),
                    "address": r.get("formatted_address", ""),
                    "location_lat": r.get("geometry", {}).get("location", {}).get("lat"),
                    "location_lng": r.get("geometry", {}).get("location", {}).get("lng")
                })
            return places
        except Exception as e:
            logger.warning(f"Google Places API query failed: {e}")
            return []
