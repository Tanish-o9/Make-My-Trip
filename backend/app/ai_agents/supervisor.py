import json
import logging
from typing import Dict, Any, List
from langgraph.graph import StateGraph, END

from app.ai_agents.state import AgentState
from app.ai_router.router import llm_router
from app.memory.memory_manager import MemoryManager

# Import nodes
from app.ai_agents.booking_agents import flight_search_node, hotel_search_node
from app.ai_agents.planning_agents import budget_planning_node, trip_planner_node, itinerary_generator_node
from app.ai_agents.support_agents import visa_assistant_node, weather_agent_node, local_guide_node
from app.ai_agents.specialists import (
    currency_conversion_node,
    restaurant_recommendation_node,
    travel_safety_node,
    customer_support_node,
    payment_assistant_node,
    analytics_node,
    rag_node,
    memory_node,
    notification_node,
    insurance_assistant_node,
    emergency_assistant_node
)

logger = logging.getLogger(__name__)

import asyncio

def report_agent_status(config, status_msg: str):
    """Reports agent execution status to WebSocket via config status_callback"""
    if not config:
        return
    status_callback = config.get("configurable", {}).get("status_callback")
    if status_callback:
        try:
            loop = asyncio.get_running_loop()
            if asyncio.iscoroutinefunction(status_callback):
                asyncio.run_coroutine_threadsafe(status_callback(status_msg), loop)
            else:
                status_callback(status_msg)
        except Exception as e:
            logger.warning(f"Failed to report status '{status_msg}': {e}")


def supervisor_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Entry node: Classifies intent, loads user preferences, and schedules specialists."""
    messages = state.get("messages", [])
    if not messages:
        return {"current_agent": "compiler_node", "pending_agents": []}

    user_message = messages[-1]["content"]
    pending = state.get("pending_agents")
    collected = state.get("collected_data") or {}
    trip_context = state.get("trip_context") or {}
    categorized_prefs = trip_context.get("categorized_preferences", {})

    if pending is None:
        pending = []

        # === Phase 1: Memory Status Event (real backend action) ===
        report_agent_status(config, "Memory Agent: Loading user preferences and trip context...")
        memory_hits = sum(len(v) for v in categorized_prefs.values()) if categorized_prefs else 0
        logger.info(f"[SUPERVISOR] Memory loaded: {memory_hits} preferences across {len(categorized_prefs)} categories")

        # === Phase 2: Fuzzy Reference Resolution (with preference awareness) ===
        report_agent_status(config, "Supervisor Agent: Classifying intent and resolving context references...")

        # Build a concise preference summary for the prompt
        pref_lines = []
        for cat, items in categorized_prefs.items():
            if items:
                pref_lines.append(f"  {cat}: {'; '.join(items[:3])}")
        pref_block = "\n".join(pref_lines) if pref_lines else "  None recorded yet"

        enrich_prompt = f"""You are resolving contextual references in a travel request.

Active Trip Context:
{json.dumps(trip_context, default=str)}

User's Known Preferences:
{pref_block}

Conversation History (last 6 turns):
{json.dumps(messages[:-1][-6:], default=str)}

User's Latest Query:
"{user_message}"

Task: Rewrite the user's query to be FULLY SELF-CONTAINED and EXPLICIT.
Replace ALL relative references with their resolved values:
- "same hotel" → the specific hotel name from context
- "previous flight" / "that flight" → the specific flight number from context
- "same dates" → the specific departure/return dates from context
- "same destination" / "there" → the specific city from context
- "book that" / "reserve it" → specify exactly what to book
- "change budget to X" → preserve all other context, only update budget
- "change destination to Y" → preserve dates/budget/passengers, only update destination

