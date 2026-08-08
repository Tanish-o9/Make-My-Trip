import logging
import asyncio
import datetime
from typing import Callable, Dict, List, Any
import httpx
from sqlalchemy.orm import Session
from app.database import SessionLocal

logger = logging.getLogger(__name__)

class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[Dict[str, Any]], Any]]] = {
            "BookingCreated": [],
            "BookingConfirmed": [],
            "BookingCancelled": [],
            "PaymentCompleted": [],
            "RefundCompleted": [],
            "WalletUpdated": [],
            "UserRegistered": [],
            "NotificationSent": [],
            "WorkflowStarted": [],
            "WorkflowFinished": []
        }
        self.dlq: List[Dict[str, Any]] = []  # Dead Letter Queue for failed events

    def subscribe(self, event_type: str, callback: Callable[[Dict[str, Any]], Any]):
        """Registers an internal subscriber callback for a specific event type."""
        if event_type in self._subscribers:
            self._subscribers[event_type].append(callback)
            logger.info(f"Subscribed callback to event type: {event_type}")
        else:
            self._subscribers[event_type] = [callback]
            logger.info(f"Registered and subscribed callback to custom event type: {event_type}")

    def emit(self, event_type: str, payload: Dict[str, Any], tenant_id: int = 1):
        """Emits an event to both internal subscribers and triggers external webhooks."""
        logger.info(f"EventBus Emitting event '{event_type}' for tenant {tenant_id}")

        # 1. Dispatch to internal subscribers
        subscribers = self._subscribers.get(event_type, [])
        for callback in subscribers:
            try:
                if asyncio.iscoroutinefunction(callback):
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(callback(payload))
                    except RuntimeError:
                        import threading
                        threading.Thread(target=lambda: asyncio.run(callback(payload))).start()
                else:
                    callback(payload)
            except Exception as e:
                logger.error(f"Error in internal event subscriber callback: {e}")

        # 2. Dispatch to external tenant webhooks in background
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._dispatch_webhooks(event_type, payload, tenant_id))
        except RuntimeError:
            import threading
            threading.Thread(
                target=lambda: asyncio.run(self._dispatch_webhooks(event_type, payload, tenant_id))
            ).start()

    async def _dispatch_webhooks(self, event_type: str, payload: Dict[str, Any], tenant_id: int):
        """Finds active webhook subscriptions for this tenant and event_type, sends POST with retries."""
        db = SessionLocal()
        try:
            from app.models.developer import WebhookSubscription, WebhookDeliveryLog
            subs = db.query(WebhookSubscription).filter(
                WebhookSubscription.tenant_id == tenant_id,
                WebhookSubscription.active == True
            ).all()

            async with httpx.AsyncClient(timeout=5.0) as client:
                for sub in subs:
                    # check if sub matches this event_type (stored as list/dict in JSON)
                    events = sub.event_types
                    if isinstance(events, list) and (event_type in events or "*" in events):
                        logger.info(f"Dispatching webhook event to target URL: {sub.target_url}")
                        
                        status_code = None
                        attempts = 0
                        max_retries = 3
                        success = False

                        while not success and attempts < max_retries:
                            attempts += 1
                            try:
                                resp = await client.post(sub.target_url, json={
                                    "event_type": event_type,
                                    "tenant_id": tenant_id,
                                    "timestamp": datetime.datetime.utcnow().isoformat(),
                                    "payload": payload
                                })
                                status_code = resp.status_code
                                if resp.status_code < 400:
                                    success = True
                            except Exception as post_err:
                                logger.warning(f"Failed to post webhook (attempt {attempts}/{max_retries}): {post_err}")
                                status_code = 0
                                if attempts < max_retries:
                                    await asyncio.sleep(0.5 * attempts)  # Backoff delay

                        # Log delivery attempt
                        log = WebhookDeliveryLog(
                            subscription_id=sub.id,
                            event_type=event_type,
                            status_code=status_code,
                            attempts=attempts
                        )
                        db.add(log)
                        db.commit()

                        # If failed after max retries, push to Dead Letter Queue (DLQ)
                        if not success:
                            self.dlq.append({
                                "event_type": event_type,
                                "payload": payload,
                                "tenant_id": tenant_id,
                                "target_url": sub.target_url,
                                "failed_at": datetime.datetime.utcnow().isoformat(),
                                "last_status": status_code
                            })
                            logger.error(f"Webhook delivery failed after {max_retries} attempts. Pushed to DLQ.")
        except Exception as e:
            logger.error(f"Error during webhook dispatch execution: {e}")
        finally:
            db.close()

# Export a single global event bus instance
event_bus = EventBus()

# Backward compatibility function for existing routes
def emit_event(event_type: str, payload: Dict[str, Any]):
    event_bus.emit(event_type, payload)
