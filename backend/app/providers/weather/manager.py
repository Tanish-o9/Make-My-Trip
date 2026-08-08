import json
import logging
from typing import Dict, Any, List
from app.providers.weather.openweather import OpenWeatherProvider
from app.utils.redis_client import redis_client
from app.services.resilience import CircuitBreaker

logger = logging.getLogger(__name__)

weather_breaker = CircuitBreaker("WeatherAPI", max_failures=3, cooldown_seconds=30)

class WeatherManager:
    def __init__(self):
        self.provider = OpenWeatherProvider()

    async def get_current_weather(self, city: str) -> Dict[str, Any]:
        city_key = city.strip().lower()
        cache_key = f"weather:current:{city_key}"

        # 1. Try Cache
        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Cache HIT for current weather of city: {city}")
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis get failed in WeatherManager: {e}")

        # 2. Call Provider with Circuit Breaker
        try:
            data = await weather_breaker.call_async(
                lambda: self.provider.get_current_weather(city)
            )
            # Write to Cache (15 min TTL = 900s)
            if redis_client and data:
                try:
                    redis_client.setex(cache_key, 900, json.dumps(data))
                except Exception as cache_err:
                    logger.error(f"Redis setex failed: {cache_err}")
            return data
        except Exception as e:
            logger.error(f"Error querying weather for {city}: {e}")
            # Cache fallback even if expired (or generate mock)
            return self.provider._get_mock_current_weather(city_key)

    async def get_forecast(self, city: str) -> List[Dict[str, Any]]:
        city_key = city.strip().lower()
        cache_key = f"weather:forecast:{city_key}"

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Cache HIT for forecast weather of city: {city}")
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis get failed in WeatherManager: {e}")

        try:
            data = await weather_breaker.call_async(
                lambda: self.provider.get_forecast(city)
            )
            if redis_client and data:
                try:
                    redis_client.setex(cache_key, 900, json.dumps(data))
                except Exception as cache_err:
                    logger.error(f"Redis setex failed: {cache_err}")
            return data
        except Exception as e:
            logger.error(f"Error querying forecast for {city}: {e}")
            return self.provider._get_mock_forecast(city_key)

    async def get_air_quality(self, city: str) -> Dict[str, Any]:
        city_key = city.strip().lower()
        cache_key = f"weather:aqi:{city_key}"

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Cache HIT for air quality of city: {city}")
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis get failed in WeatherManager: {e}")

        try:
            data = await weather_breaker.call_async(
                lambda: self.provider.get_air_quality(city)
            )
            if redis_client and data:
                try:
                    redis_client.setex(cache_key, 900, json.dumps(data))
                except Exception as cache_err:
                    logger.error(f"Redis setex failed: {cache_err}")
            return data
        except Exception as e:
            logger.error(f"Error querying air quality for {city}: {e}")
            return self.provider._get_mock_air_quality(city_key)

    async def get_travel_recommendations(self, city: str) -> Dict[str, Any]:
        city_key = city.strip().lower()
        cache_key = f"weather:travel:{city_key}"

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Cache HIT for travel weather suggestions of city: {city}")
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis get failed in WeatherManager: {e}")

        # Fetch current and forecast to compose recommendations
        current = await self.get_current_weather(city)
        forecast = await self.get_forecast(city)

        temp = current.get("temperature", 25.0)
        rain_prob = 10
        umbrella_needed = False
        
        # Check forecast for rain chances
        rain_chances = [f.get("rainChance", 0) for f in forecast]
        if rain_chances:
            max_chance = max(rain_chances)
            rain_prob = max_chance
            if max_chance > 40:
                umbrella_needed = True

        # Base suggestions on temperature
        if temp > 22:
            packing = ["Cotton shirts", "Sunglasses", "Sunscreen", "Shorts", "Sandals"]
            clothing = "Lightweight, breathable cotton outfits"
            uv_advice = "High UV radiation index. Apply SPF 30+ sunscreen liberally."
            best_time = "Early mornings or late evenings (cool temperatures)"
        else:
            packing = ["Cardigan", "Thermals", "Sneakers", "Woolen socks"]
            clothing = "Layers, warm sweater, or windbreaker jacket"
            uv_advice = "Low UV index. Normal day sunglasses advised."
            best_time = "Sunny afternoon hours"

        if umbrella_needed:
            packing.extend(["Umbrella", "Rain protector sleeves"])
            best_time = "Dry morning spells between rainfall windows"

        result = {
            "packingSuggestions": packing,
            "umbrellaNeeded": umbrella_needed,
            "rainProbability": rain_prob,
            "bestTimeToTravel": best_time,
            "clothingRecommendation": clothing,
            "uvAdvice": uv_advice
        }

        if redis_client:
            try:
                redis_client.setex(cache_key, 900, json.dumps(result))
            except Exception as cache_err:
                logger.error(f"Redis setex failed: {cache_err}")

        return result

    async def get_historical_weather(self, city: str, date: str) -> Dict[str, Any]:
        """Get historical weather for a city on a specific date (YYYY-MM-DD)."""
        city_key = city.strip().lower()
        cache_key = f"weather:historical:{city_key}:{date}"

        if redis_client:
            try:
                cached = redis_client.get(cache_key)
                if cached:
                    logger.info(f"Cache HIT for historical weather of {city} on {date}")
                    return json.loads(cached)
            except Exception as e:
                logger.error(f"Redis get failed in WeatherManager historical: {e}")

        try:
            data = await weather_breaker.call_async(
                lambda: self.provider.get_historical_weather(city, date)
            )
            if redis_client and data:
                try:
                    # Historical data doesn't change — cache for 24 hours
                    redis_client.setex(cache_key, 86400, json.dumps(data))
                except Exception as cache_err:
                    logger.error(f"Redis setex failed: {cache_err}")
            return data
        except Exception as e:
            logger.error(f"Error querying historical weather for {city} on {date}: {e}")
            return self.provider._get_mock_historical_weather(city_key, date)

    # Backwards compatibility method
    async def get_weather_for_city(self, city: str) -> Dict[str, Any]:
        current = await self.get_current_weather(city)
        forecast = await self.get_forecast(city)
        aqi = await self.get_air_quality(city)
        travel = await self.get_travel_recommendations(city)

        return {
            "temperature": current.get("temperature"),
            "humidity": current.get("humidity"),
            "wind": current.get("windSpeed"),
            "rain": float(travel.get("rainProbability", 10)) / 100.0,
            "forecast": [
                {"day": f.get("date"), "temp": f.get("temperature"), "desc": f.get("weather")}
                for f in forecast
            ],
            "air_quality": float(aqi.get("PM2_5", 0)),
            "packing_suggestions": travel.get("packingSuggestions"),
        }
