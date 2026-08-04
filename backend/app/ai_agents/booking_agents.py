import json
import logging
from typing import Dict, Any
from app.ai_agents.state import AgentState, log_agent_execution
from app.ai_router.router import llm_router
from app.ai_tools.flight_tool import flight_search_tool
from app.ai_tools.hotel_tool import hotel_search_tool

logger = logging.getLogger(__name__)

@log_agent_execution("flight_search_agent")
def flight_search_node(state: AgentState) -> dict:
    """Agent node to parse requirements, call flight search, and summarize results"""
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""
    
    # 1. Parameter extraction via LLM Router (simple profile)
    extraction_prompt = f"""
Extract parameters for a flight search from the user query.
User Query: "{user_query}"
Current Trip Context: {json.dumps(state.get("trip_context", {}))}

Output ONLY a JSON block with these keys: 
- origin (e.g. DEL, BOM)
- destination (e.g. GOI, BLR)
- departure_date (YYYY-MM-DD)
- passengers (int, default 1)
- cabin_class (ECONOMY, BUSINESS, FIRST)

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
        logger.warning(f"Failed to parse extracted parameters: {extraction_str}")
        params = {}

    # Read from state trip_context if missing
    origin = params.get("origin") or state.get("trip_context", {}).get("origin") or "DEL"
    destination = params.get("destination") or state.get("trip_context", {}).get("destination") or "GOI"
    departure_date = params.get("departure_date") or state.get("trip_context", {}).get("departure_date") or "2026-12-15"
    passengers = params.get("passengers") or state.get("trip_context", {}).get("passengers") or 1
    cabin_class = params.get("cabin_class") or state.get("trip_context", {}).get("cabin_class") or "ECONOMY"

    # 2. Call Flight Search Tool
    from app.ai_agents.supervisor import report_agent_status
    report_agent_status(config, f"Flight Search Agent: Searching flights from {origin} to {destination}...")
    search_results = flight_search_tool(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        passengers=passengers,
        cabin_class=cabin_class
    )

    # Filter based on preferences
    avoided_airlines = []
    user_prefs = state.get("trip_context", {}).get("user_historical_preferences", [])
    for pref in user_prefs:
        if "avoid" in pref.lower():
            for air_name in ["Indigo", "Air India", "Vistara", "Akasa Air"]:
                if air_name.lower() in pref.lower():
                    avoided_airlines.append(air_name.lower())

    # Map to frontend keys
    raw_flights = search_results.get("results", [])
    mapped_flights = []
    for fl in raw_flights:
        airline_name = fl.get("airline", "")
        if airline_name.lower() in avoided_airlines:
            logger.info(f"Filtering out flight {fl.get('flight_number')} due to preference: avoid {airline_name}")
            continue
        mapped_flights.append({
            "airline": fl.get("airline"),
            "flight_number": fl.get("flight_number"),
            "dep": f"{fl.get('origin')} {fl.get('departure_time')[11:16] if fl.get('departure_time') else '08:00'}",
            "arr": f"{fl.get('destination')} {fl.get('arrival_time')[11:16] if fl.get('arrival_time') else '10:30'}",
            "price": float(fl.get("price_per_passenger") or fl.get("total_price") or 0.0),
            "duration": fl.get("duration_minutes", 150)
        })

    # 3. Summarize & Rank via LLM Router
    summary_prompt = f"""
You are the Flight Search Agent.
We found these flight options:
{json.dumps(mapped_flights)}

Briefly summarize the flight options. Keep your response short, conversational, and direct. Do not include any programming code, python scripts, or system reasoning inside the conversational summary.
Include a structural JSON block at the bottom of your response inside a ```flights-data code block containing the exact sorted flight array so the UI can render cards.
"""
    summary = llm_router.complete(prompt=summary_prompt, task_type="reasoning")
    
    # Ensure flights-data block exists
    if "```flights-data" not in summary:
        summary += f"\n\n```flights-data\n{json.dumps(mapped_flights, indent=2)}\n```"

    # Update state context
    updated_context = dict(state.get("trip_context", {}))
    updated_context.update({
        "origin": origin,
        "destination": destination,
        "departure_date": departure_date,
        "passengers": passengers,
        "cabin_class": cabin_class,
        "last_flight_search_results": raw_flights
    })

    return {
        "final_response": summary,
        "trip_context": updated_context,
        "messages": [{"role": "assistant", "content": summary}]
    }


