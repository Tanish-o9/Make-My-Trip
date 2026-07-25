import pytest
import datetime
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.core import User, WalletAccount
from app.models.bookings import BookingStatus, FlightBooking, HotelBooking, PaymentAttempt
from app.models.payments import LedgerRow, SettlementBatch, ReconciliationException, ApprovalRequest, VendorPayout, Dispute
from app.services.payment_provider import get_payment_provider, StripePaymentAdapter, RazorpayPaymentAdapter
from app.services.reconciliation import ReconciliationService

client = TestClient(app)

@pytest.fixture(autouse=True)
def init_db():
    """Ensure database schema is created including new payments tables and seed test rules"""
    Base.metadata.create_all(bind=engine)
    
    from app.models.payments import AutoApprovalRule
    db = SessionLocal()
    db.query(AutoApprovalRule).delete()
    default_rule = AutoApprovalRule(
        applies_to="all",
        max_amount=50000.0,
        min_user_trust_score=0.0,
        requires_clean_fraud_check=True,
        active=True
    )
    db.add(default_rule)
    db.commit()
    db.close()
    
    # Bypass admin authentication in these tests
    from app.auth.dependencies import get_current_admin
    from app.models.core import User
    app.dependency_overrides[get_current_admin] = lambda: User(id=1, email="admin@travelos.com", role="super_admin")
    
    yield
    # Clean up test transactions/ledger entries after run
    app.dependency_overrides.clear()
    db = SessionLocal()
    db.query(LedgerRow).delete()
    db.query(SettlementBatch).delete()
    db.query(ReconciliationException).delete()
    db.query(ApprovalRequest).delete()
    db.query(VendorPayout).delete()
    db.query(Dispute).delete()
    db.query(AutoApprovalRule).delete()
    db.commit()
    db.close()


@pytest.fixture
def seeder():
    """Seeds a standard test user with a funded wallet"""
    db = SessionLocal()
    user = db.query(User).filter(User.email == "payment_test@travelos.com").first()
    if not user:
        user = User(email="payment_test@travelos.com", role="user")
        db.add(user)
        db.commit()
        db.refresh(user)

    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).first()
    if not wallet:
        wallet = WalletAccount(user_id=user.id, balance=Decimal("8000.00"), currency="INR")
        db.add(wallet)
    else:
        wallet.balance = Decimal("8000.00")
    db.commit()
    db.refresh(wallet)
    
    yield user, wallet
    db.close()


def test_payment_adapters():
    """Test Stripe and Razorpay adapters charge & refund methods directly"""
    stripe = get_payment_provider("stripe")
    razorpay = get_payment_provider("razorpay")
    
    assert stripe.name == "stripe"
    assert razorpay.name == "razorpay"
    
    # Direct charge (tokenized card)
    res_s = stripe.charge(500.0, "INR", "tok_visa", "Direct Charge test")
    assert res_s["success"] is True
    assert "ch_stripe_" in res_s["charge_id"]
    
    # Direct charge raw details PCI scope check
    res_raw = stripe.charge(500.0, "INR", "4242-4242-4242", "Direct raw Card test")
    assert res_raw["success"] is False
    assert "PCI" in res_raw["error"]

    # Razorpay DCC currency check
    res_r = razorpay.charge(100.0, "USD", "tok_visa", "USD Razorpay test")
    assert res_r["success"] is True
    assert res_r["original_currency"] == "USD"
    assert res_r["converted_amount_inr"] == 8350.0  # 100 * 83.5


def test_checkout_standard_success(seeder):
    """Test normal credit card capture checkout"""
    user, wallet = seeder
    
    # 1. Hold flight
    hold_payload = {
        "vertical": "flights",
        "amount": 4500.00,
        "user_id": user.id,
        "details": {"origin": "DEL", "destination": "GOI"}
    }
    resp = client.post("/api/v1/bookings/hold", json=hold_payload)
    assert resp.status_code == 200
    ref = resp.json()["booking_reference"]
    
    # 2. Checkout
    checkout_payload = {
        "booking_reference": ref,
        "vertical": "flights",
        "payment_method": "card",
        "payment_token": "tok_visa",
        "gateway": "stripe",
        "currency": "INR",
        "idempotency_key": f"key_standard_{ref}"
    }
    checkout_resp = client.post("/api/v1/payments/checkout", json=checkout_payload)
    assert checkout_resp.status_code == 200
    assert checkout_resp.json()["success"] is True
    
    # Verify booking status in DB is confirmed
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == ref).first()
    assert booking.status == BookingStatus.CONFIRMED
    
    # Verify Ledger logs charge
    ledger = db.query(LedgerRow).filter(LedgerRow.booking_reference == ref).first()
    assert ledger is not None
    assert ledger.transaction_type == "charge"
    assert ledger.entry_type == "credit"
    db.close()


