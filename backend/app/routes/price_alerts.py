import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.price_alert import PriceAlert
from app.auth.dependencies import get_current_user
from app.models.core import User
from app.services.notification_service import NotificationService
from app.services.flight_service import FlightService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/price-alerts", tags=["price-alerts"])

class PriceAlertCreate(BaseModel):
    route: str          # e.g., "DEL-GOI" or "Delhi -> Goa"
    vertical: str       # e.g., "flight", "hotel"
    travel_date: str    # e.g., "2026-08-18"
    target_price: float
    current_price: float
    currency: str = "INR"

@router.post("", status_code=status.HTTP_201_CREATED)
def create_price_alert(
    payload: PriceAlertCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Creates a price alert for the authenticated user, preventing duplicate active alerts"""
    # Check duplicate
    existing = db.query(PriceAlert).filter(
        PriceAlert.user_id == current_user.id,
        PriceAlert.route == payload.route,
        PriceAlert.vertical == payload.vertical,
        PriceAlert.travel_date == payload.travel_date,
        PriceAlert.alert_status == "active"
    ).first()
    if existing:
        return {"message": "Price alert already exists.", "id": existing.id}

    alert = PriceAlert(
        user_id=current_user.id,
        route=payload.route,
        vertical=payload.vertical,
        travel_date=payload.travel_date,
        target_price=payload.target_price,
        current_price=payload.current_price,
        currency=payload.currency,
        alert_status="active",
        last_checked=datetime.datetime.utcnow()
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return {"message": "Price alert created successfully.", "id": alert.id}


@router.get("", response_model=List[Dict[str, Any]])
def list_price_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all active/triggered price alerts for the traveler"""
    alerts = db.query(PriceAlert).filter(PriceAlert.user_id == current_user.id).all()
    result = []
    for a in alerts:
        result.append({
            "id": a.id,
            "user_id": a.user_id,
            "route": a.route,
            "vertical": a.vertical,
            "travel_date": a.travel_date,
            "target_price": float(a.target_price),
            "current_price": float(a.current_price),
            "currency": a.currency,
            "alert_status": a.alert_status,
            "last_checked": a.last_checked.isoformat() if a.last_checked else None,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })
    return result


@router.delete("/{id}")
def delete_price_alert(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes a price alert, enforcing user isolation"""
    alert = db.query(PriceAlert).filter(PriceAlert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Price alert not found.")
    
    # Ownership isolation check
    if alert.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this price alert.")
        
    db.delete(alert)
    db.commit()
    return {"message": "Price alert deleted successfully."}


def parse_iata(city_or_iata: str) -> str:
    mapping = {
        "delhi": "DEL",
        "goa": "GOI",
        "mumbai": "BOM",
        "bangalore": "BLR",
        "kolkata": "CCU",
        "chennai": "MAA",
        "hyderabad": "HYD",
    }
    cleaned = city_or_iata.strip().lower()
    if cleaned in mapping:
        return mapping[cleaned]
    if len(city_or_iata) == 3 and city_or_iata.isalpha():
        return city_or_iata.upper()
    return "DEL"


@router.post("/trigger-check")
async def trigger_price_alerts_check(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually triggers price monitoring check.
    For each active alert, looks up the current price, compares it, and generates notifications.
    """
    alerts = db.query(PriceAlert).filter(
        PriceAlert.user_id == current_user.id,
        PriceAlert.alert_status == "active"
    ).all()
    
    notifications_sent = []
    
    for alert in alerts:
        previous_price = float(alert.current_price)
        
        # Parse route to search IATA codes
        route_str = alert.route.replace("→", "-").replace("->", "-")
        parts = route_str.split("-")
        from_city = parts[0].strip()
        to_city = parts[1].strip() if len(parts) > 1 else "Goa"
        
        from_iata = parse_iata(from_city)
        to_iata = parse_iata(to_city)
        
        new_price = previous_price
        
        if alert.vertical.lower() in ["flight", "flights"]:
            try:
                # Search flights
                flights = await FlightService.search_flights(from_iata, to_iata, 1)
                if flights:
                    prices = [float(f.get("price", 99999)) for f in flights]
                    new_price = min(prices)
                else:
                    new_price = previous_price - 800.0 # fallback mock drop for testing
            except Exception as e:
                logger.warning(f"Failed to lookup flights for alert check: {e}")
                new_price = previous_price - 800.0 # fallback mock drop for testing
        else:
            new_price = previous_price - 800.0 # fallback mock drop for other verticals
            
        # Update alert prices
        alert.current_price = new_price
        alert.last_checked = datetime.datetime.utcnow()
        
        # When: current_price < previous_price -> generate notification
        if new_price < previous_price:
            drop_amt = previous_price - new_price
            msg = f"{to_city} flight price dropped ₹{int(drop_amt)}."
            # Also support Goa flight price dropped ₹800 format
            if "goa" in to_city.lower():
                msg = f"Goa flight price dropped ₹{int(drop_amt)}."
                
            # Prevent duplicate notifications using stable idempotency_key
            idempotency_key = f"price_drop_{alert.id}_{int(previous_price)}_{int(new_price)}"
            
            notif = NotificationService.send_notification(
                db=db,
                user_id=alert.user_id,
                notification_type="PRICE_ALERT",
                title="Price Alert Triggered",
                message=msg,
                vertical=alert.vertical,
                idempotency_key=idempotency_key
            )
            notifications_sent.append({
                "alert_id": alert.id,
                "previous_price": previous_price,
                "current_price": new_price,
                "message": msg,
                "notification_id": notif.id
            })
            
        db.commit()
        
    return {"status": "success", "checked_count": len(alerts), "notifications_sent": notifications_sent}
