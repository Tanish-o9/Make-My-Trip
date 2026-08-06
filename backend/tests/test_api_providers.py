import pytest
from app.providers.registry import provider_registry

@pytest.mark.anyio
async def test_flight_provider_manager_fallback():
    results = await provider_registry.flight_manager.search_all("DEL", "GOI", "2026-12-15")
    assert len(results) > 0
    assert results[0].provider_name in ["MockFlight", "Amadeus", "AviationStack"]
    assert results[0].details["flight_number"] is not None

@pytest.mark.anyio
async def test_hotel_provider_manager_fallback():
    results = await provider_registry.hotel_manager.search_all("Goa", "2026-12-15", "2026-12-20")
    assert len(results) > 0
    assert results[0].provider_name in ["MockHotel", "HotelBeds", "AmadeusHotels"]

@pytest.mark.anyio
async def test_weather_manager_fallback():
    weather = await provider_registry.weather_manager.get_weather_for_city("Goa")
    assert weather["temperature"] is not None
    assert "forecast" in weather

@pytest.mark.anyio
async def test_maps_manager_fallback():
    directions = await provider_registry.maps_manager.get_route_directions("Delhi", "Goa")
    assert "distance" in directions
    assert "duration" in directions
    
    spots = await provider_registry.maps_manager.search_nearby("Goa", "restaurant")
    assert len(spots) > 0

@pytest.mark.anyio
async def test_currency_manager_fallback():
    rate = await provider_registry.currency_manager.get_conversion_rate("USD", "INR")
    assert rate > 0.0
