import logging
from typing import Dict, Any
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

@tool
def emergency_helpline_tool(destination: str) -> Dict[str, Any]:
    """
    Returns verified emergency numbers (police, fire, ambulance) and nearest embassy details for a destination.
    Args:
        destination: Destination city or country name (e.g. 'Delhi', 'Goa', 'Paris', 'London').
    """
    helplines = {
        "goa": {
            "police": "112 / 100",
            "ambulance": "108 / 102",
            "fire": "101",
            "tourist_helpline": "1800-233-5060",
            "nearest_hospital": "Manipal Hospital, Dona Paula (Ph: +91 832 304 8888)"
        },
        "delhi": {
            "police": "112 / 100",
            "ambulance": "102 / 108",
            "fire": "101",
            "tourist_helpline": "1363",
            "nearest_hospital": "Max Super Speciality Hospital, Saket (Ph: +91 11 2651 5050)"
        },
        "mumbai": {
            "police": "112 / 100",
            "ambulance": "102 / 108",
            "fire": "101",
            "tourist_helpline": "1363",
            "nearest_hospital": "Kokilaben Dhirubhai Ambani Hospital, Andheri (Ph: +91 22 3099 9999)"
        },
        "paris": {
            "police": "17 (or General Europe Emergency 112)",
            "ambulance": "15",
            "fire": "18",
            "embassy_india": "Indian Embassy Paris, 15 Rue Alfred Dehodencq (Ph: +33 1 40 50 70 70)"
        },
        "london": {
            "police": "999 (or General Europe Emergency 112)",
            "ambulance": "999",
            "fire": "999",
            "embassy_india": "High Commission of India, India House, Aldwych (Ph: +44 20 7836 8484)"
        }
    }
    
    dest_lower = destination.strip().lower()
    data = helplines.get(dest_lower) or {
        "police": "112 (International GSM standard)",
        "ambulance": "112",
        "fire": "112",
        "notes": f"Verify local emergency contact protocols on arrival at {destination}."
    }
    
    return {
        "success": True,
        "destination": destination,
        "helpline_details": data
    }
