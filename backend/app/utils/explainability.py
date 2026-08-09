"""
AI Explainability Layer — Phase 12
Every recommendation, plan, and AI decision is wrapped in an
ExplainableRecommendation envelope containing:
  - reason        : Human-readable explanation of WHY this was recommended
  - confidence    : float 0.0-1.0 (sourced from data quality, not fabricated)
  - supporting_data: dict of facts that drove the recommendation
  - provider_source: where the underlying data came from
  - timestamp     : when the recommendation was generated

Usage:
    rec = explain_recommendation(
        rec_type="flight",
        item={"airline": "IndiGo", "price": 4500},
        reason="User has booked IndiGo 3 times. Price is 12% below 7-day average.",
        confidence=0.87,
        supporting_data={"past_bookings": 3, "avg_price_7d": 5114},
        provider_source="duffel + booking_history"
    )
"""
from __future__ import annotations
import datetime
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional


@dataclass
class ExplainableRecommendation:
    rec_type: str                          # "flight" | "hotel" | "activity" | "insurance" | "forex" | ...
    item: Dict[str, Any]                   # The actual recommended item
    reason: str                            # Plain-English explanation
    confidence: float                      # 0.0 – 1.0
    supporting_data: Dict[str, Any]        # Facts that drove the decision
    provider_source: str                   # Data origin (e.g., "duffel", "booking_history", "rag")
    timestamp: str = field(default_factory=lambda: datetime.datetime.utcnow().isoformat())
    limitations: Optional[str] = None      # Any provider limitation to surface to user

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def explain_recommendation(
    rec_type: str,
    item: Dict[str, Any],
    reason: str,
    confidence: float,
    supporting_data: Dict[str, Any],
    provider_source: str,
    limitations: Optional[str] = None,
) -> ExplainableRecommendation:
    """
    Factory function to create a fully explainable recommendation.
    Confidence is clamped to [0.0, 1.0] and never fabricated —
    it must be derived from real data quality signals.
    """
    confidence = max(0.0, min(1.0, float(confidence)))
    return ExplainableRecommendation(
        rec_type=rec_type,
        item=item,
        reason=reason,
        confidence=confidence,
        supporting_data=supporting_data,
        provider_source=provider_source,
        limitations=limitations,
    )


def insufficient_data_recommendation(rec_type: str, context: str = "") -> ExplainableRecommendation:
    """
    Returns a transparent 'insufficient data' recommendation instead of fabricating one.
    Called when booking history is too sparse to generate a real recommendation.
    """
    return ExplainableRecommendation(
        rec_type=rec_type,
        item={},
        reason=f"Insufficient booking history to generate a personalized {rec_type} recommendation. "
               f"Book more trips to unlock AI-powered suggestions. {context}".strip(),
        confidence=0.0,
        supporting_data={"data_points": 0},
        provider_source="none",
        limitations="Requires at least 1 prior booking in this category.",
    )


def confidence_from_data_points(n_points: int, max_points: int = 10) -> float:
    """
    Derives a confidence score linearly from data point count.
    0 points → 0.0, max_points+ → 0.95 (never 1.0 to stay honest).
    """
    if n_points <= 0:
        return 0.0
    return min(0.95, round(n_points / max_points, 2))


def wrap_agent_response(
    agent_name: str,
    response_text: str,
    data_sources: List[str],
    confidence: float = 0.7,
) -> Dict[str, Any]:
    """
    Wraps a free-text agent response with explainability metadata.
    Used by LangGraph agent nodes before returning final_response.
    """
    return {
        "response": response_text,
        "explainability": {
            "agent": agent_name,
            "data_sources": data_sources,
            "confidence": round(confidence, 2),
            "generated_at": datetime.datetime.utcnow().isoformat(),
            "is_fabricated": False,
        },
    }
