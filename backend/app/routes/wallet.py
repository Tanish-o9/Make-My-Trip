from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field
import datetime

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User, SavedTraveler, SavedPaymentMethod, Wishlist, LoyaltyTransaction, WalletTransaction
from app.services.wallet_loyalty import WalletService, LoyaltyService, CouponService, CouponValidationError

router = APIRouter(prefix="/wallet-loyalty", tags=["wallet-loyalty"])

# Schema definitions
class WalletTransactionResponse(BaseModel):
    id: int
    amount: float
    type: str
    balance_before: float = 0.0
    balance_after: float = 0.0
    reference: str = ""
    description: str = ""
    status: str = "COMPLETED"
    timestamp: datetime.datetime

class WalletResponse(BaseModel):
    balance: float
    currency: str
    transactions: List[WalletTransactionResponse] = []

class WalletTopupRequest(BaseModel):
    amount: float = Field(..., gt=0)
    payment_token: Optional[str] = "test_token_dev"  # Simulated stripe/test card token
    description: Optional[str] = "Wallet Recharge"
    pin: Optional[str] = Field(None, description="4-digit payment security PIN")

class CouponApplyRequest(BaseModel):
    code: str
    order_value: float = Field(..., gt=0)

class SavedTravelerRequest(BaseModel):
    name: str
    dob: datetime.date
    passport_no: str = None

class SavedTravelerResponse(BaseModel):
    id: int
    name: str
    dob: datetime.date
    passport_no: str = None
    
    class Config:
        from_attributes = True

class WishlistRequest(BaseModel):
    item_type: str
    item_ref_id: str

# Endpoints
@router.get("/wallet", response_model=WalletResponse)
def get_wallet(
    search: Optional[str] = None,
    tx_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    wallet = WalletService.get_or_create_wallet(db, user.id)
    query = db.query(WalletTransaction).filter(WalletTransaction.wallet_account_id == wallet.id)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (WalletTransaction.description.ilike(search_term)) |
            (WalletTransaction.reference.ilike(search_term))
        )
        
    if tx_type:
        query = query.filter(WalletTransaction.type.ilike(tx_type))
        
    if start_date:
        try:
            start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(WalletTransaction.timestamp >= start_dt)
        except ValueError:
            pass
            
    if end_date:
        try:
            end_dt = datetime.datetime.strptime(end_date, "%Y-%m-%d") + datetime.timedelta(days=1)
            query = query.filter(WalletTransaction.timestamp < end_dt)
        except ValueError:
            pass

    txs = query.order_by(WalletTransaction.timestamp.desc()).all()
    
    tx_list = []
    for tx in txs:
        tx_list.append(WalletTransactionResponse(
            id=tx.id,
            amount=float(tx.amount),
            type=tx.type,
            balance_before=float(tx.balance_before or 0.0),
            balance_after=float(tx.balance_after or 0.0),
            reference=tx.reference or "",
            description=tx.description or (f"Wallet {tx.type.capitalize()}"),
            status=tx.status or "COMPLETED",
            timestamp=tx.timestamp
        ))

    return {
        "balance": float(wallet.balance),
        "currency": wallet.currency,
        "transactions": tx_list
    }

@router.post("/wallet/topup")
def top_up_wallet(
    req: WalletTopupRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_payment_pin: Optional[str] = Header(None, alias="X-Payment-PIN")
):
    import os
    from app.payments.config import settings
    from app.services import security_pin_service

    # Enforce backend PIN check if user has PIN set in DB
    if security_pin_service.is_pin_enabled(db, user.id):
        provided_pin = req.pin or x_payment_pin
        if not provided_pin:
            raise HTTPException(
                status_code=400,
                detail="Payment security PIN required."
            )
        security_pin_service.verify_pin(db, user.id, provided_pin, purpose="wallet_topup")
    
    # Safety check: prevent test recharge in production environment
    mode = os.getenv("PAYMENT_MODE", settings.PAYMENT_MODE).lower()
    if mode == "live":
        raise HTTPException(
            status_code=400,
            detail="Direct recharges are not permitted in production. Please complete payment via Razorpay."
        )
        
    payment_ref = f"RECHARGE-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    wallet = WalletService.top_up(
        db=db, 
        user_id=user.id, 
        amount=Decimal(str(req.amount)), 
        reference=payment_ref, 
        description=req.description or "Wallet Recharge"
    )

    return {
        "success": True,
        "message": f"✓ ₹{req.amount:,.2f} added successfully",
        "balance": float(wallet.balance),
        "currency": wallet.currency
    }

