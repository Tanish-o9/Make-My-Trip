import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.search_entities import CabVehicle, City
from app.commands.seed import run_cabs

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def seed_test_cabs():
    db = SessionLocal()
    # Ensure test city exists
    city = db.query(City).filter(City.name == "Delhi").first()
    if not city:
        city = City(name="Delhi", country="India", lat=28.6139, lng=77.2090, timezone="Asia/Kolkata")
        db.add(city)
        db.commit()
    db.close()
    
    # Run cab seeder
    run_cabs()

def test_cab_inventory_image_keys_and_uniqueness():
    """Verify that all seeded vehicles have valid image_key and distinct identity"""
    db = SessionLocal()
    vehicles = db.query(CabVehicle).all()
    assert len(vehicles) > 0, "Vehicles must be seeded in database"

    seen_plates = set()
    model_to_image_keys = {}

    for v in vehicles:
        assert v.image_key is not None and len(v.image_key) > 0, f"Vehicle {v.id} ({v.display_name}) missing image_key"
        assert v.image_url is not None and len(v.image_url) > 0, f"Vehicle {v.id} missing image_url"
        assert v.plate_number is not None, f"Vehicle {v.id} missing plate_number"
        assert v.seating_capacity > 0, f"Vehicle {v.id} invalid seating capacity"
        assert v.brand is not None, f"Vehicle {v.id} missing brand"
        assert v.model is not None, f"Vehicle {v.id} missing model"

        # Unique physical plate numbers
        assert v.plate_number not in seen_plates, f"Duplicate plate number {v.plate_number} found"
        seen_plates.add(v.plate_number)

        # Ensure consistent image_key per model
        if v.model in model_to_image_keys:
            assert model_to_image_keys[v.model] == v.image_key, f"Model {v.model} has inconsistent image_key: {v.image_key} vs {model_to_image_keys[v.model]}"
        else:
            model_to_image_keys[v.model] = v.image_key

    db.close()

def test_cab_search_api_returns_image_metadata():
    """Verify that /api/v1/cabs/search returns image_key, image, and variant"""
    payload = {
        "pickup_address": "Indira Gandhi International Airport, Delhi",
        "drop_address": "Connaught Place, Delhi",
        "trip_type": "one_way",
        "passengers": 1,
        "luggage_count": 1
    }
    response = client.post("/api/v1/cabs/search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "options" in data
    assert len(data["options"]) > 0

    for opt in data["options"]:
        assert "image_key" in opt, "image_key missing from cab search option"
        assert "image" in opt or "image_url" in opt, "image URL missing from cab search option"
        assert "variant" in opt, "variant missing from cab search option"
        assert "seats" in opt or "seating_capacity" in opt, "seating capacity missing"
        assert "display_name" in opt, "display_name missing"
        assert opt["image_key"] in [
            "swift", "grand-i10", "dzire", "amaze", "verna", "creta", "seltos", 
            "xuv700", "ertiga", "innova-crysta", "carens", "camry", "mercedes-e-class", 
            "nexon-ev", "activa"
        ]

def test_cab_search_sorting_preserves_vehicle_identity():
    """Verify that sorting does not alter or corrupt vehicle images or IDs"""
    payload = {
        "pickup_address": "Delhi Airport",
        "drop_address": "Gurugram Cyber Hub",
        "trip_type": "one_way",
        "passengers": 2
    }
    resp1 = client.post("/api/v1/cabs/search", json=payload)
    assert resp1.status_code == 200
    opts = resp1.json()["options"]

    # Each vehicle option must strictly map model -> image_key
    for v in opts:
        if v["model"] == "Swift":
            assert v["image_key"] == "swift"
        elif v["model"] == "Dzire":
            assert v["image_key"] == "dzire"
        elif v["model"] == "Creta":
            assert v["image_key"] == "creta"
        elif v["model"] == "Innova Crysta":
            assert v["image_key"] == "innova-crysta"

def test_search_vertical_cabs_image_metadata():
    """Verify /api/v1/search?vertical=cabs provides full image metadata"""
    resp = client.get("/api/v1/search?vertical=cabs&origin=Delhi&destination=Agra&passengers=2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["vertical"] == "cabs"
    assert len(data["results"]) > 0

    first = data["results"][0]
    assert "image_key" in first
    assert "image" in first or "image_url" in first
    assert "display_name" in first
    assert "brand" in first
    assert "model" in first
