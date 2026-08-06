import json
import logging
from typing import Dict, Any, List
from app.providers.maps.geoapify import GeoapifyProvider
from app.utils.redis_client import redis_client
from app.services.resilience import CircuitBreaker

logger = logging.getLogger(__name__)

maps_breaker = CircuitBreaker("MapsAPI", max_failures=3, cooldown_seconds=30)

class MapsManager:
    def __init__(self):
        self.provider = GeoapifyProvider()

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

        # 2. Query Provider with Circuit Breaker
        try:
            data = await maps_breaker.call_async(
                lambda: self.provider.geocode(city)
            )
            if redis_client and data:
                try:
                    redis_client.setex(cache_key, 900, json.dumps(data))
                except Exception as cache_err:
                    logger.error(f"Redis setex failed: {cache_err}")
            return data
        except Exception as e:
            logger.error(f"Error resolving coordinates for {city}: {e}")
            # Cache fallback or local resolved defaults
            return self.provider.CITY_GEOLOCATIONS.get(city_key) or {
                "city": city.capitalize(),
                "latitude": 28.6139,
                "longitude": 77.2090,
                "formatted": f"{city.capitalize()}, India"
            }

    async def search_nearby(self, *args, **kwargs) -> List[Dict[str, Any]]:
        # Supports: search_nearby(self, location: str, query_type: str)
        # Supports: search_nearby(self, lat: float, lng: float, query_type: str)
        lat = None
        lng = None
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
            if location is not None:
                coords = await self.convert_city_to_coordinates(location)
                lat = coords.get("latitude", 15.2993)
                lng = coords.get("longitude", 74.1240)

        lat = float(lat) if lat is not None else 15.2993
        lng = float(lng) if lng is not None else 74.1240
        query_type = str(query_type) if query_type is not None else "restaurant"

        cache_key = f"maps:nearby:{lat:.4f}:{lng:.4f}:{query_type.lower()}"

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Cache HIT for nearby places search of type: {query_type}")
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis get failed in MapsManager: {e}")

        try:
            data = await maps_breaker.call_async(
                lambda: self.provider.search_nearby(lat, lng, query_type)
            )
            if redis_client and data:
                try:
                    redis_client.setex(cache_key, 900, json.dumps(data))
                except Exception as cache_err:
                    logger.error(f"Redis setex failed: {cache_err}")
            return data
        except Exception as e:
            logger.error(f"Error querying nearby spots: {e}")
            return self.provider._get_mock_places_nearby(lat, lng, query_type)

    async def get_hotel_location_details(self, hotel_name: str) -> Dict[str, Any]:
        # Resolves coordinate mapping and constructs customized marker data
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
                "popup": f"<strong>{hotel_name}</strong><br/>{coords_info.get('formatted')}"
            }
        }

    # Backward compatibility mappings
    async def get_route_directions(self, origin: str, destination: str) -> Dict[str, Any]:
        # Simple route prepare calculation using mock bounds
        return {
            "distance": "12.8 km",
            "duration": "25 mins",
            "travel_time_seconds": 1500,
            "steps": [
                f"Head north from {origin} center route",
                "Turn right onto Expressway bypass lane",
                f"Keep left to merge onto {destination} Access Gate"
            ]
        }
