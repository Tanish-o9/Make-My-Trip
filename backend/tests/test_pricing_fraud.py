import pytest
import time
from unittest.mock import MagicMock
from app.ai_agents.pricing_agents import PriceLockService
from app.ai_agents.fraud_agent import FraudDetectionService
from app.services.resilience import CircuitBreaker, CircuitBreakerOpenException

def test_price_lock_service():
    # Mock Redis client
    mock_redis = MagicMock()
    PriceLockService._redis_client = mock_redis
    
    # 1. Test Lock
    mock_redis.setex.return_value = True
    success = PriceLockService.lock_price("flight_test_123", 5200.0, ttl_seconds=300)
    assert success is True
    mock_redis.setex.assert_called_with("price_lock:flight_test_123", 300, "5200.0")

    # 2. Test Get
    mock_redis.get.return_value = b"5200.0"
    price = PriceLockService.get_locked_price("flight_test_123")
    assert price == 5200.0
    mock_redis.get.assert_called_with("price_lock:flight_test_123")


def test_fraud_evaluation_logic():
    # Test approved case
    res1 = FraudDetectionService.evaluate_transaction(
        user_id=1, ip_country="IN", card_country="IN", recent_bookings_count=0
    )
    assert res1["verdict"] == "approved"
    assert res1["risk_score"] == 0.0

    # Test review case (location mismatch)
    res2 = FraudDetectionService.evaluate_transaction(
        user_id=1, ip_country="IN", card_country="US", recent_bookings_count=0
    )
    assert res2["verdict"] == "review"
    assert res2["risk_score"] == 0.45

    # Test blocked case (location mismatch + velocity alert)
    res3 = FraudDetectionService.evaluate_transaction(
        user_id=1, ip_country="IN", card_country="US", recent_bookings_count=3
    )
    assert res3["verdict"] == "blocked"
    assert res3["risk_score"] == 0.85


def test_circuit_breaker_transitions():
    cb = CircuitBreaker("TestBreaker", max_failures=2, cooldown_seconds=0.2)
    assert cb.state == "CLOSED"

    dummy_func = MagicMock()
    dummy_func.side_effect = ValueError("outage")

    # Failure 1
    with pytest.raises(ValueError):
        cb.call(dummy_func)
    assert cb.state == "CLOSED"
    assert cb.failures == 1

    # Failure 2 (trips circuit)
    with pytest.raises(ValueError):
        cb.call(dummy_func)
    assert cb.state == "OPEN"
    assert cb.failures == 2

    # Check that calls are blocked when OPEN
    with pytest.raises(CircuitBreakerOpenException):
        cb.call(dummy_func)

    # Wait for cooldown
    time.sleep(0.25)

    # Succeeded call triggers transition to CLOSED
    success_func = MagicMock()
    success_func.return_value = "ok"
    res = cb.call(success_func)
    assert res == "ok"
    assert cb.state == "CLOSED"
    assert cb.failures == 0
