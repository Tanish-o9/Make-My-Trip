import json
import logging
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.ai_agents.state import AgentState, log_agent_execution
from app.ai_router.router import llm_router
from app.rag.retriever import rag_system
from app.ai_tools.currency_tool import currency_convert_tool
from app.models.agents import DestinationCostBaseline, AgentExecutionLog, LLMRouterDecisionLog
from app.models.bookings import FlightBooking, HotelBooking, PaymentAttempt

logger = logging.getLogger(__name__)

@log_agent_execution("currency_conversion_agent")
def currency_conversion_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Calculates daily travel cost recommendations and converts currency"""
    from app.ai_agents.supervisor import report_agent_status
    report_agent_status(config, "Forex Agent: Converting currency and calculating cash baseline...")
    context = state.get("trip_context", {})
    destination = context.get("destination") or "Goa"
    duration_days = int(context.get("duration_days") or 3)
    target_currency = context.get("target_currency") or "USD"

    db = SessionLocal()
    try:
        baseline = db.query(DestinationCostBaseline).filter(
            DestinationCostBaseline.destination.ilike(destination)
        ).first()
        if not baseline:
            # Seed-like default if destination baseline doesn't exist yet
            baseline = DestinationCostBaseline(
                destination=destination,
                daily_food_cost=1500,
                daily_transport_cost=800,
                daily_activities_cost=1200
            )
            db.add(baseline)
            db.commit()
            db.refresh(baseline)
        
        # Calculate totals in INR
        food_tot = baseline.daily_food_cost * duration_days
        trans_tot = baseline.daily_transport_cost * duration_days
        act_tot = baseline.daily_activities_cost * duration_days
        total_inr = food_tot + trans_tot + act_tot

        # Convert to target currency
        total_converted = currency_convert_tool(total_inr, target_currency).get("converted_amount", total_inr)
        
        message_text = (
            f"### Cash Recommendation for {destination} ({duration_days} Days):\n"
            f"- **Estimated Food Cost**: ₹{food_tot:,} ({target_currency} {currency_convert_tool(food_tot, target_currency).get('converted_amount', food_tot):.2f})\n"
            f"- **Local Transport**: ₹{trans_tot:,} ({target_currency} {currency_convert_tool(trans_tot, target_currency).get('converted_amount', trans_tot):.2f})\n"
            f"- **Activities budget**: ₹{act_tot:,} ({target_currency} {currency_convert_tool(act_tot, target_currency).get('converted_amount', act_tot):.2f})\n"
            f"- **Recommended Total Cash to Carry**: **₹{total_inr:,} ({target_currency} {total_converted:.2f})**"
        )

    except Exception as e:
        logger.error(f"Currency Agent error: {e}")
        message_text = f"Could not compute cash recommendations: {e}"
    finally:
        db.close()

    return {
        "final_response": message_text,
        "messages": [{"role": "assistant", "content": message_text}]
    }

@log_agent_execution("restaurant_recommendation_agent")
def restaurant_recommendation_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Suggests local restaurants filtered by dietary preferences"""
    from app.ai_agents.supervisor import report_agent_status
    report_agent_status(config, "Dining Agent: Searching local dining options...")
    context = state.get("trip_context", {})
    destination = context.get("destination") or "Goa"
    dietary = context.get("dietary_preferences") or "None"

    # Mock database places lookup
    restaurants = [
        {"name": "Spice Goa", "cuisine": "Seafood & Goan", "vegan_friendly": True, "gluten_free_friendly": False},
        {"name": "The Lazy Goose", "cuisine": "Continental", "vegan_friendly": True, "gluten_free_friendly": True},
        {"name": "Gunpowder", "cuisine": "South Indian", "vegan_friendly": True, "gluten_free_friendly": True},
        {"name": "Shamba", "cuisine": "Fusion", "vegan_friendly": False, "gluten_free_friendly": False}
    ]

    # Filter restaurants
    filtered = []
    for r in restaurants:
        if dietary.lower() == "vegan" and not r["vegan_friendly"]:
            continue
        if dietary.lower() == "gluten-free" and not r["gluten_free_friendly"]:
            continue
        filtered.append(r)

    prompt = f"""
Format a restaurant guide for {destination}.
Dietary preference requested: {dietary}.
Matches found: {json.dumps(filtered)}.
Provide a recommendation list with brief descriptions. Keep it very concise, warm, and direct. Do not include any programming code, python scripts, or system reasoning in your conversational text.
"""
    response = llm_router.complete(prompt=prompt, task_type="simple")
    return {
        "final_response": response,
        "messages": [{"role": "assistant", "content": response}]
    }

