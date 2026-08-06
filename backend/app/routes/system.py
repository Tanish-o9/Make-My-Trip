from fastapi import APIRouter
from app.database import SessionLocal
from app.utils.redis_client import redis_client
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/provider-health")
async def get_provider_health():
    # 1. Database Check
    db_status = "unhealthy"
    try:
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_status = "healthy"
    except Exception as e:
        logger.error(f"Health check: database unhealthy: {e}")

    # 2. Redis Check
    redis_status = "unhealthy"
    if redis_client:
        try:
            redis_client.ping()
            redis_status = "healthy"
        except Exception as e:
            logger.error(f"Health check: redis unhealthy: {e}")

    # 3. RapidAPI Check
    rapidapi_status = "unhealthy"
    rapid_key = os.getenv("RAPIDAPI_KEY", "")
    if rapid_key and rapid_key not in ["", "your-rapidapi-key"]:
        rapidapi_status = "healthy"

    # 4. Amadeus Check
    amadeus_status = "unhealthy"
    cid = os.getenv("AMADEUS_CLIENT_ID", "")
    csec = os.getenv("AMADEUS_CLIENT_SECRET", "")
    if cid and csec and cid not in ["", "your-amadeus-id"] and csec not in ["", "your-amadeus-secret"]:
        amadeus_status = "healthy"

    return {
        "rapidapi": rapidapi_status,
        "amadeus": amadeus_status,
        "database": db_status,
        "redis": redis_status,
        "fallback_enabled": True
    }
