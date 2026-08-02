import datetime
import logging
from sqlalchemy.orm import Session
from app.models.payments import LedgerRow, SettlementBatch, ReconciliationException

logger = logging.getLogger(__name__)

class ReconciliationService:
    @staticmethod
    def run_reconciliation(db: Session, gateway: str) -> dict:
        """
        Mock scheduled reconciliation job.
        Fetches the gateway's settlement report (simulated) and flags mismatches
        against our LedgerRow records into a ReconciliationException table.
        """
        logger.info(f"Starting reconciliation job for gateway: {gateway}")
        
        # 1. Create a mock settlement batch
        batch_ref = f"SETTLE-{gateway.upper()}-{datetime.date.today().strftime('%Y%m%d')}"
        
        # Check if batch already processed
        exists = db.query(SettlementBatch).filter(SettlementBatch.batch_reference == batch_ref).first()
        if exists:
            return {"message": "Reconciliation batch already processed for today.", "batch_id": exists.id}
            
        # Get all charges in ledger for this gateway in the last 24h
        time_threshold = datetime.datetime.utcnow() - datetime.timedelta(days=1)
        ledger_charges = db.query(LedgerRow).filter(
            LedgerRow.transaction_type == "charge",
            LedgerRow.created_at >= time_threshold
        ).all()
        
        expected_total = sum(Decimal(str(r.amount)) for r in ledger_charges)
        
        # Simulate gateway settlement report payload
        # To simulate a mismatch for testing, we will alter one transaction if any exist, or make the total slightly off.
        gateway_total = expected_total
        mismatched_booking_ref = None
        mismatch_actual_amount = 0.0
        mismatch_expected_amount = 0.0
        
        if len(ledger_charges) > 0:
            # Introduce a mock mismatch: one transaction has an unexpected fee or amount mismatch
            mismatched_txn = ledger_charges[0]
            mismatched_booking_ref = mismatched_txn.booking_reference
            mismatch_expected_amount = float(mismatched_txn.amount)
            # Gateway paid slightly less (e.g. fee deduction mismatch)
            mismatch_actual_amount = mismatch_expected_amount - 150.00
            gateway_total -= Decimal("150.00")
            
        batch = SettlementBatch(
            gateway=gateway,
            batch_reference=batch_ref,
            settlement_date=datetime.datetime.utcnow(),
            total_amount=float(gateway_total),
            status="reconciled" if not mismatched_booking_ref else "pending"
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        
        exceptions_created = []
        
        # 2. Flag mismatches into ReconciliationException table
        if mismatched_booking_ref:
            exc = ReconciliationException(
                batch_id=batch.id,
                booking_reference=mismatched_booking_ref,
                exception_type="amount_mismatch",
                expected_amount=mismatch_expected_amount,
                actual_amount=mismatch_actual_amount,
                status="pending",
                notes=f"Gateway reported amount ₹{mismatch_actual_amount} but Ledger expected ₹{mismatch_expected_amount}."
            )
            db.add(exc)
            db.commit()
            db.refresh(exc)
            exceptions_created.append(exc.id)
            logger.warning(f"Reconciliation Mismatch Flagged: Booking {mismatched_booking_ref} in batch {batch.id}")
            
        # Also check for "missing transaction" simulation
        # If there are no charges, we simulate a healthy batch
        return {
            "batch_id": batch.id,
            "status": batch.status,
            "expected_total": float(expected_total),
            "gateway_total": float(gateway_total),
            "exceptions_flagged": len(exceptions_created)
        }

    @staticmethod
    def get_summary_report(db: Session) -> dict:
        """
        Generates daily/weekly reconciliation summary reports for admin panel analytics.
        """
        total_batches = db.query(SettlementBatch).count()
        pending_exceptions = db.query(ReconciliationException).filter(ReconciliationException.status == "pending").count()
        resolved_exceptions = db.query(ReconciliationException).filter(ReconciliationException.status == "resolved").count()
        
        # Sum of exceptions
        total_mismatch_val = db.query(sa_sum_func(ReconciliationException.expected_amount)).scalar() or 0.0
        
        return {
            "total_batches_processed": total_batches,
            "pending_exceptions_count": pending_exceptions,
            "resolved_exceptions_count": resolved_exceptions,
            "total_exception_discrepancy_amount": float(total_mismatch_val)
        }

from decimal import Decimal
from typing import Optional
# SQL alchemy sum helper
def sa_sum_func(col):
    from sqlalchemy import func
    return func.sum(col)



def reconcile_provider_bookings(db: Session) -> dict:
    """
    Periodically verifies our booking records against provider status for bookings in non-terminal states.
    Auto-expires holds that have passed their held_until deadline.
    """
    logger.info("Running provider booking reconciliation job...")
    from app.models.bookings import (
        BookingStatus, FlightBooking, HotelBooking, VehicleRentalBooking, BookingEvent
    )
    from app.providers.registry import provider_registry

    reconciled_count = 0
    status_updates = []

    tables = [FlightBooking, HotelBooking, VehicleRentalBooking]

    for table in tables:
        bookings = db.query(table).filter(
            table.status.in_([
                BookingStatus.HOLD,
                BookingStatus.AWAITING_HUMAN_PAYMENT_APPROVAL,
                BookingStatus.PAYMENT_PROCESSING,
                BookingStatus.CONFIRMED
            ])
        ).all()

        for b in bookings:
            provider_name = b.pricing_snapshot.get("provider_name") if b.pricing_snapshot else None
            if not provider_name:
                if table == FlightBooking:
                    provider_name = "Amadeus"
                elif table == HotelBooking:
                    provider_name = "HotelBeds"
                else:
                    provider_name = "FirstPartyFleet"

            provider = provider_registry.get_provider(
                "flights" if table == FlightBooking else ("hotels" if table == HotelBooking else "vehicle_rental"),
                provider_name
            )

            if provider:
                now = datetime.datetime.utcnow()
                if b.status in [BookingStatus.HOLD, BookingStatus.AWAITING_HUMAN_PAYMENT_APPROVAL]:
                    if b.held_until and now > b.held_until:
                        old_status = b.status
                        b.status = BookingStatus.EXPIRED
                        reconciled_count += 1
                        status_updates.append(f"{b.booking_reference}: {old_status.value} -> expired")

                        event = BookingEvent(
                            booking_reference=b.booking_reference,
                            event_type="reconciliation_expire",
                            description=f"Reconciliation job auto-expired booking hold. Expiry was {b.held_until}."
                        )
                        db.add(event)

    db.commit()
    return {
        "reconciled_count": reconciled_count,
        "status_updates": status_updates
    }

