import datetime
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, Date, Boolean, Index, Text, JSON
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True)  # Nullable for OAuth users
    auth_provider: Mapped[str] = mapped_column(String(50), default="local") # local, google
    preferred_language: Mapped[str] = mapped_column(String(10), default="en")
    preferred_currency: Mapped[str] = mapped_column(String(10), default="INR")
    role: Mapped[str] = mapped_column(String(50), default="user")
    trust_score: Mapped[float] = mapped_column(Numeric(4, 2), default=4.50, nullable=False)
    fcm_token: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)  # Firebase FCM device token
    email_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # Must verify email before full access
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    saved_travelers = relationship("SavedTraveler", back_populates="user", cascade="all, delete-orphan")
    saved_passengers = relationship("SavedPassenger", back_populates="user", cascade="all, delete-orphan")
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


class SavedPassenger(Base):
    __tablename__ = "saved_passengers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    id_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    id_number: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Securely encrypted in DB
    label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
    last_used_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="saved_passengers")


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


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dob: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    mobile_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    alternate_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # ID Details
    passport_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    passport_expiry: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    pan_card: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    aadhaar: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Address
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)


class Traveller(Base):
    __tablename__ = "travellers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    passport: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    meal: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    seat: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    relationship: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)


class TravelPreference(Base):
    __tablename__ = "travel_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    preferred_airline: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    preferred_hotel_chain: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    preferred_cabin_class: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    meal_preference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    seat_preference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    travel_style: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class Documents(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)  # Passport, PAN, Aadhaar, etc.
    document_number: Mapped[str] = mapped_column(String(100), nullable=False)
    expiry_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    email_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    sms_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    whatsapp_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    push_alerts: Mapped[bool] = mapped_column(Boolean, default=True)  # Firebase FCM push notifications
    booking_updates: Mapped[bool] = mapped_column(Boolean, default=True)
    payment_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    trip_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    marketing_emails: Mapped[bool] = mapped_column(Boolean, default=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    device_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    issued_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_used_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationship
    user = relationship("User")


class EmailVerification(Base):
    """
    Stores hashed OTPs for email verification and password-reset flows.
    `purpose` discriminates between the two so a password-reset OTP
    can never satisfy an email-verification challenge (and vice-versa).
    """
    __tablename__ = "email_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # user_id may be null briefly if the user row is not yet committed (but in practice we commit first)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 hex of 6-digit OTP
    purpose: Mapped[str] = mapped_column(String(30), nullable=False)    # EMAIL_VERIFICATION | PASSWORD_RESET
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    used_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_email_verif_email_purpose", "email", "purpose"),
    )


class SecurityEvent(Base):
    """
    Audit log for account security events:
    LOGIN_SUCCESS, LOGIN_FAILED, PASSWORD_CHANGED, EMAIL_VERIFIED,
    LOGOUT, SESSION_REVOKED, ACCOUNT_DELETION_REQUESTED.
    """
    __tablename__ = "security_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    details: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False, index=True
    )

    user = relationship("User")


from sqlalchemy.ext.hybrid import hybrid_property

class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    destination: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    start_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    booking_references: Mapped[Optional[dict]] = mapped_column(JSON, default=list, nullable=True) # JSON list of strings
    budget: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), default=0.0, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(50), default="active", nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    trip_type: Mapped[Optional[str]] = mapped_column(String(50), default="Friends", nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False
    )

    user = relationship("User")

    @hybrid_property
    def owner_id(self) -> int:
        return self.user_id

    @owner_id.setter
    def owner_id(self, val: int):
        self.user_id = val


class TripMember(Base):
    __tablename__ = "trip_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="MEMBER", nullable=False)  # OWNER, MEMBER
    joined_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    trip = relationship("Trip")
    user = relationship("User")


class TripInvitation(Base):
    __tablename__ = "trip_invitations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True, nullable=False)
    token: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    invited_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, ACCEPTED, REJECTED
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)

    # Added columns for member details, verification, and OTP
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    otp_code_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    otp_expires_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    otp_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    otp_last_sent_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    otp_send_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    trip = relationship("Trip")


class TripPayment(Base):
    __tablename__ = "trip_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="razorpay", nullable=False)
    provider_order_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    provider_payment_id: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, PROCESSING, SUCCESS, FAILED, CANCELLED
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False
    )

    trip = relationship("Trip")


class TripExpense(Base):
    __tablename__ = "trip_expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False) # Transport, Hotel, Food, Activities, Shopping, Other
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    expense_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    payer_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    split_type: Mapped[str] = mapped_column(String(50), default="equal", nullable=False) # equal, custom
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False
    )

    trip = relationship("Trip")
    splits = relationship("TripExpenseSplit", back_populates="expense", cascade="all, delete-orphan")


class TripExpenseSplit(Base):
    __tablename__ = "trip_expense_splits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    expense_id: Mapped[int] = mapped_column(Integer, ForeignKey("trip_expenses.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    expense = relationship("TripExpense", back_populates="splits")
    user = relationship("User")


class TripActivity(Base):
    __tablename__ = "trip_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    start_time: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. "10:00 AM"
    end_time: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estimated_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="Other", nullable=False) # Flight, Hotel, Food, Sightseeing, Transport, Activity, Other
    assigned_member_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    trip = relationship("Trip")
    assigned_member = relationship("User")


class TripTask(Base):
    __tablename__ = "trip_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assignee_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    due_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False) # LOW, MEDIUM, HIGH
    status: Mapped[str] = mapped_column(String(20), default="TODO", nullable=False) # TODO, IN PROGRESS, DONE

    trip = relationship("Trip")
    assignee = relationship("User")


class TripPoll(Base):
    __tablename__ = "trip_polls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True, nullable=False)
    question: Mapped[str] = mapped_column(String(512), nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    trip = relationship("Trip")
    creator = relationship("User")
    options = relationship("TripPollOption", back_populates="poll", cascade="all, delete-orphan")


class TripPollOption(Base):
    __tablename__ = "trip_poll_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    poll_id: Mapped[int] = mapped_column(Integer, ForeignKey("trip_polls.id", ondelete="CASCADE"), index=True, nullable=False)
    option_text: Mapped[str] = mapped_column(String(255), nullable=False)

    poll = relationship("TripPoll", back_populates="options")


class TripPollVote(Base):
    __tablename__ = "trip_poll_votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    poll_id: Mapped[int] = mapped_column(Integer, ForeignKey("trip_polls.id", ondelete="CASCADE"), index=True, nullable=False)
    option_id: Mapped[int] = mapped_column(Integer, ForeignKey("trip_poll_options.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    poll = relationship("TripPoll")
    option = relationship("TripPollOption")
    user = relationship("User")


class TripMessage(Base):
    __tablename__ = "trip_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True, nullable=False)
    sender_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    trip = relationship("Trip")
    sender = relationship("User")


class TripActivityLog(Base):
    __tablename__ = "trip_activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), index=True, nullable=False)
    actor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(512), nullable=False)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    trip = relationship("Trip")
    actor = relationship("User")


