"""
AI Recommendation Engine — Phase 5
Collaborative and content-based recommendation logic.
Recommends flights, hotels, and activities based on:
  - User preference profile (from PersonalConciergeAgent)
  - Booking history
  - Budget boundaries
Wraps output in ExplainableRecommendation envelopes (Phase 12).
"""
import logging
from typing import Dict, Any, List
from app.database import SessionLocal
from app.ai_agents.concierge import concierge_agent
from app.utils.explainability import explain_recommendation, insufficient_data_recommendation

logger = logging.getLogger(__name__)

class RecommendationEngine:
    def recommend_flights(self, user_id: int, destination: str) -> Dict[str, Any]:
        """Suggests a preferred flight or budget class based on user profile history."""
        profile_res = concierge_agent.get_explainable_recommendations(user_id)
        profile = profile_res["profile_summary"]
        
        if profile["preferred_airlines"]:
            top_airline = profile["preferred_airlines"][0]
            rec_item = {
                "airline_code": top_airline["airline"],
                "cabin_class": profile["preferred_cabin"],
                "destination": destination
            }
            explanation = explain_recommendation(
                rec_type="flight_recommendation",
                item=rec_item,
                reason=f"We recommend booking with {top_airline['airline']} in {profile['preferred_cabin'].title()} class "
                       f"because it matches your most frequent airline ({top_airline['share_pct']}% share) and cabin preference.",
                confidence=top_airline["confidence"],
                supporting_data={
                    "preferred_airline": top_airline,
                    "cabin_class": profile["preferred_cabin"]
                },
                provider_source="booking_history"
            )
            return explanation.to_dict()
        else:
            return insufficient_data_recommendation("flight_recommendation", "Try searching for domestic flight routes first.").to_dict()

    def recommend_hotels(self, user_id: int, destination: str) -> Dict[str, Any]:
        """Suggests hotels matching budget band and chain preferences."""
        profile_res = concierge_agent.get_explainable_recommendations(user_id)
        profile = profile_res["profile_summary"]

        if profile["preferred_hotel_chains"]:
            top_chain = profile["preferred_hotel_chains"][0]
            rec_item = {
                "hotel_brand": top_chain,
                "budget_tier": profile["budget_band"],
                "destination": destination
            }
            explanation = explain_recommendation(
                rec_type="hotel_recommendation",
                item=rec_item,
                reason=f"We recommend {top_chain} in {destination} because you have booked this chain before and it fits your '{profile['budget_band']}' budget profile.",
                confidence=0.85,
                supporting_data={
                    "historical_chain": top_chain,
                    "budget_band": profile["budget_band"]
                },
                provider_source="booking_history"
            )
            return explanation.to_dict()
        else:
            # Fallback based on budget band
            budget = profile["budget_band"]
            if budget == "unknown":
                budget = "mid"
            rec_item = {
                "hotel_brand": f"Standard {budget.title()} Hotel",
                "budget_tier": budget,
                "destination": destination
            }
            explanation = explain_recommendation(
                rec_type="hotel_recommendation",
                item=rec_item,
                reason=f"We suggest a {budget}-tier hotel in {destination} as a starting point. Book your first hotel to personalize this recommendation.",
                confidence=0.5,
                supporting_data={"budget_band": budget},
                provider_source="system_default"
            )
            return explanation.to_dict()

    def recommend_activities(self, user_id: int, destination: str) -> Dict[str, Any]:
        """Suggests activities matching travel style history."""
        profile_res = concierge_agent.get_explainable_recommendations(user_id)
        profile = profile_res["profile_summary"]
        
        # Determine activity category based on travel style or past history
        activity_type = "Sightseeing"
        if profile["budget_band"] == "luxury":
            activity_type = "Private Yacht / Wine Tasting"
        elif profile["budget_band"] == "budget":
            activity_type = "Free Walking Tours"

        rec_item = {
            "activity_type": activity_type,
            "destination": destination
        }
        
        explanation = explain_recommendation(
            rec_type="activity_recommendation",
            item=rec_item,
            reason=f"Suggested activity category for {destination}: {activity_type}. Derived from your '{profile['budget_band']}' budget preferences.",
            confidence=0.6,
            supporting_data={"budget_band": profile["budget_band"]},
            provider_source="system_inference"
        )
        return explanation.to_dict()

# Singleton
recommendation_engine = RecommendationEngine()
