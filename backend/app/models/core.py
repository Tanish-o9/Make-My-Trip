import datetime
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, Date
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True)  # Nullable for OAuth users
    auth_provider: Mapped[str] = mapped_column(String(50), default="local") # local, google
    preferred_language: Mapped[str] = mapped_column(String(10), default="en")
    preferred_currency: Mapped[str] = mapped_column(String(10), default="INR")
    role: Mapped[str] = mapped_column(String(50), default="user")
    trust_score: Mapped[float] = mapped_column(Numeric(4, 2), default=4.50, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    saved_travelers = relationship("SavedTraveler", back_populates="user", cascade="all, delete-orphan")
    payment_methods = relationship("SavedPaymentMethod", back_populates="user", cascade="all, delete-orphan")
    wishlist_items = relationship("Wishlist", back_populates="user", cascade="all, delete-orphan")
    loyalty_account = relationship("LoyaltyAccount", uselist=False, back_populates="user", cascade="all, delete-orphan")
    wallet_account = relationship("WalletAccount", uselist=False, back_populates="user", cascade="all, delete-orphan")


class SavedTraveler(Base):
    __tablename__ = "saved_travelers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    linked_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dob: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    passport_no: Mapped[str] = mapped_column(String(50), nullable=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    user = relationship("User", back_populates="saved_travelers")


class SavedPaymentMethod(Base):
    __tablename__ = "saved_payment_methods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="stripe") # stripe, razorpay
    provider_customer_id: Mapped[str] = mapped_column(String(255), nullable=False)
    payment_token: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[str] = mapped_column(String(50), nullable=True) # Visa, Mastercard
    last4: Mapped[str] = mapped_column(String(4), nullable=True)
    exp_month: Mapped[int] = mapped_column(Integer, nullable=True)
    exp_year: Mapped[int] = mapped_column(Integer, nullable=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    user = relationship("User", back_populates="payment_methods")


class Wishlist(Base):
    __tablename__ = "wishlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)  # flight, hotel, package
    item_ref_id: Mapped[str] = mapped_column(String(100), nullable=False) # flight code, hotel id
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    user = relationship("User", back_populates="wishlist_items")


class LoyaltyAccount(Base):
    __tablename__ = "loyalty_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    points_balance: Mapped[int] = mapped_column(Integer, default=0)
    tier: Mapped[str] = mapped_column(String(50), default="Bronze") # Bronze, Silver, Gold, Platinum
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    user = relationship("User", back_populates="loyalty_account")
    transactions = relationship("LoyaltyTransaction", back_populates="account", cascade="all, delete-orphan")


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    loyalty_account_id: Mapped[int] = mapped_column(Integer, ForeignKey("loyalty_accounts.id"), index=True, nullable=False)
    points_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    booking_ref: Mapped[str] = mapped_column(String(100), nullable=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    account = relationship("LoyaltyAccount", back_populates="transactions")


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    discount_type: Mapped[str] = mapped_column(String(20), nullable=False)  # percentage, flat
    value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    valid_from: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    valid_to: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    usage_limit: Mapped[int] = mapped_column(Integer, default=1)
    times_used: Mapped[int] = mapped_column(Integer, default=0)
    min_order_value: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class WalletAccount(Base):
    __tablename__ = "wallet_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    user = relationship("User", back_populates="wallet_account")
    transactions = relationship("WalletTransaction", back_populates="account", cascade="all, delete-orphan")


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wallet_account_id: Mapped[int] = mapped_column(Integer, ForeignKey("wallet_accounts.id"), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # credit, debit
    reference: Mapped[str] = mapped_column(String(255), nullable=True) # booking_id, recharge_id
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    account = relationship("WalletAccount", back_populates="transactions")
