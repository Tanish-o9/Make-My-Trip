import os
import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class OpenWeatherProvider:
    def __init__(self):
        self.api_key = os.getenv("OPENWEATHER_API_KEY", "")

    async def get_weather(self, city: str) -> Dict[str, Any]:
        if not self.api_key or self.api_key in ["", "your-key"]:
            logger.info("OpenWeatherMap API Key not configured. Returning empty.")
            return {}

        url = f"https://api.openweathermap.org/data/2.5/weather"
        params = {
            "q": city,
            "appid": self.api_key,
            "units": "metric"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, params=params, timeout=4.0)
                resp.raise_for_status()
                data = resp.json()
                
            main_data = data.get("main", {})
            wind_data = data.get("wind", {})
            weather_desc = data.get("weather", [{}])[0].get("description", "clear sky")
            
            return {
                "temperature": main_data.get("temp", 25.0),
                "humidity": main_data.get("humidity", 60.0),
                "wind": wind_data.get("speed", 3.5),
                "rain": 0.0,
                "forecast": [{"day": "Tomorrow", "temp": main_data.get("temp", 25.0), "desc": weather_desc}],
                "air_quality": 45.0,
                "packing_suggestions": ["Sunglasses", "Sunscreen"] if main_data.get("temp", 25.0) > 22 else ["Light jacket", "Umbrella"]
            }
        except Exception as e:
            logger.warning(f"OpenWeather API query failed for {city}: {e}")
            return {}
