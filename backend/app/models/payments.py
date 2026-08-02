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


import enum

class PaymentStatus(str, enum.Enum):
    CREATED = "created"
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"

class PaymentMethod(str, enum.Enum):
    CARD = "card"
    UPI = "upi"
    NETBANKING = "netbanking"
    WALLET = "wallet"
    EMI = "emi"

class TransactionEventType(str, enum.Enum):
    ORDER_CREATED = "order_created"
    PAYMENT_AUTHORIZED = "payment_authorized"
    PAYMENT_CAPTURED = "payment_captured"
    PAYMENT_FAILED = "payment_failed"
    WEBHOOK_RECEIVED = "webhook_received"

class RefundStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.CREATED, index=True, nullable=False)
    payment_method: Mapped[Optional[PaymentMethod]] = mapped_column(Enum(PaymentMethod), nullable=True)
    razorpay_order_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    razorpay_signature: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    qr_code_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    qr_code_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    # Relationships
    transactions = relationship("PaymentTransaction", back_populates="payment", cascade="all, delete-orphan")
    refunds = relationship("Refund", back_populates="payment", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "user_id": self.user_id,
            "amount": float(self.amount) if self.amount is not None else None,
            "currency": self.currency,
            "status": self.status.value if isinstance(self.status, enum.Enum) else self.status,
            "payment_method": self.payment_method.value if isinstance(self.payment_method, enum.Enum) else self.payment_method,
            "razorpay_order_id": self.razorpay_order_id,
            "razorpay_payment_id": self.razorpay_payment_id,
            "razorpay_signature": self.razorpay_signature,
            "qr_code_url": self.qr_code_url,
            "qr_code_id": self.qr_code_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payment_id: Mapped[int] = mapped_column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), index=True, nullable=False)
    event_type: Mapped[TransactionEventType] = mapped_column(Enum(TransactionEventType), nullable=False)
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    payment = relationship("Payment", back_populates="transactions")

    def to_dict(self):
        return {
            "id": self.id,
            "payment_id": self.payment_id,
            "event_type": self.event_type.value if isinstance(self.event_type, enum.Enum) else self.event_type,
            "raw_payload": self.raw_payload,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Refund(Base):
    __tablename__ = "refunds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payment_id: Mapped[int] = mapped_column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), index=True, nullable=False)
    razorpay_refund_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[RefundStatus] = mapped_column(Enum(RefundStatus), default=RefundStatus.PENDING, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    payment = relationship("Payment", back_populates="refunds")

    def to_dict(self):
        return {
            "id": self.id,
            "payment_id": self.payment_id,
            "razorpay_refund_id": self.razorpay_refund_id,
            "amount": float(self.amount) if self.amount is not None else None,
            "status": self.status.value if isinstance(self.status, enum.Enum) else self.status,
            "reason": self.reason,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ProcessedWebhookEvent(Base):
    __tablename__ = "processed_webhook_events"

    event_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
