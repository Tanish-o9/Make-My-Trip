from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.wishlist import WishlistItem
from app.utils.event_bus import emit_event

router = APIRouter(prefix="/wishlist", tags=["wishlist"])

@router.post("")
def add_to_wishlist(
    user_id: int,
    item_type: str,
    item_ref_id: str,
    snapshot_json: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Saves a flight or hotel listing snapshot to the user wishlist"""
    existing = db.query(WishlistItem).filter(
        WishlistItem.user_id == user_id,
        WishlistItem.item_type == item_type,
        WishlistItem.item_ref_id == item_ref_id
    ).first()
    if existing:
        return {"message": "Item already in wishlist.", "id": existing.id}
        
    item = WishlistItem(
        user_id=user_id,
        item_type=item_type,
        item_ref_id=item_ref_id,
        snapshot_json=snapshot_json
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"message": "Added to wishlist.", "id": item.id}


@router.delete("/{item_id}")
def remove_from_wishlist(
    item_id: int,
    db: Session = Depends(get_db)
):
    """Removes a saved listing item from user wishlist"""
    item = db.query(WishlistItem).filter(WishlistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found.")
    db.delete(item)
    db.commit()
    return {"message": "Removed from wishlist successfully."}


@router.get("")
def list_wishlist(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Retrieves all wishlist snapshots for the traveler"""
    return db.query(WishlistItem).filter(WishlistItem.user_id == user_id).all()


@router.get("/price-alerts")
def check_wishlist_price_drops(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Simulates checking current market prices against saved snapshots, identifying drops"""
    items = db.query(WishlistItem).filter(WishlistItem.user_id == user_id).all()
    alerts = []
    
    for item in items:
        saved_price = float(item.snapshot_json.get("price" , 0.0))
        if saved_price <= 0:
            continue
            
        # Simulate a price drop: Current price is 15% lower than saved snapshot
        current_price = saved_price * 0.85
        drop_value = saved_price - current_price
        
        alerts.append({
            "wishlist_item_id": item.id,
            "item_type": item.item_type,
            "item_ref_id": item.item_ref_id,
            "saved_price": saved_price,
            "current_price": current_price,
            "price_drop": drop_value
        })
        
        # Fire event for notification routing
        emit_event("wishlist_price_drop", {
            "user_id": user_id,
            "item_ref_id": item.item_ref_id,
            "saved_price": saved_price,
            "current_price": current_price
        })
        
    return alerts
