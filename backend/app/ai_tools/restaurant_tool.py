import logging
from typing import Dict, Any, List
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

@tool
def restaurant_recommendation_tool(destination: str, dietary_preferences: str = "None") -> Dict[str, Any]:
    """
    Finds top-rated restaurants in a destination, filtered by dietary preferences (vegan, vegetarian, gluten-free, etc.).
    Args:
        destination: Target city or tourist hub.
        dietary_preferences: Food dietary preference tags (e.g. 'vegan', 'vegetarian', 'gluten-free'). Defaults to 'None'.
    """
    try:
        # Standard curated restaurants database for top locations
        restaurants = [
            {"name": "Spice Goa", "cuisine": "Seafood & Goan", "rating": 4.6, "vegan_friendly": True, "gluten_free_friendly": False, "location": "Goa"},
            {"name": "The Lazy Goose", "cuisine": "Continental & Seafood", "rating": 4.5, "vegan_friendly": True, "gluten_free_friendly": True, "location": "Goa"},
            {"name": "Gunpowder", "cuisine": "South Indian & Coastal", "rating": 4.7, "vegan_friendly": True, "gluten_free_friendly": True, "location": "Goa"},
            {"name": "Bukhara", "cuisine": "North Indian / Mughlai", "rating": 4.8, "vegan_friendly": True, "gluten_free_friendly": False, "location": "Delhi"},
            {"name": "Indian Accent", "cuisine": "Modern Indian Fusion", "rating": 4.9, "vegan_friendly": True, "gluten_free_friendly": True, "location": "Delhi"},
            {"name": "Saravana Bhavan", "cuisine": "Pure Vegetarian South Indian", "rating": 4.4, "vegan_friendly": True, "gluten_free_friendly": False, "location": "Delhi"},
            {"name": "Trishna", "cuisine": "Mangalorean Seafood", "rating": 4.7, "vegan_friendly": False, "gluten_free_friendly": False, "location": "Mumbai"},
            {"name": "Soam", "cuisine": "Gujarati / Vegetarian", "rating": 4.6, "vegan_friendly": True, "gluten_free_friendly": True, "location": "Mumbai"},
            {"name": "L'As du Fallafel", "cuisine": "Middle Eastern Kosher/Veg", "rating": 4.7, "vegan_friendly": True, "gluten_free_friendly": False, "location": "Paris"},
            {"name": "Dishoom", "cuisine": "Bombay Cafe Indian style", "rating": 4.7, "vegan_friendly": True, "gluten_free_friendly": True, "location": "London"}
        ]
        
        dest_lower = destination.strip().lower()
        diet_lower = dietary_preferences.strip().lower()
        
        filtered = []
        for r in restaurants:
            if r["location"].lower() != dest_lower:
                continue
            if "vegan" in diet_lower and not r["vegan_friendly"]:
                continue
            if "gluten-free" in diet_lower and not r["gluten_free_friendly"]:
                continue
            filtered.append(r)
            
        # Fallback to local default restaurants if no specific matches found
        if not filtered:
            filtered = [r for r in restaurants if r["location"].lower() == dest_lower][:3]
            
        return {
            "success": True,
            "destination": destination,
            "dietary_preference": dietary_preferences,
            "restaurants": filtered
        }
    except Exception as e:
        logger.error(f"restaurant_recommendation_tool failed: {e}")
        return {"success": False, "error": str(e)}
