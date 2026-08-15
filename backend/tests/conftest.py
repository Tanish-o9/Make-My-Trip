import os
import sys

# Force SQLite DATABASE_URL for all tests before any module imports app.database
os.environ["DATABASE_URL"] = "sqlite:///./test_travel_os.db"

if os.path.exists("./test_travel_os.db"):
    try:
        os.remove("./test_travel_os.db")
    except Exception:
        pass

# Initialize SQLite database schema
from app.database import engine, Base

# Import all models to register them on Base.metadata
from app.models import core, bookings, showcase, mybiz, wishlist, price_alert, agents, payments, audit
from app.models.core import EmailVerification  # ensure email_verifications table is created
# Import route modules that define inline ORM models
from app.routes import crm  # Registers SupportTicket, TicketReply


Base.metadata.create_all(bind=engine)

import pytest
from unittest.mock import AsyncMock

@pytest.fixture(autouse=True)
def mock_external_providers(monkeypatch):
    # Mock WeatherManager
    from app.providers.weather.manager import WeatherManager
    monkeypatch.setattr(WeatherManager, "get_current_weather", AsyncMock(return_value={"temperature": 25, "feelsLike": 27, "weather": "Sunny"}))
    monkeypatch.setattr(WeatherManager, "get_forecast", AsyncMock(return_value=[]))
    monkeypatch.setattr(WeatherManager, "get_travel_recommendations", AsyncMock(return_value={"rainProbability": 10, "packingSuggestions": ["T-shirt"], "bestTimeToTravel": "November to February", "clothingRecommendation": "Light cottons"}))
    
    # Mock MapsManager
    from app.providers.maps.manager import MapsManager
    monkeypatch.setattr(MapsManager, "convert_city_to_coordinates", AsyncMock(return_value={"latitude": 15.2993, "longitude": 74.1240}))
    monkeypatch.setattr(MapsManager, "search_nearby", AsyncMock(return_value=[{"name": "Mock Attraction", "rating": 4.5}]))

    # Mock MemoryManager to bypass Redis and ChromaDB
    from app.memory.memory_manager import MemoryManager
    monkeypatch.setattr(MemoryManager, "_get_chroma", classmethod(lambda cls: None))
    monkeypatch.setattr(MemoryManager, "_get_redis", classmethod(lambda cls: None))
    monkeypatch.setattr(MemoryManager, "_chroma_client", None)
    monkeypatch.setattr(MemoryManager, "_redis_client", None)

    # Mock AI tools to bypass flight/hotel provider networks at source and namespace level
    import app.ai_tools.flight_tool
    import app.ai_agents.booking_agents
    mock_flight_res = lambda **k: {"results": [{"airline": "Indigo", "price": 5000, "departureTime": "2026-12-15T08:30:00", "arrivalTime": "2026-12-15T10:45:00", "flightNumber": "6E-101", "departureAirport": "DEL", "arrivalAirport": "BOM", "cabin_class": "ECONOMY", "baggage": "15 KG", "logo": ""}]}
    monkeypatch.setattr(app.ai_tools.flight_tool, "flight_search_tool", mock_flight_res)
    monkeypatch.setattr(app.ai_agents.booking_agents, "flight_search_tool", mock_flight_res)
    
    import app.ai_tools.hotel_tool
    mock_hotel_res = lambda **k: {"results": [{"name": "Mock Taj Hotel", "price": 10000, "rating": 4.8, "address": "Goa, India", "amenities": ["Wifi", "Pool"], "hotel_tier": "LUXURY"}]}
    monkeypatch.setattr(app.ai_tools.hotel_tool, "hotel_search_tool", mock_hotel_res)
    monkeypatch.setattr(app.ai_agents.booking_agents, "hotel_search_tool", mock_hotel_res)

    # Mock RAGSystem to bypass ChromaDB
    from app.rag.retriever import RAGSystem
    monkeypatch.setattr(RAGSystem, "_get_client", lambda self: None)

    # Mock redis_client in app.services.resilience to force local memory fallback
    import app.services.resilience
    monkeypatch.setattr(app.services.resilience, "redis_client", None)


@pytest.fixture(scope="session", autouse=True)
def clean_database():
    """Clean all tables once at the start of the test session to prevent pollution."""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        # Delete from all tables in reverse sorted order to satisfy foreign keys
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    except Exception as e:
        print(f"Failed to clean database tables: {e}")
        db.rollback()
    finally:
        db.close()









