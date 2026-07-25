import datetime
import time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.bookings import PriceDropClaim
from app.models.showcase import Offer, AirlinePartner, HotelBrandPartner
from pydantic import BaseModel
from app.models.payments import AutoApprovalRule
from app.auth.dependencies import get_current_admin
from app.utils.event_bus import emit_event
from decimal import Decimal
from app.services.wallet_loyalty import WalletService

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])
admin_auth_router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])

# Aggressive rate limiting dict for admin login attempts
LOGIN_ATTEMPTS = {}  # {ip: [timestamps]}

def rate_limit_login(ip_address: str):
    now = time.time()
    if ip_address in LOGIN_ATTEMPTS:
        LOGIN_ATTEMPTS[ip_address] = [t for t in LOGIN_ATTEMPTS[ip_address] if now - t < 60]
    else:
        LOGIN_ATTEMPTS[ip_address] = []
        
    if len(LOGIN_ATTEMPTS[ip_address]) >= 3:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again after a minute."
        )
    LOGIN_ATTEMPTS[ip_address].append(now)

class AdminLoginRequest(BaseModel):
    email: str
    password: str
    two_factor_code: Optional[str] = None  # Hook point for 2FA validation

class AdminTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str

@admin_auth_router.post("/login", response_model=AdminTokenResponse)
def admin_login(
    req_body: AdminLoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_login(client_ip)
    
    from app.models.core import User
    from app.auth.jwt import verify_password, create_access_token, create_refresh_token
    
    user = db.query(User).filter(User.email == req_body.email).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if not verify_password(req_body.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    allowed_roles = ["admin", "super_admin", "finance_admin", "approver"]
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Access denied: User does not have administrative privileges."
        )
        
    # Hook point for future 2FA logic check
    if req_body.two_factor_code:
        # validate_2fa(req_body.two_factor_code)
        pass
        
    # Generate admin scoped JWT with 24 hours expiry for ease of dev testing
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=datetime.timedelta(hours=24)
    )
    refresh_token = create_refresh_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=datetime.timedelta(days=7)
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "role": user.role
    }

# 1. Price Drop Protection Claims review
@router.get("/claims")
def list_claims_queue(
    status: str = None,
    db: Session = Depends(get_db)
):
    """Lists Price Drop Claims in the manual review queues"""
    query = db.query(PriceDropClaim)
    if status:
        query = query.filter(PriceDropClaim.status == status)
    return query.all()


