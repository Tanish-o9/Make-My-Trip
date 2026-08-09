import json
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.core import UserProfile, TravelPreference
from app.memory.memory_manager import MemoryManager
from app.ai_router.router import llm_router

logger = logging.getLogger(__name__)

class ProfileMemoryExtractor:
    """
    Production-grade conversational entity extraction & memory manager.
    Automatically extracts:
      - Destination, Budget, Passengers, Dates (Trip context)
      - Seat, Meal, Airline, Hotel (Travel preferences)
      - Passport, Nationality (User profile info)
    And updates PostgreSQL + ChromaDB.
    """
    
    @classmethod
    def extract_and_remember(cls, user_id: int, session_id: str, message: str) -> Dict[str, Any]:
        """
        Runs an extraction LLM prompt on the user message.
        If entities are found, they are permanently stored in the DB & ChromaDB memory collections.
        """
        prompt = f"""
        Extract travel entities from this user message. Return ONLY a JSON block with these keys:
        - destination (string or null)
        - budget (float/int or null)
        - passengers (int or null)
        - dates (string or null, e.g. YYYY-MM-DD or range)
        - seat (string or null, e.g. window, aisle)
        - meal (string or null, e.g. vegetarian, vegan, kosher)
        - airline (string or null, e.g. Indigo, Air India)
        - hotel (string or null, e.g. Taj, Marriott)
        - passport (string or null)
        - nationality (string or null)

        User Message: "{message}"

        JSON:
        """
        
        extracted = {}
        try:
            # Query the LLM router
            res_str = llm_router.complete(prompt=prompt, task_type="simple").strip()
            import re
            res_str = re.sub(r'^```[a-z]*\n?', '', res_str, flags=re.MULTILINE)
            res_str = res_str.replace('```', '').strip()
            match = re.search(r'(\{[\s\S]*\})', res_str)
            extracted = json.loads(match.group(1)) if match else json.loads(res_str)
        except Exception as e:
            logger.debug(f"LLM entity extraction skipped/failed: {e}. Fallback to regex matches.")
            return {}

        if not extracted or not isinstance(extracted, dict):
            return {}

        logger.info(f"[ENTITY EXTRACTION] Found travel attributes: {extracted}")

        # Sync database changes
        db: Session = SessionLocal()
        try:
            # 1. Update TravelPreference (seat, meal, airline, hotel)
            pref = db.query(TravelPreference).filter(TravelPreference.user_id == user_id).first()
            if not pref:
                pref = TravelPreference(user_id=user_id)
                db.add(pref)
            
            updated_prefs = []
            if extracted.get("airline"):
                pref.preferred_airline = extracted["airline"]
                updated_prefs.append(f"Preferred airline: {extracted['airline']}")
            if extracted.get("hotel"):
                pref.preferred_hotel_chain = extracted["hotel"]
                updated_prefs.append(f"Preferred hotel chain: {extracted['hotel']}")
            if extracted.get("meal"):
                pref.meal_preference = extracted["meal"]
                updated_prefs.append(f"Meal preference: {extracted['meal']}")
            if extracted.get("seat"):
                pref.seat_preference = extracted["seat"]
                updated_prefs.append(f"Seat preference: {extracted['seat']}")

            # Save learned preferences to ChromaDB vector store
            for p_text in updated_prefs:
                MemoryManager.save_user_preference(
                    user_id=user_id,
                    preference_text=p_text,
                    category="travel_preference"
                )

            # 2. Update UserProfile (passport, nationality)
            profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
            if not profile:
                # Get user email
                from app.models.core import User
                user_obj = db.query(User).filter(User.id == user_id).first()
                profile = UserProfile(user_id=user_id, full_name="Traveler", email=user_obj.email if user_obj else None)
                db.add(profile)

            if extracted.get("passport"):
                profile.passport_number = extracted["passport"]
                MemoryManager.save_user_preference(
                    user_id=user_id,
                    preference_text=f"Passport Number: {extracted['passport']}",
                    category="document"
                )
            if extracted.get("nationality"):
                profile.nationality = extracted["nationality"]
                MemoryManager.save_user_preference(
                    user_id=user_id,
                    preference_text=f"Nationality: {extracted['nationality']}",
                    category="general"
                )

            db.commit()
        except Exception as db_err:
            logger.error(f"Error persisting extracted memory entities to SQL: {db_err}")
            db.rollback()
        finally:
            db.close()

        # 3. Cache extracted context coordinates and values in short-term MemoryManager
        try:
            active_context = MemoryManager.get_active_context(session_id) or {}
            trip_context = active_context.get("trip_context", {})
            budget_c = active_context.get("budget_constraints", {})

            # Update context parameters
            if extracted.get("destination"):
                trip_context["destination"] = extracted["destination"].strip().capitalize()
            if extracted.get("budget"):
                budget_c["total_budget"] = float(extracted["budget"])
            if extracted.get("passengers"):
                trip_context["passengers"] = int(extracted["passengers"])
            if extracted.get("dates"):
                trip_context["dates"] = str(extracted["dates"])

            active_context["trip_context"] = trip_context
            active_context["budget_constraints"] = budget_c
            MemoryManager.save_active_context(session_id, active_context, user_id)
        except Exception as ctx_err:
            logger.error(f"Error updating active context cache: {ctx_err}")

        return extracted
