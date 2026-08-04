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

Once you give me this information, I will instantly:
1. ✈️ **Search real flight deals** matching your dates.
2. 🏨 **Find top-rated hotel accommodations** within your budget.
3. 🗺️ **Generate a personalized day-by-day itinerary** adapted to local weather forecasts.
4. 💰 **Provide an optimized budget allocation**.

*Let's get started! Where are you traveling from and when?*
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

Do not include code syntax in the conversational part. Only at the very bottom inside the code blocks.
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
- Flights: {json.dumps(mapped_flights)}
- Hotels: {json.dumps(mapped_hotels)}
- Weather: {weather_res.get("forecast_description")}
- Itinerary Details: {itin_text}

Write a professional, highly detailed travel proposal. 
Include sections with icons:
- 🗺️ Itinerary Highlights & Local Tips
- ☀️ Weather & Packing Guide
- 💰 Budget Optimization & Breakdown
- 💎 Hidden Gems & Dinings (recommend local restaurants)

Do NOT include any flights-data, hotels-data, or itinerary-data blocks inside your main text. 
Instead, at the very bottom of your response, you MUST append:
1. A ```flights-data block containing the exact JSON array of mapped flights.
2. A ```hotels-data block containing the exact JSON array of mapped hotels.
3. A ```itinerary-data block containing the exact JSON array of the day-by-day itinerary.
"""
    final_response = llm_router.complete(prompt=package_synthesis_prompt, task_type="reasoning")

    # Inject the structural data blocks if they are missing or combine them
    if "```flights-data" not in final_response:
        final_response += f"\n\n```flights-data\n{json.dumps(mapped_flights, indent=2)}\n```"
    if "```hotels-data" not in final_response:
        final_response += f"\n\n```hotels-data\n{json.dumps(mapped_hotels, indent=2)}\n```"
    if "```itinerary-data" not in final_response:
        itin_arr = []
        for d in range(1, n_days + 1):
            itin_arr.append({
                "day": d,
                "title": f"Explore {destination}",
                "morning": f"Start the day exploring {destination} highlights.",
                "afternoon": "Enjoy local lunch and shopping.",
                "evening": "Wind down with dinner and sunset views."
            })
        final_response += f"\n\n```itinerary-data\n{json.dumps(itin_arr, indent=2)}\n```"

    # Inject Visa data block
    is_domestic = destination.lower() in ["goa", "delhi", "mumbai", "india", "jaipur", "kerala"]
    visa_info = {
        "destination_country": destination if not is_domestic else "India (Domestic)",
        "requirement_type": "Permit-free" if is_domestic else "Visa on Arrival / eVisa",
        "citizenship": "Indian",
        "processing_time": "Immediate" if is_domestic else "24-48 hours",
        "documents": ["Aadhar Card", "Voter ID", "Hotel Confirmation", "Flight Ticket"] if is_domestic else ["Valid Passport", "Return Flight Ticket", "Hotel Voucher", "Passport Photo"]
    }
    final_response += f"\n\n```visa-data\n{json.dumps(visa_info, indent=2)}\n```"

    # Inject Weather data block
    weather_info = {
        "avg_temp": "28" if destination.lower() == "goa" else "22",
        "forecast": f"Pleasant climate in {destination}. Perfect for sightseeing and local tours.",
        "packing_checklist": ["Sunglasses & Sunscreen", "Comfortable walking shoes", "Light cotton clothes", "Chargers & Adaptors"]
    }
    final_response += f"\n\n```weather-data\n{json.dumps(weather_info, indent=2)}\n```"

    # Inject Budget data block
    try:
        b_val = float(total_budget or 30000)
    except Exception:
        b_val = 30000.0
    budget_info = {
        "total_budget": b_val,
        "breakdown": {
            "flights": b_val * 0.35,
            "hotels": b_val * 0.40,
            "activities": b_val * 0.15,
            "food_transport": b_val * 0.10
        }
    }
    final_response += f"\n\n```budget-data\n{json.dumps(budget_info, indent=2)}\n```"

    # Inject Map data block
    map_info = [origin, destination, f"{destination} center"]
    final_response += f"\n\n```map-data\n{json.dumps(map_info, indent=2)}\n```"

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

    return {
        "final_response": final_response,
        "trip_context": updated_context,
        "messages": [{"role": "assistant", "content": final_response}]
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