Output ONLY the reconstructed query text. No explanations."""

        try:
            reconstructed_query = llm_router.complete(prompt=enrich_prompt, task_type="simple").strip()
            # Sanity: if reconstruction is empty or identical to original, use original
            if not reconstructed_query or len(reconstructed_query) < 5:
                reconstructed_query = user_message
            logger.info(f"[SUPERVISOR] Reconstructed: {reconstructed_query[:200]}")
        except Exception as e:
            logger.warning(f"Context reconstruction failed: {e}")
            reconstructed_query = user_message

        # === Phase 3: Intent Routing (preference-aware) ===
        routing_prompt = f"""Analyze this self-contained travel request and select the specialist agents needed.

Request: "{reconstructed_query}"

User's ACTIVE preferences to consider for routing:
- Airlines: {', '.join(categorized_prefs.get('airlines', ['None'])) or 'None'}
- Hotels: {', '.join(categorized_prefs.get('hotels', ['None'])) or 'None'}
- Dietary: {', '.join(categorized_prefs.get('dietary', ['None'])) or 'None'}
- Travel Style: {', '.join(categorized_prefs.get('travel_style', ['None'])) or 'None'}
- Budget Level: {', '.join(categorized_prefs.get('budget', ['None'])) or 'None'}

Available specialists:
- flight_search: flight search, booking, deals, price comparison
- hotel_search: hotel accommodations, stays, resort booking
- budget_planning: budget analysis, cost breakdown, money optimization
- itinerary_generator: day-by-day sightseeing and activity plans
- visa_assistant: visa requirements, entry rules, passport info
- weather_info: weather forecast, packing guide, climate
- local_guide: local attractions, hidden gems, sightseeing
- currency_conversion: forex, currency exchange rates
- restaurant_recommendation: restaurants, dining, food spots
- travel_safety: safety advisories, alerts, crime index
- customer_support: booking history, complaints, escalations
- payment_assistant: payment failures, refunds, wallet help
- insurance_assistant: travel insurance options and coverage
- emergency_assistant: emergency contacts, embassy numbers
- general_chat: greetings, simple questions, help

Rules:
- For full trip/vacation planning requests → ALWAYS include ["budget_planning", "flight_search", "hotel_search", "weather_info", "local_guide", "itinerary_generator"]
- For flight-only requests → ["flight_search"]
- For hotel-only requests → ["hotel_search"]
- For insurance mentions → add "insurance_assistant"
- Keep the list minimal but complete

