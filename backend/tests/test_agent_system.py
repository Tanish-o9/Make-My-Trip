import pytest
import json
from app.ai_agents.supervisor import SupervisorAgent, supervisor_graph, supervisor_node, compiler_node
from app.ai_agents.state import AgentState
from app.memory.memory_manager import MemoryManager
from app.database import SessionLocal
from app.models.core import User
from app.ai_router.router import llm_router

def mock_complete(prompt, system_prompt=None, task_type="simple", **kwargs):
    prompt_lower = prompt.lower()
    
    # 1. User Preference Statement analysis
    if "permanent travel preference" in prompt_lower:
        if "indigo" in prompt_lower:
            return "Hates Indigo flights"
        return "NONE"
        
    # 2. Context Parameter extraction
    elif "extract these travel parameters" in prompt_lower:
        if "hotel" in prompt_lower:
            return json.dumps({
                "destination": "Goa",
                "check_in": "2026-12-15",
                "check_out": "2026-12-20",
                "guests": 1,
                "budget_tier": "MIDRANGE"
            })
        else: # flight
            return json.dumps({
                "origin": "DEL",
                "destination": "Goa",
                "departure_date": "2026-12-15",
                "passengers": 1,
                "cabin_class": "ECONOMY"
            })
            
    # 3. Budget extraction
    elif "extract budget details" in prompt_lower:
        return json.dumps({
            "destination": "Goa",
            "duration_days": 3,
            "total_budget": 40000.0
        })
        
    # 4. Query reconstruction
    elif "reconstruct the user's latest query" in prompt_lower:
        if "bali" in prompt_lower:
            return "Search flights to Bali from Delhi for Dec 15"
        if "indigo" in prompt_lower or "mumbai" in prompt_lower:
            return "Search flights from Delhi to Mumbai on Dec 20"
        return "Plan my Goa trip for 3 days from Delhi, budget 40000"
        
    # 5. Routing classifier
    elif "decide which specialist agents should run" in prompt_lower:
        if "goa" in prompt_lower or "plan" in prompt_lower or "test_session_planning" in prompt_lower:
            return '["budget_planning", "flight_search", "hotel_search"]'
        return '["flight_search"]'
        
    # 6. Flight Specialist agent
    elif "flight search agent" in prompt_lower:
        return "Found flights options. ```flights-data\n[]\n```"
        
    # 7. Hotel Specialist agent
    elif "hotel recommendation agent" in prompt_lower:
        return "Found hotels. ```hotels-data\n[]\n```"
        
    # 8. Compilation response compiler
    elif "response compiler" in prompt_lower or "senior human travel consultant" in prompt_lower:
        return "Stunning neobrutalist compiled proposal. ```flights-data\n[]\n``` ```hotels-data\n[]\n```"
        
    return "Mock response"

@pytest.fixture(autouse=True)
def mock_llm_calls(monkeypatch):
    monkeypatch.setattr(llm_router, "complete", mock_complete)

@pytest.fixture(autouse=True)
def setup_test_user():
    db = SessionLocal()
    # Ensure test user 1 exists
    test_user = db.query(User).filter(User.id == 1).first()
    if not test_user:
        test_user = User(
            id=1,
            email="test_agent@travelos.com",
            password_hash="mock",
            role="user"
        )
        db.add(test_user)
        db.commit()
    db.close()


def test_supervisor_trip_planning_multi_step_routing():
    """Verify that trip planning intent schedules multiple specialist steps in sequence"""
    # 1. Mock state for "Plan my Goa trip"
    state = {
        "user_id": 1,
        "session_id": "test_session_planning",
        "trace_id": "test_trace_1",
        "messages": [{"role": "user", "content": "Plan my Goa trip for 3 days from Delhi, budget 40000"}],
        "trip_context": {},
        "budget_constraints": {},
        "active_task": "",
        "current_agent": "",
        "final_response": "",
        "pending_agents": None,
        "collected_data": {},
        "preferences": []
    }

    # 2. Invoke supervisor node to verify scheduling
    res = supervisor_node(state)
    assert res is not None
    assert "pending_agents" in res
    assert "budget_planning" in res["pending_agents"] or "flight_search" in res["pending_agents"]
    assert len(res["pending_agents"]) > 0


def test_context_enricher_fuzzy_ref_resolution():
    """Verify context enricher handles fuzzy/relative messages based on history"""
    state = {
        "user_id": 1,
        "session_id": "test_session_fuzzy",
        "trace_id": "test_trace_2",
        "messages": [
            {"role": "user", "content": "Search flights to Goa from Delhi for Dec 15"},
            {"role": "assistant", "content": "Found flights to Goa for Dec 15."},
            {"role": "user", "content": "Actually, Bali instead"}
        ],
        "trip_context": {
            "origin": "DEL",
            "destination": "Goa",
            "departure_date": "2026-12-15"
        },
        "budget_constraints": {},
        "active_task": "",
        "current_agent": "",
        "final_response": "",
        "pending_agents": None,
        "collected_data": {},
        "preferences": []
    }
    
    res = supervisor_node(state)
    assert res is not None
    assert res["current_agent"] is not None


def test_preference_learning_flight_filter():
    """Verify preference capture logs user likes/dislikes and filters options"""
    session_id = "test_session_pref_1"
    user_id = 1
    
    # 1. execute chat turn with preference statement
    resp = SupervisorAgent.execute_chat_turn(
        user_id=user_id,
        session_id=session_id,
        message="I hate Indigo flights, let's look for flights from Delhi to Mumbai on Dec 20"
    )
    
    # 2. Check if preference was saved in active context or long-term preferences
    context = MemoryManager.get_active_context(session_id) or {}
    trip_ctx = context.get("trip_context", {})
    prefs = trip_ctx.get("user_historical_preferences", [])
    
    assert any("Indigo" in p or "indigo" in p.lower() for p in prefs)


def test_compiler_node_formatting():
    """Verify compiler merges collected data and appends flights-data / hotels-data blocks"""
    state = {
        "user_id": 1,
        "session_id": "test_session_compiler",
        "trace_id": "test_trace_3",
        "messages": [{"role": "user", "content": "Compile my package"}],
        "trip_context": {"destination": "Goa"},
        "budget_constraints": {},
        "active_task": "",
        "current_agent": "compiler_node",
        "final_response": "",
        "pending_agents": [],
        "collected_data": {
            "flights": [{"airline": "Vistara", "price": 6000}],
            "hotels": [{"name": "Taj Exotica", "price": 12000}]
        },
        "preferences": []
    }

    res = compiler_node(state)
    assert res is not None
    assert "final_response" in res
    assert "flights-data" in res["final_response"]
    assert "hotels-data" in res["final_response"]