def test_checkout_3ds_stepup(seeder):
    """Test checkout triggering 3DS redirection and complete callback verification"""
    user, wallet = seeder
    
    # 1. Hold
    hold_payload = {
        "vertical": "flights",
        "amount": 12000.00,  # >= 10k triggers 3DS automatically
        "user_id": user.id,
        "details": {"origin": "DEL", "destination": "GOI"}
    }
    ref = client.post("/api/v1/bookings/hold", json=hold_payload).json()["booking_reference"]
    
    # 2. Checkout
    checkout_payload = {
        "booking_reference": ref,
        "vertical": "flights",
        "payment_method": "card",
        "payment_token": "tok_visa",
        "gateway": "stripe",
        "currency": "INR",
        "idempotency_key": f"key_3ds_{ref}"
    }
    checkout_resp = client.post("/api/v1/payments/checkout", json=checkout_payload)
    assert checkout_resp.status_code == 200
    assert checkout_resp.json()["status"] == "requires_action"
    assert "3ds-mock-page" in checkout_resp.json()["redirect_url"]
    
    # 3. Simulate callback completion POST
    form_data = {
        "booking_reference": ref,
        "gateway": "stripe",
        "amount": 12000.00,
        "wallet_debited": 0.0
    }
    callback_resp = client.post("/api/v1/payments/3ds-callback", data=form_data)
    assert callback_resp.status_code == 200
    assert "3ds_success" in callback_resp.text
    
    # Verify booking status
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == ref).first()
    assert booking.status == BookingStatus.CONFIRMED
    db.close()


def test_checkout_fraud_blocked(seeder):
    """Test checkout failing and blocking due to fraud verdict"""
    user, wallet = seeder
    
    hold_payload = {
        "vertical": "flights",
        "amount": 3500.00,
        "user_id": user.id,
        "details": {"origin": "DEL", "destination": "GOI"}
    }
    ref = client.post("/api/v1/bookings/hold", json=hold_payload).json()["booking_reference"]
    
    checkout_payload = {
        "booking_reference": ref,
        "vertical": "flights",
        "payment_method": "card",
        "payment_token": "tok_fraud",  # triggers fraud block
        "gateway": "stripe",
        "currency": "INR"
    }
    checkout_resp = client.post("/api/v1/payments/checkout", json=checkout_payload)
    assert checkout_resp.status_code == 400
    assert "payment attempt could not be processed" in checkout_resp.json()["detail"]


def test_checkout_fraud_review(seeder):
    """Test checkout flagging suspicious signals and escalating to ApprovalRequest queue"""
    user, wallet = seeder
    
    hold_payload = {
        "vertical": "flights",
        "amount": 6200.00,
        "user_id": user.id,
        "details": {"origin": "DEL", "destination": "GOI"}
    }
    ref = client.post("/api/v1/bookings/hold", json=hold_payload).json()["booking_reference"]
    
    checkout_payload = {
        "booking_reference": ref,
        "vertical": "flights",
        "payment_method": "card",
        "payment_token": "tok_review",  # triggers review verdict
        "gateway": "stripe",
        "currency": "INR"
    }
    checkout_resp = client.post("/api/v1/payments/checkout", json=checkout_payload)
    assert checkout_resp.status_code == 200
    assert checkout_resp.json()["status"] == "review"
    
    db = SessionLocal()
    booking = db.query(FlightBooking).filter(FlightBooking.booking_reference == ref).first()
    assert booking.status == BookingStatus.PENDING_ADMIN_APPROVAL
    
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.reference_id == ref).first()
    assert approval is not None
    assert approval.request_type == "fraud_review"
    assert approval.status == "PENDING"
    db.close()


