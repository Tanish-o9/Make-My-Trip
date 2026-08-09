import logging
from typing import Dict, Any, List
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

@tool
def travel_insurance_recommendation_tool(destination: str, duration_days: int) -> Dict[str, Any]:
    """
    Recommends standard and premium travel insurance policies based on destination and duration.
    Args:
        destination: Destination country or city name.
        duration_days: Length of the trip in days.
    """
    try:
        # Standard mock coverage packages for Travel OS
        options = [
            {
                "package_name": "Travel Guard Lite",
                "premium_inr": max(450, 80 * duration_days),
                "medical_coverage_usd": 50000,
                "benefits": ["Emergency Medical", "Trip Curtailment", "Baggage Loss up to $500"]
            },
            {
                "package_name": "Travel Guard Gold",
                "premium_inr": max(950, 150 * duration_days),
                "medical_coverage_usd": 100000,
                "benefits": ["Premium Medical Cover", "Trip Cancellation up to $2000", "Baggage Loss up to $1000", "Flight Delay Cover"]
            },
            {
                "package_name": "Travel Guard Platinum (Recommended)",
                "premium_inr": max(1850, 280 * duration_days),
                "medical_coverage_usd": 250000,
                "benefits": ["Unlimited Medical Cover", "Trip Cancellation/Interruption full cover", "Baggage Loss up to $2500", "Missed Connection", "Adventure Sports Cover"]
            }
        ]
        return {
            "success": True,
            "destination": destination,
            "duration_days": duration_days,
            "insurance_options": options
        }
    except Exception as e:
        logger.error(f"travel_insurance_recommendation_tool failed: {e}")
        return {"success": False, "error": str(e)}
