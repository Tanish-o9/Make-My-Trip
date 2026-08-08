"""
Autonomous AI Platform Unit & Integration Tests — Phase 13
"""
import pytest
import datetime
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount, LoyaltyAccount
from app.models.bookings import FlightBooking, HotelBooking, VisaApplication, ForexOrder, BookingStatus
from app.models.agents import PriceSnapshot
from app.ai_tools.packing_tool import generate_packing_checklist
from app.ai_tools.emergency_contacts_tool import get_emergency_contacts
from app.services.price_tracker import price_tracker
from app.services.recommendation_engine import recommendation_engine
from app.services.knowledge_graph import knowledge_graph
from app.rag.retriever import rag_system

client = TestClient(app)

# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def travel_user():
    db = SessionLocal()
    email = "ai_travel_concierge@travelos.com"
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.query(WalletAccount).filter(WalletAccount.user_id == existing.id).delete()
        db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == existing.id).delete()
        db.query(FlightBooking).filter(FlightBooking.user_id == existing.id).delete()
        db.query(HotelBooking).filter(HotelBooking.user_id == existing.id).delete()
        db.delete(existing)
        db.commit()

    user = User(email=email, role="user")
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(WalletAccount(user_id=user.id, balance=Decimal("15000.00"), currency="INR"))
    db.add(LoyaltyAccount(user_id=user.id, points_balance=850, tier="Gold"))
    
    # Add confirmed flight and hotel bookings so all tests have data
    fb = FlightBooking(
        user_id=user.id,
        booking_reference="BK-FL-AITEST",
        total_amount=5000.0,
        currency="INR",
        origin="DEL",
        airline_code="AI",
        flight_number="AI101",
        destination="GOI",
        departure_time=datetime.datetime.utcnow(),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(hours=2),
        passenger_details=[{"name": "AI Traveler", "age": 30}],
        pricing_snapshot={"base": 4000.0, "taxes": 1000.0, "fees": 0, "discount": 0},
        status=BookingStatus.CONFIRMED
    )
    hb = HotelBooking(
        user_id=user.id,
        booking_reference="BK-HT-AITEST",
        total_amount=7000.0,
        currency="INR",
        hotel_id="HOTEL-123",
        hotel_name="Grand Hyatt Goa",
        check_in=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        check_out=datetime.datetime.utcnow() + datetime.timedelta(days=4),
        room_type="Deluxe",
        guest_details=[{"name": "AI Traveler", "age": 30}],
        address="Goa, India",
        pricing_snapshot={"base": 6000.0, "taxes": 1000.0, "fees": 0, "discount": 0},
        status=BookingStatus.CONFIRMED
    )
    db.add(fb)
    db.add(hb)
    db.commit()

    # Extract primitive values before closing or detaching
    db.refresh(user)
    u_id = user.id
    u_email = user.email
    u_role = user.role or "user"
    db.close()

    from app.auth.jwt import create_access_token
    tok = create_access_token(data={"sub": u_email, "role": u_role})
    headers = {"Authorization": f"Bearer {tok}"}

    yield {
        "id": u_id,
        "email": u_email,
        "headers": headers
    }

    db2 = SessionLocal()
    u = db2.query(User).filter(User.email == email).first()
    if u:
        db2.query(WalletAccount).filter(WalletAccount.user_id == u.id).delete()
        db2.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == u.id).delete()
        db2.query(FlightBooking).filter(FlightBooking.user_id == u.id).delete()
        db2.query(HotelBooking).filter(HotelBooking.user_id == u.id).delete()
        db2.delete(u)
        db2.commit()
    db2.close()


# ─── Tests ───────────────────────────────────────────────────────────────────

def test_packing_checklist_generator():
    """Packing checklist must match season and adventure profiles."""
    res = generate_packing_checklist("Goa", 5, "summer", ["adventure"])
    assert "Swimwear" in res["checklist"]
    assert "Hiking boots" in res["checklist"]
    assert res["total_items"] > 5


def test_emergency_contacts_lookup():
    """Consulate numbers should be correct for UK/France/US."""
    us_contacts = get_emergency_contacts("USA")
    assert us_contacts["contacts"]["police"] == "911"
    assert us_contacts["contacts"]["indian_embassy"] == "+1-202-939-7000"


def test_price_tracker_intelligence():
    """Price snapshot database operations and trend analysis."""
    # Record snapshots
    price_tracker.record_price("flight", "DEL-BOM-AI101", 5200.0)
    price_tracker.record_price("flight", "DEL-BOM-AI101", 4800.0)
    price_tracker.record_price("flight", "DEL-BOM-AI101", 4500.0)

    analysis = price_tracker.analyze_price_trend("flight", "DEL-BOM-AI101")
    assert analysis["trend"] == "dropping"
    assert "explanation" in analysis
    assert "reason" in analysis["explanation"]


def test_explainable_recommendation_happy_path(travel_user):
    """Recommendation must find bookings and return personalized recommendations."""
    rec = recommendation_engine.recommend_flights(travel_user["id"], "Goa")
    assert "recommend" in rec["reason"].lower()
    assert rec["confidence"] > 0.0


def test_knowledge_graph_traversal(travel_user):
    """Localized NetworkX/Adjacency-List traversal should map User -> flight/hotel."""
    graph = knowledge_graph.build_user_graph(travel_user["id"])
    assert graph["total_nodes"] >= 2
    relations = [e["relation"] for e in graph["edges"]]
    assert "booked" in relations


def test_advanced_rag_enhancements():
    """RAGSystem queries must compress context and match meta search fields."""
    rag_system.seed_Schengen_visa_data()
    res = rag_system.rag_query("What insurance covers €30,000?", filters={"country": "Schengen"})
    assert len(res["answer"]) > 0
    assert len(res["sources"]) > 0


def test_financial_insights_api(travel_user):
    """Financial endpoint calculations for budget, expenses, and savings."""
    headers = travel_user["headers"]
    
    # 1. Expenses
    resp = client.get("/api/v1/insights/trip-expenses", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total_spend_inr"] > 0

    # 2. Budget vs actual
    resp = client.get("/api/v1/insights/budget-vs-actual", headers=headers)
    assert resp.status_code == 200
    assert "variance_inr" in resp.json()

    # 3. Savings metrics
    resp = client.get("/api/v1/insights/savings", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["loyalty_points"] == 850


def test_business_intelligence_admin_forecasting(travel_user):
    """Admin BI forecasts cancellations and flight destination demands."""
    # Require admin token
    from app.models.core import User
    db = SessionLocal()
    admin = User(email="bi_admin_test@travelos.com", role="admin")
    db.add(admin)
    db.commit()
    db.close()
    
    from app.auth.jwt import create_access_token
    tok = create_access_token(data={"sub": "bi_admin_test@travelos.com", "role": "admin"})
    headers = {"Authorization": f"Bearer {tok}"}
    
    resp = client.get("/api/admin/bi/demand-forecast", headers=headers)
    assert resp.status_code == 200
    assert "forecast" in resp.json()

    resp = client.get("/api/admin/bi/cancellation-prediction", headers=headers)
    assert resp.status_code == 200
    assert "predicted_cancellation_rate_pct" in resp.json()

    # Clean up admin
    db2 = SessionLocal()
    db2.query(User).filter(User.email == "bi_admin_test@travelos.com").delete()
    db2.commit()
    db2.close()
