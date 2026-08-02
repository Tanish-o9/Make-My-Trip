import pytest
import time
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.core import User

client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    from app.models.bookings import FlightBooking
    from app.models.payments import ApprovalRequest, LedgerRow
    from app.models.core import WalletAccount
    db.query(ApprovalRequest).delete()
    db.query(LedgerRow).delete()
    db.query(FlightBooking).delete()
    db.query(WalletAccount).delete()
    db.query(User).delete()
    db.commit()
    db.close()
    yield
    db = SessionLocal()
    db.query(ApprovalRequest).delete()
    db.query(LedgerRow).delete()
    db.query(FlightBooking).delete()
    db.query(WalletAccount).delete()
    db.query(User).delete()
    db.commit()
    db.close()

def test_admin_login_success_and_role_restriction():
    db = SessionLocal()
    # Create an admin user and a customer user
    from app.auth.jwt import hash_password
    admin = User(
        email="super_admin@travelos.com",
        password_hash=hash_password("adminpass123"),
        role="super_admin"
    )
    customer = User(
        email="customer@travelos.com",
        password_hash=hash_password("custpass123"),
        role="user"
    )
    db.add(admin)
    db.add(customer)
    db.commit()
    db.close()

    # 1. Login with regular customer role -> should fail with 403 Forbidden
    login_resp = client.post("/api/admin/auth/login", json={
        "email": "customer@travelos.com",
        "password": "custpass123"
    })
    assert login_resp.status_code == 403
    assert "administrative privileges" in login_resp.json()["detail"]

    # 2. Login with admin role -> should succeed
    login_resp = client.post("/api/admin/auth/login", json={
        "email": "super_admin@travelos.com",
        "password": "adminpass123"
    })
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert data["role"] == "super_admin"

def test_admin_endpoint_gating():
    db = SessionLocal()
    from app.auth.jwt import hash_password
    admin = User(
        email="approver_admin@travelos.com",
        password_hash=hash_password("adminpass123"),
        role="approver"
    )
    db.add(admin)
    db.commit()
    db.close()

    # Get admin token
    login_resp = client.post("/api/admin/auth/login", json={
        "email": "approver_admin@travelos.com",
        "password": "adminpass123"
    })
    token = login_resp.json()["access_token"]

    # Request without token -> should fail 401
    claims_resp = client.get("/api/admin/claims")
    assert claims_resp.status_code == 401

    # Request with token -> should succeed 200
    headers = {"Authorization": f"Bearer {token}"}
    claims_resp = client.get("/api/admin/claims", headers=headers)
    assert claims_resp.status_code == 200

def test_admin_cors_restrictions():
    # Disallowed origin should return 403
    headers = {"Origin": "https://malicious-site.com"}
    resp = client.get("/api/admin/claims", headers=headers)
    assert resp.status_code == 403
    assert "Origin" in resp.json()["detail"]

    # Allowed origin should pass custom CORS middleware check
    headers = {"Origin": "http://localhost:5174"}
    resp = client.get("/api/admin/claims", headers=headers)
    assert resp.status_code == 401

def test_admin_login_rate_limiting():
    from app.routes.admin_panel import LOGIN_ATTEMPTS
    LOGIN_ATTEMPTS.clear()
    
    # Attempt login multiple times from the same IP (TestClient simulates localhost)
    # The first 3 attempts should process normally (might fail because of bad password)
    for _ in range(3):
        resp = client.post("/api/admin/auth/login", json={
            "email": "nonexistent@travelos.com",
            "password": "wrongpassword"
        })
        assert resp.status_code in [400, 403]
        
    # The 4th attempt should trigger 429 Too Many Requests
    resp = client.post("/api/admin/auth/login", json={
        "email": "nonexistent@travelos.com",
        "password": "wrongpassword"
    })
    assert resp.status_code == 429
    assert "Too many login attempts" in resp.json()["detail"]


