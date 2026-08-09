import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class CorporateAccount(Base):
    __tablename__ = "corporate_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    departments = relationship("Department", back_populates="corporate", cascade="all, delete-orphan")
    policies = relationship("TravelPolicy", back_populates="corporate", cascade="all, delete-orphan")
    cost_centers = relationship("CostCenter", back_populates="corporate", cascade="all, delete-orphan")
    wallets = relationship("CorporateWallet", back_populates="corporate", cascade="all, delete-orphan")


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    corporate_id: Mapped[int] = mapped_column(Integer, ForeignKey("corporate_accounts.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    corporate = relationship("CorporateAccount", back_populates="departments")
    employees = relationship("EmployeeProfile", back_populates="department", cascade="all, delete-orphan")


class EmployeeProfile(Base):
    __tablename__ = "employee_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department_id: Mapped[int] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), index=True, nullable=True)
    manager_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    employee_id: Mapped[str] = mapped_column(String(100), nullable=True)

    department = relationship("Department", back_populates="employees")


class TravelPolicy(Base):
    __tablename__ = "travel_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    corporate_id: Mapped[int] = mapped_column(Integer, ForeignKey("corporate_accounts.id", ondelete="CASCADE"), index=True, nullable=False)
    max_flight_class: Mapped[str] = mapped_column(String(50), default="ECONOMY")
    max_hotel_stars: Mapped[int] = mapped_column(Integer, default=4)
    per_diem_limit_inr: Mapped[float] = mapped_column(Numeric(12, 2), default=5000.00)

    corporate = relationship("CorporateAccount", back_populates="policies")


class CostCenter(Base):
    __tablename__ = "cost_centers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    corporate_id: Mapped[int] = mapped_column(Integer, ForeignKey("corporate_accounts.id", ondelete="CASCADE"), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    budget_limit: Mapped[float] = mapped_column(Numeric(12, 2), default=100000.00)
    current_spend: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)

    corporate = relationship("CorporateAccount", back_populates="cost_centers")


class CorporateWallet(Base):
    __tablename__ = "corporate_wallets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    corporate_id: Mapped[int] = mapped_column(Integer, ForeignKey("corporate_accounts.id", ondelete="CASCADE"), index=True, nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    currency: Mapped[str] = mapped_column(String(10), default="INR")

    corporate = relationship("CorporateAccount", back_populates="wallets")
    transactions = relationship("CorporateWalletTransaction", back_populates="wallet", cascade="all, delete-orphan")


class CorporateWalletTransaction(Base):
    __tablename__ = "corporate_wallet_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wallet_id: Mapped[int] = mapped_column(Integer, ForeignKey("corporate_wallets.id", ondelete="CASCADE"), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # credit, debit
    reference: Mapped[str] = mapped_column(String(255), nullable=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    wallet = relationship("CorporateWallet", back_populates="transactions")


class ApprovalWorkflow(Base):
    __tablename__ = "approval_workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    corporate_id: Mapped[int] = mapped_column(Integer, ForeignKey("corporate_accounts.id", ondelete="CASCADE"), index=True, nullable=False)
    rule_type: Mapped[str] = mapped_column(String(100), default="limit_exceeded")  # limit_exceeded, policy_violation
    threshold_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=5000.00)
    manager_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