def test_checkout_split_payment(seeder):
    """Test split payment: debit maximum wallet portion and charge the remaining on credit card"""
    user, wallet = seeder
    # Wallet balance is seeded to ₹8,000. We buy a package for ₹12,000
    
    hold_payload = {
        "vertical": "holidays",
        "amount": 12000.00,
        "user_id": user.id,
        "details": {"package_name": "Beach getaway"}
    }
    ref = client.post("/api/v1/bookings/hold", json=hold_payload).json()["booking_reference"]
    
    checkout_payload = {
        "booking_reference": ref,
        "vertical": "holidays",
        "payment_method": "split",
        "payment_token": "tok_visa",
        "gateway": "stripe"
    }
    checkout_resp = client.post("/api/v1/payments/checkout", json=checkout_payload)
    assert checkout_resp.status_code == 200
    assert checkout_resp.json()["success"] is True
    
    db = SessionLocal()
    # Wallet should be fully drained to 0
    wallet_db = db.query(WalletAccount).filter(WalletAccount.id == wallet.id).first()
    assert wallet_db.balance == Decimal("0.00")
    
    # We should have two successful payment attempts logged
    attempts = db.query(PaymentAttempt).filter(PaymentAttempt.booking_reference == ref).all()
    assert len(attempts) == 2
    amounts = [float(a.amount) for a in attempts]
    assert 8000.0 in amounts
    assert 4000.0 in amounts
    
    db.close()


def test_idempotency_keys(seeder):
    """Test duplicate checkouts with identical idempotency key are de-duplicated"""
    user, wallet = seeder
    
    hold_payload = {
        "vertical": "flights",
        "amount": 3500.00,
        "user_id": user.id,
        "details": {"origin": "DEL", "destination": "GOI"}
    }
    ref = client.post("/api/v1/bookings/hold", json=hold_payload).json()["booking_reference"]
    
    checkout_payload = {
        "booking_reference": ref,
        "vertical": "flights",
        "payment_method": "card",
        "payment_token": "tok_visa",
        "gateway": "stripe",
        "idempotency_key": f"key_dup_{ref}"
    }
    
    # Charge 1
    resp1 = client.post("/api/v1/payments/checkout", json=checkout_payload)
    assert resp1.status_code == 200
    
    # Charge 2 (retry before status update)
    resp2 = client.post("/api/v1/payments/checkout", json=checkout_payload)
    assert resp2.status_code == 200
    assert resp1.json()["charge_id"] == resp2.json()["charge_id"]


def test_refund_routing_threshold(seeder):
    """Test refund routing: high-value refunds go to approval queue instead of auto-refund"""
    user, wallet = seeder
    
    # Create booking directly as confirmed
    db = SessionLocal()
    booking = FlightBooking(
        booking_reference="BK-REFUND-HIGH",
        user_id=user.id,
        status=BookingStatus.CONFIRMED,
        total_amount=Decimal("20000.00"),
        origin="DEL", destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=5),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=5, hours=2),
        airline_code="AI", flight_number="101",
        pricing_snapshot={"base": 18000.0, "tax": 2000.0, "discount": 0.0},
        passenger_details=[{"name": "Tester", "age": 30}]
    )
    db.add(booking)
    db.commit()
    
    # Cancel flight -> refund amount is ₹20,000 * 0.95 = ₹19,000 (exceeds ₹15k limit)
    cancel_resp = client.post("/api/v1/bookings/cancel?booking_reference=BK-REFUND-HIGH&vertical=flights")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "PENDING_APPROVAL"
    
    # Verify approval request was generated
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.reference_id == "BK-REFUND-HIGH").first()
    assert approval is not None
    assert approval.request_type == "refund_exception"
    assert approval.status == "PENDING"
    db.close()


def test_admin_approvals_processing(seeder):
    """Test resolving approval requests (Approve) completes pending booking/refund flows"""
    user, wallet = seeder
    
    # Create a pending refund approval request
    db = SessionLocal()
    approval = ApprovalRequest(
        request_type="refund_exception",
        reference_id="BK-MOCK-REFUND",
        requested_by=f"user_{user.id}",
        amount=18000.00,
        reason="Goodwill policy refund exception",
        status="PENDING"
    )
    db.add(approval)
    
    # Create flight booking in PENDING_APPROVAL status
    booking = FlightBooking(
        booking_reference="BK-MOCK-REFUND",
        user_id=user.id,
        status=BookingStatus.PENDING_APPROVAL,
        total_amount=Decimal("20000.00"),
        origin="DEL", destination="BOM",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=5),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=5, hours=2),
        airline_code="AI", flight_number="101",
        pricing_snapshot={"base": 18000.0, "tax": 2000.0, "discount": 0.0},
        passenger_details=[{"name": "Tester", "age": 30}]
    )
    db.add(booking)
    db.commit()
    db.refresh(approval)
    
    # Resolve approval request as APPROVED
    resolve_resp = client.post(
        f"/api/admin/approvals/{approval.id}/resolve?action=APPROVED&reviewer=finance_admin_1&notes=Approved goodwill refund"
    )
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "APPROVED"
    
    # Verify booking status is now refunded/cancelled
    booking_db = db.query(FlightBooking).filter(FlightBooking.booking_reference == "BK-MOCK-REFUND").first()
    assert booking_db.status == BookingStatus.REFUNDED
    
    # Wallet balance should be credited: 8000 + 18000 = 26000
    wallet_db = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).first()
    assert wallet_db.balance == Decimal("26000.00")
    db.close()