def test_admin_refund_exception_processing():
    import datetime
    from app.routes.admin_panel import LOGIN_ATTEMPTS
    LOGIN_ATTEMPTS.clear()
    db = SessionLocal()
    from app.auth.jwt import hash_password
    from app.models.payments import ApprovalRequest, LedgerRow
    from app.models.bookings import FlightBooking, BookingStatus
    from app.models.core import WalletAccount
    
    # 1. Seed user, wallet, flight booking, and exception request
    admin = User(
        email="finance_admin@travelos.com",
        password_hash=hash_password("adminpass123"),
        role="finance_admin"
    )
    user = User(
        email="traveler@travelos.com",
        password_hash=hash_password("userpass123"),
        role="user"
    )
    db.add(admin)
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = user.id
    
    wallet = WalletAccount(user_id=user_id, balance=Decimal("1000.00"), currency="INR")
    db.add(wallet)
    
    booking = FlightBooking(
        booking_reference="BK-REFUND-ADJ",
        user_id=user_id,
        status=BookingStatus.CONFIRMED,
        total_amount=Decimal("10000.00"),
        origin="DEL", destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=5),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=5, hours=2),
        airline_code="AI", flight_number="202",
        pricing_snapshot={"base": 9000.0, "tax": 1000.0, "discount": 0.0},
        passenger_details=[{"name": "Tester User", "age": 28}]
    )
    db.add(booking)
    db.commit()
    
    approval = ApprovalRequest(
        request_type="refund_exception",
        reference_id="BK-REFUND-ADJ",
        requested_by=f"user_{user_id}",
        amount=10000.00,
        reason="Goodwill full refund request",
        status="PENDING"
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    db.close()
    
    # 2. Get admin login token
    login_resp = client.post("/api/admin/auth/login", json={
        "email": "finance_admin@travelos.com",
        "password": "adminpass123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Verify queue retrieval
    queue_resp = client.get("/api/admin/refunds/queue", headers=headers)
    assert queue_resp.status_code == 200
    data = queue_resp.json()
    assert len(data) >= 1
    target = [r for r in data if r["reference_id"] == "BK-REFUND-ADJ"][0]
    assert target["amount"] == 10000.00
    assert target["booking_details"]["vertical"] == "flight"
    
    # 4. Resolve via partial adjustment override (e.g. ₹6,500 instead of ₹10,000)
    resolve_resp = client.post(
        f"/api/admin/refunds/{approval.id}/resolve",
        headers=headers,
        json={
            "action": "adjust",
            "approved_amount": 6500.00,
            "notes": "Goodwill exception partial approval override"
        }
    )
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "APPROVED"
    
    # 5. Verify DB updates
    db = SessionLocal()
    booking_db = db.query(FlightBooking).filter(FlightBooking.booking_reference == "BK-REFUND-ADJ").first()
    assert booking_db.status == BookingStatus.REFUNDED
    
    wallet_db = db.query(WalletAccount).filter(WalletAccount.user_id == user_id).first()
    assert wallet_db.balance == Decimal("7500.00")  # 1000.00 starting + 6500.00 refund
    
    ledger_db = db.query(LedgerRow).filter(LedgerRow.booking_reference == "BK-REFUND-ADJ", LedgerRow.transaction_type == "refund").first()
    assert ledger_db is not None
    assert ledger_db.amount == 6500.00
    
    db.close()

def test_jwt_roles_in_login_token_and_guards():
    db = SessionLocal()
    from app.auth.jwt import hash_password, decode_token
    db.query(User).delete()
    admin = User(
        email="admin_role_test@travelos.com",
        password_hash=hash_password("adminpass123"),
        role="admin"
    )
    customer = User(
        email="customer_role_test@travelos.com",
        password_hash=hash_password("custpass123"),
        role="user"
    )
    db.add(admin)
    db.add(customer)
    db.commit()
    db.close()

    # 1. Customer login through main token route
    login_resp = client.post("/api/v1/auth/token", data={
        "username": "customer_role_test@travelos.com",
        "password": "custpass123"
    })
    assert login_resp.status_code == 200
    customer_token = login_resp.json()["access_token"]
    decoded_customer = decode_token(customer_token)
    assert decoded_customer.get("role") == "user"

    # 2. Admin login through main token route
    admin_login_resp = client.post("/api/v1/auth/token", data={
        "username": "admin_role_test@travelos.com",
        "password": "adminpass123"
    })
    assert admin_login_resp.status_code == 200
    admin_token = admin_login_resp.json()["access_token"]
    decoded_admin = decode_token(admin_token)
    assert decoded_admin.get("role") == "admin"

    # 3. Customer token access to admin routes -> should reject 403 Forbidden
    headers = {"Authorization": f"Bearer {customer_token}"}
    claims_resp = client.get("/api/admin/claims", headers=headers)
    assert claims_resp.status_code == 403

    # 4. Admin token access to admin routes -> should allow 200 OK
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    claims_resp = client.get("/api/admin/claims", headers=admin_headers)
    assert claims_resp.status_code == 200

def test_admin_token_exchange_code_flow():
    db = SessionLocal()
    from app.auth.jwt import hash_password
    db.query(User).delete()
    admin = User(
        email="admin_exchange_test@travelos.com",
        password_hash=hash_password("adminpass123"),
        role="admin"
    )
    customer = User(
        email="customer_exchange_test@travelos.com",
        password_hash=hash_password("custpass123"),
        role="user"
    )
    db.add(admin)
    db.add(customer)
    db.commit()
    db.close()

    # Get admin token
    admin_login_resp = client.post("/api/v1/auth/token", data={
        "username": "admin_exchange_test@travelos.com",
        "password": "adminpass123"
    })
    assert admin_login_resp.status_code == 200
    admin_token = admin_login_resp.json()["access_token"]

    # Get customer token
    cust_login_resp = client.post("/api/v1/auth/token", data={
        "username": "customer_exchange_test@travelos.com",
        "password": "custpass123"
    })
    assert cust_login_resp.status_code == 200
    customer_token = cust_login_resp.json()["access_token"]

    # 1. Customer token tries to generate exchange code -> must reject 403 Forbidden
    cust_headers = {"Authorization": f"Bearer {customer_token}"}
    code_resp = client.post("/api/v1/auth/exchange-code", headers=cust_headers)
    assert code_resp.status_code == 403

    # 2. Admin token generates exchange code -> must succeed 200 OK
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    code_resp = client.post("/api/v1/auth/exchange-code", headers=admin_headers)
    assert code_resp.status_code == 200
    exchange_code = code_resp.json()["exchange_code"]
    assert exchange_code.startswith("exch_")

    # 3. Exchange the code once -> must succeed 200 OK and return session payload
    exchange_resp = client.post("/api/v1/auth/exchange", json={"exchange_code": exchange_code})
    assert exchange_resp.status_code == 200
    exchange_data = exchange_resp.json()
    assert exchange_data["token"] == admin_token
    assert exchange_data["role"] == "admin"
    assert exchange_data["email"] == "admin_exchange_test@travelos.com"

    # 4. Exchange the code a second time (single-use constraint) -> must fail 400 Bad Request
    exchange_resp2 = client.post("/api/v1/auth/exchange", json={"exchange_code": exchange_code})
    assert exchange_resp2.status_code == 400