@router.post("/claims/{claim_id}/resolve")
def resolve_claim(
    claim_id: int,
    action: str, # approve, reject
    db: Session = Depends(get_db)
):
    """Admins manually approve or deny disputed price drop claim entries"""
    claim = db.query(PriceDropClaim).filter(PriceDropClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim ID not found.")
        
    if action.lower() == "approve":
        claim.status = "approved"
    else:
        claim.status = "rejected"
        
    db.commit()
    return {
        "claim_id": claim.id,
        "status": claim.status
    }


# 2. Offer Management CRUD
@router.post("/offers")
def create_offer(
    offer_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Creates a new promotional coupon offer"""
    import datetime
    offer = Offer(
        category=offer_data.get("category", "flights"),
        tags=offer_data.get("tags", "PROMO"),
        title=offer_data.get("title", ""),
        description=offer_data.get("description", ""),
        promo_code=offer_data.get("promo_code", "SAVE"),
        valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=10)
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


@router.delete("/offers/{offer_id}")
def delete_offer(
    offer_id: int,
    db: Session = Depends(get_db)
):
    """Removes an offer code from circulation"""
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found.")
    db.delete(offer)
    db.commit()
    return {"message": "Offer deleted successfully."}


# 3. Airline Partners CRUD
@router.post("/airlines")
def create_airline_partner(
    name: str,
    logo_url: str,
    brand_gradient: str = "from-blue-600 to-indigo-600",
    db: Session = Depends(get_db)
):
    """Creates/Registers a sponsored airline partner"""
    partner = AirlinePartner(
        name=name,
        logo_url=logo_url,
        brand_gradient=brand_gradient,
        deep_link="/flights"
    )
    db.add(partner)
    db.commit()
    db.refresh(partner)
    return partner


@router.delete("/airlines/{partner_id}")
def delete_airline_partner(
    partner_id: int,
    db: Session = Depends(get_db)
):
    """Removes a sponsored airline partner"""
    partner = db.query(AirlinePartner).filter(AirlinePartner.id == partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Airline partner not found.")
    db.delete(partner)
    db.commit()
    return {"message": "Airline partner deleted."}


# Payments Dashboard & Unified Approvals APIs
from app.models.bookings import (
    PaymentAttempt, BookingStatus, FlightBooking, HotelBooking, TrainBooking, BusBooking,
    CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication, CruiseBooking,
    InsurancePolicy, VillaBooking, ForexOrder
)
from app.models.payments import LedgerRow, SettlementBatch, ReconciliationException, ApprovalRequest, VendorPayout, Dispute
from app.services.payout_manager import PayoutManager
from app.services.refund_manager import RefundManager
from app.services.reconciliation import ReconciliationService
from app.models.audit import AuditLog
from sqlalchemy import func
from decimal import Decimal
import csv
import io
from fastapi.responses import StreamingResponse

@router.get("/payments/transactions")
def get_admin_transactions(
    status: str = None,
    gateway: str = None,
    vertical: str = None,
    db: Session = Depends(get_db)
):
    """Filterable transactions list with JSON output"""
    query = db.query(PaymentAttempt)
    if status:
        query = query.filter(PaymentAttempt.status == status)
    if gateway:
        # Check if booking's attempts match
        pass
    if vertical:
        query = query.filter(PaymentAttempt.booking_reference.like(f"BK-%"))
    return query.order_by(PaymentAttempt.created_at.desc()).all()


@router.get("/payments/transactions/csv")
def export_transactions_csv(db: Session = Depends(get_db)):
    """Exports transactions ledger into a downloadable CSV sheet"""
    attempts = db.query(PaymentAttempt).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "User ID", "Booking Reference", "Status", "Amount", "Failure Reason", "Created At"])
    for a in attempts:
        writer.writerow([a.id, a.user_id, a.booking_reference, a.status, float(a.amount), a.failure_reason, a.created_at])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions_ledger.csv"}
    )


@router.get("/payments/analytics")
def get_ledger_analytics(db: Session = Depends(get_db)):
    """Computes daily totals for gross, refunds, and net revenue sourced from LedgerRow"""
    # Sum gross (charge, wallet_topup, fee credits)
    gross_query = db.query(func.sum(LedgerRow.amount)).filter(LedgerRow.entry_type == "credit").scalar() or 0.0
    refund_query = db.query(func.sum(LedgerRow.amount)).filter(LedgerRow.transaction_type == "refund").scalar() or 0.0
    
    # Aggregation by type/transaction vertical
    # In sandbox we return a breakdown list
    breakdown = [
        {"vertical": "flights", "gross": float(gross_query) * 0.4, "refunds": float(refund_query) * 0.3},
        {"vertical": "hotels", "gross": float(gross_query) * 0.3, "refunds": float(refund_query) * 0.2},
        {"vertical": "villas", "gross": float(gross_query) * 0.2, "refunds": float(refund_query) * 0.4},
        {"vertical": "others", "gross": float(gross_query) * 0.1, "refunds": float(refund_query) * 0.1}
    ]
    for b in breakdown:
        b["net"] = b["gross"] - b["refunds"]

    return {
        "gross_revenue": float(gross_query),
        "refunds_total": float(refund_query),
        "net_revenue": float(gross_query) - float(refund_query),
        "breakdown": breakdown
    }


@router.get("/payments/exceptions")
def get_reconciliation_exceptions(db: Session = Depends(get_db)):
    """Fetch pending reconciliation exceptions"""
    return db.query(ReconciliationException).filter(ReconciliationException.status == "pending").all()


@router.post("/payments/exceptions/{id}/resolve")
def resolve_reconciliation_exception(id: int, notes: str = "Resolved manually", db: Session = Depends(get_db)):
    """Admins manually reconcile mismatches"""
    exc = db.query(ReconciliationException).filter(ReconciliationException.id == id).first()
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found.")
    exc.status = "resolved"
    exc.notes = notes
    db.commit()
    return {"message": "Exception resolved.", "id": exc.id}


@router.get("/payments/gateway-health")
def get_gateway_health(db: Session = Depends(get_db)):
    """Returns provider success rate and simulated latency metrics"""
    attempts = db.query(PaymentAttempt).all()
    stripe_s = sum(1 for a in attempts if a.status == "succeeded")
    stripe_total = len(attempts)
    success_rate = (stripe_s / stripe_total * 100) if stripe_total > 0 else 98.5
    
    return [
        {
            "provider": "stripe",
            "success_rate": round(success_rate, 1),
            "avg_latency_ms": 320,
            "error_breakdown": {"insufficient_funds": 2, "card_declined": 1}
        },
        {
            "provider": "razorpay",
            "success_rate": 97.8,
            "avg_latency_ms": 285,
            "error_breakdown": {"network_timeout": 1, "invalid_otp": 3}
        }
    ]


@router.get("/approvals")
def list_approvals(status: str = None, db: Session = Depends(get_db)):
    """Unified queue of approval requests for the admin console"""
    query = db.query(ApprovalRequest)
    if status:
        query = query.filter(ApprovalRequest.status == status.upper())
    return query.order_by(ApprovalRequest.created_at.desc()).all()


@router.post("/approvals/{id}/resolve")
def resolve_approval(
    id: int,
    action: str,  # APPROVED or REJECTED
    reviewer: str,
    notes: str,
    db: Session = Depends(get_db)
):
    """
    Approve or Deny requests with notes, audit logging, and final execution triggers.
    """
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")

    if approval.status != "PENDING":
        raise HTTPException(status_code=400, detail="Approval request already processed.")

    action_upper = action.upper()
    if action_upper not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use APPROVED or REJECTED.")

    approval.status = action_upper
    approval.reviewed_by = reviewer
    approval.review_notes = notes
    approval.reviewed_at = datetime.datetime.utcnow()

    # Find target booking for status update
    booking = None
    tables = [FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication, CruiseBooking, InsurancePolicy, VillaBooking, ForexOrder]
    for table in tables:
        booking = db.query(table).filter(table.booking_reference == approval.reference_id).first()
        if booking:
            break

    # Execute downstream actions
    if action_upper == "APPROVED":
        if approval.request_type == "refund_exception":
            if booking:
                RefundManager.execute_refund_payout(
                    db,
                    booking=booking,
                    amount=Decimal(str(approval.amount)),
                    fee=Decimal("0.00"),
                    refund_to="wallet"
                )
        elif approval.request_type == "fraud_review":
            if booking:
                booking.status = BookingStatus.CONFIRMED
                # Add Ledger Row for approved transaction capture
                ledger_cap = LedgerRow(
                    booking_reference=booking.booking_reference,
                    amount=float(booking.total_amount),
                    transaction_type="charge",
                    entry_type="credit",
                    description="Fraud review approved and payment captured."
                )
                db.add(ledger_cap)
        elif approval.request_type == "high_value_payout":
            payout = db.query(VendorPayout).filter(VendorPayout.id == int(approval.reference_id)).first()
            if payout:
                PayoutManager.execute_gateway_transfer(db, payout)
        elif approval.request_type in ("myBiz_booking", "villa_booking"):
            if booking:
                booking.status = BookingStatus.CONFIRMED
        elif approval.request_type == "new_booking":
            if booking:
                booking.status = BookingStatus.CONFIRMED
                if approval.payment_gateway and approval.payment_charge_id:
                    from app.services.payment_provider import get_payment_provider
                    provider = get_payment_provider(approval.payment_gateway)
                    provider.capture(approval.payment_charge_id, float(approval.amount))
                    
                    card_attempt = PaymentAttempt(
                        user_id=booking.user_id,
                        booking_reference=booking.booking_reference,
                        status="succeeded",
                        amount=float(approval.amount)
                    )
                    db.add(card_attempt)
                    
                    ledger_card = LedgerRow(
                        booking_reference=booking.booking_reference,
                        amount=float(approval.amount),
                        transaction_type="charge",
                        entry_type="credit",
                        description=f"Admin approved capture for authorization hold ({approval.payment_charge_id})"
                    )
                    db.add(ledger_card)
                
                emit_event("booking_confirmed", {
                    "user_id": booking.user_id,
                    "booking_reference": booking.booking_reference,
                    "amount": float(booking.total_amount)
                })
                
                from app.routes.payments import send_websocket_update
                send_websocket_update(f"user_booking_{booking.booking_reference}", {
                    "status": "confirmed"
                })

    else:  # REJECTED
        if approval.request_type == "fraud_review":
            if booking:
                booking.status = BookingStatus.CANCELLED
                # Void card authorization hold
                void_log = LedgerRow(
                    booking_reference=booking.booking_reference,
                    amount=float(booking.total_amount),
                    transaction_type="refund",
                    entry_type="debit",
                    description="Fraud review rejected, authorization hold voided."
                )
                db.add(void_log)
        elif approval.request_type == "refund_exception":
            # Keep booking status confirmed since refund exception is denied
            if booking:
                booking.status = BookingStatus.CONFIRMED
        elif approval.request_type == "high_value_payout":
            payout = db.query(VendorPayout).filter(VendorPayout.id == int(approval.reference_id)).first()
            if payout:
                payout.status = "failed"
        elif approval.request_type in ("myBiz_booking", "villa_booking"):
            if booking:
                booking.status = BookingStatus.CANCELLED
        elif approval.request_type == "new_booking":
            if booking:
                booking.status = BookingStatus.REJECTED
                if approval.payment_gateway and approval.payment_charge_id:
                    from app.services.payment_provider import get_payment_provider
                    provider = get_payment_provider(approval.payment_gateway)
                    provider.void(approval.payment_charge_id)
                    
                    card_attempt = PaymentAttempt(
                        user_id=booking.user_id,
                        booking_reference=booking.booking_reference,
                        amount=float(approval.amount),
                        status="failed",
                        failure_reason="Admin declined booking"
                    )
                    db.add(card_attempt)
                
                # Refund wallet portion if exists
                ledger_wallet = db.query(LedgerRow).filter(
                    LedgerRow.booking_reference == booking.booking_reference,
                    LedgerRow.transaction_type == "wallet_debit"
                ).first()
                if ledger_wallet:
                    WalletService.refund_to_wallet(db, booking.user_id, Decimal(str(ledger_wallet.amount)), booking.booking_reference)
                    ref_ledger = LedgerRow(
                        booking_reference=booking.booking_reference,
                        amount=float(ledger_wallet.amount),
                        transaction_type="refund",
                        entry_type="credit",
                        description="Voided wallet charge refund on admin rejection"
                    )
                    db.add(ref_ledger)
                
                emit_event("booking_rejected", {
                    "user_id": booking.user_id,
                    "booking_reference": booking.booking_reference,
                    "amount": float(booking.total_amount),
                    "reason": notes
                })
                
                from app.routes.payments import send_websocket_update
                send_websocket_update(f"user_booking_{booking.booking_reference}", {
                    "status": "rejected",
                    "reason": notes
                })

    # Write to Audit Log (Module 9 required)
    audit = AuditLog(
        actor=reviewer,
        action=f"approval_{action_upper.lower()}",
        entity=approval.reference_id,
        before_json={"status": "PENDING", "type": approval.request_type},
        after_json={"status": action_upper, "notes": notes}
    )
    db.add(audit)
    db.commit()

    return {
        "id": approval.id,
        "status": approval.status,
        "reviewed_by": approval.reviewed_by
    }


@router.post("/payouts/trigger-run")
def trigger_payout_run(vendor_id: str, period: str, db: Session = Depends(get_db)):
    """Triggers automated Weekly Payout aggregator runner"""
    res = PayoutManager.calculate_weekly_vendor_payouts(db, vendor_id, period)
    return res


@router.get("/payouts")
def list_payouts(db: Session = Depends(get_db)):
    """View payout ledger logs"""
    return db.query(VendorPayout).all()


@router.get("/disputes/{id}/evidence")
def assemble_dispute_evidence(id: int, db: Session = Depends(get_db)):
    """
    Evidence submission helper.
    Assembles customer booking, KYC reference, and event logs into a bundle.
    """
    dispute = db.query(Dispute).filter(Dispute.id == id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found.")
        
    booking = None
    tables = [FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication, CruiseBooking, InsurancePolicy, VillaBooking, ForexOrder]
    for table in tables:
        booking = db.query(table).filter(table.booking_reference == dispute.booking_reference).first()
        if booking:
            break
            
    # Gather logs
    audit_trail = db.query(AuditLog).filter(AuditLog.entity == dispute.booking_reference).all()
    
    return {
        "dispute_id": dispute.id,
        "booking_reference": dispute.booking_reference,
        "evidence_due_by": dispute.evidence_due_by,
        "status": dispute.status,
        "evidence_package": {
            "customer_id": booking.user_id if booking else "unknown",
            "amount_disputed": float(dispute.amount),
            "booking_details": {
                "currency": booking.currency if booking else "INR",
                "total_amount": float(booking.total_amount) if booking else 0.0,
                "cancellation_policy_ref": booking.cancellation_policy_ref if booking else None,
                "created_at": booking.created_at if booking else None
            },
            "audit_trail": [
                {"action": log.action, "actor": log.actor, "timestamp": log.timestamp}
                for log in audit_trail
            ]
        }
    }


class AutoApprovalRuleSchema(BaseModel):
    applies_to: str
    max_amount: float
    min_user_trust_score: float
    requires_clean_fraud_check: bool
    active: bool

@router.get("/rules")
def list_rules(db: Session = Depends(get_db)):
    return db.query(AutoApprovalRule).all()

@router.post("/rules")
def create_rule(schema: AutoApprovalRuleSchema, db: Session = Depends(get_db)):
    rule = AutoApprovalRule(
        applies_to=schema.applies_to,
        max_amount=schema.max_amount,
        min_user_trust_score=schema.min_user_trust_score,
        requires_clean_fraud_check=schema.requires_clean_fraud_check,
        active=schema.active
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.put("/rules/{id}")
def update_rule(id: int, schema: AutoApprovalRuleSchema, db: Session = Depends(get_db)):
    rule = db.query(AutoApprovalRule).filter(AutoApprovalRule.id == id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")
    rule.applies_to = schema.applies_to
    rule.max_amount = schema.max_amount
    rule.min_user_trust_score = schema.min_user_trust_score
    rule.requires_clean_fraud_check = schema.requires_clean_fraud_check
    rule.active = schema.active
    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/rules/{id}")
def delete_rule(id: int, db: Session = Depends(get_db)):
    rule = db.query(AutoApprovalRule).filter(AutoApprovalRule.id == id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")
    db.delete(rule)
    db.commit()
    return {"success": True, "message": "Rule deleted successfully."}


class ResolveRefundRequest(BaseModel):
    action: str  # approve, reject, adjust
    approved_amount: Optional[float] = None
    notes: str

@router.get("/refunds/queue")
def list_refunds_queue(db: Session = Depends(get_db)):
    refunds = db.query(ApprovalRequest).filter(
        ApprovalRequest.request_type == "refund_exception"
    ).all()
    
    enriched = []
    tables = [FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication, CruiseBooking, InsurancePolicy, VillaBooking, ForexOrder]
    for r in refunds:
        booking = None
        for table in tables:
            booking = db.query(table).filter(table.booking_reference == r.reference_id).first()
            if booking:
                break
        
        user_id = 1
        if booking:
            # Safely handle user_id extraction
            user_id = booking.user_id if hasattr(booking, "user_id") else 1
            
        refund_count = db.query(ApprovalRequest).filter(
            ApprovalRequest.requested_by == f"user_{user_id}",
            ApprovalRequest.request_type == "refund_exception",
            ApprovalRequest.status == "APPROVED"
        ).count()
        
        enriched.append({
            "id": r.id,
            "reference_id": r.reference_id,
            "requested_by": r.requested_by,
            "amount": float(r.amount),
            "reason": r.reason,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "booking_details": {
                "total_amount": float(booking.total_amount) if booking else 0.0,
                "vertical": booking.__tablename__.replace("_bookings", "") if booking else "unknown",
                "user_refund_history_count": refund_count
            }
        })
    return enriched

@router.post("/refunds/{request_id}/resolve")
def resolve_refund_request(
    request_id: int,
    req_body: ResolveRefundRequest,
    db: Session = Depends(get_db)
):
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Refund exception request not found.")
        
    if approval.status != "PENDING":
        raise HTTPException(status_code=400, detail="Refund request already processed.")
        
    action_lower = req_body.action.lower()
    if action_lower not in ["approve", "reject", "adjust"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use approve, reject, or adjust.")
        
    booking = None
    tables = [FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication, CruiseBooking, InsurancePolicy, VillaBooking, ForexOrder]
    for table in tables:
        booking = db.query(table).filter(table.booking_reference == approval.reference_id).first()
        if booking:
            break
            
    if not booking:
        raise HTTPException(status_code=404, detail="Booking associated with refund request not found.")

    if action_lower in ["approve", "adjust"]:
        payout_amount = approval.amount
        if action_lower == "adjust":
            if req_body.approved_amount is None:
                raise HTTPException(status_code=400, detail="Approved amount override required for adjust action.")
            payout_amount = req_body.approved_amount
            
        approval.status = "APPROVED"
        approval.review_notes = f"Override to ₹{payout_amount}. Notes: {req_body.notes}" if action_lower == "adjust" else req_body.notes
        
        RefundManager.execute_refund_payout(
            db=db,
            booking=booking,
            amount=Decimal(str(payout_amount)),
            fee=Decimal("0.00"),
            refund_to="wallet"
        )
        
        audit = AuditLog(
            actor="admin",
            action="refund_approved_adjust" if action_lower == "adjust" else "refund_approved",
            entity=booking.booking_reference,
            timestamp=datetime.datetime.utcnow(),
            after_json={"message": f"Refund of ₹{payout_amount} approved and processed.", "notes": req_body.notes}
        )
        db.add(audit)
        db.commit()
        
        print(f"SMS/Email dispatched to user {booking.user_id}: Refund of INR {payout_amount} for booking {booking.booking_reference} has been credited to wallet.")
        
    else:  # REJECT
        approval.status = "REJECTED"
        approval.review_notes = req_body.notes
        if booking:
            booking.status = BookingStatus.CONFIRMED
        
        audit = AuditLog(
            actor="admin",
            action="refund_rejected",
            entity=booking.booking_reference,
            timestamp=datetime.datetime.utcnow(),
            after_json={"message": "Refund request rejected by admin.", "notes": req_body.notes}
        )
        db.add(audit)
        db.commit()
        
        print(f"SMS/Email dispatched to user {booking.user_id}: Refund request for booking {booking.booking_reference} has been rejected.")
        
    return {
        "success": True,
        "status": approval.status,
        "message": f"Refund exception request has been resolved as {approval.status.lower()}."
    }

