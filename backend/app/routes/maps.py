from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any
from app.providers.maps.manager import MapsManager
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
maps_manager = MapsManager()

@router.get("/search", response_model=Dict[str, Any])
async def search_location(city: str = Query(..., description="Target search city")):
    """
    Search coordinates for a target city.
    Example: GET /api/maps/search?city=Goa
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
    query_type: str = Query(..., alias="type", description="Type of nearby spots (hotel, restaurant, airport, tourism)")
):
    """
    Query nearby locations based on coordinates and type.
    Example: GET /api/maps/nearby?lat=15.2993&lng=74.1240&type=restaurant
    """
    try:
        return await maps_manager.search_nearby(lat, lng, query_type)
    except Exception as e:
        logger.error(f"Error in search_nearby route: {e}")
        return []

@router.get("/hotel-location", response_model=Dict[str, Any])
async def get_hotel_location(hotelId: str = Query(..., description="Target hotel name or ID")):
    """
    Query specific coordinates and marker data for a hotel.
    Example: GET /api/maps/hotel-location?hotelId=Grand%20Palace
    """
    hotel_clean = hotelId.strip()
    if not hotel_clean:
        raise HTTPException(status_code=400, detail="Hotel ID/name parameter cannot be empty.")
    try:
        return await maps_manager.get_hotel_location_details(hotel_clean)
    except Exception as e:
        logger.error(f"Error in get_hotel_location route: {e}")
        raise HTTPException(status_code=500, detail=str(e))