@log_agent_execution("hotel_recommendation_agent")
def hotel_search_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Agent node to search accommodations and recommend them"""
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""

    # 1. Parameter extraction
    extraction_prompt = f"""
Extract parameters for a hotel search from the user query.
User Query: "{user_query}"
Current Trip Context: {json.dumps(state.get("trip_context", {}))}

Output ONLY a JSON block with these keys:
- destination (e.g. Goa, Delhi)
- check_in (YYYY-MM-DD)
- check_out (YYYY-MM-DD)
- guests (int, default 1)
- budget_tier (BUDGET, MIDRANGE, LUXURY)

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

    destination = params.get("destination") or state.get("trip_context", {}).get("destination") or "Goa"
    check_in = params.get("check_in") or state.get("trip_context", {}).get("departure_date") or "2026-12-15"
    check_out = params.get("check_out") or state.get("trip_context", {}).get("return_date") or "2026-12-20"
    guests = params.get("guests") or state.get("trip_context", {}).get("passengers") or 1
    budget_tier = params.get("budget_tier") or state.get("budget_constraints", {}).get("tier") or "MIDRANGE"

    # 2. Call Hotel Search Tool
    from app.ai_agents.supervisor import report_agent_status
    report_agent_status(config, f"Hotel Recommendation Agent: Searching hotels in {destination}...")
    search_results = hotel_search_tool(
        destination=destination,
        check_in=check_in,
        check_out=check_out,
        guests=guests,
        budget_tier=budget_tier
    )

    # Filter hotels based on preferences
    avoided_hotel_terms = []
    user_prefs = state.get("trip_context", {}).get("user_historical_preferences", [])
    for pref in user_prefs:
        if "avoid" in pref.lower() or "dislike" in pref.lower():
            for hot_term in ["hostel", "inn", "boutique", "palace", "resort"]:
                if hot_term.lower() in pref.lower():
                    avoided_hotel_terms.append(hot_term.lower())

    # Map to frontend keys
    raw_hotels = search_results.get("results", [])
    mapped_hotels = []
    for ht in raw_hotels:
        hotel_name = ht.get("name", "")
        should_avoid = False
        for term in avoided_hotel_terms:
            if term in hotel_name.lower():
                should_avoid = True
                break
        if should_avoid:
            logger.info(f"Filtering out hotel {hotel_name} due to preference")
            continue
        mapped_hotels.append({
            "name": ht.get("name"),
            "rating": str(ht.get("rating", "4.5")),
            "amenities": ht.get("amenities", []),
            "price": float(ht.get("price_per_night") or ht.get("total_price") or 0.0),
            "total_price": float(ht.get("total_price", 0.0))
        })

    # 3. Summarize & recommend via LLM Router
    summary_prompt = f"""
You are the Hotel Recommendation Agent.
We found these hotel options in {destination}:
{json.dumps(mapped_hotels)}

Briefly highlight the best properties. Keep your response short, warm, and highly concise. Do not include any programming code, python scripts, or system reasoning inside the conversational text.
Include a structural JSON block at the bottom of your response inside a ```hotels-data code block containing the exact hotel results array so the UI can render cards.
"""
    summary = llm_router.complete(prompt=summary_prompt, task_type="reasoning")

    # Ensure hotels-data block exists
    if "```hotels-data" not in summary:
        summary += f"\n\n```hotels-data\n{json.dumps(mapped_hotels, indent=2)}\n```"

    updated_context = dict(state.get("trip_context", {}))
    updated_context.update({
        "hotel_destination": destination,
        "check_in": check_in,
        "check_out": check_out,
        "last_hotel_search_results": raw_hotels
    })

    return {
        "final_response": summary,
        "trip_context": updated_context,
        "messages": [{"role": "assistant", "content": summary}]
    }
