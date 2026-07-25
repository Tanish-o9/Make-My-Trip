import time
import random
import logging
from typing import Callable, Any

logger = logging.getLogger(__name__)

class CircuitBreakerOpenException(Exception):
    pass

class CircuitBreaker:
    def __init__(self, name: str, max_failures: int = 3, cooldown_seconds: float = 60.0):
        self.name = name
        self.max_failures = max_failures
        self.cooldown_seconds = cooldown_seconds
        
        self.failures = 0
        self.last_failure_time = 0.0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def call(self, func: Callable, *args, **kwargs) -> Any:
        current_time = time.time()
        
        # Check state transitions
        if self.state == "OPEN":
            if current_time - self.last_failure_time > self.cooldown_seconds:
                self.state = "HALF_OPEN"
                logger.info(f"Circuit Breaker [{self.name}] entered HALF_OPEN state.")
            else:
                raise CircuitBreakerOpenException(f"Circuit Breaker [{self.name}] is OPEN. Blocked call.")

        try:
            result = func(*args, **kwargs)
            # If successful in HALF_OPEN, reset circuit
            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failures = 0
                logger.info(f"Circuit Breaker [{self.name}] successfully CLOSED.")
            return result
        except Exception as e:
            self.failures += 1
            self.last_failure_time = time.time()
            
            if self.failures >= self.max_failures:
                self.state = "OPEN"
                logger.error(f"Circuit Breaker [{self.name}] TRIPPED to OPEN state. Failures: {self.failures}")
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
                    # Calculate jittered backoff
                    sleep_time = delay * (1 + random.random() * 0.1)
                    logger.warning(f"Attempt {attempt+1} failed for {func.__name__}: {e}. Retrying in {sleep_time:.2f}s...")
                    time.sleep(sleep_time)
                    delay *= factor
            raise last_err
        return wrapper
    return decorator