Output ONLY a valid JSON array. Example: ["flight_search", "hotel_search"]
JSON:"""

        try:
            route_str = llm_router.complete(prompt=routing_prompt, task_type="simple").strip()
            import re
            match = re.search(r"(\[[\s\S]*?\])", route_str)
            pending = json.loads(match.group(1)) if match else json.loads(route_str)
            # Validate all agent names
            valid = {"flight_search", "hotel_search", "budget_planning", "itinerary_generator",
                     "visa_assistant", "weather_info", "local_guide", "currency_conversion",
                     "restaurant_recommendation", "travel_safety", "customer_support",
                     "payment_assistant", "trip_planner", "insurance_assistant",
                     "emergency_assistant", "general_chat"}
            pending = [a for a in pending if a in valid]
        except Exception as e:
            logger.warning(f"Routing failed: {e}")
            pending = ["general_chat"]

        if not pending:
            pending = ["general_chat"]

        # Announce which agents will run
        report_agent_status(config, f"Supervisor: Scheduling {len(pending)} agents → {' → '.join(pending)}")
        logger.info(f"[SUPERVISOR] Agent queue: {pending}")

        # Store memory hit count in debug_telemetry
        existing_telemetry = state.get("debug_telemetry") or {}
        existing_telemetry["memory_hits"] = memory_hits
        existing_telemetry["agent_queue"] = list(pending)
        existing_telemetry["reconstructed_query"] = reconstructed_query[:300]

        return {
            "pending_agents": pending[1:],
            "current_agent": pending[0],
            "collected_data": collected,
            "debug_telemetry": existing_telemetry
        }

    # Subsequent calls: pop the next agent
    if pending:
        next_agent = pending.pop(0)
        report_agent_status(config, f"Supervisor: Dispatching → {next_agent}")
        return {
            "pending_agents": pending,
            "current_agent": next_agent,
            "collected_data": collected
        }
    else:
        return {
            "pending_agents": [],
            "current_agent": "compiler_node",
            "collected_data": collected
        }


def supervisor_router(state: AgentState) -> str:
    """Conditional router that directs execution to the current scheduled agent"""
    return state.get("current_agent") or "compiler_node"


def general_chat_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Generates richly personalized responses — no generic filler."""
    report_agent_status(config, "Travel OS: Crafting personalized response...")
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else "Hello"
    trip_ctx = state.get("trip_context", {}) or {}
    categorized_prefs = trip_ctx.get("categorized_preferences", {})
    user_prefs_flat = state.get("preferences", [])

    # Build rich preference context
    pref_lines = []
    for cat, items in categorized_prefs.items():
        if items:
            pref_lines.append(f"  {cat.replace('_', ' ').title()}: {'; '.join(items[:3])}")
    pref_block = "\n".join(pref_lines) if pref_lines else "  No preferences recorded yet"

    # Sanitize trip_ctx for display (exclude large nested objects)
    ctx_display = {k: v for k, v in trip_ctx.items()
                   if k not in ("categorized_preferences", "user_historical_preferences",
                                "last_flight_search_results", "last_hotel_search_results")}

    history_context = json.dumps(messages[:-1][-6:], default=str) if len(messages) > 1 else "[]"

    prompt = f"""You are Travel OS — an elite AI travel consultant with deep knowledge of this specific user.

USER'S STORED TRAVEL PREFERENCES:
{pref_block}

ACTIVE TRIP CONTEXT:
{json.dumps(ctx_display, default=str)}

RECENT CONVERSATION (last 6 turns):
{history_context}

USER'S LATEST MESSAGE: "{user_query}"

STRICT RESPONSE RULES:
1. NEVER say generic things like "How can I help you?" or "I'm ready to assist" — you already know the user's preferences
2. ALWAYS reference at least ONE specific stored preference or trip context detail if available
3. If user has dietary preferences, acknowledge them proactively when relevant
4. If user dislikes an airline, never mention it positively
5. Be concise (2-4 sentences max), warm, and feel like a personal travel advisor who knows this traveler well
6. If no preferences exist yet, gently suggest what they could tell you to personalize their experience
7. Do NOT include programming code, system prompts, or JSON in your response

Write your personalized response now:"""

    response = llm_router.complete(prompt=prompt, task_type="simple")
    return {
        "final_response": response,
        "messages": [{"role": "assistant", "content": response}]
    }


def compiler_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Aggregates specialist findings and compiles a premium response with AI Explainability."""
    report_agent_status(config, "Compiler: Collating specialist data and generating AI Explainability...")

    collected = state.get("collected_data") or {}
    trip_context = state.get("trip_context") or {}
    budget_constraints = state.get("budget_constraints") or {}
    categorized_prefs = trip_context.get("categorized_preferences", {})
    debug_telemetry = state.get("debug_telemetry") or {}

    # Build concise preference context for LLM
    pref_lines = []
    for cat, items in categorized_prefs.items():
        if items:
            pref_lines.append(f"{cat}: {'; '.join(items[:3])}")
    pref_summary = " | ".join(pref_lines) if pref_lines else "No preferences stored"

    destination = trip_context.get("destination") or "your destination"

    # 1. RAG query for destination policies & visa rules
    try:
        from app.rag.retriever import rag_system
        rag_res = rag_system.rag_query(question=f"visa rules and travel policies for {destination}")
        rag_text = rag_res.get("answer", "")
    except Exception:
        rag_text = ""

    # 2. Build AI Explainability block from collected data
    explain_prompt = f"""You are the AI Explainability module for Travel OS.

