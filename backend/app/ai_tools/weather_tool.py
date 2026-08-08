import os
import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def weather_search_tool(location: str, month: int = 1) -> Dict[str, Any]:
    """
    Fetches weather details or retrieves climate intelligence for a target destination.
    Args:
        location: Target city or destination name.
        month: Int represent traveling month (1-12) to fetch contextual forecasts.
    """
    from app.utils.metrics import TOOL_CALLS_TOTAL
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if api_key:
        try:
            # Call OpenWeather API
            url = f"https://api.openweathermap.org/data/2.5/weather?q={location}&appid={api_key}&units=metric"
            resp = httpx.get(url, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                TOOL_CALLS_TOTAL.labels(tool_name="weather_search", status="success").inc()
                return {
                    "success": True,
                    "location": location,
                    "temperature": data["main"]["temp"],
                    "description": data["weather"][0]["description"],
                    "humidity": data["main"]["humidity"]
                }
        except Exception as e:
            TOOL_CALLS_TOTAL.labels(tool_name="weather_search", status="error").inc()
            logger.warning(f"Failed to fetch live weather: {e}")


    # Fallback/Climate Intelligence logic for typical destinations
    loc_lower = location.lower()
    month_name = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ][max(1, min(12, month)) - 1]

    # Rule-based climate simulator
    if "goa" in loc_lower:
        if month in [6, 7, 8, 9]:
            desc = f"Heavy monsoon rains expected. Strong winds and rough seas. Outdoor beach sports closed."
            temp = 28
        else:
            desc = f"Warm and sunny skies. Clear beach visibility. Excellent travel climate."
            temp = 32
    elif "bali" in loc_lower:
        if month in [11, 12, 1, 2, 3]:
            desc = f"Rainy season context. Tropical storms and showers primarily in afternoon."
            temp = 29
        else:
            desc = f"Dry season. High winds, sunny conditions, ideal for surfing and sightseeing."
            temp = 27
    elif "himachal" in loc_lower or "manali" in loc_lower or "shimla" in loc_lower:
        if month in [12, 1, 2]:
            desc = f"Sub-zero conditions. High chance of snowstorms. Roads near passes blocked."
            temp = 2
        elif month in [7, 8]:
            desc = f"Monsoon season. Danger of landslides and cloudbursts. Avoid traveling near riverbeds."
            temp = 18
        else:
            desc = f"Pleasant spring/autumn climate. Clear mountain vistas."
            temp = 15
    else:
        desc = f"Moderate temperatures. Partly cloudy conditions expected."
        temp = 22

    TOOL_CALLS_TOTAL.labels(tool_name="weather_search", status="fallback").inc()
    return {
        "success": True,
        "location": location.capitalize(),
        "month": month_name,
        "avg_temperature_c": temp,

        "forecast_description": desc,
        "source": "climate_fallback_engine"
    }
