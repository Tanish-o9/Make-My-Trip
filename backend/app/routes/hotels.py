from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any
from app.services.hotel_service import HotelService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/search", response_model=List[Dict[str, Any]])
async def search_hotels(
    city: str = Query(..., description="Target search city"),
    check_in: str = Query(..., alias="checkIn", description="Check-in date (YYYY-MM-DD)"),
    check_out: str = Query(..., alias="checkOut", description="Check-out date (YYYY-MM-DD)"),
    adults: int = Query(1, description="Number of adults"),
    rooms: int = Query(1, description="Number of rooms"),
    currency: str = Query("INR", description="Preferred currency code")
):
    """
    Search hotels by city name, resolving destination id and querying availability.
    Example: GET /api/hotels/search?city=Goa&checkIn=2026-12-15&checkOut=2026-12-20
    """
    city_clean = city.strip()
    if not city_clean:
        raise HTTPException(status_code=400, detail="Search city parameter cannot be empty.")

    try:
        results = await HotelService.search_hotels(
            city=city_clean,
            check_in=check_in,
            check_out=check_out,
            adults=adults,
            rooms=rooms,
            currency=currency
        )
        return results
    except Exception as e:
        logger.error(f"Error in search_hotels endpoint: {e}")
        return HotelService._get_fallback_mock_hotels(city_clean, check_in, check_out, currency)

@router.get("/{hotelId}", response_model=Dict[str, Any])
async def get_hotel_details(hotelId: str):
    """
    Retrieve full details, photos, description, and facilities of a specific hotel.
    Example: GET /api/hotels/10001
    """
    try:
        return await HotelService.get_hotel_details(hotelId)
    except Exception as e:
        logger.error(f"Error in get_hotel_details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch hotel details: {str(e)}")

@router.get("/{hotelId}/reviews", response_model=List[Dict[str, Any]])
async def get_hotel_reviews(hotelId: str):
    """
    Retrieve guest reviews of a specific hotel.
    Example: GET /api/hotels/10001/reviews
    """
    try:
        return await HotelService.get_hotel_reviews(hotelId)
    except Exception as e:
        logger.error(f"Error in get_hotel_reviews: {e}")
        return []

@router.get("/{hotelId}/rooms", response_model=List[Dict[str, Any]])
async def get_hotel_rooms(
    hotelId: str,
    check_in: str = Query(..., alias="checkIn", description="Check-in date (YYYY-MM-DD)"),
    check_out: str = Query(..., alias="checkOut", description="Check-out date (YYYY-MM-DD)")
):
    """
    Retrieve room list and availability for a specific hotel.
    Example: GET /api/hotels/10001/rooms?checkIn=2026-12-15&checkOut=2026-12-20
    """
    try:
        return await HotelService.get_room_availability(hotelId, check_in, check_out)
    except Exception as e:
        logger.error(f"Error in get_hotel_rooms: {e}")
        return []
