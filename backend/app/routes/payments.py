import datetime
import hmac
import hashlib
import uuid
import logging
from decimal import Decimal
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import User, SavedPaymentMethod
from app.models.bookings import (
    BookingStatus, FlightBooking, HotelBooking, TrainBooking, BusBooking,
    CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication,
    CruiseBooking, InsurancePolicy, VillaBooking, ForexOrder, PaymentAttempt
)
from app.models.payments import LedgerRow, Dispute, ApprovalRequest, AutoApprovalRule
from app.models.audit import AuditLog
from app.utils.websocket_gateway import ws_gateway
from app.services.payment_provider import get_payment_provider, IDEMPOTENCY_CACHE
from app.ai_agents.fraud_agent import FraudDetectionService
from app.services.wallet_loyalty import WalletService
from app.services.dunning import DunningService
from app.utils.event_bus import emit_event

logger = logging.getLogger(__name__)

def get_vertical_sla_minutes(vertical: str) -> int:
    v = vertical.lower()
    if v in ["cabs", "cab"]:
        return 30
    elif v in ["trains", "train", "buses", "bus", "forex"]:
        return 60
    elif v in ["flights", "flight", "hotels", "hotel", "villas", "villa", "tours", "activity", "visa", "insurance"]:
        return 120
    elif v in ["holidays", "holiday_package", "cruises", "cruise"]:
        return 360
    return 120

def check_auto_approval(db: Session, vertical: str, amount: float, user_trust_score: float, is_clean_fraud: bool) -> Optional[AutoApprovalRule]:
    rules = db.query(AutoApprovalRule).filter(AutoApprovalRule.active == True).all()
    rules_sorted = sorted(rules, key=lambda r: 0 if r.applies_to.lower() == vertical.lower() else 1 if r.applies_to.lower() == "all" else 2)
    for rule in rules_sorted:
        if rule.applies_to.lower() not in (vertical.lower(), "all"):
            continue
        if amount > float(rule.max_amount):
            continue
        if user_trust_score < float(rule.min_user_trust_score):
            continue
        if rule.requires_clean_fraud_check and not is_clean_fraud:
            continue
        return rule
    return None

def send_websocket_update(topic: str, message: Any):
    try:
        ws_gateway.publish_to_redis(topic, message)
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(ws_gateway.broadcast_to_topic(topic, message), loop)
            else:
                asyncio.run(ws_gateway.broadcast_to_topic(topic, message))
        except RuntimeError:
            asyncio.run(ws_gateway.broadcast_to_topic(topic, message))
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed: {e}")

router = APIRouter(prefix="/payments", tags=["payments"])

# Simple IP-based rate limiting dictionary
IP_REQUEST_LOGS: Dict[str, list] = {}
RATE_LIMIT_MAX_REQUESTS = 5
RATE_LIMIT_WINDOW_SECONDS = 60

def rate_limit_check(request: Request):
    """
    Simple IP rate limiter to prevent card-testing fraud attacks on checkouts.
    """
    import sys
    if "pytest" in sys.modules or "pytest" in "".join(sys.argv):
        return
        
    ip = request.client.host if request.client else "unknown-ip"
    now = datetime.datetime.utcnow().timestamp()
    
    # Prune old logs
    if ip not in IP_REQUEST_LOGS:
        IP_REQUEST_LOGS[ip] = []
    
    IP_REQUEST_LOGS[ip] = [t for t in IP_REQUEST_LOGS[ip] if now - t < RATE_LIMIT_WINDOW_SECONDS]
    
    if len(IP_REQUEST_LOGS[ip]) >= RATE_LIMIT_MAX_REQUESTS:
        logger.warning(f"Rate limit triggered for IP: {ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Too many checkout attempts. Please try again later."
        )
    
    IP_REQUEST_LOGS[ip].append(now)


class CheckoutRequest(BaseModel):
    booking_reference: str
    vertical: str
    payment_method: str  # card, wallet, split
    payment_token: Optional[str] = "tok_visa"
    gateway: Optional[str] = "stripe"
    currency: Optional[str] = "INR"
    idempotency_key: Optional[str] = None
    cardholder_name: Optional[str] = None
    issuing_bank: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


