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
    try:
        from app.utils.redis_client import redis_client
        if redis_client:
            redis_client.delete("processed_webhook:evt_dis_101")
    except Exception:
        pass


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


from unittest.mock import MagicMock
from app.payments.client import razorpay_client

def test_human_approval_state_progression(seeder):
    """Test HOLD -> AWAITING_HUMAN_PAYMENT_APPROVAL -> PAYMENT_PROCESSING -> CONFIRMED progression"""
    user, wallet = seeder
    
    from app.auth.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = lambda: user
    original_webhook_secret = None
    
    # 1. Create a flight booking on hold
    db = SessionLocal()
    ref = "BK-STATE-TEST-123"
    booking = FlightBooking(
        booking_reference=ref,
        user_id=user.id,
        status=BookingStatus.HOLD,
        total_amount=1500.00,
        currency="INR",
        origin="DEL",
        destination="GOI",
        airline_code="AI",
        flight_number="101",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=5),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=5, hours=2),
        pricing_snapshot={"cancellation_policy": "Refundable"},
        passenger_details=[{"name": "Tester", "age": 30}]
    )
    db.add(booking)
    db.commit()
    
    # 2. Try to create payment order without human approval
    payload = {
        "booking_id": ref,
        "amount": 1500.00,
        "currency": "INR",
        "method": "card",
        "human_approved": False
    }
    resp = client.post("/api/v1/payments/create-order", json=payload)
    assert resp.status_code == 400
    assert "requires payment approval" in resp.json()["detail"]
    
    db.refresh(booking)
    assert booking.status == BookingStatus.AWAITING_HUMAN_PAYMENT_APPROVAL
    
    # 3. Create payment order WITH human approval
    original_create = razorpay_client.order.create
    razorpay_client.order.create = MagicMock(return_value={
        "id": "order_state_test_999",
        "entity": "order",
        "amount": 150000,
        "currency": "INR",
        "status": "created"
    })
    
    try:
        payload["human_approved"] = True
        resp = client.post("/api/v1/payments/create-order", json=payload)
        assert resp.status_code == 200
        
        db.refresh(booking)
        # Should be PAYMENT_PENDING (which is after PAYMENT_PROCESSING)
        assert booking.status == BookingStatus.PAYMENT_PENDING
        
        # 4. Confirm payment (Webhook captured) to transition to CONFIRMED
        webhook_payload = {
            "account_id": "acc_123",
            "event": "payment.captured",
            "contains": ["payment"],
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test_999",
                        "entity": "payment",
                        "amount": 150000,
                        "currency": "INR",
                        "status": "captured",
                        "order_id": "order_state_test_999",
                        "method": "card"
                    }
                }
            },
            "created_at": 1690000000
        }
        import json, hmac, hashlib
        from app.payments.config import settings
        original_webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
        settings.RAZORPAY_WEBHOOK_SECRET = "whsec_razorpay_test_secret"
        
        payload_bytes = json.dumps(webhook_payload).encode()
        sig = hmac.new(b"whsec_razorpay_test_secret", payload_bytes, hashlib.sha256).hexdigest()
        
        resp = client.post(
            "/api/v1/payments/webhook/razorpay",
            content=payload_bytes,
            headers={"X-Signature": sig}
        )
        assert resp.status_code == 200
        
        db.refresh(booking)
        assert booking.status == BookingStatus.CONFIRMED
        
    finally:
        razorpay_client.order.create = original_create
        if get_current_user in app.dependency_overrides:
            del app.dependency_overrides[get_current_user]
        if original_webhook_secret is not None:
            from app.payments.config import settings
            settings.RAZORPAY_WEBHOOK_SECRET = original_webhook_secret
        db.close()


def test_reconciliation_ignores_payment_pending(seeder):
    """Test that bookings in PAYMENT_PENDING and PAYMENT_PROCESSING are never auto-expired by reconciliation"""
    user, wallet = seeder
    db = SessionLocal()
    
    # 1. Create a booking in PAYMENT_PENDING with a past held_until date
    ref_pending = "BK-REC-TEST-PENDING"
    booking_pending = FlightBooking(
        booking_reference=ref_pending,
        user_id=user.id,
        status=BookingStatus.PAYMENT_PENDING,
        total_amount=1200.00,
        currency="INR",
        origin="DEL",
        destination="GOI",
        airline_code="AI",
        flight_number="101",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=5),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=5, hours=2),
        held_until=datetime.datetime.utcnow() - datetime.timedelta(minutes=10), # Past deadline
        pricing_snapshot={"cancellation_policy": "Refundable"},
        passenger_details=[{"name": "Tester", "age": 30}]
    )
    
    # 2. Create a booking in PAYMENT_PROCESSING with a past held_until date
    ref_processing = "BK-REC-TEST-PROCESSING"
    booking_processing = FlightBooking(
        booking_reference=ref_processing,
        user_id=user.id,
        status=BookingStatus.PAYMENT_PROCESSING,
        total_amount=1200.00,
        currency="INR",
        origin="DEL",
        destination="GOI",
        airline_code="AI",
        flight_number="101",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=5),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=5, hours=2),
        held_until=datetime.datetime.utcnow() - datetime.timedelta(minutes=10), # Past deadline
        pricing_snapshot={"cancellation_policy": "Refundable"},
        passenger_details=[{"name": "Tester", "age": 30}]
    )
    
    # 3. Create a booking in HOLD with a past held_until date (to verify it DOES expire)
    ref_hold = "BK-REC-TEST-HOLD"
    booking_hold = FlightBooking(
        booking_reference=ref_hold,
        user_id=user.id,
        status=BookingStatus.HOLD,
        total_amount=1200.00,
        currency="INR",
        origin="DEL",
        destination="GOI",
        airline_code="AI",
        flight_number="101",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=5),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=5, hours=2),
        held_until=datetime.datetime.utcnow() - datetime.timedelta(minutes=10), # Past deadline
        pricing_snapshot={"cancellation_policy": "Refundable"},
        passenger_details=[{"name": "Tester", "age": 30}]
    )
    
    db.add(booking_pending)
    db.add(booking_processing)
    db.add(booking_hold)
    db.commit()
    
    try:
        # Run reconciliation
        from app.services.reconciliation import reconcile_provider_bookings
        res = reconcile_provider_bookings(db)
        
        db.refresh(booking_pending)
        db.refresh(booking_processing)
        db.refresh(booking_hold)
        
        # Verify pending and processing are untouched
        assert booking_pending.status == BookingStatus.PAYMENT_PENDING
        assert booking_processing.status == BookingStatus.PAYMENT_PROCESSING
        # Verify hold is auto-expired
        assert booking_hold.status == BookingStatus.EXPIRED
        
    finally:
        db.close()
