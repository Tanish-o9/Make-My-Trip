import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    item_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # flight, hotel, package, etc.
    item_ref_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # e.g. flight ref, hotel ID
    snapshot_json: Mapped[dict] = mapped_column(JSON, nullable=False) # price/details snapshot
    added_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
