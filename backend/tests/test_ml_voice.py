import os
# Force SQLite database URL for offline test isolation before importing any app modules
os.environ["DATABASE_URL"] = "sqlite:///./test_travel_os.db"

import pytest
import json
import base64
from fastapi.testclient import TestClient
from app.database import engine, Base
from app.main import app
from app.ml.fraud_model import FraudInferenceRequest
from app.ai_agents.specialists import currency_conversion_node, restaurant_recommendation_node
from app.ai_agents.state import AgentState

# Initialize SQLite database schema
Base.metadata.create_all(bind=engine)

client = TestClient(app)

from app.ai_router.router import llm_router
def mock_complete(prompt, task_type="simple", **kwargs):
    if "intent" in prompt:
        return "flight_search"
    if "recommendation" in prompt or "identify" in prompt:
        return """{
            "price": 5200.0,
            "recommendation": "BOOK_NOW",
            "confidence": 0.9,
            "trend": "RISING",
            "reasoning": "Holiday demand rising",
            "escalate": false,
            "destination_country": "Schengen",
            "citizenship": "Indian"
        }"""
    return "Spice Goa is a great place to eat vegan food in Goa."

llm_router.complete = mock_complete


def test_ml_fraud_inference_endpoint():
    # 1. Test low risk (approved/allow)
    req_allow = {
        "ip_mismatch": 0,
        "recent_bookings_count": 0,
        "card_status_invalid": 0,
        "transaction_amount": 1000.0
    }
    response = client.post("/api/v1/ml/fraud-predict", json=req_allow)
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "allow"
    assert data["risk_score"] < 0.40

    # 2. Test high risk (block)
    req_block = {
        "ip_mismatch": 1,
        "recent_bookings_count": 5,
        "card_status_invalid": 1,
        "transaction_amount": 50000.0
    }
    response = client.post("/api/v1/ml/fraud-predict", json=req_block)
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "block"
    assert data["risk_score"] >= 0.80


def test_specialist_agent_nodes():
    # 1. Test Currency Conversion Agent Node
    state = {
        "user_id": 1,
        "messages": [{"role": "user", "content": "How much cash should I carry to Goa?"}],
        "trip_context": {
            "destination": "Goa",
            "duration_days": 4,
            "target_currency": "USD"
        },
        "budget_constraints": {},
        "final_response": ""
    }
    
    res = currency_conversion_node(state)
    assert "final_response" in res
    assert "Recommended Total Cash" in res["final_response"]
    assert "USD" in res["final_response"]

    # 2. Test Restaurant Recommendation Agent Node
    state_rest = {
        "user_id": 1,
        "messages": [{"role": "user", "content": "Where to eat in Goa?"}],
        "trip_context": {
            "destination": "Goa",
            "dietary_preferences": "vegan"
        },
        "budget_constraints": {},
        "final_response": ""
    }
    res_rest = restaurant_recommendation_node(state_rest)
    assert "final_response" in res_rest
    assert len(res_rest["messages"]) > 0


def test_voice_stream_events():
    # Test WebSocket connection to the Twilio voice streaming route
    with client.websocket_connect("/api/v1/voice/stream") as websocket:
        # Send start event
        start_payload = {
            "event": "start",
            "start": {
                "streamSid": "test_stream_12345"
            }
        }
        websocket.send_text(json.dumps(start_payload))
        
        # Send a media event containing silent Mulaw audio
        media_payload = {
            "event": "media",
            "media": {
                "payload": base64.b64encode(b"\xff" * 100).decode("utf-8")
            }
        }
        websocket.send_text(json.dumps(media_payload))
        
        # Capture response frame sent back by EleventhLabs/Deepgram mock
        resp_data = websocket.receive_text()
        resp = json.loads(resp_data)
        assert resp["event"] == "media"
        assert "payload" in resp["media"]
        
        # Send stop event
        stop_payload = {
            "event": "stop"
        }
        websocket.send_text(json.dumps(stop_payload))
