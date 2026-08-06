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

# --- REAL-TIME SERVICES HUB (Phase 13) ---
import datetime
import asyncio
from fastapi import Depends
from app.auth.dependencies import get_current_user
from app.models.core import User
from app.database import get_db
from sqlalchemy.orm import Session
from typing import Optional, List

@router.get("/realtime")
async def get_realtime_updates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """REST polling fallback for real-time services alerts"""
    from app.models.bookings import FlightBooking
    from app.providers.registry import provider_registry
    
    flights = db.query(FlightBooking).filter(
        FlightBooking.user_id == current_user.id
    ).all()
    
    alerts = []
    
    # 1. Price drop alert
    alerts.append({
        "id": "realtime_poll_price",
        "category": "Wallet",
        "title": "📉 Price Drop Alert",
        "msg": "Hotels in your wishlist dropped by 15%!",
        "priority": "medium",
        "time": "Just now",
        "read": False,
        "deepLink": "/"
    })
    
    # 2. Currency fluctuation
    rate = await provider_registry.currency_manager.get_conversion_rate("USD", "INR")
    alerts.append({
        "id": "realtime_poll_currency",
        "category": "Wallet",
        "title": "💵 Currency Fluctuation Alert",
        "msg": f"USD/INR is trading at {rate:.2f}. Ideal time to lock exchange rate!",
        "priority": "low",
        "time": "Just now",
        "read": False,
        "deepLink": "/wallet"
    })
    
    # 3. Weather Alert
    weather = await provider_registry.weather_manager.get_weather_for_city("Goa")
    temp = weather.get("temperature", 27.0)
    desc = weather.get("forecast", [{}])[0].get("desc", "overcast with occasional light rain")
    alerts.append({
        "id": "realtime_poll_weather",
        "category": "Emergency",
        "title": "⛈️ Weather Update",
        "msg": f"Goa forecast: {desc.capitalize()} | {temp}°C.",
        "priority": "medium",
        "time": "Just now",
        "read": False,
        "deepLink": "/"
    })

    # 4. Flight Status
    for f in flights:
        alerts.append({
            "id": f"realtime_poll_flight_{f.booking_reference}",
            "category": "Flights",
            "title": f"✈️ Live Status: {f.airline_code}-{f.flight_number}",
            "msg": f"Status: Boarding | Gate: T3-Gate 14A. Boarding reminder dispatched.",
            "priority": "high",
            "time": "Just now",
            "read": False,
            "deepLink": f"/booking/{f.booking_reference}"
        })
        
    return {"alerts": alerts, "server_time": datetime.datetime.utcnow().isoformat()}


@router.websocket("/ws/realtime")
async def realtime_alerts_websocket(websocket: WebSocket, token: Optional[str] = Query(None)):
    """WebSocket connection for real-time alerts hub with auto fallback"""
    await websocket.accept()
    logger.info("Real-Time Services WebSocket connected.")
    
    # Validate token if provided
    user_id = 1
    if token:
        from app.auth.jwt import decode_token
        payload = decode_token(token)
        if payload and "id" in payload:
            user_id = payload["id"]
            
    try:
        counter = 0
        while True:
            # Check db stats inside loop dynamically
            from app.database import SessionLocal
            from app.models.bookings import FlightBooking
            db = SessionLocal()
            
            alerts = []
            try:
                flights = db.query(FlightBooking).filter(FlightBooking.user_id == user_id).all()
                
                # Base simulated alerts
                alerts.append({
                    "id": f"realtime_ws_price_{counter}",
                    "category": "Wallet",
                    "title": "📉 Price Drop Alert",
                    "msg": "Hotels in your wishlist dropped by 15%!",
                    "priority": "medium",
                    "time": "Just now",
                    "read": False,
                    "deepLink": "/"
                })
                
                # Currency alert
                alerts.append({
                    "id": f"realtime_ws_curr_{counter}",
                    "category": "Wallet",
                    "title": "💵 Currency Fluctuation Alert",
                    "msg": f"INR strengthened against USD by {0.2 + (counter * 0.05):.2f}%. Good time to convert!",
                    "priority": "low",
                    "time": "Just now",
                    "read": False,
                    "deepLink": "/wallet"
                })
                
                # Weather alert
                alerts.append({
                    "id": f"realtime_ws_weather_{counter}",
                    "category": "Emergency",
                    "title": "⛈️ Weather Update",
                    "msg": "Goa forecast: Overcast with occasional light rain. 27°C.",
                    "priority": "medium",
                    "time": "Just now",
                    "read": False,
                    "deepLink": "/"
                })
                
                for f in flights:
                    # Alternating gate and delay statuses
                    gate = "T3-Gate 14" if counter % 2 == 0 else "T3-Gate 19B"
                    status = "On Time" if counter % 3 == 0 else "Boarding"
                    alerts.append({
                        "id": f"realtime_ws_flight_{f.booking_reference}_{counter}",
                        "category": "Flights",
                        "title": f"✈️ Live Status: {f.airline_code}-{f.flight_number}",
                        "msg": f"Status: {status} | Gate: {gate} | Boarding reminder dispatched.",
                        "priority": "high",
                        "time": "Just now",
                        "read": False,
                        "deepLink": f"/booking/{f.booking_reference}"
                    })
            finally:
                db.close()
                
            await websocket.send_text(json.dumps({
                "event": "realtime_alerts",
                "alerts": alerts,
                "server_time": datetime.datetime.utcnow().isoformat()
            }))
            
            counter += 1
            await asyncio.sleep(8)
            
    except WebSocketDisconnect:
        logger.info("Real-Time Services WebSocket disconnected.")
    except Exception as e:
        logger.error(f"Real-Time Services WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass
