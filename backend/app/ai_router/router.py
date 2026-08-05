import os
import json
import time
import logging
from typing import Generator, Dict, Any, List, Optional
import httpx
import redis
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.agents import LLMRouterDecisionLog

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class CircuitBreakerOpen(Exception):
    pass

class BaseLLMProvider:
    name: str = ""

    def __init__(self, api_key: Optional[str] = None, endpoint: Optional[str] = None):
        self.api_key = api_key
        self.endpoint = endpoint

    def generate(self, prompt: str, system_prompt: Optional[str] = None, stream: bool = False, **kwargs) -> Any:
        raise NotImplementedError

class OpenAIProvider(BaseLLMProvider):
    name = "openai"

    def generate(self, prompt: str, system_prompt: Optional[str] = None, stream: bool = False, **kwargs) -> Any:
        headers = {
            "Authorization": f"Bearer {self.api_key or os.getenv('OPENAI_API_KEY')}",
            "Content-Type": "application/json"
        }
        url = "https://api.openai.com/v1/chat/completions"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": kwargs.get("model", "gpt-4o-mini"),
            "messages": messages,
            "stream": stream,
            "temperature": kwargs.get("temperature", 0.7)
        }

        if stream:
            return self._generate_stream(url, headers, payload)
        else:
            return self._generate_sync(url, headers, payload)

    def _generate_sync(self, url: str, headers: dict, payload: dict) -> str:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    def _generate_stream(self, url: str, headers: dict, payload: dict) -> Generator[str, None, None]:
        with httpx.Client(timeout=10.0) as client:
            with client.stream("POST", url, headers=headers, json=payload) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data_json = json.loads(data_str)
                            chunk = data_json["choices"][0]["delta"].get("content", "")
                            if chunk:
                                yield chunk
                        except Exception:
                            continue


class GeminiProvider(BaseLLMProvider):
    name = "gemini"

    def generate(self, prompt: str, system_prompt: Optional[str] = None, stream: bool = False, **kwargs) -> Any:
        key = self.api_key or os.getenv("GEMINI_API_KEY")
        headers = {"Content-Type": "application/json"}
        # Use Gemini's OpenAI compatibility endpoint for ease and consistency
        url = f"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key={key}"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": kwargs.get("model", "gemini-1.5-flash"),
            "messages": messages,
            "stream": stream,
            "temperature": kwargs.get("temperature", 0.7)
        }

        if stream:
            return self._generate_stream(url, headers, payload)
        else:
            return self._generate_sync(url, headers, payload)

    def _generate_sync(self, url: str, headers: dict, payload: dict) -> str:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    def _generate_stream(self, url: str, headers: dict, payload: dict) -> Generator[str, None, None]:
        with httpx.Client(timeout=10.0) as client:
            with client.stream("POST", url, headers=headers, json=payload) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data_json = json.loads(data_str)
                            chunk = data_json["choices"][0]["delta"].get("content", "")
                            if chunk:
                                yield chunk
                        except Exception:
                            continue


class AnthropicProvider(BaseLLMProvider):
    name = "anthropic"

    def generate(self, prompt: str, system_prompt: Optional[str] = None, stream: bool = False, **kwargs) -> Any:
        headers = {
            "x-api-key": self.api_key or os.getenv("ANTHROPIC_API_KEY", ""),
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        url = "https://api.anthropic.com/v1/messages"
        payload = {
            "model": kwargs.get("model", "claude-3-5-sonnet-20240620"),
            "max_tokens": kwargs.get("max_tokens", 1024),
            "messages": [{"role": "user", "content": prompt}],
            "stream": stream,
            "temperature": kwargs.get("temperature", 0.7)
        }
        if system_prompt:
            payload["system"] = system_prompt

        if stream:
            return self._generate_stream(url, headers, payload)
        else:
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                return resp.json()["content"][0]["text"]

    def _generate_stream(self, url: str, headers: dict, payload: dict) -> Generator[str, None, None]:
        with httpx.Client(timeout=15.0) as client:
            with client.stream("POST", url, headers=headers, json=payload) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        try:
                            data_json = json.loads(data_str)
                            event_type = data_json.get("type")
                            if event_type == "content_block_delta":
                                chunk = data_json["delta"].get("text", "")
                                if chunk:
                                    yield chunk
                        except Exception:
                            continue


class GroqProvider(BaseLLMProvider):
    name = "groq"

    def generate(self, prompt: str, system_prompt: Optional[str] = None, stream: bool = False, **kwargs) -> Any:
        headers = {
            "Authorization": f"Bearer {self.api_key or os.getenv('GROQ_API_KEY')}",
            "Content-Type": "application/json"
        }
        url = "https://api.groq.com/openai/v1/chat/completions"
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": kwargs.get("model", "llama-3.1-8b-instant"),
            "messages": messages,
            "stream": stream,
            "temperature": kwargs.get("temperature", 0.7)
        }

        if stream:
            return self._generate_stream(url, headers, payload)
        else:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]

    def _generate_stream(self, url: str, headers: dict, payload: dict) -> Generator[str, None, None]:
        with httpx.Client(timeout=10.0) as client:
            with client.stream("POST", url, headers=headers, json=payload) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data_json = json.loads(data_str)
                            chunk = data_json["choices"][0]["delta"].get("content", "")
                            if chunk:
                                yield chunk
                        except Exception:
                            continue


