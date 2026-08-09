import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class MarketplacePartner(Base):
    __tablename__ = "marketplace_partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # hotel, agent, guide, insurance, forex, visa
    api_endpoint: Mapped[str] = mapped_column(String(500), nullable=True)
    commission_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=10.00)

    services = relationship("PartnerService", back_populates="partner", cascade="all, delete-orphan")
    referrals = relationship("AffiliateReferral", back_populates="partner", cascade="all, delete-orphan")


class PartnerService(Base):
    __tablename__ = "partner_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("marketplace_partners.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True)

    partner = relationship("MarketplacePartner", back_populates="services")


class AffiliateReferral(Base):
    __tablename__ = "affiliate_referrals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("marketplace_partners.id", ondelete="CASCADE"), nullable=False)
    referrer_tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    booking_ref: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    commission_earned: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    partner = relationship("MarketplacePartner", back_populates="referrals")
