import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False) # email, sms, push, whatsapp
    payload: Mapped[dict] = mapped_column(JSON, nullable=False) # payload containing title, body, template_vars
    status: Mapped[str] = mapped_column(String(50), default="queued") # queued, sent, failed
    sent_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # system, user_id, admin_id
    action: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # refund_issued, price_changed, fraud_blocked
    entity: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # booking_id, wallet_id
    before_json: Mapped[dict] = mapped_column(JSON, nullable=True) # State before action
    after_json: Mapped[dict] = mapped_column(JSON, nullable=True)  # State after action
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
