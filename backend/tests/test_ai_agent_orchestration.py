import pytest
from app.ai_agents.supervisor import SupervisorAgent

@pytest.mark.anyio
async def test_ai_supervisor_orchestration_flight_hotel():
    user_msg = "Recommend Vistara flights from Delhi to Goa on 2026-12-15 with a budget of 40000"
    session_id = "test-session-agent-orchestrator"
    
    response = await SupervisorAgent.execute_chat_turn_async(
        user_id=1,
        session_id=session_id,
        message=user_msg
    )
    
    assert response is not None
    assert len(response) > 0

@pytest.mark.anyio
async def test_ai_agent_graceful_fallbacks():
    user_msg = "Plan a trip to UnknownCityABC on 2026-12-15"
    response = await SupervisorAgent.execute_chat_turn_async(
        user_id=1,
        session_id="test-session-fallback",
        message=user_msg
    )
    assert response is not None
    assert len(response) > 0
