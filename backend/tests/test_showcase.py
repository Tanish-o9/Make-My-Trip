import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_showcase_offers():
    response = client.get("/api/v1/showcase/offers")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 4
    # Check that offer categories include flights, hotels, bank
    categories = [offer["category"] for offer in data]
    assert "flights" in categories
    assert "hotels" in categories
    assert "bank" in categories

def test_showcase_airlines():
    response = client.get("/api/v1/showcase/airlines")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    names = [airline["name"] for airline in data]
    assert "Air India" in names
    assert "IndiGo" in names
    assert "Vistara" in names

def test_showcase_hotels():
    response = client.get("/api/v1/showcase/hotels")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    names = [hotel["name"] for hotel in data]
    assert "Taj Hotels" in names
    assert "Hyatt Resorts" in names