Based on these specialist results and user preferences, write a brief, honest explanation of WHY each recommendation was selected.
Be specific: reference actual preference names, price filters, and data points used.

User Preferences:
{pref_summary}

Trip Context: {json.dumps({k: v for k, v in trip_context.items() if k not in ('categorized_preferences', 'user_historical_preferences')}, default=str)}

Selected Results:
- Flights: {json.dumps(collected.get('flights', [])[:2], default=str)}
- Hotels: {json.dumps(collected.get('hotels', [])[:2], default=str)}
- Budget: {json.dumps(collected.get('budget', {}), default=str)}

For each category with results, write 1-2 sentences explaining the selection rationale. Use bullet points.
Format:
• ✈️ Flights: [why these specific flights were chosen]
• 🏨 Hotels: [why these specific hotels were chosen]
• 💰 Budget: [why this budget allocation was made]

Be honest if a category has no results. Keep it under 100 words total."""

    try:
        explainability_text = llm_router.complete(prompt=explain_prompt, task_type="simple")
    except Exception:
        explainability_text = "• Recommendations selected based on destination, travel dates, and available inventory."

    # 3. Synthesize complete proposal using reasoning LLM
    compilation_prompt = f"""You are a Senior Travel Consultant at Travel OS. Compile a premium, personalized travel proposal.

User's Known Preferences (MUST be reflected in your response):
{pref_summary}

Destination: {destination}
Trip Context: {json.dumps({k: v for k, v in trip_context.items() if k not in ('categorized_preferences',)}, default=str)}
Budget: {json.dumps(budget_constraints, default=str)}

Specialist Data Gathered:
{json.dumps(collected, indent=2, default=str)}

Verified Travel Rules (RAG):
{rag_text}

Instructions:
1. PERSONALIZE every section using the user's preferences (airlines, hotels, dietary, style)
2. If user dislikes an airline, do NOT recommend it — explain why alternatives were chosen
3. If user prefers luxury, reflect luxury-tier options throughout
4. Include these sections with emoji headers:
   - 🗺️ Trip Overview & Day Highlights
   - ☀️ Weather & Packing Guide  
   - 💰 Smart Budget Breakdown
   - 💎 Dining & Hidden Gems (align with dietary preferences if any)
   - ⚠️ Safety & Entry Requirements
5. End with 3-4 smart follow-up action suggestions
6. Do NOT include flights-data/hotels-data/itinerary-data JSON blocks in your text — they are auto-appended
7. Do NOT hallucinate options not in the specialist data

