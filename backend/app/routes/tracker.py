import json
import logging
from typing import Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from app.utils.redis_client import redis_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tracker", tags=["tracker"])

# Live Mock Status Store
MOCK_STATUS = {
    "6E-502": {"status": "On Time", "gate": "T3-Gate 12", "delay_minutes": 0, "speed_knots": 480, "altitude_feet": 32000},
    "UK-811": {"status": "Delayed", "gate": "T3-Gate 4", "delay_minutes": 25, "speed_knots": 0, "altitude_feet": 0},
    "AI-312": {"status": "Active", "gate": "T2-Gate 19", "delay_minutes": 0, "speed_knots": 465, "altitude_feet": 28000}
}

@router.get("")
def lookup_flight_status(
    flight_number: str = Query(..., description="Flight code (e.g. 6E-502)"),
    date: str = Query(..., description="Date (YYYY-MM-DD)")
):
    """REST lookup returning status cache index"""
    code = flight_number.upper().strip()
    
    # Try looking up in Redis cache first
    cache_key = f"tracker:status:{code}:{date}"
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Failed cache read: {e}")

    # Fallback to local mock status
    status_info = MOCK_STATUS.get(code)
    if not status_info:
        raise HTTPException(status_code=404, detail=f"No active flight status logs for code {code}.")

    resp = {
        "flight_number": code,
        "date": date,
        "live_metrics": status_info
    }

    # Save cache if redis available
    if redis_client:
        try:
            redis_client.setex(cache_key, 120, json.dumps(resp)) # 2 mins status cache
        except Exception as e:
            logger.warning(f"Failed cache write: {e}")

    return resp


@router.websocket("/ws")
async def flight_tracker_websocket(websocket: WebSocket):
    """WebSocket channel for live tracker dashboard updates"""
    await websocket.accept()
    logger.info("Flight Tracker WebSocket channel connected.")
    
    try:
        # First frame expects subscription config: {"flight_number": "6E-502"}
        data = await websocket.receive_text()
        params = json.loads(data)
        flight_code = params.get("flight_number", "").upper().strip()
        
        status_info = MOCK_STATUS.get(flight_code)
        if not status_info:
            await websocket.send_text(json.dumps({"error": f"Flight {flight_code} not found."}))
            await websocket.close()
            return
            
        # Send initial status
        await websocket.send_text(json.dumps({
            "event": "status_update",
            "flight_number": flight_code,
            "metrics": status_info
        }))

        # Stream incremental mock telemetry updates
        alt = status_info["altitude_feet"]
        speed = status_info["speed_knots"]
        
        for i in range(5):
            # Simulate slight altitude and velocity drifts
            if alt > 0:
                alt += 100
                speed -= 2
            await websocket.send_text(json.dumps({
                "event": "telemetry_ping",
                "flight_number": flight_code,
                "metrics": {
                    "status": status_info["status"],
                    "gate": status_info["gate"],
                    "delay_minutes": status_info["delay_minutes"],
                    "speed_knots": speed,
                    "altitude_feet": alt
                }
            }))
            # short sleep simulate stream pacing
            import asyncio
            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        logger.info("Flight Tracker WebSocket channel closed.")
    except Exception as e:
        logger.error(f"Flight Tracker WS error: {e}")
        try:
            await websocket.close()
        except:
            pass
