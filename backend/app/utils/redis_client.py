import os
import redis
import logging

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

redis_client = None
try:
    redis_client = redis.Redis.from_url(REDIS_URL, socket_timeout=2)
    # Ping to check if connection actually succeeds
    redis_client.ping()
except Exception as e:
    logger.warning(f"Could not connect to Redis server: {e}. Falling back to memory caches.")
    redis_client = None