Write the proposal now:"""

    response = llm_router.complete(
        prompt=compilation_prompt,
        system_prompt=f"You are a world-class travel consultant. User preferences: {pref_summary}. Always personalize responses.",
        task_type="reasoning"
    )

    # 4. Append explainability section
    response += f"\n\n---\n**🧠 AI Recommendation Rationale**\n{explainability_text}"

    # 5. Append JSON data blocks
    if "flights" in collected:
        response += f"\n\n```flights-data\n{json.dumps(collected['flights'], indent=2, default=str)}\n```"
    if "hotels" in collected:
        response += f"\n\n```hotels-data\n{json.dumps(collected['hotels'], indent=2, default=str)}\n```"
    if "itinerary" in collected:
        response += f"\n\n```itinerary-data\n{json.dumps(collected['itinerary'], indent=2, default=str)}\n```"
    if "weather" in collected:
        response += f"\n\n```weather-data\n{json.dumps(collected['weather'], indent=2, default=str)}\n```"
    if "visa" in collected:
        response += f"\n\n```visa-data\n{json.dumps(collected['visa'], indent=2, default=str)}\n```"
    if "budget" in collected:
        response += f"\n\n```budget-data\n{json.dumps(collected['budget'], indent=2, default=str)}\n```"
    if "map" in collected:
        response += f"\n\n```map-data\n{json.dumps(collected['map'], indent=2, default=str)}\n```"

    # 6. Store debug telemetry
    debug_telemetry["pref_summary"] = pref_summary
    debug_telemetry["rag_used"] = bool(rag_text)
    debug_telemetry["collected_keys"] = list(collected.keys())

    return {
        "final_response": response,
        "messages": [{"role": "assistant", "content": response}],
        "debug_telemetry": debug_telemetry
    }


# Assemble the Unified LangGraph Workflow
builder = StateGraph(AgentState)

# Add Nodes
builder.add_node("supervisor_node", supervisor_node)
builder.add_node("flight_search", flight_search_node)
builder.add_node("hotel_search", hotel_search_node)
builder.add_node("budget_planning", budget_planning_node)
builder.add_node("itinerary_generator", itinerary_generator_node)
builder.add_node("visa_assistant", visa_assistant_node)
builder.add_node("weather_info", weather_agent_node)
builder.add_node("local_guide", local_guide_node)
builder.add_node("currency_conversion", currency_conversion_node)
builder.add_node("restaurant_recommendation", restaurant_recommendation_node)
builder.add_node("travel_safety", travel_safety_node)
builder.add_node("customer_support", customer_support_node)
builder.add_node("payment_assistant", payment_assistant_node)
builder.add_node("analytics_info", analytics_node)
builder.add_node("trip_planner", trip_planner_node)
builder.add_node("insurance_assistant", insurance_assistant_node)
builder.add_node("emergency_assistant", emergency_assistant_node)
builder.add_node("general_chat", general_chat_node)
builder.add_node("compiler_node", compiler_node)

# Set Entry Point
builder.set_entry_point("supervisor_node")

# Set up routing edges from supervisor
builder.add_conditional_edges(
    "supervisor_node",
    supervisor_router,
    {
        "flight_search": "flight_search",
        "hotel_search": "hotel_search",
        "budget_planning": "budget_planning",
        "itinerary_generator": "itinerary_generator",
        "visa_assistant": "visa_assistant",
        "weather_info": "weather_info",
        "local_guide": "local_guide",
        "currency_conversion": "currency_conversion",
        "restaurant_recommendation": "restaurant_recommendation",
        "travel_safety": "travel_safety",
        "customer_support": "customer_support",
        "payment_assistant": "payment_assistant",
        "analytics_info": "analytics_info",
        "trip_planner": "trip_planner",
        "insurance_assistant": "insurance_assistant",
        "emergency_assistant": "emergency_assistant",
        "general_chat": "general_chat",
        "compiler_node": "compiler_node"
    }
)

# Connect specialists back to supervisor
builder.add_edge("flight_search", "supervisor_node")
builder.add_edge("hotel_search", "supervisor_node")
builder.add_edge("budget_planning", "supervisor_node")
builder.add_edge("itinerary_generator", "supervisor_node")
builder.add_edge("visa_assistant", "supervisor_node")
builder.add_edge("weather_info", "supervisor_node")
builder.add_edge("local_guide", "supervisor_node")
builder.add_edge("currency_conversion", "supervisor_node")
builder.add_edge("restaurant_recommendation", "supervisor_node")
builder.add_edge("travel_safety", "supervisor_node")
builder.add_edge("customer_support", "supervisor_node")
builder.add_edge("payment_assistant", "supervisor_node")
builder.add_edge("analytics_info", "supervisor_node")
builder.add_edge("trip_planner", "supervisor_node")
builder.add_edge("insurance_assistant", "supervisor_node")
builder.add_edge("emergency_assistant", "supervisor_node")
builder.add_edge("general_chat", "supervisor_node")

# Compiler to END
builder.add_edge("compiler_node", END)

# Compile Graph
supervisor_graph = builder.compile()


class SupervisorAgent:
    @staticmethod
    def _load_and_enrich_context(user_id: int, session_id: str, message: str):
        """Shared helper: retrieves history, context, and all categorized long-term preferences.
        Returns (history, trip_context, budget_constraints)"""
        history = MemoryManager.get_conversation_history(session_id)
        history.append({"role": "user", "content": message})

        active_context = MemoryManager.get_active_context(session_id) or {}
        trip_context = active_context.get("trip_context", {})
        budget_constraints = active_context.get("budget_constraints", {})

        # === Phase 9: Dynamic Preference Learning ===
        # Detect and persist any newly expressed preferences
        try:
            pref_prompt = f"""
