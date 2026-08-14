import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount
from decimal import Decimal

client = TestClient(app)

@pytest.fixture
def clean_buses_user():
    db = SessionLocal()
    user_email = "buses_test_user@travelos.com"
    
    # Clean old test data
    user = db.query(User).filter(User.email == user_email).first()
    if user:
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.delete(user)
        db.commit()
        
    user = User(email=user_email)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    wallet = WalletAccount(user_id=user.id, balance=Decimal("10000.00"), currency="INR")
    db.add(wallet)
    db.commit()
    
    yield user
    
    db = SessionLocal()
    user = db.query(User).filter(User.email == user_email).first()
    if user:
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.delete(user)
        db.commit()
    db.close()

def test_buses_booking_lifecycle(clean_buses_user):
    user = clean_buses_user
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Search Buses
    search_res = client.get("/api/v1/search?vertical=buses&origin=Delhi&destination=Jaipur", headers=headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert "results" in search_data
    assert len(search_data["results"]) > 0
    selected_bus = search_data["results"][0]
    
    bus_id = selected_bus["id"]
    
    # 2. Get Details
    details_res = client.get(f"/api/v1/buses/{bus_id}/details", headers=headers)
    assert details_res.status_code == 200
    details_data = details_res.json()
    assert details_data["operator_name"] == selected_bus["operator_name"]
    
    # 3. Get Seat Map
    seats_res = client.get(f"/api/v1/buses/{bus_id}/seats", headers=headers)
    assert seats_res.status_code == 200
    seats_data = seats_res.json()
    assert "seats" in seats_data
    
    # Find available seats
    available_seats = [s for s in seats_data["seats"] if not s["is_occupied"]]
    assert len(available_seats) >= 2
    seats_to_book_objs = available_seats[:2]
    seats_to_book = [s["seat_number"] for s in seats_to_book_objs]
    
    # Calculate seat surcharge dynamically
    min_price_in_map = min(float(s.get("price", 9999)) for s in seats_data["seats"])
    total_seat_surcharge = sum(max(0.0, float(s.get("price", min_price_in_map)) - min_price_in_map) for s in seats_to_book_objs)
    
    base_total = selected_bus["price"] * 2
    subtotal = base_total + total_seat_surcharge
    tax = round(subtotal * 0.05, 2)
    req_amount = round(subtotal + tax + 50.0, 2)
    
    # 4. Create Hold booking
    hold_payload = {
        "vertical": "buses",
        "amount": req_amount,
        "details": {
            "bus_id": bus_id,
            "operator_name": selected_bus["operator_name"],
            "bus_type": selected_bus["bus_type"],
            "origin": "Delhi",
            "destination": "Jaipur",
            "journey_date": "2026-12-16",
            "departure_time": selected_bus["departure_time"],
            "seat_numbers": seats_to_book,
            "boarding_point": selected_bus["boarding_points"][0],
            "dropping_point": selected_bus["dropping_points"][0],
            "passengers": [
                {"name": "Alice Smith", "age": 25, "gender": "Female", "seat_number": seats_to_book[0]},
                {"name": "Bob Smith", "age": 28, "gender": "Male", "seat_number": seats_to_book[1]}
            ],
            "contact": {"email": user.email, "phone": "9876543210"}
        }
    }
    
    hold_res = client.post("/api/v1/bookings/hold", json=hold_payload, headers=headers)
    assert hold_res.status_code == 200, hold_res.json()
    hold_data = hold_res.json()
    booking_ref = hold_data["booking_reference"]
    assert hold_data["status"] == "hold"
    
    # 5. Confirm & Capture payment (with wallet payment method)
    confirm_res = client.post(f"/api/v1/bookings/confirm?booking_reference={booking_ref}&vertical=buses&payment_method=wallet", headers=headers)
    assert confirm_res.status_code == 200, confirm_res.json()
    confirm_data = confirm_res.json()
    assert confirm_data["booking_reference"] == booking_ref
    
    # 6. Retrieve booking details
    booking_details_res = client.get(f"/api/v1/bookings/details/{booking_ref}", headers=headers)
    assert booking_details_res.status_code == 200
    booking_details_data = booking_details_res.json()
    assert booking_details_data["vertical"] == "buses"
    assert booking_details_data["booking"]["status"] == "confirmed"
    
    # Ticket has passenger details
    ticket = booking_details_data["ticket"]
    assert len(ticket["passenger_details"]) == 2
    assert ticket["passenger_details"][0]["name"] == "Alice Smith"
    assert ticket["passenger_details"][0]["seat_number"] == seats_to_book[0]
