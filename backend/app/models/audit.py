import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, JSON, Boolean, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    channel: Mapped[str] = mapped_column(String(50), default="in_app", nullable=False) # in_app, email, sms, push, whatsapp
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notification_type: Mapped[str] = mapped_column(String(50), default="GENERAL", index=True, nullable=False)
    booking_reference: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    vertical: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    action_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    read_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    delivery_status: Mapped[str] = mapped_column(String(50), default="DELIVERED", nullable=False) # DELIVERED, PENDING, FAILED, RETRYING
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True) # Optional JSON payload
    status: Mapped[str] = mapped_column(String(50), default="sent") # sent, failed, queued
    sent_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, index=True, nullable=False)

    user = relationship("User")
    deliveries = relationship("NotificationDelivery", back_populates="notification", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_notif_user_created", "user_id", "created_at"),
        Index("ix_notif_user_unread", "user_id", "is_read"),
    )


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    notification_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("notifications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    channel: Mapped[str] = mapped_column(String(50), nullable=False)  # email, in_app, push, websocket
    provider: Mapped[str] = mapped_column(String(50), default="system", nullable=False)  # resend, sendgrid, fcm, ws
    status: Mapped[str] = mapped_column(String(50), default="DELIVERED", nullable=False)  # DELIVERED, PENDING, FAILED, RETRYING
    attempt_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_attempt_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    delivered_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    notification = relationship("Notification", back_populates="deliveries")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # system, user_id, admin_id
    action: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # refund_issued, price_changed, fraud_blocked
    entity: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # booking_id, wallet_id
    before_json: Mapped[dict] = mapped_column(JSON, nullable=True) # State before action
    after_json: Mapped[dict] = mapped_column(JSON, nullable=True)  # State after action
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