Analyze this user message and detect any explicitly stated permanent travel preferences.
Examples: "I hate Indigo", "I always fly Business Class", "I'm vegetarian", "I prefer Taj hotels", "I never book cheap hostels".

Message: "{message}"

If a clear preference is detected, output a short, clean summary sentence (e.g. "Hates Indigo airlines", "Always travels Business Class", "Vegetarian dietary requirement").
If NO permanent preference is stated, output ONLY the word: NONE
"""
            pref_stmt = llm_router.complete(prompt=pref_prompt, task_type="simple").strip()
            if pref_stmt and pref_stmt.upper() not in ("NONE", "NONE.", ""):
                # Categorize intelligently
                p_lower = pref_stmt.lower()
                if any(k in p_lower for k in ["vegan", "vegetarian", "halal", "gluten", "food", "diet"]):
                    pref_cat = "dietary"
                elif any(k in p_lower for k in ["indigo", "vistara", "air india", "akasa", "airline", "flight", "cabin", "business class", "economy"]):
                    pref_cat = "airline"
                elif any(k in p_lower for k in ["taj", "hotel", "resort", "marriott", "oberoi", "hilton", "stay"]):
                    pref_cat = "hotel"
                elif any(k in p_lower for k in ["budget", "cheap", "luxury", "affordable", "spend"]):
                    pref_cat = "budget"
                elif any(k in p_lower for k in ["solo", "family", "adventure", "luxury", "style", "backpack"]):
                    pref_cat = "travel_style"
                else:
                    pref_cat = "preference"

                MemoryManager.save_user_preference(user_id=user_id, preference_text=pref_stmt, category=pref_cat)
                logger.info(f"Learned preference [{pref_cat}]: {pref_stmt}")

                if "user_historical_preferences" not in trip_context:
                    trip_context["user_historical_preferences"] = []
                if pref_stmt not in trip_context["user_historical_preferences"]:
                    trip_context["user_historical_preferences"].append(pref_stmt)
        except Exception as e:
            logger.error(f"Preference capture error: {e}")

        # === Phase 1: Load ALL categorized long-term preferences from DB ===
        try:
            all_prefs = MemoryManager.get_all_user_preferences(user_id=user_id)
            # Flatten into the trip_context
            trip_context["categorized_preferences"] = all_prefs

            # Auto-apply cabin class from airline preferences
            airline_prefs = all_prefs.get("airlines", [])
            for ap in airline_prefs:
                if "business class" in ap.lower() and "cabin_class" not in trip_context:
                    trip_context["cabin_class"] = "BUSINESS"
                elif "first class" in ap.lower() and "cabin_class" not in trip_context:
                    trip_context["cabin_class"] = "FIRST"

            # Auto-apply hotel tier from hotel preferences
            hotel_prefs = all_prefs.get("hotels", [])
            for hp in hotel_prefs:
                if any(k in hp.lower() for k in ["luxury", "taj", "oberoi", "marriott", "five star", "5 star"]) and "hotel_tier" not in trip_context:
                    trip_context["hotel_tier"] = "LUXURY"

            # Add flat list of all preferences to trip_context for agent nodes
            all_flat = [p for prefs in all_prefs.values() for p in prefs]
            existing_flat = trip_context.get("user_historical_preferences", [])
            for p in all_flat:
                if p not in existing_flat:
                    existing_flat.append(p)
            trip_context["user_historical_preferences"] = existing_flat
        except Exception as e:
            logger.error(f"Failed to load all preferences: {e}")

        # Also do a semantic query for message-relevant preferences
        try:
            semantic_prefs = MemoryManager.query_user_preferences(user_id=user_id, query=message, limit=5)
            if semantic_prefs:
                existing_prefs = trip_context.get("user_historical_preferences", [])
                for p in semantic_prefs:
                    if p not in existing_prefs:
                        existing_prefs.append(p)
                trip_context["user_historical_preferences"] = existing_prefs
        except Exception as e:
            logger.error(f"Failed semantic preference query: {e}")

        return history, trip_context, budget_constraints

    @staticmethod
    def execute_chat_turn(user_id: int, session_id: str, message: str) -> str:
        # 1. Load history, context, and enriched preferences
        history, trip_context, budget_constraints = SupervisorAgent._load_and_enrich_context(
            user_id, session_id, message
        )

        # 2. Parameter extraction from conversation history
        context_prompt = f"""
