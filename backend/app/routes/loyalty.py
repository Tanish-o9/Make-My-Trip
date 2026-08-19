from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User
from app.services.wallet_loyalty import LoyaltyService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/loyalty", tags=["loyalty"])

@router.get("/dashboard")
async def get_loyalty_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    from app.models.core import WalletAccount, WalletTransaction
    
    # Recalculate user's loyalty account details using LoyaltyService
    loyalty = LoyaltyService.get_or_create_loyalty(db, current_user.id)
    LoyaltyService.recalculate_tier(db, current_user.id)
    db.refresh(loyalty)
    
    tier = loyalty.tier
    
    # Calculate actual cashback balance from ledger
    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == current_user.id).first()
    cashback_val = 0.0
    if wallet:
        cashback_val = db.query(func.sum(WalletTransaction.amount)).filter(
            WalletTransaction.wallet_account_id == wallet.id,
            WalletTransaction.type == "credit",
            WalletTransaction.description.ilike("%cashback%")
        ).scalar() or 0.0
        
    return {
        "user_id": current_user.id,
        "membership_tier": tier,
        "reward_points": loyalty.points_balance,
        "cashback_balance_inr": float(cashback_val),
        "referral_code": f"REF-{current_user.id:04d}-{tier[:2].upper()}",
        "coupons": [
            {"code": "FLYGOLD", "discount": "10% Off on Flights", "terms": "For Gold members and above"},
            {"code": "STAYPLAT", "discount": "15% Off on Hotels", "terms": "For Platinum members and above"}
        ]
    }
