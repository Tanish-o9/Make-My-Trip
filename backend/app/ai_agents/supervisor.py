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
    notification_node
)

logger = logging.getLogger(__name__)

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
- hotel_search (hotel stays, accommodation)
- budget_planning (budget analysis, splitting expenses)
- itinerary_generator (day-by-day travel plans, sights scheduling)
- visa_assistant (visas, passports, entry documents)
- weather_info (forecast, climate, clothing advice)
- local_guide (hidden gems, local spots, travel recommendations)
- currency_conversion (converting currency, exchange rates, how much cash to carry)
- restaurant_recommendation (food, dining, restaurants, eating out)
- travel_safety (warnings, advisories, safety index)
- customer_support (help, agent, human support, booking history issues)
- payment_assistant (payment failed, decline explanation, retry transaction)
- analytics_info (admin statistics, token counts, latency stats)
- general_chat (greetings, general chat, general question answering)

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
        "analytics_info", "general_chat"
    ]
    if intent not in valid_intents:
        intent = "general_chat"

    logger.info(f"Supervisor classified intent: {intent}")
    return intent


# Define the General Chat Node
def general_chat_node(state: AgentState) -> dict:
    """Generates standard helpful responses for generic chat inputs"""
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
        
        # 2. Extract/Rehydrate Context from conversation history
        trip_context = {}
        budget_constraints = {}
        
        context_prompt = f"""
        Analyze the conversation history and extract the following travel parameters if mentioned:
        - destination (string)
        - departure_date (string, YYYY-MM-DD)
        - return_date (string, YYYY-MM-DD)
        - duration_days (int)
        - total_budget (float)
        
        Conversation History:
        {json.dumps(history[-8:])}
        
        Output ONLY a JSON block:
        {{
          "destination": "...",
          "departure_date": "...",
          "return_date": "...",
          "duration_days": ...,
          "total_budget": ...
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
                if extracted.get("destination") and extracted["destination"] != "...":
                    trip_context["destination"] = extracted["destination"]
                if extracted.get("departure_date") and extracted["departure_date"] != "...":
                    trip_context["departure_date"] = extracted["departure_date"]
                if extracted.get("return_date") and extracted["return_date"] != "...":
                    trip_context["return_date"] = extracted["return_date"]
                if extracted.get("duration_days") and isinstance(extracted["duration_days"], (int, float)):
                    trip_context["duration_days"] = int(extracted["duration_days"])
                if extracted.get("total_budget") and isinstance(extracted["total_budget"], (int, float)):
                    budget_constraints["total_budget"] = float(extracted["total_budget"])
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
        
        # Save updated history
        new_history = result.get("messages", [])
        MemoryManager.save_conversation_history(session_id, new_history, user_id)
        
        return result.get("final_response", "I'm sorry, I could not process your request.")
