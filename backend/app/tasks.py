import time
import datetime
import logging
import threading
from decimal import Decimal
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.payments import ApprovalRequest, LedgerRow, Dispute
from app.models.bookings import (
    BookingStatus, FlightBooking, HotelBooking, TrainBooking, BusBooking,
    CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication,
    CruiseBooking, InsurancePolicy, VillaBooking, ForexOrder, PaymentAttempt
)
from app.models.core import User
from app.models.audit import AuditLog
from app.services.payment_provider import get_payment_provider
from app.services.wallet_loyalty import WalletService
from app.utils.event_bus import emit_event
from app.routes.payments import send_websocket_update

logger = logging.getLogger(__name__)

def run_sla_cleanup():
    logger.info("Starting background SLA / Timeout checker daemon loop...")
    while True:
        try:
            db = SessionLocal()
            try:
                check_pending_approvals_sla(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in background SLA daemon loop: {e}")
        time.sleep(15) # Check every 15 seconds

def check_pending_approvals_sla(db: Session):
    now = datetime.datetime.utcnow()
    pending_approvals = db.query(ApprovalRequest).filter(ApprovalRequest.status == "PENDING").all()
    
    for approval in pending_approvals:
        if approval.sla_expires_at and now > approval.sla_expires_at:
            logger.warning(f"SLA breach detected for request {approval.id} (Ref: {approval.reference_id})")
            approval.is_sla_breached = True
            
            # Perform timeout action
            if approval.timeout_behavior == "auto_reject":
                # Resolve request as REJECTED
                approval.status = "REJECTED"
                approval.reviewed_by = "system_sla_daemon"
                approval.review_notes = "SLA timeout: Booking auto-rejected due to lack of administrative clearance within window."
                approval.reviewed_at = now
                
                # Locate booking
                booking = None
                tables = [FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking, HolidayPackageBooking, ActivityBooking, VisaApplication, CruiseBooking, InsurancePolicy, VillaBooking, ForexOrder]
                for table in tables:
                    booking = db.query(table).filter(table.booking_reference == approval.reference_id).first()
                    if booking:
                        break
                        
                if booking:
                    # Transition booking to REJECTED
                    booking.status = BookingStatus.REJECTED
                    
                    # Void card authorization hold if exists
                    if approval.payment_gateway and approval.payment_charge_id:
                        try:
                            provider = get_payment_provider(approval.payment_gateway)
                            provider.void(approval.payment_charge_id)
                        except Exception as ex:
                            logger.error(f"Failed to void hold {approval.payment_charge_id}: {ex}")
                        
                        card_attempt = PaymentAttempt(
                            user_id=booking.user_id,
                            booking_reference=booking.booking_reference,
                            status="failed",
                            failure_reason="SLA timeout: Voided hold"
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
                            description="Voided wallet charge refund on SLA timeout rejection"
                        )
                        db.add(ref_ledger)
                    
                    # Emit rejection event
                    emit_event("booking_rejected", {
                        "user_id": booking.user_id,
                        "booking_reference": booking.booking_reference,
                        "amount": float(booking.total_amount),
                        "reason": "SLA timeout"
                    })
                    
                    # Broadcast status update to client
                    send_websocket_update(f"user_booking_{booking.booking_reference}", {
                        "status": "rejected",
                        "reason": "SLA timeout"
                    })
                    
                # Write to Audit Log
                audit = AuditLog(
                    actor="system_sla_daemon",
                    action="sla_timeout_rejection",
                    entity=approval.reference_id,
                    timestamp=now,
                    details="SLA expired. Transaction hold voided."
                )
                db.add(audit)
                db.commit()
                
            elif approval.timeout_behavior == "escalate":
                # Escalate to Super Admin
                approval.assigned_role = "Super Admin"
                approval.reason = f"[ESCALATED SLA BREACH] {approval.reason}"
                db.commit()
                
                # Broadcast WebSocket breach alert to Admin Console
                send_websocket_update("admin_notifications", {
                    "type": "sla_breach",
                    "booking_reference": approval.reference_id,
                    "request_id": approval.id
                })
                
                # Write to Audit Log
                audit = AuditLog(
                    actor="system_sla_daemon",
                    action="sla_escalation",
                    entity=approval.reference_id,
                    timestamp=now,
                    details="SLA expired. Escalated to Super Admin role."
                )
                db.add(audit)
                db.commit()

def start_sla_daemon():
    thread = threading.Thread(target=run_sla_cleanup, daemon=True)
    thread.start()
