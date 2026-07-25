import pytest
import datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.core import User, Coupon, WalletAccount
from app.services.wallet_loyalty import WalletService, LoyaltyService, CouponService, CouponValidationError, InsufficientWalletBalance

# Setup in-memory SQLite DB for unit testing
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

def test_wallet_top_up_and_debit(db):
    user = User(email="test@travelos.com")
    db.add(user)
    db.commit()

    # Create wallet and top up
    WalletService.top_up(db, user.id, Decimal("5000.00"), "recharge_1")
    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).first()
    assert wallet.balance == Decimal("5000.00")

    # Debit wallet for booking
    WalletService.debit_for_booking(db, user.id, Decimal("2000.00"), "booking_1")
    assert wallet.balance == Decimal("3000.00")

    # Expect error on insufficient funds
    with pytest.raises(InsufficientWalletBalance):
        WalletService.debit_for_booking(db, user.id, Decimal("4000.00"), "booking_2")

def test_coupon_validation_and_application(db):
    user = User(email="test@travelos.com")
    db.add(user)
    db.commit()

    # 1. Create a valid coupon
    valid_coupon = Coupon(
        code="SAVE10",
        discount_type="percentage",
        value=Decimal("10.00"),
        valid_from=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=2),
        usage_limit=5,
        times_used=0,
        min_order_value=Decimal("1000.00")
    )
    db.add(valid_coupon)
    
    # 2. Create an expired coupon
    expired_coupon = Coupon(
        code="EXPIRED",
        discount_type="flat",
        value=Decimal("500.00"),
        valid_from=datetime.datetime.utcnow() - datetime.timedelta(days=5),
        valid_to=datetime.datetime.utcnow() - datetime.timedelta(days=2),
        usage_limit=5,
        times_used=0,
        min_order_value=Decimal("0.00")
    )
    db.add(expired_coupon)
    db.commit()

    # Success case validation
    coupon = CouponService.validate_coupon(db, "SAVE10", user.id, Decimal("1500.00"))
    assert coupon.code == "SAVE10"

    # Fail cases
    with pytest.raises(CouponValidationError, match="expired"):
        CouponService.validate_coupon(db, "EXPIRED", user.id, Decimal("500.00"))

    with pytest.raises(CouponValidationError, match="Minimum order value"):
        CouponService.validate_coupon(db, "SAVE10", user.id, Decimal("500.00"))

    # Discount calculation
    discount = CouponService.apply_coupon(db, "SAVE10", user.id, Decimal("2000.00"))
    assert discount == Decimal("200.00")
    assert valid_coupon.times_used == 1
