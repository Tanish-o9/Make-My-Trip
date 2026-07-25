import json
import logging
import base64
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ai_agents.supervisor import SupervisorAgent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])

class AudioTranscriberService:
    """Mock Deepgram Streaming STT Service"""
    @staticmethod
    def bytes_to_text(audio_bytes: bytes) -> str:
        # Simple simulated voice activation trigger:
        # In production, stream bytes to Deepgram connection:
        # dg_client.send(audio_bytes)
        return "Recommend flights from Delhi to Goa on December 15th"

class SpeechSynthesizerService:
    """Mock ElevenLabs Streaming TTS Service"""
    @staticmethod
    def text_to_mulaw_base64(text: str) -> str:
        # Returns a mock base64 audio payload conforming to Mulaw format:
        # In production, stream via ElevenLabs client:
        # eleven_labs.generate(text, model="eleven_monolingual_v1", codec="mulaw_8000")
        dummy_audio = b"\xff" * 200 # Mulaw silent carrier frames
        return base64.b64encode(dummy_audio).decode("utf-8")


@router.websocket("/stream")
async def voice_media_stream_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint targeting Twilio media stream calls.
    Conforms to Twilio's Audio Streaming Protocol:
    https://www.twilio.com/docs/voice/api/media-streams
    """
    await websocket.accept()
    logger.info("Twilio voice media stream connection established.")
    
    stream_sid = None
    interrupted = False

    try:
        while True:
            packet = await websocket.receive_text()
            data = json.loads(packet)
            
            event = data.get("event")
            
            if event == "start":
                stream_sid = data["start"]["streamSid"]
                logger.info(f"Twilio Call Stream Started: {stream_sid}")
                
            elif event == "media":
                payload_b64 = data["media"]["payload"]
                audio_bytes = base64.b64decode(payload_b64)
                
                # 1. Speech-to-Text (STT) via Deepgram
                user_transcript = AudioTranscriberService.bytes_to_text(audio_bytes)
                
                if user_transcript and not interrupted:
                    logger.info(f"STT Transcript: '{user_transcript}'")
                    
                    # Interruption check: If user starts speaking while output is streaming,
                    # we would immediately dispatch a Twilio 'clear' event.
                    
                    # 2. Query Supervisor Agent
                    agent_reply = SupervisorAgent.execute_chat_turn(
                        user_id=1,
                        session_id=f"voice_{stream_sid or 'dummy'}",
                        message=user_transcript
                    )
                    
                    # Extract raw text from reply markdown
                    clean_reply = agent_reply.replace("**", "").replace("#", "")
                    logger.info(f"Agent Vocalizing: '{clean_reply[:50]}...'")
                    
                    # 3. Text-to-Speech (TTS) via ElevenLabs
                    mulaw_payload = SpeechSynthesizerService.text_to_mulaw_base64(clean_reply)
                    
                    # Stream Mulaw frames back to Twilio
                    response_payload = {
                        "event": "media",
                        "streamSid": stream_sid,
                        "media": {
                            "payload": mulaw_payload
                        }
                    }
                    await websocket.send_text(json.dumps(response_payload))
                    
            elif event == "stop":
                logger.info(f"Twilio Call Stream Stopped: {stream_sid}")
                break
                
    except WebSocketDisconnect:
        logger.info("Twilio voice media stream disconnected.")
    except Exception as e:
        logger.error(f"Voice gateway stream error: {e}")
        try:
            await websocket.close()
        except:
            pass
