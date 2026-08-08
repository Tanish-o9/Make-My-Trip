from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any
from app.providers.weather.manager import WeatherManager
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
weather_manager = WeatherManager()


@router.get("/current", response_model=Dict[str, Any])
async def get_current_weather(city: str = Query(..., description="Target search city")):
    """
    Get current weather details for a specific city.
    Example: GET /api/v1/weather/current?city=Goa
    """
    city_clean = city.strip()
    if not city_clean:
        raise HTTPException(status_code=400, detail="City parameter cannot be empty.")
    try:
        return await weather_manager.get_current_weather(city_clean)
    except Exception as e:
        logger.error(f"Error in get_current_weather route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast", response_model=List[Dict[str, Any]])
async def get_weather_forecast(city: str = Query(..., description="Target search city")):
    """
    Get 5-day weather forecast details for a specific city.
    Example: GET /api/v1/weather/forecast?city=Goa
    """
    city_clean = city.strip()
    if not city_clean:
        raise HTTPException(status_code=400, detail="City parameter cannot be empty.")
    try:
        return await weather_manager.get_forecast(city_clean)
    except Exception as e:
        logger.error(f"Error in get_weather_forecast route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/air-quality", response_model=Dict[str, Any])
async def get_air_quality(city: str = Query(..., description="Target search city")):
    """
    Get Air Quality Index and pollutant counts for a specific city.
    Example: GET /api/v1/weather/air-quality?city=Goa
    """
    city_clean = city.strip()
    if not city_clean:
        raise HTTPException(status_code=400, detail="City parameter cannot be empty.")
    try:
        return await weather_manager.get_air_quality(city_clean)
    except Exception as e:
        logger.error(f"Error in get_air_quality route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/travel", response_model=Dict[str, Any])
async def get_travel_recommendations(city: str = Query(..., description="Target search city")):
    """
    Get travel packing guidelines and clothing suggestions for a specific city.
    Example: GET /api/v1/weather/travel?city=Goa
    """
    city_clean = city.strip()
    if not city_clean:
        raise HTTPException(status_code=400, detail="City parameter cannot be empty.")
    try:
        return await weather_manager.get_travel_recommendations(city_clean)
    except Exception as e:
        logger.error(f"Error in get_travel_recommendations route: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historical", response_model=Dict[str, Any])
async def get_historical_weather(
    city: str = Query(..., description="Target city"),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
):
    """
    Get historical weather data for a city on a specific date.
    Requires OpenWeather One Call API 3.0 subscription.
    Falls back to mock data when API is unconfigured.
    Example: GET /api/v1/weather/historical?city=Goa&date=2026-07-01
    """
    city_clean = city.strip()
    date_clean = date.strip()
    if not city_clean or not date_clean:
        raise HTTPException(status_code=400, detail="Both city and date are required.")
    try:
        return await weather_manager.get_historical_weather(city_clean, date_clean)
    except Exception as e:
        logger.error(f"Error in get_historical_weather route: {e}")
        raise HTTPException(status_code=500, detail=str(e))
