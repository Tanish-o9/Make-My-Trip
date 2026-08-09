import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Agency(Base):
    __tablename__ = "agencies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=True)

    agents = relationship("Agent", back_populates="agency", cascade="all, delete-orphan")


class Agent(Base):
    __tablename__ = "agents_staff"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agency_id: Mapped[int] = mapped_column(Integer, ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tier: Mapped[str] = mapped_column(String(50), default="junior")  # senior, junior

    agency = relationship("Agency", back_populates="agents")
    assignments = relationship("CustomerAssignment", back_populates="agent", cascade="all, delete-orphan")
    commissions = relationship("CommissionRecord", back_populates="agent", cascade="all, delete-orphan")


class CustomerAssignment(Base):
    __tablename__ = "customer_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agents_staff.id", ondelete="CASCADE"), nullable=False)
    customer_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    agent = relationship("Agent", back_populates="assignments")


class CommissionRecord(Base):
    __tablename__ = "commission_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agents_staff.id", ondelete="CASCADE"), nullable=False)
    booking_ref: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, paid

    agent = relationship("Agent", back_populates="commissions")
