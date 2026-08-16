import datetime
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User, LoyaltyAccount, WalletAccount
from app.models.showcase import Offer
from app.models.wishlist import WishlistItem
from app.routes.dashboard import get_all_user_bookings
from app.routes.showcase import seed_showcase_data

logger = logging.getLogger("travel_os.offers")

router = APIRouter(prefix="/offers", tags=["offers"])

@router.get("/active")
def get_active_offers(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Ensure database is seeded with showcase/offers data
    try:
        seed_showcase_data(db)
    except Exception as e:
        logger.error(f"Error seeding showcase data: {e}")

    now = datetime.datetime.utcnow()
    
    # 1. Fetch loyalty tier
    loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == current_user.id).first()
    points = loyalty.points_balance if loyalty else 0
    tier = "Silver"
    if points > 5000:
        tier = "Platinum"
    elif points > 1000:
        tier = "Gold"
        
    # 2. Fetch active and non-expired offers
    query = db.query(Offer).filter(Offer.active == True, Offer.valid_to >= now)
    if category:
        # Standardize category filter (e.g. bus vs buses)
        cat_filter = category.lower().rstrip("s")
        if cat_filter == "bus":
            query = query.filter(Offer.category.in_(["bus", "buses"]))
        else:
            query = query.filter(Offer.category.like(f"%{cat_filter}%"))

    offers = query.all()
    
    # 3. Fetch user history data for personalization
    try:
        bookings = get_all_user_bookings(db, current_user.id)
        last_vertical = bookings[0].vertical if bookings else None
    except Exception as e:
        logger.warning(f"Failed to fetch user bookings for personalization: {e}")
        last_vertical = None
        
    wishlist_count = db.query(WishlistItem).filter(WishlistItem.user_id == current_user.id).count()
    
    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == current_user.id).first()
    wallet_balance = float(wallet.balance) if wallet else 0.0
    
    serialized_offers = []
    for offer in offers:
        desc = offer.description
        title = offer.title
        tags = offer.tags or ""
        
        # Apply Loyalty Tier personalization
        if tier in ["Gold", "Platinum"]:
            if offer.category in ["flights", "hotels", "holidays"]:
                title = f"👑 {tier} Special: {title}"
                desc = f"Exclusive VIP benefit for {tier} members. {desc}"
                
        # Apply Wishlist personalization
        if wishlist_count > 0 and offer.category in ["flights", "hotels"]:
            desc = f"✨ Matches your wishlist destinations! {desc}"
            
        # Apply Last Booked vertical personalization
        if last_vertical and offer.category == last_vertical:
            desc = f"🔥 Handpicked because you recently booked a {last_vertical.rstrip('s')}: {desc}"
            
        # Apply Wallet Balance personalization
        if wallet_balance > 50000 and offer.category == "bank":
            desc = f"💼 Premium Card Offer: {desc}"
            
        # Determine discount type and value from promo code or defaults
        discount_type = "percentage"
        discount_value = 10
        
        code = (offer.promo_code or "").upper()
        if "FLYFAST" in code:
            discount_value = 12
        elif "LUXSTAYS" in code:
            discount_value = 20
        elif "BUSBUDDY" in code:
            discount_value = 20
        elif "GOAPACK" in code:
            discount_type = "flat"
            discount_value = 1500
        elif "CABRIDE" in code:
            discount_value = 15
        elif "ICICI" in code:
            discount_value = 10
            
        serialized_offers.append({
            "id": offer.id,
            "title": title,
            "description": desc,
            "category": offer.category,
            "discount_type": discount_type,
            "discount_value": discount_value,
            "coupon_code": offer.promo_code,
            "promo_code": offer.promo_code, # Fallback compatibility
            "valid_until": offer.valid_to.isoformat(),
            "valid_to": offer.valid_to.isoformat(), # Fallback compatibility
            "cta_route": offer.cta_url or f"/{offer.category}",
            "cta_url": offer.cta_url or f"/{offer.category}", # Fallback compatibility
            "tags": tags
        })
        
    return {"offers": serialized_offers}
