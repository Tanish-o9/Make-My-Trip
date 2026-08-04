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

def supervisor_router(state: AgentState) -> str:
    """Decides which agent node should execute next based on user intent and state history"""
    messages = state.get("messages", [])
    if not messages:
        return "general_chat"
        
    user_message = messages[-1]["content"]

    # Call LLM Router to classify user intent
    prompt = f"""
Classify the user intent for the following message.
Message: "{user_message}"

You must choose one of the following exact categories:
- flight_search (searching flights, booking flights)
- hotel_search (hotel stays, villas, accommodations, room booking)
- budget_planning (budget analysis, budget constraints analysis, splitting expenses)
- itinerary_generator (generating day-by-day itineraries only, sightseeing schedules)
- visa_assistant (visa requirements, passports, entry documents)
- weather_info (weather forecast, packing list, climate, clothing advice)
- local_guide (hidden gems, local spots, travel recommendations, attractions, restaurants, shopping, nightlife)
- currency_conversion (forex, converting currency, exchange rates, recommended cash)
- travel_safety (safety warnings, advisories, safety index)
- customer_support (customer support, human agent help, booking problems)
- payment_assistant (payment failures, retry transactions)
- analytics_info (token counts, latency stats, admin metrics)
- trip_planner (comprehensive end-to-end trip packages, holiday packages, planning a full travel itinerary with flights/hotels/pricing, honeymoon trip, family trip, solo trip, adventure trip, luxury trip, corporate travel, weekend trip, international travel, multi-city trip, travel advice)
- insurance_assistant (travel insurance coverage, claim guidelines, premium recommendations)
- emergency_assistant (local emergency phone numbers, medical help, police contact, embassy contacts)
- general_chat (greetings, standard conversational exchanges, off-topic chats)

Output ONLY the category name. Do not write anything else.

Category:
"""
    intent = llm_router.complete(prompt=prompt, task_type="simple").strip().lower()
    
    # Validation check
    valid_intents = [
        "flight_search", "hotel_search", "budget_planning",
        "itinerary_generator", "visa_assistant", "weather_info",
        "local_guide", "currency_conversion", "restaurant_recommendation",
        "travel_safety", "customer_support", "payment_assistant",
        "analytics_info", "trip_planner", "insurance_assistant", "emergency_assistant", "general_chat"
    ]
    if intent not in valid_intents:
        intent = "general_chat"

    logger.info(f"Supervisor classified intent: {intent}")
    return intent


# Define the General Chat Node
def general_chat_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Generates standard helpful responses for generic chat inputs"""
    report_agent_status(config, "Travel OS Assistant thinking...")
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else "Hello"

    prompt = f"""
