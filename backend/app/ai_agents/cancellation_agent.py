import datetime
from decimal import Decimal
import logging
from sqlalchemy.orm import Session
from app.models.bookings import FlightBooking, HotelBooking, BookingStatus
from app.models.audit import AuditLog
from app.services.wallet_loyalty import WalletService
from app.ai_agents.state import log_agent_execution

logger = logging.getLogger(__name__)

class CancellationAgent:
    @staticmethod
    def process_cancellation(db: Session, booking_ref: str, user_id: int) -> dict:
        """
        Determines refund amount and executes cancellation and refund wallet credits.
        """
        # 1. Search FlightBooking
        booking = db.query(FlightBooking).filter(
            FlightBooking.booking_reference == booking_ref,
            FlightBooking.user_id == user_id
        ).first()
        
        target_time = None
        if booking:
            target_time = booking.departure_time
        else:
            # Try HotelBooking
            booking = db.query(HotelBooking).filter(
                HotelBooking.booking_reference == booking_ref,
                HotelBooking.user_id == user_id
            ).first()
            if booking:
                target_time = booking.check_in

        if not booking:
            return {"success": False, "error": "Booking not found"}

        if booking.status in [BookingStatus.CANCELLED, BookingStatus.REFUNDED]:
            return {"success": False, "error": "Booking already cancelled or refunded"}

        # 2. Calculate Refund Percentage based on lead time
        now = datetime.datetime.utcnow()
        refund_pct = Decimal("0.00")
        
        if target_time:
            time_diff = target_time - now
            hours_diff = time_diff.total_seconds() / 3600.0
            
            if hours_diff >= 48:
                refund_pct = Decimal("1.00") # 100% refund
            elif hours_diff >= 24:
                refund_pct = Decimal("0.50") # 50% refund
            else:
                refund_pct = Decimal("0.00") # No refund

        # 3. Calculate refund amount
        original_price = Decimal(str(booking.total_amount))
        refund_amount = original_price * refund_pct
        penalty_fee = original_price - refund_amount

        # 4. Perform Wallet Credit
        WalletService.refund_to_wallet(db, user_id, refund_amount, booking_ref)

        # 5. Update Status
        booking.status = BookingStatus.REFUNDED if refund_pct > 0 else BookingStatus.CANCELLED
        
        # 6. Audit Logging
        audit = AuditLog(
            actor="system_cancellation_agent",
            action="booking_cancelled",
            entity=booking_ref,
            before_json={"status": "confirmed", "price": float(original_price)},
            after_json={
                "status": booking.status.value,
                "refund_amount": float(refund_amount),
                "penalty_fee": float(penalty_fee)
            }
        )
        db.add(audit)
        db.commit()

        # Send alert down to notification triggers
        return {
            "success": True,
            "booking_reference": booking_ref,
            "original_amount": float(original_price),
            "refund_amount": float(refund_amount),
            "penalty_fee": float(penalty_fee),
            "status": booking.status.value
        }
