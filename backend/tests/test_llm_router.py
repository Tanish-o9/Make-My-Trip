import os
import pytest
from unittest.mock import patch, MagicMock
from app.ai_router.router import LLMRouter, CircuitBreakerOpen

@pytest.fixture(autouse=True)
def mock_env_keys():
    """Fixture to standardize environment keys for testing so tests are offline-capable"""
    old_env = dict(os.environ)
    # Set mock key for OpenAI
    os.environ["OPENAI_API_KEY"] = "mock-openai-key"
    # Remove real keys for other services to prevent real HTTP dispatches
    for key in ["GROQ_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]:
        if key in os.environ:
            del os.environ[key]
    yield
    # Restore env
    os.environ.clear()
    os.environ.update(old_env)

@patch("app.ai_router.router.OpenAIProvider.generate")
@patch("app.ai_router.router.OllamaProvider.generate")
def test_router_failover_success(mock_ollama, mock_openai):
    # Setup OpenAI to fail, Ollama to succeed
    mock_openai.side_effect = Exception("OpenAI API Down")
    mock_ollama.return_value = "Hello from local Llama"

    router = LLMRouter()
    # Mock Redis client to avoid dependency on local Redis server in unit tests
    router.redis_client = MagicMock()
    router.redis_client.get.return_value = None

    # Execute completion
    response = router.complete(
        prompt="Hi",
        task_type="reasoning",
        trace_id="test_failover_trace"
    )

    # Asserts
    assert response == "Hello from local Llama"
    assert mock_openai.call_count == 1
    assert mock_ollama.call_count == 1


@patch("app.ai_router.router.OpenAIProvider.generate")
def test_circuit_breaker_tripping(mock_openai):
    router = LLMRouter()
    mock_redis = MagicMock()
    router.redis_client = mock_redis
    
    # Simulate consecutive failures
    # Mock redis behavior: incrementing failure count
    failures_store = {}
    def get_redis_val(key):
        return failures_store.get(key)
    def incr_redis_val(key):
        val = int(failures_store.get(key) or 0) + 1
        failures_store[key] = str(val)
        return val

    mock_redis.get.side_effect = get_redis_val
    mock_redis.incr.side_effect = incr_redis_val
    
    # Mock circuit check keys
    mock_redis.get.side_effect = lambda key: failures_store.get(key)

    # Trips after 3 failures
    mock_openai.side_effect = Exception("API connection error")

    for _ in range(3):
        try:
            router.complete(prompt="Hi", task_type="reasoning")
        except Exception:
            pass

    # Check if the circuit breaker is now marked open
    assert int(failures_store.get("router:failures:openai")) >= 3
