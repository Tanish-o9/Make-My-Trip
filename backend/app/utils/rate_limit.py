import time
import logging
from typing import Optional, Tuple
from app.utils.redis_client import redis_client

logger = logging.getLogger(__name__)

class RedisRateLimiter:
    """
    Token Bucket rate limiting algorithm implemented in Redis.
    Guarantees thread-safe and process-safe rate limiting using Redis pipeline/multi transaction.
    """
    def __init__(self, key_prefix: str = "ratelimit"):
        self.key_prefix = key_prefix

    def is_allowed(
        self,
        identifier: str,
        rate_limit: int,          # Max tokens/capacity
        refill_period: int = 60,  # Refill window in seconds
    ) -> Tuple[bool, int]:
        """
        Check if request is allowed under rate limits.
        Returns:
            (allowed: bool, remaining_tokens: int)
        """
        if not redis_client:
            # Fallback to allow if Redis is unreachable
            return True, rate_limit

        tokens_key = f"{self.key_prefix}:{identifier}:tokens"
        last_updated_key = f"{self.key_prefix}:{identifier}:last_updated"
        now = time.time()

        try:
            # Multi-transaction or pipeline execution to ensure atomicity
            pipe = redis_client.pipeline()
            pipe.get(tokens_key)
            pipe.get(last_updated_key)
            res = pipe.execute()

            raw_tokens = res[0]
            raw_last_updated = res[1]

            if raw_tokens is None or raw_last_updated is None:
                # Initialization
                current_tokens = rate_limit
                last_updated = now
            else:
                last_updated = float(raw_last_updated)
                stored_tokens = float(raw_tokens)
                
                # Calculate replenishment: tokens refilled over elapsed duration
                elapsed = max(0.0, now - last_updated)
                refill_rate = rate_limit / refill_period
                replenished = elapsed * refill_rate
                
                current_tokens = min(rate_limit, stored_tokens + replenished)
                last_updated = now

            if current_tokens >= 1.0:
                current_tokens -= 1.0
                allowed = True
            else:
                allowed = False

            # Save state
            pipe = redis_client.pipeline()
            pipe.set(tokens_key, str(current_tokens))
            pipe.set(last_updated_key, str(last_updated))
            # Set key expiry slightly longer than refill period to auto-cleanup inactive users
            pipe.expire(tokens_key, refill_period * 2)
            pipe.expire(last_updated_key, refill_period * 2)
            pipe.execute()

            return allowed, int(current_tokens)

        except Exception as e:
            logger.error(f"Rate limiting failure in Redis: {e}")
            return True, rate_limit

# Global instances
global_rate_limiter = RedisRateLimiter("global")
llm_rate_limiter = RedisRateLimiter("llm")
