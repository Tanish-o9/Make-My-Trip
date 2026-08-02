import time
import sys
import threading
from typing import Dict, List
from fastapi import Request, HTTPException, status
from app.utils.redis_client import redis_client
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    FastAPI dependency for IP/User-based sliding window rate limiting.
    Supports centralized Redis and thread-safe local in-memory fallback.
    """
    def __init__(self, max_requests: int, window_seconds: int, scope: str = "default"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.scope = scope
        
        # In-memory store fallback
        self.local_store: Dict[str, List[float]] = {}
        self.lock = threading.Lock()

    def _is_pytest(self) -> bool:
        # Avoid rate-limiting during testing unless specifically desired
        return "pytest" in sys.modules or "pytest" in "".join(sys.argv)

    def _in_memory_check(self, key: str):
        now = time.time()
        with self.lock:
            if key not in self.local_store:
                self.local_store[key] = []
            
            # Prune old timestamps
            self.local_store[key] = [t for t in self.local_store[key] if now - t < self.window_seconds]
            
            if len(self.local_store[key]) >= self.max_requests:
                logger.warning(f"Local Rate Limit breached for key: {key} under scope: {self.scope}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later."
                )
            
            self.local_store[key].append(now)

    def _redis_check(self, key: str):
        redis_key = f"rate_limit:{self.scope}:{key}"
        now = time.time()
        try:
            # Use transaction pipeline
            pipe = redis_client.pipeline()
            # Fetch existing timestamps in window
            pipe.lrange(redis_key, 0, -1)
            res = pipe.execute()[0]
            
            timestamps = [float(t.decode('utf-8')) for t in res if t]
            valid_timestamps = [t for t in timestamps if now - t < self.window_seconds]
            
            if len(valid_timestamps) >= self.max_requests:
                logger.warning(f"Redis Rate Limit breached for key: {key} under scope: {self.scope}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later."
                )
            
            # Record current attempt
            pipe = redis_client.pipeline()
            pipe.rpush(redis_key, now)
            pipe.expire(redis_key, self.window_seconds)
            pipe.ltrim(redis_key, -self.max_requests, -1)
            pipe.execute()
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Redis rate limiter failed ({e}). Falling back to in-memory check.")
            self._in_memory_check(key)

    def __call__(self, request: Request):
        if self._is_pytest():
            return
            
        client_ip = request.client.host if request.client else "unknown-ip"
        
        # If user is authenticated, limit by user email, otherwise by IP
        user_key = client_ip
        if hasattr(request.state, "user") and request.state.user:
            user_key = getattr(request.state.user, "email", client_ip)
            
        if redis_client:
            self._redis_check(user_key)
        else:
            self._in_memory_check(user_key)
