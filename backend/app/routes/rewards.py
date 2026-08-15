from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User, LoyaltyAccount, LoyaltyTransaction
from app.services.wallet_loyalty import LoyaltyService

router = APIRouter(prefix="/rewards", tags=["rewards"])

@router.get("")
def get_rewards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the traveler's rewards status, tier levels, progress, and points history
    """
    loyalty = LoyaltyService.get_or_create_loyalty(db, current_user.id)
    
    # Recalculate tier first
    LoyaltyService.recalculate_tier(db, current_user.id)
    db.refresh(loyalty)
    
    points = loyalty.points_balance
    
    # Determine level and progress
    # Explorer (0-999) -> Traveler (1000-2999) -> Adventurer (3000-4999) -> Globetrotter (5000+)
    if points < 1000:
        level = "Explorer"
        next_level = "Traveler"
        progress = round((points / 1000.0) * 100, 2)
    elif points < 3000:
        level = "Traveler"
        next_level = "Adventurer"
        progress = round(((points - 1000) / 2000.0) * 100, 2)
    elif points < 5000:
        level = "Adventurer"
        next_level = "Globetrotter"
        progress = round(((points - 3000) / 2000.0) * 100, 2)
    else:
        level = "Globetrotter"
        next_level = None
        progress = 100.0
        
    # Fetch transactions history
    txs = db.query(LoyaltyTransaction).filter(
        LoyaltyTransaction.loyalty_account_id == loyalty.id
    ).order_by(LoyaltyTransaction.timestamp.desc()).all()
    
    history = []
    for tx in txs:
        # Normalize/ensure reward history description format: e.g. "+500 Flight Booking", "-300 Wallet Redemption"
        prefix = "+" if tx.points_delta > 0 else ""
        desc = tx.reason
        if not desc.startswith(("+", "-")):
            desc = f"{prefix}{tx.points_delta} {tx.reason}"
            
        history.append({
            "id": tx.id,
            "points_delta": tx.points_delta,
            "description": desc,
            "reason": tx.reason,
            "booking_ref": tx.booking_ref,
            "created_at": tx.timestamp.isoformat() if tx.timestamp else None
        })
        
    return {
        "points": points,
        "level": level,
        "next_level": next_level,
        "progress": progress,
        "history": history
    }
