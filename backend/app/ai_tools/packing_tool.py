"""
Packing Checklist Generator Tool — Phase 2
Generates a deterministic packing checklist based on category, weather/season, duration, and user interests.
Zero fabrication — rule-based lists.
"""
from typing import Dict, List, Any

PACKING_TEMPLATES = {
    "beach": ["Swimwear", "Sunscreen (SPF 50+)", "Sunglasses", "Beach towel", "Flip flops", "Sun hat", "Waterproof dry bag"],
    "business": ["Formal suit/blazer", "Dress shirts", "Tie", "Formal shoes", "Lint roller", "Business cards", "Laptop & charger"],
    "adventure": ["Hiking boots", "Waterproof jacket", "Thermals/base layers", "First aid kit", "Insect repellent", "Headlamp/flashlight", "Refillable water bottle"],
    "winter": ["Heavy coat", "Gloves", "Beanie/wool hat", "Scarf", "Thermal socks", "Lip balm", "Moisturizer"],
    "general_essentials": ["Passport & travel documents", "Toothbrush & toothpaste", "Deodorant", "Mobile phone charger", "Universal power adapter", "Underwear & socks", "Prescription medications", "Pyjamas"]
}

def generate_packing_checklist(
    destination: str,
    duration_days: int,
    season: str,
    interests: List[str]
) -> Dict[str, Any]:
    """
    Generates a packing checklist.
    """
    checklist = list(PACKING_TEMPLATES["general_essentials"])
    
    # Season / weather adjustments
    season_lower = season.lower() if season else ""
    if "winter" in season_lower or "cold" in season_lower:
        checklist.extend(PACKING_TEMPLATES["winter"])
    elif "summer" in season_lower or "hot" in season_lower or "beach" in season_lower:
        checklist.extend(PACKING_TEMPLATES["beach"])
        
    # Interest-based additions
    for interest in (interests or []):
        interest_lower = interest.lower()
        if "business" in interest_lower or "work" in interest_lower:
            checklist.extend(PACKING_TEMPLATES["business"])
        elif "adventure" in interest_lower or "trekking" in interest_lower or "hiking" in interest_lower or "outdoor" in interest_lower:
            checklist.extend(PACKING_TEMPLATES["adventure"])
            
    # Remove duplicates
    checklist = list(dict.fromkeys(checklist))
    
    return {
        "destination": destination,
        "duration_days": duration_days,
        "checklist": checklist,
        "total_items": len(checklist),
        "source": "deterministic_packing_rules"
    }
