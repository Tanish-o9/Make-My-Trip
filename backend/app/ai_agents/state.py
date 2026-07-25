import time
import uuid
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

def log_agent_execution(agent_name: str):
    """Decorator to log agent execution to the AgentExecutionLog database table"""
    def decorator(func):
        def wrapper(state: AgentState, *args, **kwargs):
            start_time = time.time()
            trace_id = state.get("trace_id") or str(uuid.uuid4())
            db: Session = SessionLocal()
            status = "success"
            output_str = ""
            tokens_count = 0
            provider_used = "router"
            
            try:
                # Execute the agent node
                result = func(state, *args, **kwargs)
                # Read output from state if returned
                if isinstance(result, dict) and "final_response" in result:
                    output_str = str(result["final_response"])
                else:
                    output_str = str(result)
                return result
            except Exception as e:
                status = "failure"
                output_str = f"Error: {str(e)}"
                raise e
            finally:
                latency = int((time.time() - start_time) * 1000)
                try:
                    log_entry = AgentExecutionLog(
                        trace_id=trace_id,
                        agent_name=agent_name,
                        input_data=json_safe_dumps(state.get("messages", [])[-1:]),
                        output_data=output_str[:2000],  # Truncated limit
                        tokens_used=tokens_count,
                        latency_ms=latency,
                        llm_provider_used=provider_used,
                        status=status
                    )
                    db.add(log_entry)
                    db.commit()
                except Exception as ex:
                    logger.error(f"Failed to write AgentExecutionLog: {ex}")
                finally:
                    db.close()
        return wrapper
    return decorator

def json_safe_dumps(obj) -> str:
    try:
        return json.dumps(obj)
    except Exception:
        return str(obj)

import json
