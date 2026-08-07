import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.core import User, WalletAccount
from decimal import Decimal

client = TestClient(app)

@pytest.fixture
def clean_hotel_user():
    db = SessionLocal()
    user_email = "hotel_test_user@travelos.com"
    
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
    
    wallet = WalletAccount(user_id=user.id, balance=Decimal("50000.00"), currency="INR")
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

def test_hotel_booking_engine_lifecycle(clean_hotel_user):
    user = clean_hotel_user
    from app.auth.jwt import create_access_token
    token = create_access_token(data={"sub": user.email, "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Search Hotels (POST)
    search_payload = {
        "city": "Goa",
        "check_in": "2026-12-15",
        "check_out": "2026-12-20",
        "adults": 2,
        "rooms": 1
    }
    search_res = client.post("/api/v1/hotels/search", json=search_payload, headers=headers)
    assert search_res.status_code == 200
    hotels_list = search_res.json()
    assert len(hotels_list) > 0
    selected_hotel = hotels_list[0]
    
    # 2. Hold Room
    hold_payload = {
        "hotel_id": selected_hotel["hotelId"],
        "hotel_name": selected_hotel["hotelName"],
        "room_type": "Deluxe Palace Suite",
        "amount": selected_hotel["price"],
        "check_in": "2026-12-15",
        "check_out": "2026-12-20",
        "provider_name": "HotelBeds",
        "details": {
            "address": selected_hotel["address"]
        }
    }
    hold_res = client.post("/api/v1/hotels/hold", json=hold_payload, headers=headers)
    assert hold_res.status_code == 200
    hold_data = hold_res.json()
    booking_ref = hold_data["booking_reference"]
    assert hold_data["status"] == "room_held"
    
    # 3. Revalidate (no change)
    reval_res = client.post("/api/v1/hotels/revalidate", json={"booking_reference": booking_ref}, headers=headers)
    assert reval_res.status_code == 200
    assert reval_res.json()["price_changed"] is False
    
    # 4. Revalidate with change trigger
    change_ref = f"{booking_ref}_revalidate_change"
    reval_change_res = client.post("/api/v1/hotels/revalidate", json={"booking_reference": change_ref}, headers=headers)
    assert reval_change_res.status_code == 200
    reval_change_data = reval_change_res.json()
    assert reval_change_data["price_changed"] is True
    assert reval_change_data["new_price"] == reval_change_data["old_price"] + 2000.0
    
    # 5. Book Room (Guest registration)
    book_payload = {
        "booking_reference": booking_ref,
        "guests": [
            {
                "name": "Jane Doe",
                "dob": "1995-02-15",
                "gender": "F",
                "email": "jane@example.com",
                "phone": "9876543210"
            }
        ]
    }
    book_res = client.post("/api/v1/hotels/book", json=book_payload, headers=headers)
    assert book_res.status_code == 200
    assert book_res.json()["status"] == "payment_pending"
    
    # 6. Reservation Details ( Timeline )
    res_details = client.get(f"/api/v1/hotels/reservation/{booking_ref}", headers=headers)
    assert res_details.status_code == 200
    details_data = res_details.json()
    assert details_data["status"] == "payment_pending"
    assert len(details_data["timeline"]) >= 2  # room_held, guest_validated
    
    # 7. Digital Voucher
    voucher_res = client.get(f"/api/v1/hotels/voucher/{booking_ref}", headers=headers)
    assert voucher_res.status_code == 200
    voucher_data = voucher_res.json()
    assert "voucher_number" in voucher_data
    assert voucher_data["hotel_name"] == selected_hotel["hotelName"]
    
    # 8. Cancel & Refund
    cancel_res = client.post("/api/v1/hotels/engine/cancel", json={"booking_reference": booking_ref}, headers=headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"
    
    refund_res = client.post("/api/v1/hotels/engine/refund", json={"booking_reference": booking_ref}, headers=headers)
    assert refund_res.status_code == 200
    assert refund_res.json()["status"] == "refunded"
