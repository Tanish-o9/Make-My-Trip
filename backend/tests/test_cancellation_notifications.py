import pytest
import datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.core import User, WalletAccount
from app.models.bookings import FlightBooking, BookingStatus
from app.ai_agents.cancellation_agent import CancellationAgent
from app.services.wallet_loyalty import WalletService

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

def test_cancellation_refund_rules(db):
    user = User(email="traveler@comfort.com", phone="+919999999999")
    db.add(user)
    db.commit()

    # Initialize user wallet with 0
    wallet = WalletAccount(user_id=user.id, balance=Decimal("0.00"), currency="INR")
    db.add(wallet)
    db.commit()

    # 1. 100% Refund (Departure in 72 hours)
    flight_1 = FlightBooking(
        booking_reference="REF_100",
        user_id=user.id,
        status=BookingStatus.CONFIRMED,
        total_amount=Decimal("5000.00"),
        pricing_snapshot={},
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(hours=72),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(hours=75),
        origin="DEL",
        destination="GOI",
        airline_code="6E",
        flight_number="6E-502",
        passenger_details=[]
    )
    db.add(flight_1)
    db.commit()

    res_1 = CancellationAgent.process_cancellation(db, "REF_100", user.id)
    assert res_1["success"] is True
    assert res_1["refund_amount"] == 5000.0
    assert res_1["penalty_fee"] == 0.0
    assert wallet.balance == Decimal("5000.00")

    # 2. 50% Refund (Departure in 30 hours)
    flight_2 = FlightBooking(
        booking_reference="REF_50",
        user_id=user.id,
        status=BookingStatus.CONFIRMED,
        total_amount=Decimal("4000.00"),
        pricing_snapshot={},
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(hours=30),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(hours=33),
        origin="DEL",
        destination="GOI",
        airline_code="AI",
        flight_number="AI-312",
        passenger_details=[]
    )
    db.add(flight_2)
    db.commit()

    res_2 = CancellationAgent.process_cancellation(db, "REF_50", user.id)
    assert res_2["success"] is True
    assert res_2["refund_amount"] == 2000.0
    assert res_2["penalty_fee"] == 2000.0
    assert wallet.balance == Decimal("7000.00")  # 5000 + 2000

    # 3. 0% Refund (Departure in 10 hours)
    flight_3 = FlightBooking(
        booking_reference="REF_0",
        user_id=user.id,
        status=BookingStatus.CONFIRMED,
        total_amount=Decimal("3000.00"),
        pricing_snapshot={},
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(hours=10),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(hours=13),
        origin="DEL",
        destination="GOI",
        airline_code="UK",
        flight_number="UK-811",
        passenger_details=[]
    )
    db.add(flight_3)
    db.commit()

    res_3 = CancellationAgent.process_cancellation(db, "REF_0", user.id)
    assert res_3["success"] is True
    assert res_3["refund_amount"] == 0.0
    assert res_3["penalty_fee"] == 3000.0
    assert wallet.balance == Decimal("7000.00")  # stays 7000