Analyze the conversation and extract all travel parameters. Use context clues from earlier messages too.

Conversation History:
{json.dumps(history[-8:])}

User long-term preferences:
{json.dumps(trip_context.get('categorized_preferences', {}))}

Extract these fields if mentioned (leave blank/null if genuinely unknown):
- origin (IATA code, e.g. DEL, BOM, BLR, CCU)
- destination (city name, e.g. Goa, Paris, Dubai)
- departure_date (YYYY-MM-DD)
- return_date (YYYY-MM-DD)
- duration_days (integer nights)
- total_budget (float, INR)
- passengers (integer)
- travel_style (Solo/Family/HoneyMoon/Adventure/Luxury/Business)
- cabin_class (ECONOMY/BUSINESS/FIRST — use preferences if stated)
- hotel_tier (BUDGET/MIDRANGE/LUXURY — use preferences if stated)
- dietary_preferences (Vegan/Vegetarian/Halal/None)
- target_currency (USD/EUR/AED etc., if mentioned)

Output ONLY valid JSON, no code blocks:
{{
  "origin": null, "destination": null, "departure_date": null,
  "return_date": null, "duration_days": null, "total_budget": null,
  "passengers": null, "travel_style": null, "cabin_class": null,
  "hotel_tier": null, "dietary_preferences": null, "target_currency": null
}}
"""
        try:
            extraction_str = llm_router.complete(prompt=context_prompt, task_type="simple")
            import re
            match = re.search(r"(\{[\s\S]*?\})", extraction_str)
            extracted = json.loads(match.group(1)) if match else json.loads(extraction_str.strip())
            for k, v in extracted.items():
                if v and v not in ("...", "None", "null", None, ""):
                    if k == "total_budget":
                        budget_constraints["total_budget"] = float(v)
                    elif k == "hotel_tier":
                        budget_constraints["tier"] = str(v).upper()
                        trip_context[k] = str(v).upper()
                    else:
                        trip_context[k] = v
        except Exception as e:
            logger.error(f"Context extraction error: {e}")

        # Initialize State
        state = {
            "user_id": user_id,
            "session_id": session_id,
            "trace_id": f"trace_{session_id}_{len(history)}",
            "messages": history,
            "trip_context": trip_context,
            "budget_constraints": budget_constraints,
            "active_task": "",
            "current_agent": "",
            "final_response": "",
            "pending_agents": None,  # Force re-init in supervisor_node
            "collected_data": {},
            "preferences": trip_context.get("user_historical_preferences", []),
            "debug_telemetry": {"session_id": session_id, "user_id": user_id, "turn": len(history)}
        }

        result = supervisor_graph.invoke(state)

        # Save History & Context
        new_history = result.get("messages", [])
        MemoryManager.save_conversation_history(session_id, new_history, user_id)

        final_trip_ctx = result.get("trip_context", {})
        updated_active_context = {
            "trip_context": final_trip_ctx,
            "budget_constraints": result.get("budget_constraints", {}),
            "last_debug_telemetry": result.get("debug_telemetry", {})
        }
        MemoryManager.save_active_context(session_id, updated_active_context, user_id)

        return result.get("final_response", "I'm sorry, I could not process your request.")


    @staticmethod
    async def execute_chat_turn_async(user_id: int, session_id: str, message: str, status_callback=None) -> str:
        # 1. Load history, context, and enriched preferences (shared with sync path)
        history, trip_context, budget_constraints = SupervisorAgent._load_and_enrich_context(
            user_id, session_id, message
        )

        # 2. Parameter extraction from conversation history (same as sync path)
        context_prompt = f"""
