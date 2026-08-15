import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    route: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # e.g. "Delhi → Goa" or "DEL-GOI"
    vertical: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # e.g. "flight", "hotel"
    travel_date: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. "18 Aug" or "2026-08-18"
    target_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    current_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    last_checked: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    alert_status: Mapped[str] = mapped_column(String(20), default="active", index=True, nullable=False) # active, triggered
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")
