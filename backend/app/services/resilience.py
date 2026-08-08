import time
import random
import logging
from typing import Callable, Any, Optional
from app.utils.redis_client import redis_client

logger = logging.getLogger(__name__)

class CircuitBreakerOpenException(Exception):
    pass

class CircuitBreaker:
    """
    Production-grade Circuit Breaker.
    Failure count, circuit state (CLOSED/OPEN/HALF_OPEN), and cooldown expiration
    are persisted in Redis when available to share state across all process workers.
    Exposes 'state' and 'failures' as property fields for backward compatibility.
    """
    def __init__(self, name: str, max_failures: int = 3, cooldown_seconds: float = 60.0):
        self.name = name
        self.max_failures = max_failures
        self.cooldown_seconds = cooldown_seconds
        
        # Local memory fallback defaults
        self._local_failures = 0
        self._local_last_failure_time = 0.0
        self._local_state = "CLOSED"

    def _get_key(self, field: str) -> str:
        return f"cb:{self.name}:{field}"

    @property
    def state(self) -> str:
        if redis_client:
            try:
                state = redis_client.get(self._get_key("state"))
                if state:
                    return state.decode("utf-8")
            except Exception as e:
                logger.error(f"Redis error reading CB state for {self.name}: {e}")
        return self._local_state

    @state.setter
    def state(self, val: str):
        if redis_client:
            try:
                redis_client.set(self._get_key("state"), val)
                redis_client.expire(self._get_key("state"), int(self.cooldown_seconds * 2))
            except Exception as e:
                logger.error(f"Redis error setting CB state for {self.name}: {e}")
        self._local_state = val

    @property
    def failures(self) -> int:
        if redis_client:
            try:
                failures = redis_client.get(self._get_key("failures"))
                if failures is not None:
                    return int(failures)
            except Exception as e:
                logger.error(f"Redis error reading CB failures for {self.name}: {e}")
        return self._local_failures

    @failures.setter
    def failures(self, val: int):
        if redis_client:
            try:
                redis_client.set(self._get_key("failures"), str(val))
                redis_client.expire(self._get_key("failures"), int(self.cooldown_seconds * 2))
            except Exception as e:
                logger.error(f"Redis error setting CB failures for {self.name}: {e}")
        self._local_failures = val

    def get_last_failure_time(self) -> float:
        if redis_client:
            try:
                lft = redis_client.get(self._get_key("lft"))
                if lft is not None:
                    return float(lft)
            except Exception as e:
                logger.error(f"Redis error reading CB failure time for {self.name}: {e}")
        return self._local_last_failure_time

    def record_failure(self):
        current_time = time.time()
        failures = 0
        if redis_client:
            try:
                failures = redis_client.incr(self._get_key("failures"))
                redis_client.set(self._get_key("lft"), str(current_time))
                redis_client.expire(self._get_key("failures"), int(self.cooldown_seconds * 2))
                redis_client.expire(self._get_key("lft"), int(self.cooldown_seconds * 2))
            except Exception as e:
                logger.error(f"Redis error recording CB failure for {self.name}: {e}")
                self._local_failures += 1
                failures = self._local_failures
                self._local_last_failure_time = current_time
        else:
            self._local_failures += 1
            failures = self._local_failures
            self._local_last_failure_time = current_time

        if failures >= self.max_failures:
            self.state = "OPEN"
            logger.error(f"Circuit Breaker [{self.name}] TRIPPED to OPEN state. Failures: {failures}")

    def record_success(self):
        if redis_client:
            try:
                redis_client.delete(self._get_key("failures"))
                redis_client.delete(self._get_key("lft"))
            except Exception as e:
                logger.error(f"Redis error resetting CB metrics for {self.name}: {e}")
        self._local_failures = 0
        self._local_last_failure_time = 0.0
        self.state = "CLOSED"

    def check_and_update_state(self) -> str:
        state = self.state
        current_time = time.time()
        
        if state == "OPEN":
            lft = self.get_last_failure_time()
            if current_time - lft > self.cooldown_seconds:
                state = "HALF_OPEN"
                self.state = "HALF_OPEN"
                logger.info(f"Circuit Breaker [{self.name}] entered HALF_OPEN state.")
            else:
                raise CircuitBreakerOpenException(f"Circuit Breaker [{self.name}] is OPEN. Blocked call.")
        return state

    def call(self, func: Callable, *args, **kwargs) -> Any:
        state = self.check_and_update_state()
        try:
            result = func(*args, **kwargs)
            if state == "HALF_OPEN":
                self.record_success()
                logger.info(f"Circuit Breaker [{self.name}] successfully CLOSED after successful call.")
            return result
        except Exception as e:
            self.record_failure()
            raise e

    async def call_async(self, func: Callable, *args, **kwargs) -> Any:
        state = self.check_and_update_state()
        try:
            result = await func(*args, **kwargs)
            if state == "HALF_OPEN":
                self.record_success()
                logger.info(f"Circuit Breaker [{self.name}] successfully CLOSED after successful async call.")
            return result
        except Exception as e:
            self.record_failure()
            raise e


def retry_with_backoff(max_retries: int = 3, initial_delay: float = 1.0, factor: float = 2.0):
    """Decorator to retry functions using exponential backoff with random jitter"""
    def decorator(func: Callable):
        def wrapper(*args, **kwargs):
            delay = initial_delay
            last_err = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_err = e
                    sleep_time = delay * (1 + random.random() * 0.1)
                    logger.warning(f"Attempt {attempt+1} failed for {func.__name__}: {e}. Retrying in {sleep_time:.2f}s...")
                    time.sleep(sleep_time)
                    delay *= factor
            raise last_err
        return wrapper
    return decorator
