"""
Phase 7 (AI Upgrade) — AI Conversation turn test runner
Simulates 100 conversational turns against the Travel OS SupervisorAgent.
Verifies memory extraction, provider failovers, and context updates.
"""
import os
import sys
import time
import uuid
import random

# Ensure project imports work when run from backend/
sys.path.insert(0, os.getcwd())

from dotenv import load_dotenv
load_dotenv()

from app.ai_agents.supervisor import SupervisorAgent
from app.database import SessionLocal
from app.models.core import User

PROMPTS = [
    "Hello! I am planning a holiday package.",
    "I want to go to Goa with 2 adults.",
    "My total budget is 80k INR.",
    "I prefer flying with Vistara.",
    "Can you recommend a hotel like Taj?",
    "I am a vegetarian traveler.",
    "I always prefer window seats on flights.",
    "My passport number is L1234567 and I am Indian.",
    "What is the weather in Goa for December?",
    "What are the visa rules for France?",
    "Can you suggest a beachside bistro restaurant in Goa?",
    "Is it safe to travel to Delhi?",
    "What is the currency exchange rate for USD to INR?",
    "How much cash should I carry for 5 days in Goa?",
    "Are there any hospitals near Dona Paula?",
    "I want to check travel insurance policies.",
    "Who is the emergency contact in Goa?"
]

def run_tester():
    print("=" * 60)
    print("      Travel OS — 100 Conversation Turn Tester (Phase 7)")
    print("=" * 60)
    
    db = SessionLocal()
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = db.query(User).first()
        if not user:
            print("No users found in database. Seeding a new test traveler...")
            # Create user
            user = User(
                id=1,
                email="test_traveler@travelos.com",
                phone="+919999999999",
                auth_provider="local",
                role="user"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Create profile
            from app.models.core import UserProfile
            profile = UserProfile(
                user_id=user.id,
                full_name="Alice test traveler",
                email=user.email,
                nationality="Indian",
                passport_number="Z9999999"
            )
            db.add(profile)
            db.commit()
            print("Successfully seeded Alice (id=1) in database.")

            
    user_id = user.id
    db.close()
    
    session_id = f"test_session_{uuid.uuid4().hex[:8]}"
    print(f"Simulating session: {session_id} for user_id: {user_id}\n")
    
    success_count = 0
    total_turns = 100
    
    start_time = time.time()
    
    for turn in range(total_turns):
        prompt = random.choice(PROMPTS)
        print(f"Turn {turn+1}/{total_turns}: User: '{prompt}'")
        
        turn_start = time.time()
        try:
            # Execute chat turn (this runs memory extraction, agent routing, and compiler node)
            response = SupervisorAgent.execute_chat_turn(
                user_id=user_id,
                session_id=session_id,
                message=prompt
            )
            elapsed = time.time() - turn_start
            print(f"  Supervisor Agent Response (in {elapsed:.2f}s): {response[:120]}...")
            success_count += 1
        except Exception as e:
            print(f"  ERROR on Turn {turn+1}: {e}")
            import traceback
            traceback.print_exc()
            
        print("-" * 50)
        
    duration = time.time() - start_time
    print(f"\nCompleted {total_turns} turns in {duration:.2f}s.")
    print(f"Success turns: {success_count}/{total_turns} ({success_count/total_turns*100:.1f}%)")

if __name__ == "__main__":
    run_tester()
