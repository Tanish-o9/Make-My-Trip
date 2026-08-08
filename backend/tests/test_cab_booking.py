import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User

client = TestClient(app)

@pytest.fixture
def clean_cab_user():
    db = SessionLocal()
    user_email = "cab_test_user@travelos.com"
    
    # Clean old test data
    user = db.query(User).filter(User.email == user_email).first()
    if user:
        db.delete(user)
        db.commit()
        
    user = User(email=user_email)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    yield user
    
    db = SessionLocal()
    user = db.query(User).filter(User.email == user_email).first()
    if user:
        db.delete(user)
        db.commit()
    db.close()

def test_cab_booking_engine_lifecycle(clean_cab_user):
    user = clean_cab_user
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Search Cabs
    search_payload = {
        "pickup_address": "Indira Gandhi International Airport, Delhi",
        "drop_address": "Connaught Place, Delhi",
        "trip_type": "airport_transfer"
    }
    search_res = client.post("/api/v1/cabs/search", json=search_payload, headers=headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert "options" in search_data
    assert len(search_data["options"]) > 0
    selected_cab = search_data["options"][0]
    
    # 2. Fare Estimate
    est_payload = {
        "pickup_address": "Indira Gandhi International Airport, Delhi",
        "drop_address": "Connaught Place, Delhi",
        "cab_type": selected_cab["cab_type"]
    }
    est_res = client.post("/api/v1/cabs/estimate", json=est_payload, headers=headers)
    assert est_res.status_code == 200
    assert "final_fare" in est_res.json()
    
    # 3. Book Cab
    book_payload = {
        "pickup_address": "Indira Gandhi International Airport, Delhi",
        "drop_address": "Connaught Place, Delhi",
        "cab_type": selected_cab["cab_type"],
        "amount": float(selected_cab["fare"])
    }
    book_res = client.post("/api/v1/cabs/book", json=book_payload, headers=headers)
    assert book_res.status_code == 200
    book_data = book_res.json()
    booking_ref = book_data["booking_reference"]
    assert book_data["status"] == "driver_assigned"
    
    # 4. Ride History
    history_res = client.get("/api/v1/cabs/history", headers=headers)
    assert history_res.status_code == 200
    assert len(history_res.json()) > 0
    
    # 5. Get Booking Details
    details_res = client.get(f"/api/v1/cabs/{booking_ref}", headers=headers)
    assert details_res.status_code == 200
    assert details_res.json()["status"] == "confirmed"
    
    # 6. Live Tracking
    track_res = client.get(f"/api/v1/cabs/{booking_ref}/track", headers=headers)
    assert track_res.status_code == 200
    track_data = track_res.json()
    assert "driver_coordinates" in track_data
    
    # 7. Share Ride
    share_res = client.post("/api/v1/cabs/share", json={"booking_reference": booking_ref, "phone_number": "9876543210"}, headers=headers)
    assert share_res.status_code == 200
    assert "shared_link" in share_res.json()
    
    # 8. Cancel Cab
    cancel_res = client.post("/api/v1/cabs/cancel", json={"booking_reference": booking_ref}, headers=headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"