class OllamaProvider(BaseLLMProvider):
    name = "ollama"

    def generate(self, prompt: str, system_prompt: Optional[str] = None, stream: bool = False, **kwargs) -> Any:
        endpoint = self.endpoint or os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")
        url = f"{endpoint}/api/generate"
        payload = {
            "model": kwargs.get("model", "llama3"),
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": kwargs.get("temperature", 0.7)
            }
        }
        if system_prompt:
            payload["system"] = system_prompt

        if stream:
            return self._generate_stream(url, payload)
        else:
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                return resp.json()["response"]

    def _generate_stream(self, url: str, payload: dict) -> Generator[str, None, None]:
        with httpx.Client(timeout=20.0) as client:
            with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    try:
                        data_json = json.loads(line)
                        chunk = data_json.get("response", "")
                        if chunk:
                            yield chunk
                        if data_json.get("done", False):
                            break
                    except Exception:
                        continue


class LLMRouter:
    def __init__(self):
        self.providers: Dict[str, BaseLLMProvider] = {
            "openai": OpenAIProvider(),
            "gemini": GeminiProvider(),
            "anthropic": AnthropicProvider(),
            "groq": GroqProvider(),
            "ollama": OllamaProvider()
        }
        self.max_failures = 3
        self.cooldown_period = 300  # 5 minutes
        self.redis_client = None

    def _get_redis(self):
        if self.redis_client is None:
            try:
                self.redis_client = redis.Redis.from_url(REDIS_URL, socket_timeout=2)
            except Exception as e:
                logger.warning(f"Router failed to connect to Redis: {e}")
        return self.redis_client

    def _is_circuit_open(self, provider_name: str) -> bool:
        r = self._get_redis()
        if not r:
            return False
        try:
            if r.get(f"router:cooldown:{provider_name}"):
                return True
            failures = int(r.get(f"router:failures:{provider_name}") or 0)
            if failures >= self.max_failures:
                # Mark cooldown
                r.setex(f"router:cooldown:{provider_name}", self.cooldown_period, "open")
                logger.warning(f"Circuit breaker OPENED for provider: {provider_name}")
                return True
        except Exception as e:
            logger.error(f"Error checking circuit status: {e}")
        return False

    def _record_success(self, provider_name: str, latency: float):
        r = self._get_redis()
        if not r:
            return
        try:
            r.delete(f"router:failures:{provider_name}")
            # Add latency to rolling average
            r.lpush(f"router:latency:{provider_name}", str(latency))
            r.ltrim(f"router:latency:{provider_name}", 0, 9) # keep last 10
        except Exception as e:
            logger.error(f"Error logging success metrics: {e}")

    def _record_failure(self, provider_name: str):
        r = self._get_redis()
        if not r:
            return
        try:
            r.incr(f"router:failures:{provider_name}")
        except Exception as e:
            logger.error(f"Error logging failure metrics: {e}")

    def _get_average_latency(self, provider_name: str) -> float:
        r = self._get_redis()
        if not r:
            return 1000.0
        try:
            latencies = r.lrange(f"router:latency:{provider_name}", 0, -1)
            if latencies:
                return sum(float(l) for l in latencies) / len(latencies)
        except Exception:
            pass
        return 1000.0

    # Placeholder/dummy key patterns that should be treated as unconfigured
    _PLACEHOLDER_PATTERNS = (
        "your-", "your_", "sk-proj-your", "placeholder", "example",
        "changeme", "<", ">", "REPLACE", "TODO", "xxx", "test-key"
    )

    def _is_real_key(self, key: Optional[str]) -> bool:
        """Returns True only if key looks like a real API key (not a placeholder)."""
        if not key or len(key) < 10:
            return False
        key_lower = key.lower()
        for pattern in self._PLACEHOLDER_PATTERNS:
            if pattern.lower() in key_lower:
                return False
        return True

    def _rank_providers(self, task_type: str) -> List[str]:
        """Returns an ordered list of providers that have valid API keys and open circuits."""
        # Groq-first ordering since it's free, fast (Llama 3.1), and most likely configured
        if task_type == "simple":
            order = ["groq", "gemini", "openai", "anthropic"]
        elif task_type == "reasoning":
            order = ["groq", "gemini", "openai", "anthropic"]
        elif task_type == "creative":
            order = ["groq", "gemini", "anthropic", "openai"]
        else:
            order = ["groq", "gemini", "openai", "anthropic"]

        # Only add Ollama if explicitly configured with a non-default endpoint
        ollama_ep = os.getenv("OLLAMA_ENDPOINT", "")
        if ollama_ep and ollama_ep != "http://localhost:11434" and "localhost" not in ollama_ep:
            order.append("ollama")

        active_providers = []
        for name in order:
            key_env_map = {
                "openai": "OPENAI_API_KEY",
                "gemini": "GEMINI_API_KEY",
                "anthropic": "ANTHROPIC_API_KEY",
                "groq": "GROQ_API_KEY",
            }
            if name in key_env_map:
                key = os.getenv(key_env_map[name], "")
                if not self._is_real_key(key):
                    logger.debug(f"Skipping provider {name}: key missing or placeholder")
                    continue

            if not self._is_circuit_open(name):
                active_providers.append(name)

        if not active_providers:
            logger.error(
                "No LLM providers are configured with real API keys. "
                "Set GROQ_API_KEY (free at console.groq.com) in your environment variables."
            )

        return active_providers

    def complete(
        self,
        prompt: str,
        task_type: str = "simple",
        system_prompt: Optional[str] = None,
        stream: bool = False,
        trace_id: str = "default_trace",
        **kwargs
    ) -> Any:
        ranked = self._rank_providers(task_type)
        logger.info(f"Router ranked providers for {task_type}: {ranked}")

        if not ranked:
            raise RuntimeError(
                "No LLM provider is configured with a real API key. "
                "Please set GROQ_API_KEY in Railway environment variables. "
                "Get a free key at https://console.groq.com"
            )

        db = None
        try:
            db = SessionLocal()
        except Exception as e:
            logger.warning(f"Could not connect to database for decision logging: {e}")

        last_error = None

        for idx, provider_name in enumerate(ranked):
            provider = self.providers[provider_name]

            start_time = time.time()
            decision_log = None
            
            try:
                # Log decision to DB if available
                if db:
                    try:
                        decision_log = LLMRouterDecisionLog(
                            trace_id=trace_id,
                            request_type=task_type,
                            chosen_provider=provider_name,
                            reason=f"Rank {idx+1} for {task_type} (cost/latency optimized)",
                            fallback_used=(idx > 0)
                        )
                        db.add(decision_log)
                        db.commit()
                    except Exception as db_err:
                        logger.warning(f"Failed to write initial decision log to database: {db_err}")
                        db.rollback()
                        decision_log = None

                # Call generation
                result = provider.generate(prompt, system_prompt=system_prompt, stream=stream, **kwargs)

                # For stream response, we wrap it in a generator that logs success on completion
                if stream:
                    def stream_wrapper():
                        start_stream_time = time.time()
                        tokens = []
                        try:
                            for chunk in result:
                                tokens.append(chunk)
                                yield chunk
                            # Record success upon successful exhaustion of stream
                            latency = (time.time() - start_stream_time) * 1000
                            self._record_success(provider_name, latency)
                            # Update DB log with final duration
                            if db and decision_log:
                                try:
                                    decision_log.latency_ms = int(latency)
                                    db.commit()
                                except Exception:
                                    db.rollback()
                        except Exception as e:
                            self._record_failure(provider_name)
                            raise e
                        finally:
                            if db:
                                try:
                                    db.close()
                                except Exception:
                                    pass
                    return stream_wrapper()
                else:
                    latency = (time.time() - start_time) * 1000
                    self._record_success(provider_name, latency)
                    if db and decision_log:
                        try:
                            decision_log.latency_ms = int(latency)
                            db.commit()
                        except Exception:
                            db.rollback()
                    return result

            except Exception as e:
                logger.error(f"Provider {provider_name} failed: {e}")
                self._record_failure(provider_name)
                last_error = e
                # Update DB log with error
                if db and decision_log:
                    try:
                        decision_log.error_message = str(e)
                        decision_log.latency_ms = int((time.time() - start_time) * 1000)
                        db.commit()
                    except Exception:
                        db.rollback()
                continue

        if db:
            try:
                db.close()
            except Exception:
                pass
        # If all providers fail, raise exception
        raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")

# Global Router Instance
llm_router = LLMRouter()