You are the primary coordinator for Travel OS.
Respond to the user's inquiry: "{user_query}"
Keep it warm, professional, and very concise (maximum 3 sentences). Do not include any programming code, python scripts, or system instructions in your response.
"""
    response = llm_router.complete(prompt=prompt, task_type="simple")
    return {
        "final_response": response,
        "messages": [{"role": "assistant", "content": response}]
    }


# Assemble the Unified LangGraph Workflow
builder = StateGraph(AgentState)

# Add Nodes
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

# Set up Routing entry point
builder.set_conditional_entry_point(
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
        "general_chat": "general_chat"
    }
)

# Connect nodes to END (simple single-step routing per message turn)
builder.add_edge("flight_search", END)
builder.add_edge("hotel_search", END)
builder.add_edge("budget_planning", END)
builder.add_edge("itinerary_generator", END)
builder.add_edge("visa_assistant", END)
builder.add_edge("weather_info", END)
builder.add_edge("local_guide", END)
builder.add_edge("currency_conversion", END)
builder.add_edge("restaurant_recommendation", END)
builder.add_edge("travel_safety", END)
builder.add_edge("customer_support", END)
builder.add_edge("payment_assistant", END)
builder.add_edge("analytics_info", END)
builder.add_edge("trip_planner", END)
builder.add_edge("insurance_assistant", END)
builder.add_edge("emergency_assistant", END)
builder.add_edge("general_chat", END)

# Compile
supervisor_graph = builder.compile()


class SupervisorAgent:
    @staticmethod
    def execute_chat_turn(user_id: int, session_id: str, message: str) -> str:
        # 1. Retrieve session history from memory
        history = MemoryManager.get_conversation_history(session_id)
        
        # Append user message
        history.append({"role": "user", "content": message})
        
        # 2. Load active context and user preferences
        active_context = MemoryManager.get_active_context(session_id) or {}
        trip_context = active_context.get("trip_context", {})
        budget_constraints = active_context.get("budget_constraints", {})
        
        # Check and save user preferences
        try:
            pref_prompt = f"""
            Analyze the user's message: "{message}"
            Does the user explicitly state any long-term preference, airline preference, seat preference, dietary restriction, avoided airlines, avoided destinations, or languages?
            If yes, summarize it into a short preference statement (e.g. "Prefers Vistara airlines", "Vegetarian food only", "Wants to avoid Indigo flights", "Avoids rainy destinations").
            If no preference is expressed, return "NONE".
            Output ONLY the preference statement or "NONE".
            """
            pref_stmt = llm_router.complete(prompt=pref_prompt, task_type="simple").strip()
            if pref_stmt and pref_stmt.upper() != "NONE":
                MemoryManager.save_user_preference(user_id=user_id, preference_text=pref_stmt, category="preference")
                if "user_historical_preferences" not in trip_context:
                    trip_context["user_historical_preferences"] = []
                if pref_stmt not in trip_context["user_historical_preferences"]:
                    trip_context["user_historical_preferences"].append(pref_stmt)
        except Exception as e:
            logger.error(f"Preference capture error: {e}")

        # Query long-term preferences from Chroma
        try:
            user_prefs = MemoryManager.query_user_preferences(user_id=user_id, query=message, limit=5)
            if user_prefs:
                existing_prefs = trip_context.get("user_historical_preferences", [])
                for p in user_prefs:
                    if p not in existing_prefs:
                        existing_prefs.append(p)
                trip_context["user_historical_preferences"] = existing_prefs
        except Exception as e:
            logger.error(f"Failed to load user preferences: {e}")
        
        # 3. Extract/Rehydrate Context from conversation history
        context_prompt = f"""
        Analyze the conversation history and extract the following travel parameters if mentioned:
        - origin (string, IATA code if possible e.g. DEL, BOM)
        - destination (string)
        - departure_date (string, YYYY-MM-DD)
        - return_date (string, YYYY-MM-DD)
        - duration_days (int)
        - total_budget (float)
        - passengers (int)
        - travel_style (string e.g. Solo, Family, Honeymoon, Adventure, Luxury, Corporate)
        - cabin_class (string e.g. ECONOMY, BUSINESS, FIRST)
        - hotel_tier (string e.g. BUDGET, MIDRANGE, LUXURY)
        
        Conversation History:
        {json.dumps(history[-8:])}
        
        Output ONLY a JSON block:
        {{
          "origin": "...",
          "destination": "...",
          "departure_date": "...",
          "return_date": "...",
          "duration_days": ...,
          "total_budget": ...,
          "passengers": ...,
          "travel_style": "...",
          "cabin_class": "...",
          "hotel_tier": "..."
        }}
        """
        try:
            extraction_str = llm_router.complete(prompt=context_prompt, task_type="simple")
            import re
            match = re.search(r"(\{[\s\S]*?\})", extraction_str)
            extracted = {}
            if match:
                extracted = json.loads(match.group(1))
            else:
                extracted = json.loads(extraction_str.strip().strip("```json").strip("```").strip())
            
            if extracted:
                for k, v in extracted.items():
                    if v and v != "...":
                        if k in ["total_budget", "hotel_tier"]:
                            if k == "total_budget":
                                budget_constraints["total_budget"] = float(v)
                            else:
                                budget_constraints["tier"] = str(v).upper()
                        else:
                            trip_context[k] = v
        except Exception as e:
            logger.error(f"Context extraction error in execute_chat_turn: {e}")

        # Initialize state
        state = {
            "user_id": user_id,
            "session_id": session_id,
            "trace_id": f"trace_{session_id}_{len(history)}",
            "messages": history,
            "trip_context": trip_context,
            "budget_constraints": budget_constraints,
            "active_task": "",
            "current_agent": "",
            "final_response": ""
        }
        
        # Run graph
        result = supervisor_graph.invoke(state)
        
        # Save updated history & active context
        new_history = result.get("messages", [])
        MemoryManager.save_conversation_history(session_id, new_history, user_id)
        
        updated_active_context = {
            "trip_context": result.get("trip_context", {}),
            "budget_constraints": result.get("budget_constraints", {})
        }
        MemoryManager.save_active_context(session_id, updated_active_context, user_id)
        
        return result.get("final_response", "I'm sorry, I could not process your request.")

    @staticmethod
    async def execute_chat_turn_async(user_id: int, session_id: str, message: str, status_callback=None) -> str:
        # 1. Retrieve session history from memory
        history = MemoryManager.get_conversation_history(session_id)
        
        # Append user message
        history.append({"role": "user", "content": message})
        
        # 2. Load active context and user preferences
        active_context = MemoryManager.get_active_context(session_id) or {}
        trip_context = active_context.get("trip_context", {})
        budget_constraints = active_context.get("budget_constraints", {})
        
        # Check and save user preferences
        try:
            pref_prompt = f"""
            Analyze the user's message: "{message}"
            Does the user explicitly state any long-term preference, airline preference, seat preference, dietary restriction, avoided airlines, avoided destinations, or languages?
            If yes, summarize it into a short preference statement (e.g. "Prefers Vistara airlines", "Vegetarian food only", "Wants to avoid Indigo flights", "Avoids rainy destinations").
            If no preference is expressed, return "NONE".
            Output ONLY the preference statement or "NONE".
            """
            pref_stmt = llm_router.complete(prompt=pref_prompt, task_type="simple").strip()
            if pref_stmt and pref_stmt.upper() != "NONE":
                MemoryManager.save_user_preference(user_id=user_id, preference_text=pref_stmt, category="preference")
                if "user_historical_preferences" not in trip_context:
                    trip_context["user_historical_preferences"] = []
                if pref_stmt not in trip_context["user_historical_preferences"]:
                    trip_context["user_historical_preferences"].append(pref_stmt)
        except Exception as e:
            logger.error(f"Preference capture error: {e}")

        # Query long-term preferences from Chroma
        try:
            user_prefs = MemoryManager.query_user_preferences(user_id=user_id, query=message, limit=5)
            if user_prefs:
                existing_prefs = trip_context.get("user_historical_preferences", [])
                for p in user_prefs:
                    if p not in existing_prefs:
                        existing_prefs.append(p)
                trip_context["user_historical_preferences"] = existing_prefs
        except Exception as e:
            logger.error(f"Failed to load user preferences: {e}")
        
        # 3. Extract/Rehydrate Context from conversation history
        context_prompt = f"""
        Analyze the conversation history and extract the following travel parameters if mentioned:
        - origin (string, IATA code if possible e.g. DEL, BOM)
        - destination (string)
        - departure_date (string, YYYY-MM-DD)
        - return_date (string, YYYY-MM-DD)
        - duration_days (int)
        - total_budget (float)
        - passengers (int)
        - travel_style (string e.g. Solo, Family, Honeymoon, Adventure, Luxury, Corporate)
        - cabin_class (string e.g. ECONOMY, BUSINESS, FIRST)
        - hotel_tier (string e.g. BUDGET, MIDRANGE, LUXURY)
        
        Conversation History:
        {json.dumps(history[-8:])}
        
        Output ONLY a JSON block:
        {{
          "origin": "...",
          "destination": "...",
          "departure_date": "...",
          "return_date": "...",
          "duration_days": ...,
          "total_budget": ...,
          "passengers": ...,
          "travel_style": "...",
          "cabin_class": "...",
          "hotel_tier": "..."
        }}
        """
        try:
            extraction_str = llm_router.complete(prompt=context_prompt, task_type="simple")
            import re
            match = re.search(r"(\{[\s\S]*?\})", extraction_str)
            extracted = {}
            if match:
                extracted = json.loads(match.group(1))
            else:
                extracted = json.loads(extraction_str.strip().strip("```json").strip("```").strip())
            
            if extracted:
                for k, v in extracted.items():
                    if v and v != "...":
                        if k in ["total_budget", "hotel_tier"]:
                            if k == "total_budget":
                                budget_constraints["total_budget"] = float(v)
                            else:
                                budget_constraints["tier"] = str(v).upper()
                        else:
                            trip_context[k] = v
        except Exception as e:
            logger.error(f"Context extraction error in execute_chat_turn_async: {e}")

        # Initialize state
        state = {
            "user_id": user_id,
            "session_id": session_id,
            "trace_id": f"trace_{session_id}_{len(history)}",
            "messages": history,
            "trip_context": trip_context,
            "budget_constraints": budget_constraints,
            "active_task": "",
            "current_agent": "",
            "final_response": ""
        }
        
        # Pass status_callback in configuration
        config = {"configurable": {"status_callback": status_callback}}
        
        # Run graph
        result = await supervisor_graph.ainvoke(state, config=config)
        
        # Save updated history & active context
        new_history = result.get("messages", [])
        MemoryManager.save_conversation_history(session_id, new_history, user_id)
        
        updated_active_context = {
            "trip_context": result.get("trip_context", {}),
            "budget_constraints": result.get("budget_constraints", {})
        }
        MemoryManager.save_active_context(session_id, updated_active_context, user_id)
        
        return result.get("final_response", "I'm sorry, I could not process your request.")
