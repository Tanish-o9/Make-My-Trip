import json
import logging
import functools
from typing import Callable, Any, Optional
from app.utils.redis_client import redis_client

logger = logging.getLogger(__name__)

def redis_cached(ttl_seconds: int = 300, key_prefix: str = "cache"):
    """
    Decorator to cache function results in Redis.
    Falls back to normal execution if Redis is offline.
    Arguments must be JSON-serializable to compose a unique cache key.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if not redis_client:
                return func(*args, **kwargs)

            # Generate unique cache key from function name + args + kwargs
            try:
                args_str = json.dumps(args, default=str)
                kwargs_str = json.dumps(kwargs, sort_keys=True, default=str)
                key_hash = hash(args_str + kwargs_str) & 0xffffffff
                cache_key = f"{key_prefix}:{func.__name__}:{key_hash}"
            except Exception as e:
                logger.warning(f"Failed to generate cache key for {func.__name__}: {e}")
                return func(*args, **kwargs)

            # Try to fetch from Redis
            try:
                cached_data = redis_client.get(cache_key)
                if cached_data:
                    logger.debug(f"[CACHE HIT] {func.__name__}")
                    return json.loads(cached_data)
            except Exception as e:
                logger.error(f"Redis error reading cache for {func.__name__}: {e}")

            # Call actual function
            result = func(*args, **kwargs)

            # Save back to Redis
            try:
                redis_client.setex(cache_key, ttl_seconds, json.dumps(result, default=str))
                logger.debug(f"[CACHE STORE] {func.__name__} (TTL: {ttl_seconds}s)")
            except Exception as e:
                logger.error(f"Redis error writing cache for {func.__name__}: {e}")

            return result
        return wrapper
    return decorator


def redis_cached_async(ttl_seconds: int = 300, key_prefix: str = "cache"):
    """Async variant of the Redis cache decorator."""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            if not redis_client:
                return await func(*args, **kwargs)

            try:
                args_str = json.dumps(args, default=str)
                kwargs_str = json.dumps(kwargs, sort_keys=True, default=str)
                key_hash = hash(args_str + kwargs_str) & 0xffffffff
                cache_key = f"{key_prefix}:{func.__name__}:{key_hash}"
            except Exception as e:
                logger.warning(f"Failed to generate cache key for {func.__name__}: {e}")
                return await func(*args, **kwargs)

            try:
                cached_data = redis_client.get(cache_key)
                if cached_data:
                    logger.debug(f"[CACHE HIT] {func.__name__}")
                    return json.loads(cached_data)
            except Exception as e:
                logger.error(f"Redis error reading cache for {func.__name__}: {e}")

            result = await func(*args, **kwargs)

            try:
                redis_client.setex(cache_key, ttl_seconds, json.dumps(result, default=str))
                logger.debug(f"[CACHE STORE] {func.__name__} (TTL: {ttl_seconds}s)")
            except Exception as e:
                logger.error(f"Redis error writing cache for {func.__name__}: {e}")

            return result
        return wrapper
    return decorator