Analyze the conversation and extract all travel parameters. Use context clues from earlier messages too.

Conversation History:
{json.dumps(history[-8:])}

User long-term preferences:
{json.dumps(trip_context.get('categorized_preferences', {}))}

Extract these fields if mentioned (leave blank/null if genuinely unknown):
- origin (IATA code, e.g. DEL, BOM, BLR, CCU)
- destination (city name, e.g. Goa, Paris, Dubai)
- departure_date (YYYY-MM-DD)
- return_date (YYYY-MM-DD)
- duration_days (integer nights)
- total_budget (float, INR)
- passengers (integer)
- travel_style (Solo/Family/HoneyMoon/Adventure/Luxury/Business)
- cabin_class (ECONOMY/BUSINESS/FIRST — use preferences if stated)
- hotel_tier (BUDGET/MIDRANGE/LUXURY — use preferences if stated)
- dietary_preferences (Vegan/Vegetarian/Halal/None)
- target_currency (USD/EUR/AED etc., if mentioned)

Output ONLY valid JSON, no code blocks:
{{
  "origin": null, "destination": null, "departure_date": null,
  "return_date": null, "duration_days": null, "total_budget": null,
  "passengers": null, "travel_style": null, "cabin_class": null,
  "hotel_tier": null, "dietary_preferences": null, "target_currency": null
}}
"""
        try:
            extraction_str = llm_router.complete(prompt=context_prompt, task_type="simple")
            import re
            match = re.search(r"(\{[\s\S]*?\})", extraction_str)
            extracted = json.loads(match.group(1)) if match else json.loads(extraction_str.strip())
            for k, v in extracted.items():
                if v and v not in ("...", "None", "null", None, ""):
                    if k == "total_budget":
                        budget_constraints["total_budget"] = float(v)
                    elif k == "hotel_tier":
                        budget_constraints["tier"] = str(v).upper()
                        trip_context[k] = str(v).upper()
                    else:
                        trip_context[k] = v
        except Exception as e:
            logger.error(f"Context extraction error: {e}")

        # Initialize State
        state = {
            "user_id": user_id,
            "session_id": session_id,
            "trace_id": f"trace_{session_id}_{len(history)}",
            "messages": history,
            "trip_context": trip_context,
            "budget_constraints": budget_constraints,
            "active_task": "",
            "current_agent": "",
            "final_response": "",
            "pending_agents": None, # Force re-init in supervisor_node
            "collected_data": {},
            "preferences": trip_context.get("user_historical_preferences", []),
            "debug_telemetry": {"session_id": session_id, "user_id": user_id, "turn": len(history)}
        }

        # Pass status_callback in configuration
        config = {"configurable": {"status_callback": status_callback}}
        
        result = await supervisor_graph.ainvoke(state, config=config)

        # Save History & Context
        new_history = result.get("messages", [])
        MemoryManager.save_conversation_history(session_id, new_history, user_id)
        
        updated_active_context = {
            "trip_context": result.get("trip_context", {}),
            "budget_constraints": result.get("budget_constraints", {}),
            "last_debug_telemetry": result.get("debug_telemetry", {})
        }
        MemoryManager.save_active_context(session_id, updated_active_context, user_id)

        return result.get("final_response", "I'm sorry, I could not process your request.")
