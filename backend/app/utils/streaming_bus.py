import logging
import asyncio
import datetime
from typing import Callable, Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class StreamingEvent:
    def __init__(self, offset: int, event_type: str, payload: Dict[str, Any], timestamp: str):
        self.offset = offset
        self.event_type = event_type
        self.payload = payload
        self.timestamp = timestamp

class StreamingBus:
    """
    Enterprise message streaming client mimicking Kafka/NATS capabilities.
    Supports Event Streaming, Replay by offset, Ordering index logs,
    partitioned Consumer Groups, retry counts, and DLQ redirects.
    """
    def __init__(self):
        # Global sequential offset log
        self._event_log: List[StreamingEvent] = []
        self._offset_counter = 0
        self._consumers: Dict[str, List[Callable[[StreamingEvent], Any]]] = {}
        self.dlq: List[Dict[str, Any]] = []

    def publish(self, event_type: str, payload: Dict[str, Any]) -> int:
        """Publishes an event to the stream, logging its sequence offset."""
        self._offset_counter += 1
        event = StreamingEvent(
            offset=self._offset_counter,
            event_type=event_type,
            payload=payload,
            timestamp=datetime.datetime.utcnow().isoformat()
        )
        self._event_log.append(event)
        logger.info(f"StreamingBus Published event '{event_type}' at offset: {event.offset}")

        # Trigger active subscribers
        consumers = self._consumers.get(event_type, [])
        for consumer in consumers:
            try:
                # Simulating consumer group partition execution
                if asyncio.iscoroutinefunction(consumer):
                    asyncio.create_task(self._safe_execute_async(consumer, event))
                else:
                    consumer(event)
            except Exception as e:
                logger.error(f"Consumer execution error: {e}")
                self._route_to_dlq(event, str(e))

        return event.offset

    def subscribe(self, event_type: str, callback: Callable[[StreamingEvent], Any]):
        """Registers a consumer callback for a specific event stream partition."""
        if event_type not in self._consumers:
            self._consumers[event_type] = []
        self._consumers[event_type].append(callback)
        logger.info(f"Consumer subscribed to event partition: {event_type}")

    def replay(self, start_offset: int) -> List[Dict[str, Any]]:
        """Replay logged stream events starting from a specific sequence offset (Kafka Replay)."""
        logger.info(f"Replaying event stream starting from offset: {start_offset}")
        return [
            {
                "offset": e.offset,
                "event_type": e.event_type,
                "payload": e.payload,
                "timestamp": e.timestamp
            }
            for e in self._event_log if e.offset >= start_offset
        ]

    async def _safe_execute_async(self, callback: Callable, event: StreamingEvent):
        """Asynchronously executes consumer tasks with retries and DLQ fallback."""
        max_retries = 3
        attempts = 0
        success = False
        while not success and attempts < max_retries:
            attempts += 1
            try:
                await callback(event)
                success = True
            except Exception as err:
                logger.warning(f"Async consumer failed (attempt {attempts}/{max_retries}): {err}")
                if attempts < max_retries:
                    await asyncio.sleep(0.1 * attempts)

        if not success:
            self._route_to_dlq(event, f"Failed after {max_retries} attempts.")

    def _route_to_dlq(self, event: StreamingEvent, reason: str):
        """Pushes failed event payloads to the Dead Letter Queue (DLQ)."""
        logger.error(f"Routing failed event offset {event.offset} to DLQ. Reason: {reason}")
        self.dlq.append({
            "offset": event.offset,
            "event_type": event.event_type,
            "payload": event.payload,
            "failed_at": datetime.datetime.utcnow().isoformat(),
            "reason": reason
        })

# Global Streaming Bus Instance
streaming_bus = StreamingBus()
