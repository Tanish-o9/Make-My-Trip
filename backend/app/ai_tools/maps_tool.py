import asyncio
import logging
from typing import Dict, Any
from langchain_core.tools import tool
from app.providers.maps.manager import MapsManager

logger = logging.getLogger(__name__)

maps_manager = MapsManager()

@tool
def maps_geocoding_tool(city: str) -> Dict[str, Any]:
    """
    Geocodes a city name to coordinates (latitude, longitude, formatted address).
    Args:
        city: Name of the target city or location (e.g. 'Delhi', 'Goa').
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, maps_manager.convert_city_to_coordinates(city))
                res = future.result()
        else:
            res = loop.run_until_complete(maps_manager.convert_city_to_coordinates(city))
        return {"success": True, "data": res}
    except Exception as e:
        logger.error(f"maps_geocoding_tool failed: {e}")
        return {"success": False, "error": str(e)}

@tool
def maps_directions_tool(origin: str, destination: str, mode: str = "driving") -> Dict[str, Any]:
    """
    Calculates turn-by-turn route directions between an origin and destination.
    Args:
        origin: Start location name or coordinates.
        destination: End location name or coordinates.
        mode: Travel mode ('driving', 'walking', 'transit', 'bicycling'). Defaults to 'driving'.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, maps_manager.get_route_directions(origin, destination, mode))
                res = future.result()
        else:
            res = loop.run_until_complete(maps_manager.get_route_directions(origin, destination, mode))
        return {"success": True, "data": res}
    except Exception as e:
        logger.error(f"maps_directions_tool failed: {e}")
        return {"success": False, "error": str(e)}

@tool
def maps_taxi_tool(origin: str, destination: str) -> Dict[str, Any]:
    """
    Estimates taxi driving distance, duration, and fare cost in INR.
    Args:
        origin: Start address or city.
        destination: End address or city.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, maps_manager.get_taxi_estimate(origin, destination))
                res = future.result()
        else:
            res = loop.run_until_complete(maps_manager.get_taxi_estimate(origin, destination))
        return {"success": True, "data": res}
    except Exception as e:
        logger.error(f"maps_taxi_tool failed: {e}")
        return {"success": False, "error": str(e)}

@tool
def maps_nearby_tool(lat: float, lng: float, place_type: str) -> Dict[str, Any]:
    """
    Searches for nearby places (restaurants, attractions, hospitals, lodging) relative to coordinates.
    Args:
        lat: Latitude coordinate.
        lng: Longitude coordinate.
        place_type: Type of place to search ('restaurant', 'attraction', 'hospital', 'hotel').
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, maps_manager.search_nearby(lat, lng, place_type))
                res = future.result()
        else:
            res = loop.run_until_complete(maps_manager.search_nearby(lat, lng, place_type))
        return {"success": True, "results": res}
    except Exception as e:
        logger.error(f"maps_nearby_tool failed: {e}")
        return {"success": False, "error": str(e)}
