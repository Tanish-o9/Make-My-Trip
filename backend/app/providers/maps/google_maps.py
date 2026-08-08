import os
import httpx
import logging
import asyncio
import random
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Base URLs
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACES_TEXTSEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"

# Hardcoded coordinate lookup for common Indian cities/airports (used as fallback)
KNOWN_COORDS: Dict[str, Tuple[float, float]] = {
    "del": (28.5562, 77.1000),  # IGI Airport
    "delhi": (28.6139, 77.2090),
    "goi": (15.3808, 73.8314),  # Goa Airport
    "goa": (15.2993, 74.1240),
    "bom": (19.0896, 72.8656),  # Mumbai Airport
    "mumbai": (19.0760, 72.8777),
    "blr": (13.1986, 77.7066),  # Bengaluru Airport
    "bengaluru": (12.9716, 77.5946),
    "hyd": (17.2403, 78.4294),  # Hyderabad Airport
    "hyderabad": (17.3850, 78.4867),
    "maa": (12.9900, 80.1693),  # Chennai Airport
    "chennai": (13.0827, 80.2707),
    "jaipur": (26.9124, 75.7873),
    "manali": (32.2396, 77.1887),
    "paris": (48.8566, 2.3522),
    "london": (51.5074, -0.1278),
    "tokyo": (35.6762, 139.6503),
    "dubai": (25.2048, 55.2708),
}

# Approximate taxi fare per km (INR) for estimation
TAXI_RATE_PER_KM = 14.0
TAXI_BASE_FARE = 50.0


