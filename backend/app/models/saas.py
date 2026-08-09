import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, JSON, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subdomain: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    custom_domain: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active")  # active, suspended
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    workspaces = relationship("Workspace", back_populates="tenant", cascade="all, delete-orphan")
    settings = relationship("TenantSettings", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    branding = relationship("TenantBranding", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    subscriptions = relationship("SaaSSubscription", back_populates="tenant", cascade="all, delete-orphan")
    invoices = relationship("SaaSInvoice", back_populates="tenant", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="workspaces")


class TenantSettings(Base):
    __tablename__ = "tenant_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    settings_json: Mapped[dict] = mapped_column(JSON, default=dict)

    tenant = relationship("Tenant", back_populates="settings")


class TenantBranding(Base):
    __tablename__ = "tenant_branding"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    logo_url: Mapped[str] = mapped_column(String(500), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(50), default="#000000")
    secondary_color: Mapped[str] = mapped_column(String(50), default="#ffffff")
    theme_name: Mapped[str] = mapped_column(String(50), default="light")
    email_header: Mapped[str] = mapped_column(String(500), nullable=True)
    invoice_header: Mapped[str] = mapped_column(String(500), nullable=True)

    tenant = relationship("Tenant", back_populates="branding")


class SaaSSubscription(Base):
    __tablename__ = "saas_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    plan_name: Mapped[str] = mapped_column(String(50), default="free")  # free, starter, professional, enterprise
    status: Mapped[str] = mapped_column(String(50), default="active")  # active, past_due, canceled
    starts_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    ends_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)

    tenant = relationship("Tenant", back_populates="subscriptions")


class SaaSInvoice(Base):
    __tablename__ = "saas_invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="unpaid")  # paid, unpaid, void
    billing_period_start: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    billing_period_end: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    tenant = relationship("Tenant", back_populates="invoices")


class BetaFeedback(Base):
    __tablename__ = "beta_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    feedback_type: Mapped[str] = mapped_column(String(50), default="bug") # bug, feature, general
    message: Mapped[str] = mapped_column(String(2000), nullable=False)
    screenshot_url: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
