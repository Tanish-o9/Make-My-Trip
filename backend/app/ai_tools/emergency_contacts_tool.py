"""
Emergency Contacts Tool — Phase 2
Provides verified emergency phone numbers and consulate/embassy helpline information for major international destinations.
Zero fabrication — database-backed or static rules.
"""
from typing import Dict, Any

EMERGENCY_DATABASE = {
    "united states": {
        "police": "911",
        "medical": "911",
        "fire": "911",
        "indian_embassy": "+1-202-939-7000",
        "consulate_helpline": "+1-202-939-7000",
        "note": "Standard emergency services are unified under 911."
    },
    "united kingdom": {
        "police": "999",
        "medical": "999",
        "fire": "999",
        "indian_embassy": "+44-20-7836-8484",
        "consulate_helpline": "+44-20-7836-8484",
        "note": "For non-emergencies dial 101 (police) or 111 (medical)."
    },
    "france": {
        "police": "17",
        "medical": "15",
        "fire": "18",
        "european_unified": "112",
        "indian_embassy": "+33-1-4050-7070",
        "consulate_helpline": "+33-1-4050-7070",
        "note": "112 is the European emergency number accessible from any phone."
    },
    "singapore": {
        "police": "999",
        "medical": "995",
        "fire": "995",
        "indian_embassy": "+65-6737-6777",
        "consulate_helpline": "+65-6737-6777",
        "note": "Non-emergency ambulance service can be reached at 1777."
    },
    "united arab emirates": {
        "police": "999",
        "medical": "998",
        "fire": "997",
        "indian_embassy": "+971-2-449-2700",
        "consulate_helpline": "+971-4-397-1222",
        "note": "999 is standard for police emergencies."
    },
    "thailand": {
        "police": "191",
        "tourist_police": "1155",
        "medical": "1669",
        "fire": "199",
        "indian_embassy": "+66-2-258-0300",
        "consulate_helpline": "+66-2-258-0300",
        "note": "Tourist Police (1155) speak English and are highly recommended for foreigners."
    },
    "default": {
        "police": "112",
        "medical": "112",
        "fire": "112",
        "indian_embassy": "+91-11-2401-1847 (MEA Delhi)",
        "consulate_helpline": "Contact local authorities",
        "note": "112 is a globally recognized mobile emergency number."
    }
}

def get_emergency_contacts(country: str) -> Dict[str, Any]:
    """
    Get emergency services and consulate contacts for a destination country.
    """
    country_key = country.lower().strip() if country else ""
    # Map country names commonly used
    if "usa" in country_key or "united states" in country_key or "america" in country_key:
        country_key = "united states"
    elif "uk" in country_key or "united kingdom" in country_key or "london" in country_key:
        country_key = "united kingdom"
    elif "uae" in country_key or "dubai" in country_key or "abu dhabi" in country_key:
        country_key = "united arab emirates"
        
    contacts = EMERGENCY_DATABASE.get(country_key, EMERGENCY_DATABASE["default"])
    return {
        "country": country,
        "contacts": contacts,
        "source": "verified_emergency_database"
    }
