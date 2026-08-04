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
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal agent execution error")


@router.get("/chat/history/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    try:
        history = MemoryManager.get_conversation_history(session_id)
        return {"history": history}
    except Exception as e:
        logger.error(f"Error fetching chat history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat history")


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
                logger.error(f"Error in WebSocket execution: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Error occurred during agent compilation."
                }))
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket session disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
