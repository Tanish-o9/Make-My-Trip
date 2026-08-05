import time
import uuid
import json
import logging
from typing import TypedDict, List, Dict, Any, Annotated, Optional
import operator
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.agents import AgentExecutionLog

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    user_id: int
    session_id: str
    trace_id: str
    messages: Annotated[List[Dict[str, Any]], operator.add]
    trip_context: Dict[str, Any]
    budget_constraints: Dict[str, Any]
    active_task: str
    current_agent: str
    final_response: str
    pending_agents: List[str]
    collected_data: Dict[str, Any]
    preferences: List[str]
    # Debug telemetry — populated by each agent via decorator, surfaced to frontend/API
    debug_telemetry: Dict[str, Any]


def log_agent_execution(agent_name: str):
    """Decorator that logs agent execution to DB and populates debug_telemetry in state."""
    def decorator(func):
        def wrapper(state: AgentState, *args, **kwargs):
            start_time = time.time()
            trace_id = state.get("trace_id") or str(uuid.uuid4())
            status = "success"
            output_str = ""
            tokens_count = 0
            provider_used = "router"
            result = None
            db = None

            try:
                result = func(state, *args, **kwargs)
                if isinstance(result, dict):
                    output_str = str(result.get("final_response", ""))[:2000]
                    tokens_count = int(result.get("tokens_used", 0) or 0)
                    provider_used = result.get("llm_provider", "router")
                else:
                    output_str = str(result)[:2000]
                return result
            except Exception as e:
                status = "failure"
                output_str = f"Error: {str(e)}"
                raise e
            finally:
                latency = int((time.time() - start_time) * 1000)

                # === Append per-agent telemetry to state ===
                if isinstance(result, dict):
                    telemetry = dict(result.get("debug_telemetry") or state.get("debug_telemetry") or {})
                    route = list(telemetry.get("agent_route", []))
                    route.append({
                        "agent": agent_name,
                        "status": status,
                        "latency_ms": latency,
                        "tokens_used": tokens_count,
                        "provider": provider_used,
                        "output_preview": output_str[:300]
                    })
                    telemetry["agent_route"] = route
                    telemetry["total_latency_ms"] = telemetry.get("total_latency_ms", 0) + latency
                    result["debug_telemetry"] = telemetry

                # === Write to DB (non-fatal: agent must not crash if DB fails) ===
                try:
                    db = SessionLocal()
                    log_entry = AgentExecutionLog(
                        trace_id=trace_id,
                        agent_name=agent_name,
                        input_data=json_safe_dumps(state.get("messages", [])[-1:]),
                        output_data=output_str,
                        tokens_used=tokens_count,
                        latency_ms=latency,
                        llm_provider_used=provider_used,
                        status=status
                    )
                    db.add(log_entry)
                    db.commit()
                except Exception as ex:
                    logger.error(f"Failed to write AgentExecutionLog for {agent_name}: {ex}")
                    try:
                        if db:
                            db.rollback()
                    except Exception:
                        pass
                finally:
                    try:
                        if db:
                            db.close()
                    except Exception:
                        pass


        return wrapper
    return decorator


def json_safe_dumps(obj) -> str:
    try:
        return json.dumps(obj, default=str)
    except Exception:
        return str(obj)
