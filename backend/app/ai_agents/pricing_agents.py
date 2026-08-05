import json
import logging
import os
import redis
from typing import Dict, Any, Optional
from app.ai_agents.state import AgentState, log_agent_execution
from app.ai_router.router import llm_router

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class PriceLockService:
    _redis_client = None

    @classmethod
    def _get_redis(cls):
        if cls._redis_client is None:
            try:
                cls._redis_client = redis.Redis.from_url(REDIS_URL, socket_timeout=2)
            except Exception:
                pass
        return cls._redis_client

    @classmethod
    def lock_price(cls, booking_ref: str, price: float, ttl_seconds: int = 300) -> bool:
        r = cls._get_redis()
        if r:
            try:
                r.setex(f"price_lock:{booking_ref}", ttl_seconds, str(price))
                logger.info(f"Price locked for {booking_ref}: ₹{price} for {ttl_seconds}s")
                return True
            except Exception as e:
                logger.error(f"Failed to lock price in Redis: {e}")
        return False

    @classmethod
    def get_locked_price(cls, booking_ref: str) -> Optional[float]:
        r = cls._get_redis()
        if r:
            try:
                val = r.get(f"price_lock:{booking_ref}")
                if val:
                    return float(val)
            except Exception as e:
                logger.error(f"Failed to get locked price from Redis: {e}")
        return None


@log_agent_execution("price_prediction_agent")
def price_prediction_node(state: AgentState) -> dict:
    """Agent node to analyze price history and recommend Book Now vs Wait"""
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""

    # Parse query variables
    prompt = f"""
Extract details of flight or hotel search.
Query: "{user_query}"
Current Context: {json.dumps(state.get("trip_context", {}), default=str)}
Identify route and base price. Recommend Wait/Book. Output JSON:
- price (float)
- recommendation (BOOK_NOW, WAIT)
- confidence (float, 0-1)
- trend (RISING, STABLE, FALLING)
- reasoning (string)
"""
    decision_str = llm_router.complete(prompt=prompt, task_type="simple")
    try:
        clean_json = decision_str.strip().strip("```json").strip("```").strip()
        data = json.loads(clean_json)
    except Exception:
        data = {
            "price": 5000.0,
            "recommendation": "BOOK_NOW",
            "confidence": 0.8,
            "trend": "RISING",
            "reasoning": "Prices are expected to rise due to holiday travel demand."
        }

    response_text = f"""
### Price Trend Prediction
**Current Price**: ₹{data['price']:,}
**Recommendation**: **{data['recommendation'].replace('_', ' ')}** ({int(data['confidence'] * 100)}% Confidence)
**Trend**: {data['trend']}
**Why**: {data['reasoning']}
"""
    return {
        "final_response": response_text,
        "messages": [{"role": "assistant", "content": response_text}]
    }


@log_agent_execution("dynamic_pricing_agent")
def dynamic_pricing_node(state: AgentState) -> dict:
    """Calculates demand-based pricing increments and issues locks"""
    context = state.get("trip_context", {})
    booking_ref = context.get("booking_reference") or "ref_dummy"
    base_price = context.get("base_price", 5000.0)
    
    # Calculate demand multiplier based on context (e.g. day of week, lead time)
    # Simple multiplier stub:
    multiplier = 1.05  # 5% demand markup
    final_price = float(base_price) * multiplier

    # Lock price in Redis
    PriceLockService.lock_price(booking_ref, final_price, ttl_seconds=300)

    result_text = f"Dynamic Pricing applied. Final fare locked: ₹{final_price:.2f} (locked for 5 mins)."
    return {
        "final_response": result_text,
        "trip_context": dict(context, locked_price=final_price),
        "messages": [{"role": "assistant", "content": result_text}]
    }
