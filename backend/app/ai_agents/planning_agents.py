import json
import logging
from typing import Dict, Any
from app.ai_agents.state import AgentState, log_agent_execution
from app.ai_router.router import llm_router
from app.ai_tools.weather_tool import weather_search_tool

logger = logging.getLogger(__name__)

# Destination cost baseline lookup
DESTINATION_COSTS = {
    "goa": {"flight_avg": 6000, "hotel_avg_per_night": 3000, "daily_expenses": 1500},
    "bali": {"flight_avg": 25000, "hotel_avg_per_night": 5000, "daily_expenses": 3000},
    "delhi": {"flight_avg": 4000, "hotel_avg_per_night": 2500, "daily_expenses": 1200},
    "mumbai": {"flight_avg": 4000, "hotel_avg_per_night": 4000, "daily_expenses": 2000},
}

@log_agent_execution("budget_planning_agent")
def budget_planning_node(state: AgentState) -> dict:
    """Agent node to parse total budget and split it across categories, raising warnings if unrealistic"""
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""

    # Parse constraints
    extraction_prompt = f"""
Extract budget details from the user prompt:
Prompt: "{user_query}"
Current Context: {json.dumps(state.get("trip_context", {}))}

Output ONLY a JSON block:
- destination (string)
- duration_days (int)
- total_budget (float)

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
    duration_days = params.get("duration_days") or state.get("trip_context", {}).get("duration_days") or 5
    total_budget = params.get("total_budget") or state.get("budget_constraints", {}).get("total_budget") or 25000.0

    # Look up baseline costs
    dest_key = destination.lower().strip()
    baseline = DESTINATION_COSTS.get(dest_key, {"flight_avg": 5000, "hotel_avg_per_night": 3500, "daily_expenses": 1500})

    est_flight = baseline["flight_avg"]
    est_hotel = baseline["hotel_avg_per_night"] * duration_days
    est_daily = baseline["daily_expenses"] * duration_days
    min_required = est_flight + est_hotel + est_daily

    is_realistic = total_budget >= min_required
    warning = ""
    if not is_realistic:
        warning = f"WARNING: A budget of ₹{total_budget:,} for {duration_days} days in {destination} is tight. Minimum estimated is ₹{min_required:,}."

    # Split budget
    flight_share = int(total_budget * 0.3)
    hotel_share = int(total_budget * 0.35)
    activities_share = int(total_budget * 0.15)
    food_transport_share = int(total_budget * 0.2)

    breakdown = {
        "flights": flight_share,
        "hotels": hotel_share,
        "activities": activities_share,
        "food_transport": food_transport_share,
        "unallocated": int(total_budget - (flight_share + hotel_share + activities_share + food_transport_share))
    }

    result_text = f"""
### Budget Analysis for {destination} ({duration_days} Days)
**Total Budget**: ₹{total_budget:,}
{warning if warning else "The budget is realistic and comfortable for this destination."}

**Proposed Allocation**:
- **Flights (30%)**: ₹{flight_share:,}
- **Accommodations (35%)**: ₹{hotel_share:,}
- **Activities (15%)**: ₹{activities_share:,}
- **Food & Local Transport (20%)**: ₹{food_transport_share:,}
"""

    budget_constraints = {
        "total_budget": float(total_budget),
        "is_realistic": is_realistic,
        "breakdown": breakdown,
        "warning": warning
    }

    return {
        "final_response": result_text,
        "budget_constraints": budget_constraints,
        "messages": [{"role": "assistant", "content": result_text}]
    }


@log_agent_execution("trip_planner_agent")
def trip_planner_node(state: AgentState) -> dict:
    """Orchestrates flight + hotel options and aligns them under budget constraints"""
    # Simply invoke Flight node and Hotel node behavior, combining results into one unified response
    # In a full LangGraph we do this by chaining, in this monolithic agent we can run both lookups and compile.
    context = state.get("trip_context", {})
    budget = state.get("budget_constraints", {})

    destination = context.get("destination") or "Goa"
    departure_date = context.get("departure_date") or "2026-12-15"
    return_date = context.get("return_date") or "2026-12-20"
    total_budget = budget.get("total_budget") or 25000.0

    # Compile itinerary skeleton
    skeleton_prompt = f"""
Synthesize a single coherent travel package recommendation.
Destination: {destination}
Dates: {departure_date} to {return_date}
Budget limit: ₹{total_budget:,}

Flight Details (if searched): {json.dumps(context.get("last_flight_search_results", []))}
Hotel Details (if searched): {json.dumps(context.get("last_hotel_search_results", []))}
Budget Splits: {json.dumps(budget.get("breakdown", {}))}

Provide a beautiful overview. Include a structural JSON block at the bottom of your response inside a ```trip-summary code block containing:
- destination
- dates
- flight_option (name, flight_number, price)
- hotel_option (name, price_per_night, price_total)
- remaining_budget
"""
    summary = llm_router.complete(prompt=skeleton_prompt, task_type="creative")

    return {
        "final_response": summary,
        "messages": [{"role": "assistant", "content": summary}]
    }


@log_agent_execution("itinerary_generator_agent")
def itinerary_generator_node(state: AgentState) -> dict:
    """Generates day-by-day slots (morning/afternoon/evening), respecting local weather alerts"""
    context = state.get("trip_context", {})
    destination = context.get("destination") or "Goa"
    duration = context.get("duration_days") or 3

    # Call weather intelligence
    weather = weather_search_tool(destination, month=12)
    weather_desc = weather.get("forecast_description", "")

    itinerary_prompt = f"""
You are the Itinerary Generator Agent.
Create a day-by-day travel plan (Morning, Afternoon, Evening slots) for a {duration} days trip to {destination}.
Note the weather forecast context: "{weather_desc}". If the weather indicates monsoons or extreme heat/cold, avoid scheduling heavy outdoor visits in those slots.

Provide a brief, beautiful day-by-day overview. Keep it extremely concise and direct. Do not include any programming code, python scripts, or system reasoning in your conversational text.
Include a structural JSON block at the bottom of your response inside a ```itinerary-data code block containing the exact day-by-day array structure so the UI can render cards.
"""
    itinerary_text = llm_router.complete(prompt=itinerary_prompt, task_type="creative")

    return {
        "final_response": itinerary_text,
        "messages": [{"role": "assistant", "content": itinerary_text}]
    }
