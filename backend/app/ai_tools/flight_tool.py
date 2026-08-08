import os
import json
import logging
import hashlib
from typing import Dict, Any, List
import redis
import datetime

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

def _get_redis_client():
    try:
        return redis.Redis.from_url(REDIS_URL, socket_timeout=2)
    except Exception:
        return None

def flight_search_tool(
    origin: str,
    destination: str,
    departure_date: str,  # YYYY-MM-DD
    passengers: int = 1,
    cabin_class: str = "ECONOMY"
) -> Dict[str, Any]:
    """
    Searches for flights matching criteria via flight inventory systems.
    Args:
        origin: IATA code for departure city (e.g., DEL, BOM).
        destination: IATA code for arrival city (e.g., GOI, BLR).
        departure_date: Date of departure (YYYY-MM-DD).
        passengers: Number of tickets needed.
        cabin_class: Cabin preference (ECONOMY, BUSINESS, FIRST).
    """
    import asyncio
    import concurrent.futures
    from app.services.flight_service import FlightService

    origin = origin.upper().strip()
    destination = destination.upper().strip()
    cabin_class = cabin_class.upper().strip()

    async def get_offers():
        try:
            return await FlightService.search_flights(origin, destination, passengers, departure_date)
        except Exception as e:
            logger.error(f"flight_search_tool search failed: {e}")
            return []

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    from app.utils.metrics import TOOL_CALLS_TOTAL
    try:
        if loop and loop.is_running():
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, get_offers())
                results = future.result()
        else:
            results = asyncio.run(get_offers())
        
        status = "success" if results else "empty"
        TOOL_CALLS_TOTAL.labels(tool_name="flight_search", status=status).inc()
        return {"success": True, "results": results}
    except Exception as exc:
        TOOL_CALLS_TOTAL.labels(tool_name="flight_search", status="error").inc()
        raise exc

