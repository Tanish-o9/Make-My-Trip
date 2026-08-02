import time
import threading
from typing import Dict
from app.utils.redis_client import redis_client
from app.auth.jwt import decode_token
import logging

logger = logging.getLogger(__name__)

# Fallback local dictionary for blacklisted signatures
BLACKLIST_STORE: Dict[str, float] = {}
lock = threading.Lock()

def blacklist_token(token: str):
    """
    Blacklist a JWT token by storing it in Redis (or in-memory fallback)
    with a TTL equal to the token's remaining lifespan.
    """
    payload = decode_token(token)
    if not payload:
        return
        
    exp = payload.get("exp")
    if not exp:
        return
        
    now = time.time()
    ttl = int(exp - now)
    
    # If the token has already expired naturally, no need to blacklist
    if ttl <= 0:
        return
        
    # Standardize on token signature or full token
    # Full token is fine, but we can index key by the last 30 chars or full token
    key = f"blacklist:{token}"
    
    if redis_client:
        try:
            redis_client.setex(key, ttl, "1")
            logger.info(f"Token successfully blacklisted in Redis. TTL: {ttl}s")
            return
        except Exception as e:
            logger.warning(f"Failed to blacklist in Redis ({e}), using in-memory backup.")
            
    with lock:
        BLACKLIST_STORE[token] = exp
        logger.info(f"Token blacklisted in-memory fallback. Expires in: {ttl}s")

def is_token_blacklisted(token: str) -> bool:
    """Check if a token has been explicitly revoked"""
    if redis_client:
        try:
            key = f"blacklist:{token}"
            return redis_client.exists(key) > 0
        except Exception as e:
            logger.warning(f"Redis lookup failed for blacklist ({e}), checking in-memory backup.")
            
    with lock:
        now = time.time()
        # Clean expired blacklisted tokens
        expired = [k for k, v in BLACKLIST_STORE.items() if v < now]
        for k in expired:
            del BLACKLIST_STORE[k]
            
        return token in BLACKLIST_STORE
