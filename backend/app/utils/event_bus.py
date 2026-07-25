import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def emit_event(event_type: str, payload: Dict[str, Any]) -> None:
    """
    Publishes events to the notification agent stream and logs status updates
    Args:
        event_type: e.g. 'booking_confirmed', 'price_drop_payout', 'wishlist_price_drop'
        payload: Metadata variables (user_id, amount, reference)
    """
    logger.info(f"[EVENT BUS] Emitted event '{event_type}' with payload: {payload}")
    # Mocking dispatch: In production this puts the event on a Redis/RabbitMQ queue
    # which is picked up asynchronously by the Notification Agent node.
    user_id = payload.get("user_id")
    ref = payload.get("booking_reference")
    
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        if event_type == "booking_confirmed":
            print(f"SMS/Email dispatched to user {user_id}: Booking {ref} confirmed successfully!")
            from app.ai_agents.notification_agent import NotificationAgent
            NotificationAgent.dispatch_booking_confirmation(db, user_id, payload.get("vertical", "booking"), ref, "Standard confirmed booking details")
        elif event_type == "booking_under_review":
            print(f"SMS/Email dispatched to user {user_id}: Booking {ref} is under review.")
            from app.ai_agents.notification_agent import NotificationAgent
            NotificationAgent.dispatch_booking_under_review(db, user_id, payload.get("vertical", "booking"), ref, payload.get("sla_minutes", 120))
        elif event_type == "booking_rejected":
            print(f"SMS/Email dispatched to user {user_id}: Booking {ref} was declined. Reason: {payload.get('reason')}")
            from app.ai_agents.notification_agent import NotificationAgent
            NotificationAgent.dispatch_booking_rejection(db, user_id, payload.get("vertical", "booking"), ref, payload.get("reason", "Internal policy mismatch"))
        elif event_type == "price_drop_payout":
            print(f"Notification: User {user_id} received wallet refund for booking {ref}.")
        elif event_type == "wishlist_price_drop":
            print(f"Email Alert: Saved item in user {user_id}'s wishlist has dropped in price!")
        elif event_type == "mybiz_approval_request":
            print(f"Action Required: Manager approval needed for employee travel reference {ref}.")
    finally:
        db.close()
