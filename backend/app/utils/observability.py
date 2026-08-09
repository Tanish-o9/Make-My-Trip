import logging
import time
from typing import Callable, Any
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class ObservabilityManager:
    """
    OpenTelemetry tracing wrapper context manager tracking SLIs/SLOs,
     Jaeger span links, and latency percentiles.
    """
    def __init__(self):
        self.metrics_store = {
            "sli_api_availability": 0.9992,
            "sli_latency_p95_ms": 14.5
        }

    @contextmanager
    def start_span(self, operation_name: str, attributes: dict = None):
        """Mocks OpenTelemetry distributed span tracing."""
        start_time = time.time()
        span_id = f"span_{int(start_time * 1000)}"
        attributes = attributes or {}
        
        logger.info(f"[OTel Span STARTED] operation: {operation_name} | span_id: {span_id} | attributes: {attributes}")
        try:
            yield {"span_id": span_id, "operation": operation_name}
        finally:
            elapsed_ms = (time.time() - start_time) * 1000.0
            logger.info(f"[OTel Span FINISHED] operation: {operation_name} | span_id: {span_id} | duration: {elapsed_ms:.2f}ms")

    def track_sli(self, name: str, value: float):
        """Update metrics state store."""
        self.metrics_store[name] = value
        logger.info(f"Recorded SLI update - '{name}': {value}")

    def check_slo_compliance(self) -> dict:
        """Returns SLO target check indicators."""
        return {
            "slo_availability_target": 0.999,
            "sli_availability_actual": self.metrics_store["sli_api_availability"],
            "compliant": self.metrics_store["sli_api_availability"] >= 0.999
        }

# Global Observability instance
observability = ObservabilityManager()
