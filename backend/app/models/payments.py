import datetime
from typing import Optional
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, Date, JSON, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class LedgerRow(Base):
    __tablename__ = "ledger_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_reference: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)  # charge, refund, payout, wallet_topup, wallet_debit, fee
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False)  # credit (money incoming), debit (money outgoing)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class SettlementBatch(Base):
    __tablename__ = "settlement_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    gateway: Mapped[str] = mapped_column(String(50), nullable=False)  # stripe, razorpay
    batch_reference: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    settlement_date: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)  # pending, reconciled
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    exceptions = relationship("ReconciliationException", back_populates="batch", cascade="all, delete-orphan")


class ReconciliationException(Base):
    __tablename__ = "reconciliation_exceptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("settlement_batches.id"), nullable=True)
    booking_reference: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    exception_type: Mapped[str] = mapped_column(String(50), nullable=False)  # missing_transaction, amount_mismatch, unexpected_fee
    expected_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    actual_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)  # pending, resolved
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    batch = relationship("SettlementBatch", back_populates="exceptions")


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    request_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)  # refund_exception, fraud_review, high_value_payout, myBiz_booking, price_drop_claim_dispute
    reference_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)  # booking_ref, claim_id, payout_id
    requested_by: Mapped[str] = mapped_column(String(100), nullable=False)  # system, employee_id, user_id
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    payment_gateway: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    payment_charge_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # SLA & Timeout handling fields
    sla_expires_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    is_sla_breached: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    timeout_behavior: Mapped[str] = mapped_column(String(50), default="auto_reject", nullable=False) # auto_reject, escalate
    assigned_role: Mapped[str] = mapped_column(String(50), default="Booking Approver", nullable=False)


class VendorPayout(Base):
    __tablename__ = "vendor_payouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    vendor_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    period: Mapped[str] = mapped_column(String(20), nullable=False)  # YYYY-WW
    gross_bookings_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    commission_deducted: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    net_payout_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending_approval", nullable=False)  # pending_approval, processing, paid, failed
    ledger_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_reference: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(50), nullable=False)
    evidence_due_by: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="under_review", nullable=False)  # under_review, won, lost
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class AutoApprovalRule(Base):
    __tablename__ = "auto_approval_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    applies_to: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., flights, hotels, all
    max_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    min_user_trust_score: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    requires_clean_fraud_check: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
