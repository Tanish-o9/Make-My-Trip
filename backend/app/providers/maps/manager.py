import json
import logging
from typing import Dict, Any, List
from app.providers.maps.geoapify import GeoapifyProvider
from app.providers.maps.google_maps import GoogleMapsProvider
from app.utils.redis_client import redis_client
from app.services.resilience import CircuitBreaker

logger = logging.getLogger(__name__)

maps_breaker = CircuitBreaker("MapsAPI", max_failures=3, cooldown_seconds=30)


class MapsManager:
    def __init__(self):
        self.geoapify = GeoapifyProvider()
        self.google = GoogleMapsProvider()

    # ─────────────────────────────────────────────────────────
    # Geocoding
    # ─────────────────────────────────────────────────────────

    async def convert_city_to_coordinates(self, city: str) -> Dict[str, Any]:
        city_key = city.strip().lower()
        cache_key = f"maps:coords:{city_key}"

        # 1. Try Redis Cache
        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Cache HIT for geocoding of city: {city}")
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis get failed in MapsManager: {e}")

        # 2. Try Google Maps Geocoding first (if configured)
        if self.google._is_configured():
            try:
                data = await maps_breaker.call_async(lambda: self.google.geocode(city))
                if data:
                    result = {
                        "city": city.capitalize(),
                        "latitude": data["latitude"],
                        "longitude": data["longitude"],
                        "formatted": data.get("formatted_address", city.capitalize()),
                        "place_id": data.get("place_id"),
                        "source": "google",
                    }
                    if redis_client:
                        try:
                            redis_client.setex(cache_key, 3600, json.dumps(result))
                        except Exception:
                            pass
                    return result
            except Exception as e:
                logger.warning(f"Google geocoding failed for {city}: {e}. Falling back to Geoapify.")

        # 3. Fallback to Geoapify
        try:
            data = await maps_breaker.call_async(lambda: self.geoapify.geocode(city))
            if redis_client and data:
                try:
                    redis_client.setex(cache_key, 900, json.dumps(data))
                except Exception:
                    pass
            return data
        except Exception as e:
            logger.error(f"Error resolving coordinates for {city}: {e}")
            coords = self.geoapify.CITY_GEOLOCATIONS.get(city_key)
            if coords:
                return {
                    "city": city.capitalize(),
                    "latitude": coords["lat"],
                    "longitude": coords["lng"],
                    "formatted": coords.get("address", city.capitalize()),
                }
            return {"city": city.capitalize(), "latitude": 28.6139, "longitude": 77.2090, "formatted": f"{city.capitalize()}, India"}

    # ─────────────────────────────────────────────────────────
    # Directions (Airport Route, Hotel Route)
    # ─────────────────────────────────────────────────────────

    async def get_route_directions(self, origin: str, destination: str, mode: str = "driving") -> Dict[str, Any]:
        """Returns real driving/transit directions. Falls back to mock if Google is unconfigured."""
        cache_key = f"maps:directions:{origin.lower()}:{destination.lower()}:{mode}"

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        try:
            result = await maps_breaker.call_async(
                lambda: self.google.get_directions(origin, destination, mode)
            )
            if redis_client and result:
                try:
                    redis_client.setex(cache_key, 1800, json.dumps(result))
                except Exception:
                    pass
            return result
        except Exception as e:
            logger.warning(f"get_route_directions failed: {e}.")
            return self.google._mock_directions(origin, destination, mode)

    # ─────────────────────────────────────────────────────────
    # Taxi Estimate
    # ─────────────────────────────────────────────────────────

    async def get_taxi_estimate(self, origin: str, destination: str) -> Dict[str, Any]:
        cache_key = f"maps:taxi:{origin.lower()}:{destination.lower()}"

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        try:
            result = await maps_breaker.call_async(
                lambda: self.google.get_taxi_estimate(origin, destination)
            )
            if redis_client and result:
                try:
                    redis_client.setex(cache_key, 1800, json.dumps(result))
                except Exception:
                    pass
            return result
        except Exception as e:
            logger.warning(f"get_taxi_estimate failed: {e}.")
            return self.google._mock_taxi_estimate(origin, destination)

    # ─────────────────────────────────────────────────────────
    # Nearby Search
    # ─────────────────────────────────────────────────────────

    async def search_nearby(self, *args, **kwargs) -> List[Dict[str, Any]]:
        """Supports: search_nearby(location, type) or search_nearby(lat, lng, type)."""
        lat = lng = None
        query_type = None

        if len(args) == 2:
            location, query_type = args
            coords = await self.convert_city_to_coordinates(location)
            lat = coords.get("latitude", 15.2993)
            lng = coords.get("longitude", 74.1240)
        elif len(args) == 3:
            lat, lng, query_type = args
        else:
            lat = kwargs.get("lat")
            lng = kwargs.get("lng")
            query_type = kwargs.get("query_type") or kwargs.get("type")
            location = kwargs.get("location")
            if location:
                coords = await self.convert_city_to_coordinates(location)
                lat = coords.get("latitude", 15.2993)
                lng = coords.get("longitude", 74.1240)

        lat = float(lat) if lat is not None else 15.2993
        lng = float(lng) if lng is not None else 74.1240
        query_type = str(query_type) if query_type else "restaurant"

        cache_key = f"maps:nearby:{lat:.4f}:{lng:.4f}:{query_type.lower()}"
        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Cache HIT for nearby {query_type} at {lat},{lng}")
                    return json.loads(cached)
            except Exception:
                pass

        # Try Google Places first
        if self.google._is_configured():
            try:
                data = await maps_breaker.call_async(
                    lambda: self.google.get_places_nearby(lat, lng, query_type)
                )
                if redis_client and data:
                    try:
                        redis_client.setex(cache_key, 900, json.dumps(data))
                    except Exception:
                        pass
                return data
            except Exception as e:
                logger.warning(f"Google Places Nearby failed: {e}. Falling back to Geoapify.")

        # Fallback to Geoapify
        try:
            data = await maps_breaker.call_async(
                lambda: self.geoapify.search_nearby(lat, lng, query_type)
            )
            if redis_client and data:
                try:
                    redis_client.setex(cache_key, 900, json.dumps(data))
                except Exception:
                    pass
            return data
        except Exception as e:
            logger.error(f"Error querying nearby spots: {e}")
            return self.google._mock_places_nearby(lat, lng, query_type)

    async def get_nearby_restaurants(self, lat: float, lng: float) -> List[Dict[str, Any]]:
        return await self.search_nearby(lat, lng, "restaurant")

    async def get_nearby_attractions(self, lat: float, lng: float) -> List[Dict[str, Any]]:
        return await self.search_nearby(lat, lng, "tourist_attraction")

    async def get_nearby_hospitals(self, lat: float, lng: float) -> List[Dict[str, Any]]:
        return await self.search_nearby(lat, lng, "hospital")

    # ─────────────────────────────────────────────────────────
    # Hotel Location Details
    # ─────────────────────────────────────────────────────────

    async def get_hotel_location_details(self, hotel_name: str) -> Dict[str, Any]:
        coords_info = await self.convert_city_to_coordinates(hotel_name)
        lat = coords_info.get("latitude", 15.2993)
        lng = coords_info.get("longitude", 74.1240)

        return {
            "coordinates": {"latitude": lat, "longitude": lng},
            "address": coords_info.get("formatted") or "Tourist Zone, India",
            "marker": {
                "title": hotel_name,
                "latitude": lat,
                "longitude": lng,
                "popup": f"<strong>{hotel_name}</strong><br/>{coords_info.get('formatted')}",
            },
        }