class GoogleMapsProvider:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()

    def _is_configured(self) -> bool:
        return bool(self.api_key) and self.api_key not in ("", "your-google-maps-key")

    async def _get(self, url: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a GET request to Google Maps API with retry."""
        if not self._is_configured():
            raise ValueError("GOOGLE_MAPS_API_KEY is not configured.")

        params["key"] = self.api_key
        max_retries = 2
        delay = 0.5
        last_err = None

        for attempt in range(max_retries + 1):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(url, params=params, timeout=6.0)
                    resp.raise_for_status()
                    data = resp.json()
                    status = data.get("status", "")
                    if status in ("ZERO_RESULTS", "NOT_FOUND"):
                        return {}
                    if status not in ("OK", ""):
                        raise ValueError(f"Google Maps API error: {status} — {data.get('error_message', '')}")
                    return data
            except Exception as e:
                last_err = e
                if attempt < max_retries:
                    sleep_time = delay * (1 + random.random() * 0.1)
                    logger.warning(f"Google Maps attempt {attempt+1} failed: {e}. Retrying in {sleep_time:.2f}s")
                    await asyncio.sleep(sleep_time)
                    delay *= 2.0
        raise last_err

    # ─────────────────────────────────────────────────────────
    # Geocoding API
    # ─────────────────────────────────────────────────────────

    async def geocode(self, address: str) -> Dict[str, Any]:
        """
        Convert an address/city/airport code to lat/lng coordinates.
        Falls back to KNOWN_COORDS table if API is unconfigured.
        """
        addr_lower = address.strip().lower()

        if not self._is_configured():
            return self._mock_geocode(addr_lower)

        try:
            data = await self._get(GEOCODE_URL, {"address": address})
            results = data.get("results", [])
            if not results:
                return self._mock_geocode(addr_lower)
            r = results[0]
            loc = r["geometry"]["location"]
            return {
                "latitude": loc["lat"],
                "longitude": loc["lng"],
                "formatted_address": r.get("formatted_address", address),
                "place_id": r.get("place_id", ""),
            }
        except Exception as e:
            logger.warning(f"Google Geocoding failed for '{address}': {e}. Using fallback.")
            return self._mock_geocode(addr_lower)

    # ─────────────────────────────────────────────────────────
    # Directions API
    # ─────────────────────────────────────────────────────────

    async def get_directions(
        self,
        origin: str,
        destination: str,
        mode: str = "driving",
    ) -> Dict[str, Any]:
        """
        Get directions between two points.
        mode: driving | walking | transit | bicycling
        """
        if not self._is_configured():
            return self._mock_directions(origin, destination, mode)

        try:
            data = await self._get(DIRECTIONS_URL, {
                "origin": origin,
                "destination": destination,
                "mode": mode,
                "units": "metric",
            })
            routes = data.get("routes", [])
            if not routes:
                return self._mock_directions(origin, destination, mode)

            leg = routes[0].get("legs", [{}])[0]
            distance_m = leg.get("distance", {}).get("value", 0)
            duration_s = leg.get("duration", {}).get("value", 0)

            return {
                "origin": origin,
                "destination": destination,
                "mode": mode,
                "distance": leg.get("distance", {}).get("text", ""),
                "distance_meters": distance_m,
                "duration": leg.get("duration", {}).get("text", ""),
                "duration_seconds": duration_s,
                "steps": [
                    {
                        "instruction": s.get("html_instructions", ""),
                        "distance": s.get("distance", {}).get("text", ""),
                        "duration": s.get("duration", {}).get("text", ""),
                        "mode": s.get("travel_mode", mode),
                    }
                    for s in leg.get("steps", [])
                ],
                "polyline": routes[0].get("overview_polyline", {}).get("points", ""),
            }
        except Exception as e:
            logger.warning(f"Google Directions failed for '{origin}'→'{destination}': {e}. Using fallback.")
            return self._mock_directions(origin, destination, mode)

    # ─────────────────────────────────────────────────────────
    # Distance Matrix / Taxi Estimate
    # ─────────────────────────────────────────────────────────

    async def get_taxi_estimate(self, origin: str, destination: str) -> Dict[str, Any]:
        """
        Estimate taxi/cab cost between two points.
        Uses Distance Matrix API for distance, then applies per-km rate.
        """
        if not self._is_configured():
            return self._mock_taxi_estimate(origin, destination)

        try:
            data = await self._get(DISTANCE_MATRIX_URL, {
                "origins": origin,
                "destinations": destination,
                "mode": "driving",
                "units": "metric",
            })
            rows = data.get("rows", [])
            if not rows:
                return self._mock_taxi_estimate(origin, destination)

            element = rows[0].get("elements", [{}])[0]
            if element.get("status") != "OK":
                return self._mock_taxi_estimate(origin, destination)

            distance_m = element.get("distance", {}).get("value", 0)
            duration_s = element.get("duration", {}).get("value", 0)
            distance_km = distance_m / 1000.0
            estimated_fare = TAXI_BASE_FARE + (distance_km * TAXI_RATE_PER_KM)

            return {
                "origin": origin,
                "destination": destination,
                "distance": element.get("distance", {}).get("text", ""),
                "distance_km": round(distance_km, 2),
                "duration": element.get("duration", {}).get("text", ""),
                "duration_seconds": duration_s,
                "estimated_fare_inr": round(estimated_fare, 0),
                "currency": "INR",
                "rate_per_km": TAXI_RATE_PER_KM,
                "base_fare": TAXI_BASE_FARE,
                "note": "Estimate only. Actual fare may vary based on traffic and cab type.",
            }
        except Exception as e:
            logger.warning(f"Google Distance Matrix failed: {e}. Using fallback.")
            return self._mock_taxi_estimate(origin, destination)

    # ─────────────────────────────────────────────────────────
    # Places Nearby API
    # ─────────────────────────────────────────────────────────

    async def get_places_nearby(
        self,
        lat: float,
        lng: float,
        place_type: str,
        radius: int = 3000,
    ) -> List[Dict[str, Any]]:
        """
        Search for nearby places by type.
        place_type: restaurant | tourist_attraction | hospital | lodging | airport
        Returns up to 8 results.
        """
        if not self._is_configured():
            return self._mock_places_nearby(lat, lng, place_type)

        # Map generic labels to Google Places types
        type_map = {
            "restaurant": "restaurant",
            "restaurants": "restaurant",
            "attraction": "tourist_attraction",
            "attractions": "tourist_attraction",
            "tourism": "tourist_attraction",
            "hospital": "hospital",
            "hospitals": "hospital",
            "hotel": "lodging",
            "hotels": "lodging",
            "airport": "airport",
        }
        google_type = type_map.get(place_type.lower(), place_type.lower())

        try:
            data = await self._get(PLACES_NEARBY_URL, {
                "location": f"{lat},{lng}",
                "radius": radius,
                "type": google_type,
            })
            results = data.get("results", [])
            places = []
            for r in results[:8]:
                loc = r.get("geometry", {}).get("location", {})
                places.append({
                    "name": r.get("name", ""),
                    "rating": r.get("rating", 0.0),
                    "user_ratings_total": r.get("user_ratings_total", 0),
                    "vicinity": r.get("vicinity", ""),
                    "place_id": r.get("place_id", ""),
                    "types": r.get("types", []),
                    "open_now": r.get("opening_hours", {}).get("open_now"),
                    "latitude": loc.get("lat"),
                    "longitude": loc.get("lng"),
                    "photo_reference": (r.get("photos") or [{}])[0].get("photo_reference"),
                })
            return places
        except Exception as e:
            logger.warning(f"Google Places Nearby failed ({place_type} near {lat},{lng}): {e}. Using fallback.")
            return self._mock_places_nearby(lat, lng, place_type)

    # ─────────────────────────────────────────────────────────
    # Mock / Fallback helpers
    # ─────────────────────────────────────────────────────────

    def _mock_geocode(self, address: str) -> Dict[str, Any]:
        addr_lower = address.strip().lower()
        if addr_lower in KNOWN_COORDS:
            lat, lng = KNOWN_COORDS[addr_lower]
        else:
            lat, lng = 28.6139, 77.2090  # Default: Delhi
        return {
            "latitude": lat,
            "longitude": lng,
            "formatted_address": address.capitalize(),
            "place_id": f"mock_{addr_lower.replace(' ', '_')}",
        }

    def _mock_directions(self, origin: str, destination: str, mode: str) -> Dict[str, Any]:
        return {
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "distance": "15.2 km",
            "distance_meters": 15200,
            "duration": "28 mins",
            "duration_seconds": 1680,
            "steps": [
                {"instruction": f"Head north from {origin}", "distance": "2 km", "duration": "5 mins", "mode": mode},
                {"instruction": "Turn right onto the main highway", "distance": "10 km", "duration": "15 mins", "mode": mode},
                {"instruction": f"Arrive at {destination}", "distance": "3.2 km", "duration": "8 mins", "mode": mode},
            ],
            "polyline": "",
        }

    def _mock_taxi_estimate(self, origin: str, destination: str) -> Dict[str, Any]:
        distance_km = 15.0
        fare = TAXI_BASE_FARE + (distance_km * TAXI_RATE_PER_KM)
        return {
            "origin": origin,
            "destination": destination,
            "distance": "15.0 km",
            "distance_km": distance_km,
            "duration": "28 mins",
            "duration_seconds": 1680,
            "estimated_fare_inr": fare,
            "currency": "INR",
            "rate_per_km": TAXI_RATE_PER_KM,
            "base_fare": TAXI_BASE_FARE,
            "note": "Estimate only (mock). Actual fare may vary.",
        }

    def _mock_places_nearby(self, lat: float, lng: float, place_type: str) -> List[Dict[str, Any]]:
        type_lower = place_type.lower()
        if "restaurant" in type_lower:
            return [
                {"name": "Spice Garden Restaurant", "rating": 4.3, "user_ratings_total": 412, "vicinity": "Near Beach Road", "place_id": "mock_r1", "types": ["restaurant"], "open_now": True, "latitude": lat + 0.001, "longitude": lng + 0.001, "photo_reference": None},
                {"name": "The Coastal Kitchen", "rating": 4.6, "user_ratings_total": 890, "vicinity": "Market Street", "place_id": "mock_r2", "types": ["restaurant"], "open_now": True, "latitude": lat - 0.002, "longitude": lng + 0.002, "photo_reference": None},
                {"name": "Biryani House", "rating": 4.1, "user_ratings_total": 235, "vicinity": "City Center", "place_id": "mock_r3", "types": ["restaurant"], "open_now": False, "latitude": lat + 0.003, "longitude": lng - 0.001, "photo_reference": None},
            ]
        elif "attraction" in type_lower or "tourism" in type_lower:
            return [
                {"name": "Historic Fort & Museum", "rating": 4.7, "user_ratings_total": 2341, "vicinity": "Old Town", "place_id": "mock_a1", "types": ["tourist_attraction"], "open_now": True, "latitude": lat + 0.005, "longitude": lng - 0.003, "photo_reference": None},
                {"name": "Scenic Waterfront Promenade", "rating": 4.5, "user_ratings_total": 1820, "vicinity": "Beachside", "place_id": "mock_a2", "types": ["tourist_attraction"], "open_now": True, "latitude": lat - 0.004, "longitude": lng + 0.005, "photo_reference": None},
                {"name": "Local Handicraft Market", "rating": 4.2, "user_ratings_total": 670, "vicinity": "Bazaar Lane", "place_id": "mock_a3", "types": ["tourist_attraction"], "open_now": True, "latitude": lat + 0.002, "longitude": lng + 0.004, "photo_reference": None},
            ]
        elif "hospital" in type_lower:
            return [
                {"name": "City General Hospital", "rating": 3.9, "user_ratings_total": 310, "vicinity": "Hospital Road", "place_id": "mock_h1", "types": ["hospital"], "open_now": True, "latitude": lat - 0.005, "longitude": lng - 0.002, "photo_reference": None},
                {"name": "Apollo Clinic & Emergency", "rating": 4.4, "user_ratings_total": 540, "vicinity": "Main Boulevard", "place_id": "mock_h2", "types": ["hospital"], "open_now": True, "latitude": lat + 0.006, "longitude": lng + 0.003, "photo_reference": None},
            ]
        else:
            return [
                {"name": f"{place_type.title()} Spot 1", "rating": 4.0, "user_ratings_total": 100, "vicinity": "Nearby", "place_id": "mock_x1", "types": [place_type], "open_now": True, "latitude": lat + 0.001, "longitude": lng + 0.001, "photo_reference": None},
                {"name": f"{place_type.title()} Spot 2", "rating": 4.2, "user_ratings_total": 200, "vicinity": "Nearby", "place_id": "mock_x2", "types": [place_type], "open_now": True, "latitude": lat - 0.001, "longitude": lng - 0.001, "photo_reference": None},
            ]