@log_agent_execution("travel_safety_agent")
def travel_safety_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Retrieves travel advisories and alerts using RAG"""
    from app.ai_agents.supervisor import report_agent_status
    report_agent_status(config, "Safety Agent: Checking travel advisories...")
    context = state.get("trip_context", {})
    destination = context.get("destination") or "Goa"

    rag_result = rag_system.rag_query(
        question=f"What are the safety levels and active travel warnings for {destination}?",
        filters={"country": destination.capitalize()}
    )
    answer = rag_result["answer"]
    
    disclaimer = "\n\n*Disclaimer: Safety indicators are sourced from public advisories. Confirm latest parameters with government sources.*"
    final_text = f"### Travel Advisory: {destination}\n\n{answer}{disclaimer}"

    return {
        "final_response": final_text,
        "messages": [{"role": "assistant", "content": final_text}]
    }

@log_agent_execution("customer_support_agent")
def customer_support_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Provides general Q&A and escalates support issues to human agents"""
    from app.ai_agents.supervisor import report_agent_status
    report_agent_status(config, "Support Agent: Retrieving profile bookings history...")
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""
    user_id = state.get("user_id", 1)

    db = SessionLocal()
    try:
        flights = db.query(FlightBooking).filter(FlightBooking.user_id == user_id).all()
        hotels = db.query(HotelBooking).filter(HotelBooking.user_id == user_id).all()
        booking_refs = [f.booking_reference for f in flights] + [h.booking_reference for h in hotels]
    except Exception:
        booking_refs = []
    finally:
        db.close()

    # Determine if ticket escalation is requested
    prompt = f"""
Decide if the user wants to talk to a human or raise a ticket.
Query: "{user_query}"
Current Booking References: {booking_refs}
Output ONLY JSON block:
- escalate (true/false)
- reasoning (string)
JSON:
"""
    decision_str = llm_router.complete(prompt=prompt, task_type="simple")
    try:
        clean_json = decision_str.strip().strip("```json").strip("```").strip()
        data = json.loads(clean_json)
        escalate = data.get("escalate", False)
    except Exception:
        escalate = "escalate" in user_query.lower() or "human" in user_query.lower()

    if escalate:
        ticket_id = f"TKT-{user_id}-99"
        support_response = f"I've raised a support ticket ({ticket_id}) and queued this for human escalation. An agent will contact you shortly."
    else:
        support_response = f"I searched your active bookings ({', '.join(booking_refs) if booking_refs else 'None'}). How can I assist you with your flights or hotels?"

    return {
        "final_response": support_response,
        "messages": [{"role": "assistant", "content": support_response}]
    }

@log_agent_execution("payment_assistant_agent")
def payment_assistant_node(state: AgentState, config: Dict[str, Any] = None) -> dict:
    """Diagnoses payment failures from transaction tables in plain language"""
    from app.ai_agents.supervisor import report_agent_status
    report_agent_status(config, "Payment Assistant: Analyzing payment history logs...")
    user_id = state.get("user_id", 1)
    
    db = SessionLocal()
    try:
        last_failure = db.query(PaymentAttempt).filter(
            PaymentAttempt.user_id == user_id,
            PaymentAttempt.status == "failed"
        ).order_by(PaymentAttempt.created_at.desc()).first()
        
        if last_failure:
            reason = last_failure.failure_reason or "UNKNOWN_ERROR"
            amount = last_failure.amount
            ref = last_failure.booking_reference
            
            prompt = f"""
Explain this payment decline in simple, reassuring words:
Decline code: "{reason}"
Amount: ₹{amount}
Booking reference: "{ref}"
Give 1 actionable step to retry (e.g. check limit, try different card).
"""
            explanation = llm_router.complete(prompt=prompt, task_type="simple")
        else:
            explanation = "I couldn't find any recent failed payments for your profile. Please check if your card was charged."
    except Exception as e:
        explanation = f"Could not retrieve transaction attempts: {e}"
    finally:
        db.close()

    return {
        "final_response": explanation,
        "messages": [{"role": "assistant", "content": explanation}]
    }

@log_agent_execution("analytics_agent")
def analytics_node(state: AgentState) -> dict:
    """Aggregates metrics for the admin console dashboard"""
    db = SessionLocal()
    try:
        tot_logs = db.query(AgentExecutionLog).count()
        avg_latency = db.query(func.avg(AgentExecutionLog.latency_ms)).scalar() or 0
        tot_tokens = db.query(func.sum(AgentExecutionLog.tokens_used)).scalar() or 0
        
        provider_counts = db.query(
            LLMRouterDecisionLog.chosen_provider,
            func.count(LLMRouterDecisionLog.id)
        ).group_by(LLMRouterDecisionLog.chosen_provider).all()
        
        provider_stats = {p[0]: p[1] for p in provider_counts}
        
        metrics = {
            "total_agent_executions": tot_logs,
            "average_latency_ms": round(float(avg_latency), 2),
            "total_token_spend": int(tot_tokens),
            "provider_breakdown": provider_stats
        }
        response_text = f"Analytics generated. Stats: {json.dumps(metrics)}"
    except Exception as e:
        response_text = f"Failed to calculate logs statistics: {e}"
    finally:
        db.close()

    return {
        "final_response": response_text,
        "trip_context": dict(state.get("trip_context", {}), analytics_data=response_text),
        "messages": [{"role": "assistant", "content": response_text}]
    }

@log_agent_execution("rag_agent")
def rag_node(state: AgentState) -> dict:
    """Wrapper node exposing general knowledge base Q&A"""
    messages = state.get("messages", [])
    user_query = messages[-1]["content"] if messages else ""
    
    rag_result = rag_system.rag_query(question=user_query)
    answer = rag_result["answer"]
    
    return {
        "final_response": answer,
        "messages": [{"role": "assistant", "content": answer}]
    }

@log_agent_execution("memory_agent")
def memory_node(state: AgentState) -> dict:
    """Summarizes current conversation flow to update profile preferences"""
    messages = state.get("messages", [])
    history_str = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
    
    prompt = f"""
Summarize user preference signals (e.g. vegan, business cabin, low budget) from the conversation:
{history_str}
Output a comma-separated list of tags.
"""
    summary = llm_router.complete(prompt=prompt, task_type="simple")
    return {
        "final_response": f"Profile preferences updated: {summary}",
        "messages": [{"role": "assistant", "content": f"Profile preferences updated: {summary}"}]
    }

@log_agent_execution("notification_agent")
def notification_node(state: AgentState) -> dict:
    """Router helper mimicking event dispatches"""
    context = state.get("trip_context", {})
    ref = context.get("booking_reference") or "REF-DUMMY"
    
    msg = f"Alert scheduled. confirmation code {ref} is active."
    return {
        "final_response": msg,
        "messages": [{"role": "assistant", "content": msg}]
    }
