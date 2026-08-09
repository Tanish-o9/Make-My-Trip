import httpx
import os
import logging

logger = logging.getLogger(__name__)

_max_connections = int(os.getenv("HTTP_CLIENT_MAX_CONNECTIONS", "200"))
_max_keepalive = int(os.getenv("HTTP_CLIENT_MAX_KEEPALIVE", "100"))
_timeout_seconds = float(os.getenv("HTTP_CLIENT_TIMEOUT", "10.0"))

limits = httpx.Limits(
    max_keepalive_connections=_max_keepalive,
    max_connections=_max_connections,
    keepalive_expiry=60.0
)

# Shared global HTTP client connection pool
# Note: DO NOT use as a context manager (e.g. async with async_client) during route execution,
# as that will close the client. Use direct client calls: await async_client.get(...)
async_client = httpx.AsyncClient(limits=limits, timeout=_timeout_seconds)

logger.info(f"Shared HTTP client pool initialized: max_connections={_max_connections}, max_keepalive={_max_keepalive}, timeout={_timeout_seconds}s")
