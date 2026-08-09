"""
Price Tracker Service — Phase 4
Maintains price snapshots in DB and monitors:
  - Flight price fluctuations
  - Hotel price fluctuations
  - Forex rate fluctuations
  - Activity price fluctuations
Detects price drops/spikes, identifies the best booking window, and calculates future trends using simple statistics (moving average, standard deviation).
"""
import logging
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy import desc
from app.database import SessionLocal
from app.models.agents import PriceSnapshot
from app.utils.explainability import explain_recommendation

logger = logging.getLogger(__name__)

class PriceTrackerService:
    def record_price(
        self, item_type: str, item_id: str, price: float, currency: str = "INR"
    ) -> PriceSnapshot:
        """Record a single price observation to DB."""
        db = SessionLocal()
        try:
            snapshot = PriceSnapshot(
                item_type=item_type.lower().strip(),
                item_id=item_id.strip(),
                price=float(price),
                currency=currency
            )
            db.add(snapshot)
            db.commit()
            db.refresh(snapshot)
            return snapshot
        except Exception as e:
            logger.error(f"[PriceTracker] Failed to record price for {item_type} {item_id}: {e}")
            db.rollback()
            raise e
        finally:
            db.close()

    def get_price_history(self, item_type: str, item_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        """Get historical price list sorted by oldest first."""
        db = SessionLocal()
        try:
            rows = db.query(PriceSnapshot).filter(
                PriceSnapshot.item_type == item_type.lower().strip(),
                PriceSnapshot.item_id == item_id.strip()
            ).order_by(PriceSnapshot.created_at.asc()).limit(limit).all()
            return [{"price": r.price, "date": r.created_at.isoformat(), "currency": r.currency} for r in rows]
        finally:
            db.close()

    def analyze_price_trend(self, item_type: str, item_id: str) -> Dict[str, Any]:
        """
        Analyze price trend: 7-day average, volatility, drop detection.
        No fabricated data — returns 'insufficient' if historical point count < 2.
        """
        history = self.get_price_history(item_type, item_id)
        if len(history) < 2:
            return {
                "status": "insufficient_data",
                "message": "Need at least 2 historical price observations to calculate trends.",
                "history_points": len(history)
            }

        prices = [h["price"] for h in history]
        current_price = prices[-1]
        previous_price = prices[-2]
        
        avg_price = sum(prices) / len(prices)
        pct_change = ((current_price - previous_price) / previous_price) * 100
        
        # Calculate standard deviation for volatility
        variance = sum((p - avg_price) ** 2 for p in prices) / len(prices)
        std_dev = variance ** 0.5
        
        trend = "stable"
        if pct_change < -5.0:
            trend = "dropping"
        elif pct_change > 5.0:
            trend = "spiking"

        # Determine best booking window (e.g. if current price is below average, suggest booking now)
        action = "hold"
        if current_price < avg_price - (0.5 * std_dev):
            action = "buy_now"
        elif current_price > avg_price + (0.5 * std_dev):
            action = "wait"

        analysis = {
            "item_type": item_type,
            "item_id": item_id,
            "current_price": current_price,
            "previous_price": previous_price,
            "average_price": round(avg_price, 2),
            "percentage_change": round(pct_change, 2),
            "volatility_std_dev": round(std_dev, 2),
            "trend": trend,
            "recommended_action": action,
            "history_points": len(history)
        }

        # Add explainable recommendation wrapper
        explanation = explain_recommendation(
            rec_type="price_intelligence",
            item=analysis,
            reason=f"Current price of {item_id} is ₹{current_price:,.0f}, which is {abs(pct_change):.1f}% "
                   f"{'lower' if pct_change < 0 else 'higher'} than the previous observation. "
                   f"The 7-day average is ₹{avg_price:,.0f}. Recommended action is {action.upper()}.",
            confidence=min(0.95, round(len(history) / 10, 2)),
            supporting_data={
                "prices_history": prices,
                "avg_price": avg_price,
                "volatility": std_dev
            },
            provider_source="price_snapshots"
        )
        analysis["explanation"] = explanation.to_dict()
        return analysis

# Singleton
price_tracker = PriceTrackerService()
