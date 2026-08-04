import json
import logging
from typing import Dict, Any
from app.ai_agents.state import AgentState, log_agent_execution
from app.ai_router.router import llm_router
from app.rag.retriever import rag_system
from app.ai_tools.weather_tool import weather_search_tool

logger = logging.getLogger(__name__)

@log_agent_execution("visa_assistant_agent")
def visa_assistant_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Uses RAG to find and explain visa requirements for destination countries"""
    from app.ai_agents.supervisor import report_agent_status
    report_agent_status(config, "Visa Assistant: Retrieving visa entry requirements...")
    
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
        import re
        match = re.search(r"(\{[\s\S]*?\})", extraction_str)
        if match:
            params = json.loads(match.group(1))
        else:
            clean_json = extraction_str.strip().strip("```json").strip("```").strip()
            params = json.loads(clean_json)
    except Exception:
        params = {}

    dest_country = params.get("destination_country") or "Schengen"
    citizenship = params.get("citizenship") or "India"
    
    # Query RAG
    rag_result = rag_system.rag_query(
        question=f"What are the visa requirements for a traveler from {citizenship} visiting {dest_country}?",
        filters={"country": dest_country.capitalize()},
        trace_id=state.get("trace_id", "visa_rag_trace")
    )

    answer = rag_result["answer"]
    
    prompt = f"""
You are the Senior Visa Consultant. Format the following visa rules into a highly structured advisory letter for the user.
Use emojis, lists, step-by-step application instructions, and processing times.
Destination: {dest_country}
Citizenship: {citizenship}
Visa Rules: {answer}
"""
    advisory = llm_router.complete(prompt=prompt, task_type="simple")
    
    return {
        "final_response": advisory,
        "messages": [{"role": "assistant", "content": advisory}]
    }


@log_agent_execution("weather_agent")
def weather_agent_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Fetches weather forecast and formats travel recommendations"""
    from app.ai_agents.supervisor import report_agent_status
    
    context = state.get("trip_context", {})
    destination = context.get("destination") or "Goa"
    
    report_agent_status(config, f"Weather Agent: Retrieving climate indicators for {destination}...")
    weather_results = weather_search_tool(destination, month=12)
    desc = weather_results.get("forecast_description", "")
    temp = weather_results.get("avg_temperature_c", 25)

    prompt = f"""
You are the Travel Weather Expert. Format a friendly weather briefing for a traveler visiting {destination} in December.
Current stats: {temp}°C, Forecast: {desc}

Provide a detailed packing checklist (clothing, footwear, accessories) based on these conditions. Use tables or checklists.
"""
    response = llm_router.complete(prompt=prompt, task_type="simple")
    return {
        "final_response": response,
        "messages": [{"role": "assistant", "content": response}]
    }


@log_agent_execution("local_guide_agent")
def local_guide_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Provides local travel tips, hidden gems, and local recommendations"""
    from app.ai_agents.supervisor import report_agent_status
    
    context = state.get("trip_context", {})
    destination = context.get("destination") or "Goa"

    report_agent_status(config, f"Local Guide: Compiling local attractions and shopping guide for {destination}...")
    prompt = f"""
You are the Senior Local Guide. Suggest 3 hidden gems, 2 traditional local delicacies/restaurants, and 2 unique shopping/cultural spots in {destination}.
Highlight exactly why each is special and the best time of day to visit. Make your response highly descriptive, engaging, and professional.
"""
    response = llm_router.complete(prompt=prompt, task_type="creative")
    return {
        "final_response": response,
        "messages": [{"role": "assistant", "content": response}]
    }
