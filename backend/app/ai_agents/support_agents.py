import json
import logging
from app.ai_agents.state import AgentState, log_agent_execution
from app.ai_router.router import llm_router
from app.rag.retriever import rag_system
from app.ai_tools.weather_tool import weather_search_tool

logger = logging.getLogger(__name__)

@log_agent_execution("visa_assistant_agent")
def visa_assistant_node(state: AgentState) -> dict:
    """Uses RAG to find and explain visa requirements for destination countries"""
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""

    # Classify nationality & target country via router
    extraction_prompt = f"""
Identify the destination country and user's citizenship from the prompt:
Prompt: "{user_query}"
Current Context: {json.dumps(state.get("trip_context", {}))}

Output ONLY a JSON block:
- destination_country (e.g. Schengen, USA, Thailand)
- citizenship (e.g. Indian, Canadian)

JSON:
"""
    extraction_str = llm_router.complete(prompt=extraction_prompt, task_type="simple")
    try:
        clean_json = extraction_str.strip().strip("```json").strip("```").strip()
        params = json.loads(clean_json)
    except Exception:
        params = {}

    dest_country = params.get("destination_country") or "Schengen"
    
    # Query RAG
    rag_result = rag_system.rag_query(
        question=f"What are the visa requirements for a traveler from {params.get('citizenship', 'India')} visiting {dest_country}?",
        filters={"country": dest_country.capitalize()},
        trace_id=state.get("trace_id", "visa_rag_trace")
    )

    answer = rag_result["answer"]
    return {
        "final_response": answer,
        "messages": [{"role": "assistant", "content": answer}]
    }


@log_agent_execution("weather_agent")
def weather_agent_node(state: AgentState) -> dict:
    """Fetches weather forecast and formats travel recommendations"""
    context = state.get("trip_context", {})
    destination = context.get("destination") or "Goa"
    
    weather_results = weather_search_tool(destination, month=12)
    desc = weather_results.get("forecast_description", "")
    temp = weather_results.get("avg_temperature_c", 25)

    prompt = f"""
Format a friendly weather briefing for a traveler visiting {destination} in December.
Current stats: {temp}°C, Forecast: {desc}
Suggest packing guidelines based on these conditions.
"""
    response = llm_router.complete(prompt=prompt, task_type="simple")
    return {
        "final_response": response,
        "messages": [{"role": "assistant", "content": response}]
    }


@log_agent_execution("local_guide_agent")
def local_guide_node(state: AgentState) -> dict:
    """Provides local travel tips, hidden gems, and local recommendations"""
    context = state.get("trip_context", {})
    destination = context.get("destination") or "Goa"

    prompt = f"""
You are the Local Guide Agent. Suggest 3 hidden gems and authentic local experiences in {destination} that standard tourists often miss.
Give a brief explanation for why each is special.
"""
    response = llm_router.complete(prompt=prompt, task_type="creative")
    return {
        "final_response": response,
        "messages": [{"role": "assistant", "content": response}]
    }
