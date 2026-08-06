import logging
from typing import Dict, Any
from app.providers.weather.openweather import OpenWeatherProvider

logger = logging.getLogger(__name__)

class WeatherManager:
    def __init__(self):
        self.provider = OpenWeatherProvider()

    async def get_weather_for_city(self, city: str) -> Dict[str, Any]:
        data = await self.provider.get_weather(city)
        if not data:
            logger.info(f"OpenWeather returned empty. Falling back to local static weather db for {city}.")
            # Static fallback data based on city
            temp = 28.0 if "goa" in city.lower() else 18.0 if "delhi" in city.lower() else 24.0
            data = {
                "temperature": temp,
                "humidity": 65.0,
                "wind": 4.2,
                "rain": 0.1,
                "forecast": [
                    {"day": "Tomorrow", "temp": temp + 1.0, "desc": "mostly sunny"},
                    {"day": "Day after", "temp": temp - 0.5, "desc": "scattered showers"}
                ],
                "air_quality": 35.0,
                "packing_suggestions": ["Cotton clothes", "Sunscreen", "Flip-flops"] if temp > 22 else ["T-shirts", "Sweater"]
            }
        return data
