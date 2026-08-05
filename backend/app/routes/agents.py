from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
import logging

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.ai_agents.supervisor import SupervisorAgent, supervisor_graph
from app.memory.memory_manager import MemoryManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    response: str

@router.post("/chat", response_model=ChatResponse)
def chat_turn(
    req: ChatRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        response = SupervisorAgent.execute_chat_turn(
            user_id=user.id,
            session_id=req.session_id,
            message=req.message
        )
        return {"response": response}
    except RuntimeError as e:
        import traceback
        logger.error(f"Agent config error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Agent execution error: {type(e).__name__}: {e}\n{tb}")
        raise HTTPException(status_code=500, detail="Internal agent execution error")




@router.get("/chat/history/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    try:
        history = MemoryManager.get_conversation_history(session_id)
        return {"history": history}
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat history")


@router.get("/preferences")
def get_user_preferences(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        from app.models.agents import UserPreferenceEmbedding
        results = db.query(UserPreferenceEmbedding).filter(UserPreferenceEmbedding.user_id == user.id).all()
        return {"preferences": [r.summary_text for r in results]}
    except Exception as e:
        logger.error(f"Error fetching preferences: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user preferences")


@router.websocket("/chat/ws/{session_id}")
async def chat_ws_endpoint(websocket: WebSocket, session_id: str, db: Session = Depends(get_db)):
    # 1. Accept WebSocket Connection
    await websocket.accept()
    
    # 2. Extract Token and Authenticate
    # (FastAPI dependencies aren't automatically fully resolved inside raw WebSockets on some configurations,
    # so we read the token passed either as a subprotocol or inside the first message)
    user_id = 1 # Fallback dummy user for sandboxed/local testing if token missing
    
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            message_text = payload.get("message")
            token = payload.get("token")
            
            if token:
                # Resolve user from token
                from app.auth.jwt import decode_token
                user_payload = decode_token(token)
                if user_payload:
                    from app.models.core import User
                    user = db.query(User).filter(User.email == user_payload.get("sub")).first()
                    if user:
                        user_id = user.id

            if not message_text:
                await websocket.send_text(json.dumps({"error": "Empty message"}))
                continue
                
            # Send initial progress state
            await websocket.send_text(json.dumps({
                "type": "status",
                "status": "Supervisor classifying intent..."
            }))
            
            # Execute Chat turn and respond
            try:
                async def status_callback(status_msg: str):
                    try:
                        await websocket.send_text(json.dumps({
                            "type": "status",
                            "status": status_msg
                        }))
                    except Exception:
                        pass

                # Fetch final response asynchronously
                response = await SupervisorAgent.execute_chat_turn_async(
                    user_id=user_id,
                    session_id=session_id,
                    message=message_text,
                    status_callback=status_callback
                )
                
                # Simulate token streaming of the response to show smooth Framer Motion typing
                words = response.split(" ")
                current_text = ""
                for idx, word in enumerate(words):
                    current_text += (word + " ")
                    # Yield incremental chunks
                    await websocket.send_text(json.dumps({
                        "type": "chunk",
                        "text": word + " "
                    }))
                    import asyncio
                    await asyncio.sleep(0.03) # smooth simulation of network streaming
                
                # Send complete event
                await websocket.send_text(json.dumps({
                    "type": "done",
                    "full_response": response
                }))

            except Exception as e:
                import traceback
                tb = traceback.format_exc()
                err_str = str(e)
                logger.error(f"[WS] Agent execution error for session {session_id}: {err_str}\n{tb}")

                # Classify the error for a useful user-facing message
                if "429" in err_str or "Too Many Requests" in err_str or "rate_limit" in err_str.lower():
                    user_msg = "AI rate limit reached. Please wait a moment and try again."
                elif "No LLM provider" in err_str or "GROQ_API_KEY" in err_str:
                    user_msg = "AI is not configured. Please contact support."
                elif "Connection refused" in err_str or "ConnectionRefused" in err_str:
                    user_msg = "AI service unreachable. Please try again in a few seconds."
                elif "timeout" in err_str.lower():
                    user_msg = "AI request timed out. Please try a simpler query or try again."
                else:
                    user_msg = f"Agent error: {err_str[:200]}"

                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": user_msg
                }))
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket session disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


@router.delete("/session/{session_id}/reset")
def reset_session(session_id: str, user=Depends(get_current_user)):
    """Clears the active session context and history for a fresh chat start."""
    try:
        MemoryManager.clear_active_context(session_id)
        return {"message": f"Session {session_id} has been reset successfully."}
    except Exception as e:
        logger.error(f"Error resetting session: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset session")


@router.get("/preferences/categories")
def get_preferences_by_category(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns all preferences organized by category (airlines, hotels, dietary, travel_style, budget, general)."""
    try:
        categorized = MemoryManager.get_all_user_preferences(user_id=user.id)
        total = sum(len(v) for v in categorized.values())
        return {
            "user_id": user.id,
            "total_preferences": total,
            "categories": categorized
        }
    except Exception as e:
        logger.error(f"Error fetching categorized preferences: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch categorized preferences")


@router.get("/debug/{session_id}")
def get_debug_telemetry(session_id: str, user=Depends(get_current_user)):
    """Returns the debug telemetry from the last agent execution for a session.
    Includes: agent_route, memory_hits, total_latency_ms, pref_summary, rag_used, tool_calls.
    """
    try:
        active_ctx = MemoryManager.get_active_context(session_id)
        telemetry = active_ctx.get("last_debug_telemetry", {})

        # Supplement with AgentExecutionLog from DB for the most recent trace
        from app.models.agents import AgentExecutionLog
        from app.database import SessionLocal
        db_local = SessionLocal()
        try:
            # Get recent execution logs for this session
            trace_prefix = f"trace_{session_id}_"
            recent_logs = db_local.query(AgentExecutionLog).filter(
                AgentExecutionLog.trace_id.like(f"{trace_prefix}%")
            ).order_by(AgentExecutionLog.created_at.desc()).limit(20).all()

            db_agent_route = []
            total_tokens = 0
            for log in recent_logs:
                db_agent_route.append({
                    "agent": log.agent_name,
                    "status": log.status,
                    "latency_ms": log.latency_ms,
                    "tokens_used": log.tokens_used,
                    "provider": log.llm_provider_used,
                    "timestamp": log.created_at.isoformat() if log.created_at else None
                })
                total_tokens += log.tokens_used or 0

            if db_agent_route:
                telemetry["db_agent_route"] = db_agent_route
                telemetry["total_tokens_used"] = total_tokens
        except Exception as db_ex:
            logger.warning(f"Could not read AgentExecutionLog: {db_ex}")
        finally:
            db_local.close()

        # Enrich with preference summary
        try:
            categorized = MemoryManager.get_all_user_preferences(user_id=user.id)
            telemetry["preference_categories"] = {k: len(v) for k, v in categorized.items()}
            telemetry["total_preferences_loaded"] = sum(len(v) for v in categorized.values())
        except Exception:
            pass

        return {
            "session_id": session_id,
            "user_id": user.id,
            "telemetry": telemetry
        }
    except Exception as e:
        logger.error(f"Error fetching debug telemetry: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch debug telemetry")