@router.get("/loyalty")
def get_loyalty_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    loy = LoyaltyService.get_or_create_loyalty(db, user.id)
    txs = db.query(LoyaltyTransaction).filter(LoyaltyTransaction.loyalty_account_id == loy.id).all()
    return {
        "points_balance": loy.points_balance,
        "tier": loy.tier,
        "history": [
            {
                "points_delta": tx.points_delta,
                "reason": tx.reason,
                "booking_ref": tx.booking_ref,
                "timestamp": tx.timestamp
            }
            for tx in txs
        ]
    }

@router.post("/coupon/validate")
def validate_coupon(
    req: CouponApplyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        coupon = CouponService.validate_coupon(db, req.code, user.id, Decimal(str(req.order_value)))
        # Calculate expected discount
        discount_val = Decimal(str(coupon.value))
        if coupon.discount_type == "percentage":
            discount = (Decimal(str(req.order_value)) * discount_val) / Decimal("100.00")
        else:
            discount = discount_val
            
        return {
            "valid": True,
            "code": coupon.code,
            "discount_amount": float(discount),
            "discount_type": coupon.discount_type
        }
    except CouponValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Travelers CRUD
@router.post("/travelers", response_model=SavedTravelerResponse)
def add_traveler(
    req: SavedTravelerRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    traveler = SavedTraveler(
        linked_user_id=user.id,
        name=req.name,
        dob=req.dob,
        passport_no=req.passport_no
    )
    db.add(traveler)
    db.commit()
    db.refresh(traveler)
    return traveler

@router.get("/travelers", response_model=List[SavedTravelerResponse])
def list_travelers(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(SavedTraveler).filter(SavedTraveler.linked_user_id == user.id).all()

# Wishlist CRUD
@router.post("/wishlist")
def add_wishlist(
    req: WishlistRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    exists = db.query(Wishlist).filter(
        Wishlist.user_id == user.id,
        Wishlist.item_type == req.item_type,
        Wishlist.item_ref_id == req.item_ref_id
    ).first()
    if exists:
        return {"status": "already_added"}
        
    item = Wishlist(user_id=user.id, item_type=req.item_type, item_ref_id=req.item_ref_id)
    db.add(item)
    db.commit()
    return {"status": "added"}

@router.get("/wishlist")
def list_wishlist(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(Wishlist).filter(Wishlist.user_id == user.id).all()
    return [{"id": item.id, "item_type": item.item_type, "item_ref_id": item.item_ref_id} for item in items]

from fastapi.responses import Response
from app.ai_agents.cancellation_agent import CancellationAgent
from app.services.calendar_service import CalendarService
from app.ai_agents.notification_agent import NotificationAgent

@router.post("/bookings/{booking_ref}/cancel")
def cancel_booking(
    booking_ref: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = CancellationAgent.process_cancellation(db, booking_ref, user.id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
        
    # Dispatch notification alert
    NotificationAgent.dispatch_cancellation_refund(
        db=db,
        user_id=user.id,
        booking_ref=booking_ref,
        refund_amount=result["refund_amount"]
    )
    return result

@router.get("/calendar/export")
def export_calendar(
    summary: str,
    description: str,
    location: str,
    start_date: str, # YYYY-MM-DD
    user: User = Depends(get_current_user)
):
    try:
        start_time = datetime.datetime.strptime(start_date, "%Y-%m-%d")
        event = {
            "summary": summary,
            "description": description,
            "location": location,
            "start_time": start_time,
            "end_time": start_time + datetime.timedelta(hours=2)
        }
        ics_text = CalendarService.generate_ics_content(event)
        return Response(
            content=ics_text,
            media_type="text/calendar",
            headers={"Content-Disposition": f"attachment; filename=itinerary_{start_date}.ics"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate calendar file: {e}")