def test_reconciliation_exception_matching(seeder):
    """Test reconciliation job flags anomalies in expected vs actual gateway batch reports"""
    db = SessionLocal()
    # Add a mock successful charge transaction in ledger
    ledger = LedgerRow(
        booking_reference="BK-RECON-TEST",
        amount=5000.0,
        transaction_type="charge",
        entry_type="credit",
        description="Gateway payment"
    )
    db.add(ledger)
    db.commit()
    
    # Run reconciliation for Stripe (DCC will mismatch amount by ₹150 for testing)
    recon_res = ReconciliationService.run_reconciliation(db, "stripe")
    assert recon_res["exceptions_flagged"] == 1
    
    # Verify ReconciliationException logged
    exc = db.query(ReconciliationException).filter(ReconciliationException.booking_reference == "BK-RECON-TEST").first()
    assert exc is not None
    assert exc.exception_type == "amount_mismatch"
    assert exc.expected_amount == 5000.0
    assert exc.actual_amount == 4850.0  # 5000 - 150
    db.close()


def test_payout_manager_high_value(seeder):
    """Test payout scheduler escalates vendor payments above threshold to approval queue"""
    db = SessionLocal()
    
    # Trigger payout aggregating host_premium (totals ₹30,000 bookings -> ₹27,000 net, exceeds ₹25k limit)
    resp = client.post("/api/admin/payouts/trigger-run?vendor_id=host_premium&period=2026-31")
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending_approval"
    assert resp.json()["approval_required"] is True
    
    # Verify payout is pending approval in DB
    payout = db.query(VendorPayout).filter(VendorPayout.vendor_id == "host_premium", VendorPayout.period == "2026-31").first()
    assert payout.status == "pending_approval"
    
    # Verify ApprovalRequest added
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.request_type == "high_value_payout").first()
    assert approval is not None
    assert approval.reference_id == str(payout.id)
    db.close()


def test_gateway_chargeback_dispute_creation(seeder):
    """Test disputes received via webhook trigger approval case creation & evidence compiling tools"""
    webhook_payload = {
        "event": "charge.dispute.created",
        "id": "evt_dis_101",
        "data": {
            "booking_reference": "BK-DISPUTE-REF",
            "amount": 6500.0,
            "reason_code": "fraudulent"
        }
    }
    
    # Send webhook with simulated signature verification header
    # HMAC SHA256 signature of payload using whsec_stripe_test_secret
    import json, hmac, hashlib
    payload_bytes = json.dumps(webhook_payload).encode()
    sig = hmac.new(b"whsec_stripe_test_secret", payload_bytes, hashlib.sha256).hexdigest()
    
    resp = client.post(
        "/api/v1/payments/webhook/stripe",
        content=payload_bytes,
        headers={"X-Signature": sig}
    )
    assert resp.status_code == 200
    
    # Verify dispute and approvals requests logged
    db = SessionLocal()
    dispute = db.query(Dispute).filter(Dispute.booking_reference == "BK-DISPUTE-REF").first()
    assert dispute is not None
    assert dispute.status == "under_review"
    
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.request_type == "price_drop_claim_dispute").first()
    assert approval is not None
    assert approval.reference_id == str(dispute.id)
    
    # Test evidence package assembler API
    evidence_resp = client.get(f"/api/admin/disputes/{dispute.id}/evidence")
    assert evidence_resp.status_code == 200
    data = evidence_resp.json()
    assert data["booking_reference"] == "BK-DISPUTE-REF"
    assert data["evidence_package"]["amount_disputed"] == 6500.0
    db.close()
