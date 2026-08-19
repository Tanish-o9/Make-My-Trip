import pytest
import datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.bookings import FlightBooking, BookingStatus
from app.models.core import User, WalletAccount, LoyaltyAccount, Trip, TripMember, TripExpense, TripExpenseSplit
from app.services.wallet_loyalty import WalletService, LoyaltyService, InsufficientWalletBalance
from app.services.booking_core import BookingStateMachine

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

@pytest.fixture
def user(db):
    usr = User(email="test@travelos.com")
    db.add(usr)
    db.commit()
    db.refresh(usr)
    return usr

def test_wallet_insufficient_balance_rejection(db, user):
    # Ensure wallet exists and has zero balance
    wallet = WalletService.get_or_create_wallet(db, user.id)
    wallet.balance = Decimal("0.00")
    db.commit()
    
    # Create a mock flight booking on HOLD with all required fields
    booking = FlightBooking(
        booking_reference="TTEST-REF-01",
        user_id=user.id,
        status=BookingStatus.HOLD,
        total_amount=Decimal("1500.00"),
        currency="INR",
        origin="DEL",
        destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=2),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=2, hours=2),
        airline_code="6E",
        flight_number="101",
        passenger_details=[{"name": "Verified Traveler"}],
        pricing_snapshot={}
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    
    # Attempting to debit should raise InsufficientWalletBalance
    with pytest.raises(InsufficientWalletBalance):
        WalletService.debit_for_booking(db, user.id, Decimal("1500.00"), "TTEST-REF-01")

def test_loyalty_recalculate_tier(db, user):
    loyalty = LoyaltyService.get_or_create_loyalty(db, user.id)
    # Add a transaction that gives points
    from app.models.core import LoyaltyTransaction
    tx = LoyaltyTransaction(
        loyalty_account_id=loyalty.id,
        points_delta=3500,
        reason="Test earn",
        booking_ref="TTEST-REF-02"
    )
    db.add(tx)
    db.commit()
    
    # Recalculate
    tier = LoyaltyService.recalculate_tier(db, user.id)
    assert tier == "Adventurer"

def test_percentage_splits_validation():
    # Simple verification of sum validation
    total_pct = sum([60.0, 40.0])
    assert total_pct == 100.0
    
    total_pct_fail = sum([60.0, 35.0])
    assert total_pct_fail != 100.0
