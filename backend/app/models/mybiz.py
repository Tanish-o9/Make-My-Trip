import datetime
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    billing_details: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Corporate travel policy thresholds
    max_fare_class: Mapped[str] = mapped_column(String(50), default="ECONOMY") # ECONOMY, BUSINESS, FIRST
    max_hotel_rating: Mapped[int] = mapped_column(Integer, default=4) # max star rating allowed
    per_diem_limit: Mapped[float] = mapped_column(Numeric(12, 2), default=5000.0) # limit in INR
    
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class EmployeeLink(Base):
    __tablename__ = "employee_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    org_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="traveler") # admin, approver, traveler
    
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "org_id", name="uq_user_org"),
    )
