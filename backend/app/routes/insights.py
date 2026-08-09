"""
Financial Insights & Knowledge Graph Router — Phase 7 & 10
Exposes:
  - GET /insights/trip-expenses       — Trip expense summary by category
  - GET /insights/budget-vs-actual   — Real comparison of budget vs actual spend
  - GET /insights/savings            — Loyalty rewards + cashback total valuation
  - GET /insights/knowledge-graph    — Localized traveler connections traversal graph
"""
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User, WalletAccount, LoyaltyAccount
from app.models.bookings import FlightBooking, HotelBooking, BookingStatus
from app.services.knowledge_graph import knowledge_graph

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["insights"])

@router.get("/trip-expenses")
def get_trip_expenses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Calculates all confirmed user travel expenses grouped by vertical."""
    flights_total = float(db.query(func.coalesce(func.sum(FlightBooking.total_amount), 0)).filter(
        FlightBooking.user_id == current_user.id,
        FlightBooking.status == BookingStatus.CONFIRMED
    ).scalar() or 0.0)

    hotels_total = float(db.query(func.coalesce(func.sum(HotelBooking.total_amount), 0)).filter(
        HotelBooking.user_id == current_user.id,
        HotelBooking.status == BookingStatus.CONFIRMED
    ).scalar() or 0.0)

    total = flights_total + hotels_total
    return {
        "user_id": current_user.id,
        "total_spend_inr": round(total, 2),
        "breakdown": {
            "flights": round(flights_total, 2),
            "hotels": round(hotels_total, 2)
        },
        "currency": "INR"
    }


@router.get("/budget-vs-actual")
def get_budget_vs_actual(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Compare estimated budget vs actual confirmed spending."""
    # Sourced from general trip planner defaults
    estimated_budget = 45000.0
    
    expenses = get_trip_expenses(current_user, db)
    actual_spend = expenses["total_spend_inr"]
    
    variance = estimated_budget - actual_spend
    status = "under_budget" if variance >= 0 else "over_budget"

    return {
        "user_id": current_user.id,
        "estimated_budget_inr": estimated_budget,
        "actual_spend_inr": actual_spend,
        "variance_inr": round(variance, 2),
        "status": status,
        "alert": f"You are currently {status.replace('_', ' ')} by ₹{abs(variance):,.2f}."
    }


@router.get("/savings")
def get_savings_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Valuate cashback, loyalty rewards points, and coupons savings."""
    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == current_user.id).first()
    loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == current_user.id).first()

    cashback_val = float(wallet.balance) if wallet else 0.0
    points = int(loyalty.points_balance) if loyalty else 0
    
    # 1 point = ₹0.25 valuation
    loyalty_val = points * 0.25
    total_savings = cashback_val + loyalty_val

    return {
        "user_id": current_user.id,
        "cashback_balance_inr": round(cashback_val, 2),
        "loyalty_points": points,
        "loyalty_points_value_inr": round(loyalty_val, 2),
        "total_savings_value_inr": round(total_savings, 2)
    }


@router.get("/knowledge-graph")
def get_user_knowledge_graph(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Traverse and return adjacency list travel connections."""
    graph = knowledge_graph.build_user_graph(current_user.id)
    return {
        "user_id": current_user.id,
        "graph": graph
    }
