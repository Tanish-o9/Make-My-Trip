import os
import redis
import logging

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

redis_client = None
try:
    # Use a connection pool to reuse connections under concurrent load
    pool = redis.ConnectionPool.from_url(
        REDIS_URL,
        max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", "50")),
        socket_timeout=2.0,
        socket_connect_timeout=2.0,
        retry_on_timeout=True
    )
    redis_client = redis.Redis(connection_pool=pool)
    # Ping to check if connection actually succeeds
    redis_client.ping()
except Exception as e:
    logger.warning(f"Could not connect to Redis server: {e}. Falling back to memory caches.")
    redis_client = None
