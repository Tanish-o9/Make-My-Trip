import logging
import random
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class MachineLearningPlatform:
    """
    ML Platform registry containing production dynamic pricing engines,
    predictive cancellation calculators, fraud estimators, and A/B test splitters.
    """
    def __init__(self):
        self.registry = {
            "dynamic_pricing": "v2.1.0-prod",
            "cancellation_predictor": "v1.4.0-stable",
            "fraud_detector": "v3.0.1-active"
        }

    def predict_dynamic_price(self, base_price: float, demand_multiplier: float, availability_ratio: float) -> Dict[str, Any]:
        """Calculates demand-adaptive dynamic price updates (Dynamic Pricing model)."""
        # Dynamic pricing multiplier calculation: higher demand or lower availability pushes price up
        multiplier = 1.0 + (demand_multiplier * 0.15) - (availability_ratio * 0.10)
        multiplier = max(0.9, min(2.5, multiplier))
        final_price = round(base_price * multiplier, 2)

        return {
            "model_version": self.registry["dynamic_pricing"],
            "base_price": base_price,
            "final_price": final_price,
            "pricing_multiplier": round(multiplier, 2)
        }

    def predict_cancellation_risk(self, booking_details: Dict[str, Any]) -> Dict[str, Any]:
        """AI score predicting probability of booking cancellation."""
        # Simple heuristic risk calculation representation
        lead_time = booking_details.get("lead_time_days", 14)
        cancellation_history_rate = booking_details.get("user_cancel_ratio", 0.0)
        
        # Risk increases with higher lead time and past cancellation history
        risk_score = 0.1 + (lead_time / 180.0) * 0.4 + cancellation_history_rate * 0.5
        risk_score = min(0.99, max(0.01, risk_score))

        return {
            "model_version": self.registry["cancellation_predictor"],
            "cancellation_probability": round(risk_score, 3),
            "risk_tier": "HIGH" if risk_score > 0.6 else "MEDIUM" if risk_score > 0.25 else "LOW"
        }

    def evaluate_fraud_risk(self, transaction_amount: float, client_country: str, merchant_country: str) -> Dict[str, Any]:
        """Evaluates card-not-present fraud risks."""
        risk_score = 0.05
        # Cross-border transactions are slightly higher risk
        if client_country != merchant_country:
            risk_score += 0.25
        # Large ticket amounts push risk score up
        if transaction_amount > 50000.0:
            risk_score += 0.45

        return {
            "model_version": self.registry["fraud_detector"],
            "fraud_risk_score": round(risk_score, 2),
            "approved": risk_score < 0.65
        }

    def split_ab_test(self, user_id: str, experiment_name: str) -> str:
        """Assigns user to A/B test cohorts deterministically using hashing."""
        # Deterministic user hash allocation
        hash_val = hash(f"{user_id}:{experiment_name}")
        cohort = "B" if hash_val % 2 == 0 else "A"
        logger.info(f"User {user_id} routed to A/B cohort '{cohort}' for test '{experiment_name}'")
        return cohort

# Global ML Platform Service
ml_platform = MachineLearningPlatform()
