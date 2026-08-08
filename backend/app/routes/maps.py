from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any, Optional
from app.providers.maps.manager import MapsManager
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
maps_manager = MapsManager()


@router.get("/search", response_model=Dict[str, Any])
async def search_location(city: str = Query(..., description="Target search city")):
    """
    Geocode a city name to coordinates.
    Example: GET /api/v1/maps/search?city=Goa
    """
    city_clean = city.strip()
    if not city_clean:
        raise HTTPException(status_code=400, detail="City parameter cannot be empty.")
    try:
        return await maps_manager.convert_city_to_coordinates(city_clean)
    except Exception as e:
        logger.error(f"Error in search_location route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nearby", response_model=List[Dict[str, Any]])
async def search_nearby(
    lat: float = Query(..., description="Latitude coordinate"),
    lng: float = Query(..., description="Longitude coordinate"),
    query_type: str = Query(..., alias="type", description="Type: restaurant | attraction | hospital | hotel | airport"),
):
    """
    Get nearby places by coordinates and type.
    Example: GET /api/v1/maps/nearby?lat=15.2993&lng=74.1240&type=restaurant
    """
    try:
        return await maps_manager.search_nearby(lat, lng, query_type)
    except Exception as e:
        logger.error(f"Error in search_nearby route: {e}")
        return []


@router.get("/hotel-location", response_model=Dict[str, Any])
async def get_hotel_location(hotelId: str = Query(..., description="Hotel name or ID")):
    """
    Get coordinates and map marker for a hotel.
    Example: GET /api/v1/maps/hotel-location?hotelId=Grand%20Palace
    """
    hotel_clean = hotelId.strip()
    if not hotel_clean:
        raise HTTPException(status_code=400, detail="Hotel ID/name cannot be empty.")
    try:
        return await maps_manager.get_hotel_location_details(hotel_clean)
    except Exception as e:
        logger.error(f"Error in get_hotel_location route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/directions", response_model=Dict[str, Any])
async def get_directions(
    origin: str = Query(..., description="Origin address, city, or coordinates"),
    destination: str = Query(..., description="Destination address, city, or coordinates"),
    mode: str = Query("driving", description="Travel mode: driving | walking | transit | bicycling"),
):
    """
    Get turn-by-turn directions between two points.
    Example: GET /api/v1/maps/directions?origin=DEL+Airport&destination=Connaught+Place&mode=driving
    """
    if not origin.strip() or not destination.strip():
        raise HTTPException(status_code=400, detail="Both origin and destination are required.")

    allowed_modes = {"driving", "walking", "transit", "bicycling"}
    if mode.lower() not in allowed_modes:
        raise HTTPException(status_code=400, detail=f"Mode must be one of: {', '.join(allowed_modes)}")

    try:
        return await maps_manager.get_route_directions(origin.strip(), destination.strip(), mode.lower())
    except Exception as e:
        logger.error(f"Error in get_directions route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/taxi-estimate", response_model=Dict[str, Any])
async def get_taxi_estimate(
    origin: str = Query(..., description="Pickup location (address or city)"),
    destination: str = Query(..., description="Drop-off location (address or city)"),
):
    """
    Estimate taxi/cab fare between two points.
    Example: GET /api/v1/maps/taxi-estimate?origin=DEL+Airport&destination=Hotel+Taj+Palace
    """
    if not origin.strip() or not destination.strip():
        raise HTTPException(status_code=400, detail="Both origin and destination are required.")

    try:
        return await maps_manager.get_taxi_estimate(origin.strip(), destination.strip())
    except Exception as e:
        logger.error(f"Error in get_taxi_estimate route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nearby/restaurants", response_model=List[Dict[str, Any]])
async def get_nearby_restaurants(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """Shortcut: Get nearby restaurants at coordinates."""
    try:
        return await maps_manager.get_nearby_restaurants(lat, lng)
    except Exception as e:
        logger.error(f"Error in nearby restaurants: {e}")
        return []


@router.get("/nearby/attractions", response_model=List[Dict[str, Any]])
async def get_nearby_attractions(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """Shortcut: Get nearby tourist attractions at coordinates."""
    try:
        return await maps_manager.get_nearby_attractions(lat, lng)
    except Exception as e:
        logger.error(f"Error in nearby attractions: {e}")
        return []


@router.get("/nearby/hospitals", response_model=List[Dict[str, Any]])
async def get_nearby_hospitals(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """Shortcut: Get nearby hospitals at coordinates."""
    try:
        return await maps_manager.get_nearby_hospitals(lat, lng)
    except Exception as e:
        logger.error(f"Error in nearby hospitals: {e}")
        return []