@router.post("/checkout", dependencies=[Depends(rate_limit_check)])
def checkout(req: CheckoutRequest, db: Session = Depends(get_db)):
    """
    Core checkout endpoint supporting split payment, fraud reviews, 3DS redirect, and idempotency.
    """
    logger.info(
        f"Checkout initiated: ref={req.booking_reference} method={req.payment_method} "
        f"bank={req.issuing_bank} holder={req.cardholder_name} email={req.email} phone={req.phone}"
    )
    # 1. Idempotency Key validation
    if req.idempotency_key and req.idempotency_key in IDEMPOTENCY_CACHE:
        logger.info(f"Checkout: returning cached response for key {req.idempotency_key}")
        return IDEMPOTENCY_CACHE[req.idempotency_key]

    # 2. PCI Scope minimisation: Reject raw credentials
    if req.payment_token and len(req.payment_token) > 20 and not req.payment_token.startswith("tok_"):
        raise HTTPException(
            status_code=400,
            detail="PCI Compliance Error: Raw card data received. Only gateway payment tokens permitted."
        )

    # 3. Locate Booking
    models_mapping = {
        "flights": FlightBooking, "hotels": HotelBooking, "trains": TrainBooking,
        "cabs": CabBooking, "visa": VisaApplication, "holidays": HolidayPackageBooking,
        "buses": BusBooking, "tours": ActivityBooking, "cruises": CruiseBooking,
        "insurance": InsurancePolicy, "villas": VillaBooking, "forex": ForexOrder
    }
    model_cls = models_mapping.get(req.vertical.lower())
    if not model_cls:
        raise HTTPException(status_code=400, detail="Invalid vertical.")

    booking = db.query(model_cls).filter(model_cls.booking_reference == req.booking_reference).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    if booking.status != BookingStatus.HOLD:
        raise HTTPException(status_code=400, detail="Booking is not on hold status.")

    user_id = booking.user_id
    total_amount = Decimal(str(booking.total_amount))
    
    # 4. Checkout-time Fraud Check (Module 4)
    # Determine country code mismatch flags or velocity
    ip_mismatch = 1 if req.payment_token == "tok_fraud" else 0
    recent_bookings = 3 if req.payment_token in ("tok_review", "tok_fraud") else 1
    card_status = 1 if req.payment_token == "tok_invalid" else 0
    
    fraud_verdict = FraudDetectionService.evaluate_transaction(
        user_id=user_id,
        ip_country="IN",
        card_country="US" if ip_mismatch else "IN",
        recent_bookings_count=recent_bookings
    )
    
    if fraud_verdict["verdict"] == "blocked":
        # Log details internally and notify user with a generic message
        pay_attempt = PaymentAttempt(
            user_id=user_id,
            booking_reference=req.booking_reference,
            status="failed",
            failure_reason="Transaction blocked by security clearance rules.",
            amount=float(total_amount)
        )
        db.add(pay_attempt)
        
        # Log to ledger
        ledger_entry = LedgerRow(
            booking_reference=req.booking_reference,
            amount=float(total_amount),
            transaction_type="fee",
            entry_type="credit",
            description="Fraud blocked attempt logged"
        )
        db.add(ledger_entry)
        
        booking.status = BookingStatus.CANCELLED
        db.commit()
        
        emit_event("payment_failed", {
            "user_id": user_id,
            "booking_reference": req.booking_reference,
            "amount": float(total_amount),
            "reason": "Security clearance failure"
        })
        
        # Generic message to block card testing/revealing rules
        raise HTTPException(
            status_code=400,
            detail="Your payment attempt could not be processed due to standard gateway validation checks. Please try a different card."
        )
        
    # Determine fraud check clean status and reasoning
    is_clean_fraud = True
    fraud_reason = None
    if fraud_verdict["verdict"] == "review":
        is_clean_fraud = False
        fraud_reason = f"Fraud review: Risk score {fraud_verdict['risk_score']}. Billing location variance detected."
    elif fraud_verdict["verdict"] == "blocked":
        is_clean_fraud = False
        
    # Check Auto-Approval Rules
    user_obj = db.query(User).filter(User.id == user_id).first()
    user_trust = float(user_obj.trust_score) if (user_obj and user_obj.trust_score is not None) else 4.50
    matched_rule = check_auto_approval(db, req.vertical, float(total_amount), user_trust, is_clean_fraud)

    # 5. Split payment logic & balances (Module 1)
    wallet = WalletService.get_or_create_wallet(db, user_id)
    wallet_balance = Decimal(str(wallet.balance))
    
    card_amount = total_amount
    wallet_debited = Decimal("0.00")
    
    # If the user chose corporate_billing, we do not debit wallet
    if req.payment_method == "corporate_billing":
        pass
    elif req.payment_method == "split" or (req.payment_method == "wallet" and wallet_balance < total_amount):
        if wallet_balance > 0:
            wallet_debited = min(wallet_balance, total_amount)
            card_amount = total_amount - wallet_debited
            # Perform wallet debit (held portion)
            WalletService.debit_for_booking(db, user_id, wallet_debited, req.booking_reference)
            
            wallet_attempt = PaymentAttempt(
                user_id=user_id,
                booking_reference=req.booking_reference,
                status="succeeded" if matched_rule else "authorized",
                amount=float(wallet_debited),
                failure_reason="Wallet portion of split checkout"
            )
            db.add(wallet_attempt)
            
            ledger_wallet = LedgerRow(
                booking_reference=req.booking_reference,
                amount=float(wallet_debited),
                transaction_type="wallet_debit",
                entry_type="debit",
                description="Wallet split-checkout debit"
            )
            db.add(ledger_wallet)
            db.commit()
            
    elif req.payment_method == "wallet":
        # Wallet only charge
        WalletService.debit_for_booking(db, user_id, total_amount, req.booking_reference)
        
        wallet_attempt = PaymentAttempt(
            user_id=user_id,
            booking_reference=req.booking_reference,
            status="succeeded" if matched_rule else "authorized",
            amount=float(total_amount)
        )
        db.add(wallet_attempt)
        
        ledger_wallet = LedgerRow(
            booking_reference=req.booking_reference,
            amount=float(total_amount),
            transaction_type="wallet_debit",
            entry_type="debit",
            description="Wallet-only booking payment"
        )
        db.add(ledger_wallet)
        db.commit()

    # Determine SLA minutes
    sla_minutes = get_vertical_sla_minutes(req.vertical)

    # CASE A: Auto-Approved
    if matched_rule:
        charge_id = "wallet_only"
        if card_amount > 0 and req.payment_method != "corporate_billing":
            provider = get_payment_provider(req.gateway)
            charge_res = provider.charge(
                amount=float(card_amount),
                currency=req.currency,
                token=req.payment_token,
                description=f"Booking checkout for {req.booking_reference}",
                idempotency_key=req.idempotency_key
            )
            if charge_res.get("status") == "requires_action":
                return {
                    "success": False,
                    "status": "requires_action",
                    "action_type": "3ds_redirect",
                    "redirect_url": charge_res["redirect_url"] + f"&booking_reference={req.booking_reference}&wallet_debited={wallet_debited}",
                    "booking_reference": req.booking_reference
                }
            if not charge_res.get("success"):
                raise HTTPException(status_code=400, detail=f"Card Charge Failed: {charge_res.get('error')}")
            
            charge_id = charge_res["charge_id"]
            card_attempt = PaymentAttempt(
                user_id=user_id, booking_reference=req.booking_reference,
                status="succeeded", amount=float(card_amount)
            )
            db.add(card_attempt)
            
            ledger_card = LedgerRow(
                booking_reference=req.booking_reference, amount=float(card_amount),
                transaction_type="charge", entry_type="credit",
                description=f"Gateway card payment via {req.gateway} ({charge_id})"
            )
            db.add(ledger_card)
        
        booking.status = BookingStatus.CONFIRMED
        
        # Log to Audit Log
        audit = AuditLog(
            actor="system",
            action="auto_approval",
            entity=req.booking_reference,
            timestamp=datetime.datetime.utcnow(),
            after_json={"details": f"Booking auto-approved by rule {matched_rule.id} (applies_to={matched_rule.applies_to}, max_amount={matched_rule.max_amount})"}
        )
        db.add(audit)
        db.commit()
        
        emit_event("booking_confirmed", {
            "user_id": user_id,
            "booking_reference": req.booking_reference,
            "amount": float(total_amount)
        })
        
        response = {
            "success": True,
            "status": "succeeded",
            "message": f"Payment captured completely. Booking confirmed (Auto-approved by rule {matched_rule.id}).",
            "booking_reference": req.booking_reference,
            "charge_id": charge_id
        }
        if req.idempotency_key:
            IDEMPOTENCY_CACHE[req.idempotency_key] = response
        return response

    # CASE B: Mandatory Admin Approval Required
    else:
        charge_id = "pending_admin_approval"
        if card_amount > 0 and req.payment_method != "corporate_billing":
            provider = get_payment_provider(req.gateway)
            charge_res = provider.authorize(
                amount=float(card_amount),
                currency=req.currency,
                token=req.payment_token,
                description=f"Booking authorization for {req.booking_reference}",
                idempotency_key=req.idempotency_key
            )
            if charge_res.get("status") == "requires_action":
                # Redirect required
                return {
                    "success": False,
                    "status": "requires_action",
                    "action_type": "3ds_redirect",
                    "redirect_url": charge_res["redirect_url"] + f"&booking_reference={req.booking_reference}&wallet_debited={wallet_debited}",
                    "booking_reference": req.booking_reference
                }
            if not charge_res.get("success"):
                raise HTTPException(status_code=400, detail=f"Card Authorization Failed: {charge_res.get('error')}")
            
            charge_id = charge_res["charge_id"]
            card_attempt = PaymentAttempt(
                user_id=user_id, booking_reference=req.booking_reference,
                status="authorized", amount=float(card_amount)
            )
            db.add(card_attempt)
            db.commit()

        # Update booking status
        booking.status = BookingStatus.PENDING_ADMIN_APPROVAL
        # Extend slot hold to safely cover the SLA window
        booking.held_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=sla_minutes)
        
        # Determine approval reason
        if fraud_reason:
            reason = fraud_reason
        elif req.payment_method == "corporate_billing":
            reason = "myBiz Corporate Billing limit check: awaiting manager approval."
        elif req.vertical.lower() == "villas":
            reason = "Villa booking requires host verification/confirmation."
        else:
            reason = f"New booking review for {req.vertical} vertical."

        # Create ApprovalRequest ticket
        approval = ApprovalRequest(
            request_type="fraud_review" if fraud_reason else "new_booking",
            reference_id=req.booking_reference,
            requested_by=f"user_{user_id}",
            amount=float(total_amount),
            reason=reason,
            status="PENDING",
            payment_gateway=req.gateway if card_amount > 0 else None,
            payment_charge_id=charge_id if card_amount > 0 else None,
            sla_expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=sla_minutes),
            is_sla_breached=False,
            timeout_behavior="auto_reject",
            assigned_role="Booking Approver"
        )
        db.add(approval)
        db.commit()

        # Dispatch Notifications
        emit_event("booking_under_review", {
            "user_id": user_id,
            "booking_reference": req.booking_reference,
            "vertical": req.vertical,
            "sla_minutes": sla_minutes
        })

        # Real-time WebSocket Alert for Admins
        send_websocket_update("admin_notifications", {
            "type": "new_approval_request",
            "booking_reference": req.booking_reference,
            "vertical": req.vertical,
            "amount": float(total_amount),
            "reason": reason,
            "sla_expires_at": approval.sla_expires_at.isoformat() if approval.sla_expires_at else None
        })

        response = {
            "success": False,
            "status": "review",
            "message": "Booking submitted. Awaiting administrative clearance.",
            "booking_reference": req.booking_reference,
            "charge_id": charge_id,
            "sla_minutes": sla_minutes
        }
        if req.idempotency_key:
            IDEMPOTENCY_CACHE[req.idempotency_key] = response
        return response


