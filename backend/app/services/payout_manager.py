import datetime
import logging
from decimal import Decimal
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from app.models.payments import LedgerRow, VendorPayout, ApprovalRequest
from app.utils.event_bus import emit_event

logger = logging.getLogger(__name__)

# Configurable high-value payout approval threshold
PAYOUT_APPROVAL_THRESHOLD = Decimal("25000.00")
COMMISSION_RATE = Decimal("0.10")  # 10% commission

class PayoutManager:
    @staticmethod
    def calculate_weekly_vendor_payouts(db: Session, vendor_id: str, period: str) -> dict:
        """
        Aggregates completed vendor bookings in a period, computes net payout
        (gross bookings - 10% commission), checks threshold, and executes or requests approval.
        """
        logger.info(f"Computing payout run for vendor {vendor_id} for period {period}")
        
        # Check if payout already exists for this period
        existing = db.query(VendorPayout).filter(
            VendorPayout.vendor_id == vendor_id,
            VendorPayout.period == period
        ).first()
        if existing:
            return {"message": "Payout already computed for this period.", "payout_id": existing.id, "status": existing.status}

        # Query all successful bookings in ledger for this vendor (simulated via booking_reference matching)
        # In a real environment, we'd search bookings table filtering by completed status and vendor host_id
        # Here we mock booking aggregation: let's assume this vendor had 3 bookings totaling ₹30,000
        gross_amount = Decimal("30000.00") if vendor_id == "host_premium" else Decimal("18000.00")
        commission = gross_amount * COMMISSION_RATE
        net_amount = gross_amount - commission
        
        status = "pending_approval" if net_amount >= PAYOUT_APPROVAL_THRESHOLD else "processing"
        
        payout = VendorPayout(
            vendor_id=vendor_id,
            period=period,
            gross_bookings_amount=float(gross_amount),
            commission_deducted=float(commission),
            net_payout_amount=float(net_amount),
            status=status
        )
        db.add(payout)
        db.commit()
        db.refresh(payout)
        
        if status == "pending_approval":
            # Escalate to general approval workflow (Module 5)
            approval = ApprovalRequest(
                request_type="high_value_payout",
                reference_id=str(payout.id),
                requested_by="system_payout_scheduler",
                amount=float(net_amount),
                reason=f"Vendor payout for period {period} exceeds auto-process limit of ₹{PAYOUT_APPROVAL_THRESHOLD}",
                status="PENDING"
            )
            db.add(approval)
            db.commit()
            logger.info(f"Vendor payout {payout.id} escalated to ApprovalRequest {approval.id}")
            return {
                "payout_id": payout.id,
                "status": payout.status,
                "net_amount": float(net_amount),
                "approval_required": True,
                "approval_id": approval.id
            }
            
        # For auto-processed payouts, run simulated gateway transfer
        return cls.execute_gateway_transfer(db, payout)

    @classmethod
    def execute_gateway_transfer(cls, db: Session, payout: VendorPayout) -> dict:
        """
        Executes vendor payout via Stripe Connect / Razorpay Route transfer API
        """
        logger.info(f"Initiating gateway transfer for payout {payout.id} to vendor {payout.vendor_id}")
        
        # Simulate transient error / retry logic
        success = True
        error_msg = None
        
        # Simulating random gateway failure for host_flaky
        if payout.vendor_id == "host_flaky":
            # Trigger retry simulation or fail
            success = False
            error_msg = "Gateway API connection timeout (Stripe Connect error code: connect_timeout)"
            
        if success:
            payout.status = "paid"
            # Log payout to ledger
            ledger_entry = LedgerRow(
                booking_reference=f"PAYOUT-{payout.id}",
                amount=float(payout.net_payout_amount),
                transaction_type="payout",
                entry_type="debit",  # outgoing payout
                description=f"Weekly payout to vendor {payout.vendor_id} for period {payout.period}"
            )
            db.add(ledger_entry)
            payout.ledger_ref = f"PAYOUT-{payout.id}"
            db.commit()
            
            emit_event("vendor_payout_completed", {
                "vendor_id": payout.vendor_id,
                "payout_id": payout.id,
                "amount": float(payout.net_payout_amount)
            })
            
            return {
                "payout_id": payout.id,
                "status": "paid",
                "net_amount": float(payout.net_payout_amount)
            }
        else:
            payout.status = "failed"
            db.commit()
            
            # Emit high-priority failure alert to events
            logger.error(f"CRITICAL VENDOR PAYOUT FAILURE: Payout ID {payout.id} to vendor {payout.vendor_id} failed: {error_msg}")
            emit_event("vendor_payout_failed", {
                "vendor_id": payout.vendor_id,
                "payout_id": payout.id,
                "amount": float(payout.net_payout_amount),
                "error": error_msg
            })
            
            return {
                "payout_id": payout.id,
                "status": "failed",
                "error": error_msg
            }
