import os
import httpx
import logging
import asyncio
import random
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

CITY_GEOLOCATIONS = {
    "goa": {"lat": 15.2993, "lng": 74.1240, "city": "Goa", "address": "Goa, India"},
    "delhi": {"lat": 28.6139, "lng": 77.2090, "city": "Delhi", "address": "Delhi, India"},
    "mumbai": {"lat": 19.0760, "lng": 72.8777, "city": "Mumbai", "address": "Mumbai, India"},
    "jaipur": {"lat": 26.9124, "lng": 75.7873, "city": "Jaipur", "address": "Jaipur, Rajasthan, India"},
    "manali": {"lat": 32.2396, "lng": 77.1887, "city": "Manali", "address": "Manali, Himachal Pradesh, India"},
    "paris": {"lat": 48.8566, "lng": 2.3522, "city": "Paris", "address": "Paris, France"},
    "london": {"lat": 51.5074, "lng": -0.1278, "city": "London", "address": "London, United Kingdom"},
    "tokyo": {"lat": 35.6762, "lng": 139.6503, "city": "Tokyo", "address": "Tokyo, Japan"}
}

class GeoapifyProvider:
    def __init__(self):
        self.api_key = os.getenv("GEOAPIFY_API_KEY", "").strip()

    async def _make_request(self, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if not self.api_key or self.api_key == "your-geoapify-key":
            logger.warning("GEOAPIFY_API_KEY is not configured.")
            raise ValueError("Geoapify API Key is missing.")

        url = f"https://api.geoapify.com/{path}"
        params["apiKey"] = self.api_key

        max_retries = 2
        delay = 0.5
        factor = 2.0
        last_err = None

        for attempt in range(max_retries + 1):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, params=params, timeout=5.0)
                    if resp.status_code == 429:
                        raise httpx.HTTPStatusError("Rate Limit (429)", request=resp.request, response=resp)
                    resp.raise_for_status()
                    return resp.json()
            except Exception as e:
                last_err = e
                if attempt < max_retries:
                    sleep_time = delay * (1 + random.random() * 0.1)
                    logger.warning(f"Attempt {attempt+1} failed for Geoapify {path}: {e}. Retrying in {sleep_time:.2f}s...")
                    await asyncio.sleep(sleep_time)
                    delay *= factor
                else:
                    logger.error(f"All requests failed for Geoapify {path}: {e}")
                    raise e
        raise last_err

    async def geocode(self, text: str) -> Dict[str, Any]:
        params = {"text": text, "limit": 1}
        try:
            data = await self._make_request("v1/geocode/search", params)
            features = data.get("features", [])
            if features:
                properties = features[0].get("properties", {})
                geometry = features[0].get("geometry", {})
                coordinates = geometry.get("coordinates", [0.0, 0.0])  # [lon, lat]
                return {
                    "city": properties.get("city") or properties.get("name") or text.capitalize(),
                    "latitude": float(coordinates[1]),
                    "longitude": float(coordinates[0]),
                    "formatted": properties.get("formatted") or text
                }
        except Exception as e:
            logger.warning(f"Geoapify Geocoding failed for {text}: {e}.")

        # Offline Local fallback
        clean_text = text.lower().strip()
        for k, v in CITY_GEOLOCATIONS.items():
            if k in clean_text:
                return {
                    "city": v["city"],
                    "latitude": v["lat"],
                    "longitude": v["lng"],
                    "formatted": v["address"]
                }
        return {
            "city": text.capitalize(),
            "latitude": 28.6139,
            "longitude": 77.2090,
            "formatted": f"{text.capitalize()}, India"
        }

    async def reverse_geocode(self, lat: float, lng: float) -> Dict[str, Any]:
        params = {"lat": str(lat), "lon": str(lng), "limit": 1}
        try:
            data = await self._make_request("v1/geocode/reverse", params)
            features = data.get("features", [])
            if features:
                properties = features[0].get("properties", {})
                return {
                    "city": properties.get("city") or "Unknown City",
                    "country": properties.get("country") or "India",
                    "formatted": properties.get("formatted") or "Nearby Area"
                }
        except Exception as e:
            logger.warning(f"Geoapify Reverse Geocoding failed for {lat}, {lng}: {e}.")
        return {"city": "Local Hub", "country": "India", "formatted": "Central Tourist Zone"}

    async def search_nearby(self, lat: float, lng: float, query_type: str) -> List[Dict[str, Any]]:
        # Map frontend query type to Geoapify categories
        category_map = {
            "hotel": "accommodation.hotel",
            "restaurant": "catering.restaurant",
            "airport": "airport",
            "tourism": "tourism.attraction"
        }
        category = category_map.get(query_type.lower().strip(), "tourism.attraction")
        
        params = {
            "categories": category,
            "filter": f"circle:{lng},{lat},5000", # 5km filter radius
            "bias": f"proximity:{lng},{lat}",
            "limit": 10
        }

        try:
            data = await self._make_request("v2/places", params)
            features = data.get("features", [])
            places = []
            for item in features:
                properties = item.get("properties", {})
                geometry = item.get("geometry", {})
                coords = geometry.get("coordinates", [0.0, 0.0]) # [lon, lat]
                places.append({
                    "id": properties.get("place_id") or f"place_{properties.get('name') or 'spot'}",
                    "name": properties.get("name") or properties.get("street") or f"Local {query_type.capitalize()}",
                    "latitude": float(coords[1]),
                    "longitude": float(coords[0]),
                    "address": properties.get("formatted") or properties.get("address_line2") or "Nearby Area",
                    "category": query_type,
                    "distance": float(properties.get("distance") or 120.0)
                })
            if places:
                return places
        except Exception as e:
            logger.warning(f"Geoapify Places Search failed for {lat}, {lng}: {e}.")

        return self._get_mock_places_nearby(lat, lng, query_type)

    @staticmethod
    def _get_mock_places_nearby(lat: float, lng: float, query_type: str) -> List[Dict[str, Any]]:
        # High fidelity offline relative spots builder
        if query_type.lower() == "hotel":
            names = ["The Grand Palace Hotel", "Sunset View Resorts", "Sleek Business Suites", "Cozy Backpackers Inn"]
            addresses = ["Central Boulevard Road", "Cliffside Seaside Drive", "Financial Tech District", "Cultural Market St"]
        elif query_type.lower() == "restaurant":
            names = ["Ocean Breeze Café", "Royal Tandoori Bistro", "Healthy Herbivore Grill", "Gourmet Bakery Hub"]
            addresses = ["Beach View Walkway", "Old Town Heritage Lane", "14 Green Meadows Crescent", "Market Crossing Block"]
        elif query_type.lower() == "airport":
            names = ["International Terminal A", "Regional Heliport Yard"]
            addresses = ["Airport Approach Expressway", "Highlands Runway Bypass"]
        else:
            names = ["Scenic Botanical Gardens", "Museum of Modern Heritage", "Royal Citadel Gatehouse", "Sunset Beach Viewpoint"]
            addresses = ["Forest Reserve Road", "Citadel Hilltop Drive", "Central Plaza Arc", "Sunset Promenade Walk"]

        results = []
        for idx, name in enumerate(names[:4]):
            # Generate stable coordinates slightly offset from the target lat/lng
            offset_lat = lat + (0.005 * (idx + 1) * (-1 if idx % 2 == 0 else 1))
            offset_lng = lng + (0.005 * (idx + 1) * (1 if idx % 3 == 0 else -1))
            results.append({
                "id": f"mock_{query_type}_{idx}",
                "name": name,
                "latitude": offset_lat,
                "longitude": offset_lng,
                "address": addresses[idx % len(addresses)],
                "category": query_type,
                "distance": float(100 * (idx + 1))
            })
        return results
