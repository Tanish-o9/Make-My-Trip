import logging
import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit import Notification, NotificationDelivery
from app.models.core import User, NotificationPreference

logger = logging.getLogger("travel_os.notifications")

class NotificationService:
    """
    Unified, idempotent Notification & Communication Service for Ghumne Chale.
    Dispatches in-app notifications, WebSocket alerts, and transactional emails.
    Integrated with circuit breaker and failure tolerance.
    """

    @staticmethod
    def send_notification(
        db: Session,
        user_id: int,
        notification_type: str,
        title: str,
        message: str,
        booking_reference: Optional[str] = None,
        vertical: Optional[str] = None,
        action_url: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        channel: str = "in_app",
        send_email: bool = False,
        email_recipient: Optional[str] = None,
        email_subject: Optional[str] = None,
        email_html: Optional[str] = None,
        is_marketing: bool = False,
    ) -> Notification:
        now = datetime.datetime.utcnow()

        # 1. Idempotency check: prevent duplicate notifications
        if idempotency_key:
            existing = (
                db.query(Notification)
                .filter(Notification.idempotency_key == idempotency_key)
                .first()
            )
            if existing:
                logger.info(f"Duplicate notification suppressed by idempotency_key: {idempotency_key}")
                return existing

        # 2. Preference Check
        pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
        if is_marketing and pref and not pref.marketing_emails:
            logger.info(f"Marketing notification suppressed for user {user_id} per preferences")
            # Create a placeholder in-app notification or skip
            send_email = False

        # 3. Create In-App Notification record
        notif = Notification(
            user_id=user_id,
            channel=channel,
            title=title,
            message=message,
            notification_type=notification_type,
            booking_reference=booking_reference,
            vertical=vertical,
            action_url=action_url,
            is_read=False,
            idempotency_key=idempotency_key,
            delivery_status="DELIVERED",
            payload={},
            sent_at=now,
            created_at=now,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)

        # 4. Record in-app delivery
        inapp_delivery = NotificationDelivery(
            notification_id=notif.id,
            channel="in_app",
            provider="system",
            status="DELIVERED",
            delivered_at=now,
        )
        db.add(inapp_delivery)
        db.commit()

        # 5. Send Real-Time WebSocket alert (non-blocking)
        try:
            from app.utils.websocket_gateway import ws_gateway
            ws_gateway.broadcast(f"user_{user_id}", {
                "event": "NOTIFICATION",
                "notification": {
                    "id": notif.id,
                    "title": title,
                    "message": message,
                    "notification_type": notification_type,
                    "booking_reference": booking_reference,
                    "vertical": vertical,
                    "action_url": action_url,
                    "created_at": notif.created_at.isoformat(),
                }
            })
        except Exception as ws_err:
            logger.debug(f"WebSocket notification skipped/fallback: {ws_err}")

        # 6. Send Email if requested (never breaks transaction on failure)
        if send_email:
            user = db.query(User).filter(User.id == user_id).first()
            target_email = email_recipient or (user.email if user else None)
            if target_email:
                subject = email_subject or title
                html_body = email_html or f"<p>{message}</p>"
                text_body = message

                email_delivery = NotificationDelivery(
                    notification_id=notif.id,
                    channel="email",
                    provider="resend",
                    status="PENDING",
                    attempt_count=1,
                    last_attempt_at=now,
                )
                db.add(email_delivery)
                db.commit()

                try:
                    from app.services.communication import SendGridClient
                    comm = SendGridClient()
                    comm.send_email(
                        to_email=target_email,
                        subject=subject,
                        body=text_body,
                        html_body=html_body,
                    )
                    email_delivery.status = "DELIVERED"
                    email_delivery.delivered_at = datetime.datetime.utcnow()
                    db.commit()
                    logger.info(f"Notification email delivered to {target_email}")
                except Exception as mail_exc:
                    email_delivery.status = "FAILED"
                    email_delivery.error_code = str(mail_exc)[:100]
                    db.commit()
                    logger.warning(f"Notification email delivery failed (core transaction intact): {mail_exc}")

        return notif
