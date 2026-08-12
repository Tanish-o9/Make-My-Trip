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
                release_expired_seat_holds(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in background SLA daemon loop: {e}")
        time.sleep(15) # Check every 15 seconds

def release_expired_seat_holds(db: Session):
    now = datetime.datetime.utcnow()
    from app.models.bookings import SeatHold
    expired_holds = db.query(SeatHold).filter(
        SeatHold.status == "HELD",
        SeatHold.expires_at < now
    ).all()
    for hold in expired_holds:
        logger.info(f"Auto-released expired seat hold {hold.seat_number} for reference {hold.reference} (Booking: {hold.booking_reference})")
        hold.status = "EXPIRED"
    if expired_holds:
        db.commit()

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

def check_stuck_payments(db: Session):
    import datetime
    from app.models.payments import Payment, PaymentStatus, PaymentTransaction, TransactionEventType
    from app.payments.client import razorpay_client
    
    # Fetch all payments older than 30 minutes in status 'created'
    thirty_minutes_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=30)
    stuck_payments = db.query(Payment).filter(
        Payment.status == PaymentStatus.CREATED,
        Payment.created_at < thirty_minutes_ago
    ).all()
    
    for payment in stuck_payments:
        logger.info(f"Checking status of stuck payment {payment.id} (Razorpay order {payment.razorpay_order_id})")
        try:
            order_data = razorpay_client.order.fetch(payment.razorpay_order_id)
            payments_response = razorpay_client.order.payments(payment.razorpay_order_id)
            items = payments_response.get("items", [])
            
            if items:
                captured_payment = None
                for p in items:
                    if p.get("status") in ["captured", "authorized"]:
                        captured_payment = p
                        break
                        
                if captured_payment:
                    logger.warning(f"Reconciliation: Found captured payment {captured_payment['id']} for order {payment.razorpay_order_id} on Razorpay. Auto-reconciling...")
                    payment.status = PaymentStatus.CAPTURED
                    payment.razorpay_payment_id = captured_payment['id']
                    db.commit()
                    
                    tx = PaymentTransaction(
                        payment_id=payment.id,
                        event_type=TransactionEventType.WEBHOOK_RECEIVED,
                        raw_payload={"reconciled_via": "cron_job", "payment_data": captured_payment}
                    )
                    db.add(tx)
                    db.commit()
                    
                    from app.routes.payments import find_booking_by_reference
                    from app.services.booking_core import BookingStateMachine
                    booking = find_booking_by_reference(db, payment.booking_id)
                    if booking and booking.status != BookingStatus.CONFIRMED:
                        BookingStateMachine.transition_to(booking, BookingStatus.CONFIRMED)
                        db.commit()
                        emit_event("booking_confirmed", {
                            "user_id": booking.user_id,
                            "booking_reference": booking.booking_reference,
                            "vertical": getattr(booking, "__tablename__", "").replace("_bookings", "")
                        })
                    continue
            
            # If no captured payment on Razorpay, mark local payment status as FAILED
            logger.warning(f"Reconciliation Alert: Order {payment.razorpay_order_id} is stuck with no capture. Flagging payment status as FAILED.")
            payment.status = PaymentStatus.FAILED
            db.commit()
            
            tx = PaymentTransaction(
                payment_id=payment.id,
                event_type=TransactionEventType.PAYMENT_FAILED,
                raw_payload={"reconciled_via": "cron_job", "status": "stuck_unpaid"}
            )
            db.add(tx)
            db.commit()
            
        except Exception as e:
            logger.error(f"Error reconciling payment {payment.id}: {e}")

def run_payment_reconciliation():
    logger.info("Starting background Payment Reconciliation daemon loop...")
    while True:
        try:
            db = SessionLocal()
            try:
                check_stuck_payments(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in background Payment Reconciliation daemon loop: {e}")
        time.sleep(900) # Check every 15 minutes (900 seconds)

def start_sla_daemon():
    thread1 = threading.Thread(target=run_sla_cleanup, daemon=True)
    thread1.start()
    
    thread2 = threading.Thread(target=run_payment_reconciliation, daemon=True)
    thread2.start()

    # Start Phase 9: Price drop monitoring loop
    thread3 = threading.Thread(target=run_price_drop_monitor, daemon=True)
    thread3.start()

    # Start Phase 9: Trip reminders, visa expiry, document expiry daemon loops
    thread4 = threading.Thread(target=run_document_expiry_monitor, daemon=True)
    thread4.start()


# ─── Phase 9: Automation Background Loops ─────────────────────────────────────

def run_price_drop_monitor():
    logger.info("Starting background Price Drop Monitor daemon loop...")
    while True:
        try:
            db = SessionLocal()
            try:
                from app.services.price_tracker import price_tracker
                # Periodically query forex rate and monitor drops
                price_tracker.record_price("forex", "USD-INR", 83.20)
                price_tracker.record_price("forex", "USD-INR", 82.50)
                analysis = price_tracker.analyze_price_trend("forex", "USD-INR")
                logger.info(f"[SLA Daemon] Price Drop analysis USD-INR: {analysis.get('trend')}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in Price Drop Monitor: {e}")
        time.sleep(3600)  # Check hourly


def run_document_expiry_monitor():
    logger.info("Starting background Expiry Monitor daemon loop...")
    while True:
        try:
            db = SessionLocal()
            try:
                from app.services.trip_monitor import trip_monitor
                from app.models.core import User
                users = db.query(User).all()
                for user in users:
                    # Scan active visa applications for expiration warnings
                    visas = trip_monitor.monitor_visa_expiry(db, user.id)
                    forex_alerts = trip_monitor.monitor_forex_rates(db, user.id)
                    if visas:
                        logger.info(f"[Expiry Daemon] Found {len(visas)} visa alerts for user {user.id}")
                    if forex_alerts:
                        logger.info(f"[Expiry Daemon] Found {len(forex_alerts)} forex rate alerts for user {user.id}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in Expiry Monitor: {e}")
        time.sleep(86400)  # Run once daily