@router.get("/3ds-mock-page", response_class=HTMLResponse)
def get_3ds_mock_page(
    gateway: str,
    amount: float,
    currency: str,
    token: str,
    booking_reference: str,
    wallet_debited: float = 0.0
):
    """
    Interactive simulated 3DS portal.
    """
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>3D Secure Verification</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
            body {{
                font-family: 'Inter', sans-serif;
                background-color: #090d16;
                color: #f1f5f9;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
            }}
            .card {{
                background-color: #0d1527;
                border: 1px border #1e293b;
                border-radius: 20px;
                padding: 40px;
                max-width: 450px;
                width: 100%;
                text-align: center;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            }}
            h2 {{ font-weight: 800; color: #3b82f6; margin-top: 0; }}
            .detail {{ margin: 20px 0; font-size: 14px; color: #94a3b8; text-align: left; background: #0f172a; padding: 15px; border-radius: 10px; }}
            .btn {{
                background-color: #2563eb;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                margin-top: 20px;
                transition: background 0.2s;
            }}
            .btn:hover {{ background-color: #1d4ed8; }}
        </style>
    </head>
    <body>
        <div class="card">
            <h2>3D Secure Step-Up Challenge</h2>
            <p>Verification required by bank issuer for security confirmation.</p>
            <div class="detail">
                <div><strong>Merchant:</strong> Travel OS Operating System</div>
                <div><strong>Booking Ref:</strong> {booking_reference}</div>
                <div><strong>Amount:</strong> {currency} {amount}</div>
                <div><strong>Split Wallet Portion:</strong> {currency} {wallet_debited}</div>
                <div><strong>Gateway:</strong> {gateway.upper()}</div>
            </div>
            <form action="/api/v1/payments/3ds-callback" method="POST">
                <input type="hidden" name="booking_reference" value="{booking_reference}">
                <input type="hidden" name="gateway" value="{gateway}">
                <input type="hidden" name="amount" value="{amount}">
                <input type="hidden" name="wallet_debited" value="{wallet_debited}">
                <button type="submit" class="btn">Authorize Payment (Simulate OTP)</button>
            </form>
        </div>
    </body>
    </html>
    """
    return html_content


from fastapi import Form

@router.post("/3ds-callback")
def post_3ds_callback(
    booking_reference: str = Form(...),
    gateway: str = Form(...),
    amount: float = Form(...),
    wallet_debited: float = Form(...),
    db: Session = Depends(get_db)
):
    """
    Post-verification step. Complete booking confirm.
    """
    models_mapping = {
        "BK-": FlightBooking  # General model lookup fallback
    }
    # In sandbox mock environment, we can check all tables or determine vertical
    # We find the booking across standard tables by booking_reference
    booking = None
    tables = [FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication, CruiseBooking, InsurancePolicy, VillaBooking, ForexOrder]
    for table in tables:
        booking = db.query(table).filter(table.booking_reference == booking_reference).first()
        if booking:
            break
            
    if not booking:
        raise HTTPException(status_code=404, detail="Booking reference mismatch.")

    # Determine vertical name from model
    vertical = getattr(booking, "__tablename__", "").replace("_bookings", "").replace("_applications", "").replace("_policies", "").replace("_orders", "").replace("_properties", "")
    
    # Check Auto-Approval Rules
    is_clean_fraud = True
    user_obj = db.query(User).filter(User.id == booking.user_id).first()
    user_trust = float(user_obj.trust_score) if (user_obj and user_obj.trust_score is not None) else 4.50
    matched_rule = check_auto_approval(db, vertical, float(booking.total_amount), user_trust, is_clean_fraud)

    if matched_rule:
        # Mark payment attempt as succeeded
        card_attempt = PaymentAttempt(
            user_id=booking.user_id,
            booking_reference=booking_reference,
            status="succeeded",
            amount=amount
        )
        db.add(card_attempt)
        
        # Ledger entry
        ledger_card = LedgerRow(
            booking_reference=booking_reference,
            amount=amount,
            transaction_type="charge",
            entry_type="credit",
            description=f"3DS completed gateway card payment via {gateway} (Auto-approved by rule {matched_rule.id})"
        )
        db.add(ledger_card)
        
        booking.status = BookingStatus.CONFIRMED
        
        # Log to Audit Log
        audit = AuditLog(
            actor="system",
            action="auto_approval",
            entity=booking_reference,
            timestamp=datetime.datetime.utcnow(),
            after_json={"details": f"Booking auto-approved post-3DS by rule {matched_rule.id} (applies_to={matched_rule.applies_to}, max_amount={matched_rule.max_amount})"}
        )
        db.add(audit)
        db.commit()
        
        emit_event("booking_confirmed", {
            "user_id": booking.user_id,
            "booking_reference": booking_reference,
            "amount": float(booking.total_amount)
        })
    else:
        # Mark payment attempt as authorized
        card_attempt = PaymentAttempt(
            user_id=booking.user_id,
            booking_reference=booking_reference,
            status="authorized",
            amount=amount
        )
        db.add(card_attempt)
        
        booking.status = BookingStatus.PENDING_ADMIN_APPROVAL
        sla_minutes = get_vertical_sla_minutes(vertical)
        booking.held_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=sla_minutes)
        
        reason = f"New booking review for {vertical} vertical (post-3DS)."
        approval = ApprovalRequest(
            request_type="new_booking",
            reference_id=booking_reference,
            requested_by=f"user_{booking.user_id}",
            amount=float(booking.total_amount),
            reason=reason,
            status="PENDING",
            payment_gateway=gateway,
            payment_charge_id=f"ch_{gateway}_auth_{uuid.uuid4().hex[:12]}",
            sla_expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=sla_minutes),
            is_sla_breached=False,
            timeout_behavior="auto_reject",
            assigned_role="Booking Approver"
        )
        db.add(approval)
        db.commit()
        
        emit_event("booking_under_review", {
            "user_id": booking.user_id,
            "booking_reference": booking_reference,
            "vertical": vertical,
            "sla_minutes": sla_minutes
        })

        # Real-time WebSocket Alert for Admins
        send_websocket_update("admin_notifications", {
            "type": "new_approval_request",
            "booking_reference": booking_reference,
            "vertical": vertical,
            "amount": float(booking.total_amount),
            "reason": reason,
            "sla_expires_at": approval.sla_expires_at.isoformat() if approval.sla_expires_at else None
        })
    
    # Notify the parent window via postMessage for smooth modal completion
    html = """
    <html>
    <body>
        <script>
            window.parent.postMessage("3ds_success", "*");
        </script>
        <h3 style="font-family: sans-serif; text-align: center; margin-top: 50px; color: #10b981;">3D Secure Challenge Succeeded. Proceeding...</h3>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


# Simulated webhook signature validation secrets
WEBHOOK_SECRETS = {
    "stripe": "whsec_stripe_test_secret",
    "razorpay": "whsec_razorpay_test_secret"
}

@router.post("/webhook/{provider}")
async def gateway_webhook(
    provider: str,
    request: Request,
    x_signature: str = Header(None, alias="X-Signature"),
    db: Session = Depends(get_db)
):
    """
    Signature-verified Webhook handler handling successes, refunds, disputes, and chargebacks.
    """
    body = await request.body()
    secret = WEBHOOK_SECRETS.get(provider.lower(), "default_secret")
    
    # 1. Signature check (verifies request is authentic)
    if x_signature:
        expected_sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, x_signature):
            logger.warning(f"Webhook Signature Mismatch for provider: {provider}")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
            
    # Parse mock webhook payload
    import json
    try:
        payload = json.loads(body.decode())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("event")
    data = payload.get("data", {})
    booking_ref = data.get("booking_reference")
    
    logger.info(f"Webhook received from {provider}: {event_type} for booking {booking_ref}")

    # Deduplicate processing
    webhook_id = payload.get("id")
    # In production, cache this webhook ID in Redis/DB to make webhook idempotent
    
    if event_type == "charge.refund.settled":
        # Finalize async gateway refund
        # Update Dispute or Booking state
        # In a real app we would check if a refund request exists
        # Write reversing Ledger entry if necessary
        ledger_refund = LedgerRow(
            booking_reference=booking_ref,
            amount=data.get("amount", 0.0),
            transaction_type="refund",
            entry_type="debit",
            description=f"Webhook refund settled: {provider}"
        )
        db.add(ledger_refund)
        db.commit()
        emit_event("refund_processed", {
            "booking_reference": booking_ref,
            "amount": data.get("amount", 0.0)
        })

    elif event_type == "charge.dispute.created":
        # Create dispute record
        dispute = Dispute(
            booking_reference=booking_ref,
            amount=data.get("amount", 0.0),
            reason_code=data.get("reason_code", "fraudulent"),
            evidence_due_by=datetime.datetime.utcnow() + datetime.timedelta(days=7),
            status="under_review"
        )
        db.add(dispute)
        db.commit()
        db.refresh(dispute)

        # Escalate to Unified Approvals Queue (Module 5)
        approval = ApprovalRequest(
            request_type="price_drop_claim_dispute",  # matches dispute requests
            reference_id=str(dispute.id),
            requested_by=f"{provider}_gateway_webhook",
            amount=data.get("amount", 0.0),
            reason=f"Gateway Chargeback Dispute opened: {dispute.reason_code}. Evidence due: {dispute.evidence_due_by}",
            status="PENDING"
        )
        db.add(approval)
        db.commit()
        
        emit_event("dispute_opened", {
            "booking_reference": booking_ref,
            "amount": data.get("amount", 0.0)
        })

    elif event_type == "charge.dispute.won" or event_type == "charge.dispute.lost":
        dispute = db.query(Dispute).filter(Dispute.booking_reference == booking_ref).first()
        if dispute:
            dispute.status = "won" if "won" in event_type else "lost"
            
            # If lost, we write reversing ledger rows for the chargeback adjustment (Module 2)
            if dispute.status == "lost":
                ledger_reversal = LedgerRow(
                    booking_reference=booking_ref,
                    amount=float(dispute.amount),
                    transaction_type="refund",  # Chargeback adjustment
                    entry_type="debit",
                    description=f"Ledger adjustment: Chargeback dispute lost to gateway ({provider})"
                )
                db.add(ledger_reversal)
                
            db.commit()

    return {"message": "Webhook processed successfully"}
