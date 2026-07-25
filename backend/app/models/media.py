import datetime
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Media(Base):
    __tablename__ = "media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # hotel, vehicle, destination, activity, partner, etc.
    owner_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # owner entity primary key (string to support mock IDs)
    url: Mapped[str] = mapped_column(String(255), nullable=False) # CDN or local static file URL
    alt_text: Mapped[str] = mapped_column(String(150), default="Travel asset photo")
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    blur_hash_base64: Mapped[str] = mapped_column(Text, nullable=True) # Tiny base64 low-res image for blur-up previews
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
