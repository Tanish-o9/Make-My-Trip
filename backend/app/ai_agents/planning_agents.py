import json
import logging
from typing import Dict, Any
from app.ai_agents.state import AgentState, log_agent_execution
from app.ai_router.router import llm_router
from app.ai_tools.weather_tool import weather_search_tool
from app.ai_tools.flight_tool import flight_search_tool
from app.ai_tools.hotel_tool import hotel_search_tool

logger = logging.getLogger(__name__)

# Destination cost baseline lookup
DESTINATION_COSTS = {
    "goa": {"flight_avg": 6000, "hotel_avg_per_night": 3000, "daily_expenses": 1500},
    "bali": {"flight_avg": 25000, "hotel_avg_per_night": 5000, "daily_expenses": 3000},
    "delhi": {"flight_avg": 4000, "hotel_avg_per_night": 2500, "daily_expenses": 1200},
    "mumbai": {"flight_avg": 4000, "hotel_avg_per_night": 4000, "daily_expenses": 2000},
}

@log_agent_execution("budget_planning_agent")
def budget_planning_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Agent node to parse total budget and split it across categories, raising warnings if unrealistic"""
    from app.ai_agents.supervisor import report_agent_status
    report_agent_status(config, "Budget Agent: Analyzing expenses and splitting allocations...")
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""

    # Parse constraints from trip_context (no LLM call)
    import re as _re
    trip_ctx = state.get("trip_context", {})
    budget_c = state.get("budget_constraints", {})

    destination = trip_ctx.get("destination") or "Goa"
    duration_days = trip_ctx.get("duration_days")
    if not duration_days:
        m = _re.search(r'(\d+)\s+(?:days?|nights?)', user_query, _re.IGNORECASE)
        duration_days = int(m.group(1)) if m else 5
    duration_days = int(duration_days)

    total_budget = budget_c.get("total_budget")
    if not total_budget:
        m = _re.search(r'(?:₹|rs\.?\s*|inr\s*)(\d[\d,]*)|([\d,]+)\s*(?:rupees?|inr)', user_query, _re.IGNORECASE)
        if m:
            raw = (m.group(1) or m.group(2) or "").replace(",", "")
            try:
                total_budget = float(raw)
            except Exception:
                total_budget = 25000.0
        else:
            total_budget = 25000.0
    total_budget = float(total_budget)



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

    collected = dict(state.get("collected_data") or {})
    collected["budget"] = budget_constraints

    return {
        "final_response": result_text,
        "budget_constraints": budget_constraints,
        "collected_data": collected,
        "messages": [{"role": "assistant", "content": result_text}]
    }


@log_agent_execution("trip_planner_agent")
def trip_planner_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Orchestrates flight + hotel options and aligns them under budget constraints"""
    from app.ai_agents.supervisor import report_agent_status
    
    context = state.get("trip_context", {})
    budget = state.get("budget_constraints", {})

    destination = context.get("destination")
    origin = context.get("origin")
    departure_date = context.get("departure_date")
    return_date = context.get("return_date")
    total_budget = budget.get("total_budget")
    passengers = context.get("passengers") or 1
    travel_style = context.get("travel_style") or "general"
    cabin_class = context.get("cabin_class") or "ECONOMY"
    hotel_tier = context.get("hotel_tier") or "MIDRANGE"

    # Check for missing parameters
    missing = []
    if not destination or destination == "...":
        missing.append("Destination")
    if not origin or origin == "...":
        missing.append("Origin departure city (e.g. Delhi, DEL)")
    if not departure_date or departure_date == "...":
        missing.append("Departure date")
    if not return_date or return_date == "...":
        missing.append("Return date")
    if not total_budget:
        missing.append("Trip budget (in INR)")

    if missing:
        missing_list_str = "\n".join([f"- **{m}**" for m in missing])
        response_text = f"""### Welcome to Travel OS AI Consultant! 🌍

I see you want to plan a trip, but I need a few more details to customize the perfect package for you. Could you please provide:

{missing_list_str}

Once you give me this information, I will instantly fetch everything for you.
"""
        return {
            "final_response": response_text,
            "messages": [{"role": "assistant", "content": response_text}]
        }

    report_agent_status(config, f"AI Travel Consultant: Searching flights from {origin} to {destination}...")
    flights_res = flight_search_tool(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        passengers=passengers,
        cabin_class=cabin_class
    )
    
    report_agent_status(config, f"AI Travel Consultant: Searching hotel accommodations in {destination}...")
    hotels_res = hotel_search_tool(
        destination=destination,
        check_in=departure_date,
        check_out=return_date,
        guests=passengers,
        budget_tier=hotel_tier
    )

    report_agent_status(config, f"AI Travel Consultant: Retrieving weather forecast for {destination}...")
    weather_res = weather_search_tool(destination, month=12)

    # 1. Map Flight schema to match frontend requirements
    raw_flights = flights_res.get("results", [])
    mapped_flights = []
    for fl in raw_flights[:3]:  # Top 3 options
        mapped_flights.append({
            "airline": fl.get("airline"),
            "flight_number": fl.get("flight_number"),
            "dep": f"{fl.get('origin')} {fl.get('departure_time')[11:16] if fl.get('departure_time') else '08:00'}",
            "arr": f"{fl.get('destination')} {fl.get('arrival_time')[11:16] if fl.get('arrival_time') else '10:30'}",
            "price": float(fl.get("price_per_passenger") or fl.get("total_price") or 0.0),
            "duration": fl.get("duration_minutes", 150)
        })

    # 2. Map Hotel schema to match frontend requirements
    raw_hotels = hotels_res.get("results", [])
    mapped_hotels = []
    for ht in raw_hotels[:3]:  # Top 3 options
        mapped_hotels.append({
            "name": ht.get("name"),
            "rating": str(ht.get("rating", "4.5")),
            "amenities": ht.get("amenities", []),
            "price": float(ht.get("price_per_night") or ht.get("total_price") or 0.0),
            "total_price": float(ht.get("total_price", 0.0))
        })

    report_agent_status(config, "AI Travel Consultant: Planning day-by-day slots...")
    
    # Calculate duration
    try:
        from datetime import datetime
        n_days = (datetime.strptime(return_date, "%Y-%m-%d") - datetime.strptime(departure_date, "%Y-%m-%d")).days
        if n_days <= 0: n_days = 3
    except Exception:
        n_days = 3

    # Generate Itinerary using LLM
    itin_generation_prompt = f"""
    You are the Itinerary Planning Expert. Generate a day-by-day travel plan for a {n_days} days trip to {destination}.
    Weather: {weather_res.get("forecast_description")}
    Travel style: {travel_style}
    
    Provide a detailed conversational response detailing highlights.
    Additionally, you MUST output a JSON block inside a ```itinerary-data code block at the bottom containing an array of day objects:
    [
      {{
        "day": 1,
        "title": "...",
        "morning": "...",
        "afternoon": "...",
        "evening": "..."
      }},
      ...
    ]
    """
    itin_text = llm_router.complete(prompt=itin_generation_prompt, task_type="creative")

    # Synthesize the final comprehensive response
    package_synthesis_prompt = f"""
    You are a senior travel consultant compiling a complete travel package for the user.
    Destination: {destination}
    Origin: {origin}
    Dates: {departure_date} to {return_date} ({n_days} Days)
    Budget: ₹{total_budget:,}
    Passengers: {passengers}
    Travel Style: {travel_style}
    
    Here are the search details:
    - Flights: {json.dumps(mapped_flights, default=str)}
    - Hotels: {json.dumps(mapped_hotels, default=str)}
    - Weather: {weather_res.get("forecast_description")}
    - Itinerary Details: {itin_text}
    
    Write a professional, highly detailed travel proposal. 
    Include sections with icons:
    - 🗺️ Itinerary Highlights & Local Tips
    - ☀️ Weather & Packing Guide
    - 💰 Budget Optimization & Breakdown
    - 💎 Hidden Gems & Dinings (recommend local restaurants)
    """
    final_response = llm_router.complete(prompt=package_synthesis_prompt, task_type="reasoning")

    # Inject metadata blocks
    final_response += f"\n\n```flights-data\n{json.dumps(mapped_flights, indent=2, default=str)}\n```"
    final_response += f"\n\n```hotels-data\n{json.dumps(mapped_hotels, indent=2, default=str)}\n```"

    itin_arr = []
    for d in range(1, n_days + 1):
        itin_arr.append({
            "day": d,
            "title": f"Explore {destination}",
            "morning": f"Start the day exploring {destination} highlights.",
            "afternoon": "Enjoy local lunch and shopping.",
            "evening": "Wind down with dinner and sunset views."
        })
    final_response += f"\n\n```itinerary-data\n{json.dumps(itin_arr, indent=2, default=str)}\n```"

    updated_context = dict(state.get("trip_context", {}))
    updated_context.update({
        "last_flight_search_results": raw_flights,
        "last_hotel_search_results": raw_hotels,
        "destination": destination,
        "origin": origin,
        "departure_date": departure_date,
        "return_date": return_date,
        "passengers": passengers
    })

    collected = dict(state.get("collected_data") or {})
    collected["flights"] = mapped_flights
    collected["hotels"] = mapped_hotels
    collected["itinerary"] = itin_arr

    return {
        "final_response": final_response,
        "trip_context": updated_context,
        "collected_data": collected,
        "messages": [{"role": "assistant", "content": final_response}]
    }


@log_agent_execution("itinerary_generator_agent")
def itinerary_generator_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Generates day-by-day slots (morning/afternoon/evening), respecting local weather alerts"""
    from app.ai_agents.supervisor import report_agent_status
    report_agent_status(config, "Itinerary Agent: Designing daily schedules adjusted to climate conditions...")
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

    try:
        import re
        match = re.search(r"(\[[\s\S]*?\])", itinerary_text)
        if match:
            itin_arr = json.loads(match.group(1))
        else:
            itin_arr = []
    except Exception:
        itin_arr = []

    collected = dict(state.get("collected_data") or {})
    collected["itinerary"] = itin_arr

    return {
        "final_response": itinerary_text,
        "collected_data": collected,
        "messages": [{"role": "assistant", "content": itinerary_text}]
    }
