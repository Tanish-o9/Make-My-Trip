import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session, object_session
from app.models.bookings import BookingStatus, BookingMixin

class BookingStateMachine:
    """Manages the state transitions of booking records"""
    
    @staticmethod
    def transition_to(booking: BookingMixin, target_status: BookingStatus) -> None:
        current = booking.status
        if current == target_status:
            return
            
        allowed = False
        if current == BookingStatus.OFFER_SELECTED:
            if target_status in [BookingStatus.HOLD, BookingStatus.EXPIRED, BookingStatus.CANCELLED]:
                allowed = True
        elif current == BookingStatus.HOLD:
            if target_status in [
                BookingStatus.CONFIRMED, 
                BookingStatus.PENDING_APPROVAL, 
                BookingStatus.PENDING_ADMIN_APPROVAL, 
                BookingStatus.CANCELLED,
                BookingStatus.PAYMENT_PENDING,
                BookingStatus.AWAITING_HUMAN_PAYMENT_APPROVAL,
                BookingStatus.PAYMENT_PROCESSING,
                BookingStatus.EXPIRED
            ]:
                allowed = True
        elif current == BookingStatus.AWAITING_HUMAN_PAYMENT_APPROVAL:
            if target_status in [BookingStatus.PAYMENT_PROCESSING, BookingStatus.HOLD, BookingStatus.EXPIRED, BookingStatus.CANCELLED, BookingStatus.CONFIRMED, BookingStatus.PAYMENT_PENDING]:
                allowed = True
        elif current == BookingStatus.PAYMENT_PROCESSING:
            if target_status in [BookingStatus.CONFIRMED, BookingStatus.PAYMENT_FAILED, BookingStatus.EXPIRED, BookingStatus.CANCELLED, BookingStatus.PAYMENT_PENDING]:
                allowed = True
        elif current == BookingStatus.EXPIRED:
            pass
        elif current == BookingStatus.PENDING_ADMIN_APPROVAL:
            if target_status in [BookingStatus.CONFIRMED, BookingStatus.REJECTED, BookingStatus.CANCELLED]:
                allowed = True
        elif current == BookingStatus.PENDING_APPROVAL:
            if target_status in [BookingStatus.CONFIRMED, BookingStatus.CANCELLED]:
                allowed = True
        elif current == BookingStatus.PENDING:
            if target_status in [BookingStatus.CONFIRMED, BookingStatus.CANCELLED]:
                allowed = True
        elif current == BookingStatus.CONFIRMED:
            if target_status in [
                BookingStatus.CANCELLED,
                BookingStatus.COMPLETED,
                BookingStatus.REFUND_INITIATED,
                BookingStatus.REFUNDED,
                BookingStatus.VEHICLE_HANDED_OVER
            ]:
                allowed = True
        elif current == BookingStatus.VEHICLE_HANDED_OVER:
            if target_status in [
                BookingStatus.TRIP_ACTIVE,
                BookingStatus.CANCELLED,
                BookingStatus.CONFIRMED
            ]:
                allowed = True
        elif current == BookingStatus.TRIP_ACTIVE:
            if target_status in [
                BookingStatus.RETURNED,
                BookingStatus.COMPLETED
            ]:
                allowed = True
        elif current == BookingStatus.RETURNED:
            if target_status in [
                BookingStatus.COMPLETED
            ]:
                allowed = True
        elif current == BookingStatus.REFUND_INITIATED:
            if target_status in [BookingStatus.REFUNDED, BookingStatus.CONFIRMED]:
                allowed = True
        elif current == BookingStatus.REFUNDED:
            # Terminal state
            pass
        elif current == BookingStatus.REJECTED:
            # Terminal state, no further transitions
            pass
        elif current == BookingStatus.PAYMENT_PENDING:
            if target_status in [
                BookingStatus.PAYMENT_CONFIRMED,
                BookingStatus.PAYMENT_FAILED,
                BookingStatus.CANCELLED,
                BookingStatus.CONFIRMED,
                BookingStatus.HOLD
            ]:
                allowed = True
        elif current == BookingStatus.PAYMENT_FAILED:
            if target_status in [
                BookingStatus.PAYMENT_PENDING,
                BookingStatus.CANCELLED,
                BookingStatus.CONFIRMED,
                BookingStatus.HOLD
            ]:
                allowed = True
        elif current == BookingStatus.PAYMENT_CONFIRMED:
            if target_status in [
                BookingStatus.CONFIRMED,
                BookingStatus.PENDING_APPROVAL,
                BookingStatus.PENDING_ADMIN_APPROVAL,
                BookingStatus.CANCELLED
            ]:
                allowed = True
        
        if not allowed:
            raise ValueError(f"State transition from {current} to {target_status} is not permitted.")
            
        if target_status == BookingStatus.CONFIRMED:
            session = object_session(booking)
            if session:
                from app.models.payments import Payment, PaymentStatus
                payment = session.query(Payment).filter(
                    Payment.booking_id == booking.booking_reference
                ).first()
                if payment and payment.status != PaymentStatus.CAPTURED:
                    raise ValueError("Cannot transition booking to CONFIRMED unless payment status is captured.")
                if current in [BookingStatus.PAYMENT_PENDING, BookingStatus.PAYMENT_CONFIRMED, BookingStatus.PAYMENT_FAILED] and not payment:
                    raise ValueError("Cannot transition booking to CONFIRMED without a payment record.")
            
        booking.status = target_status


    @staticmethod
    def compute_refund(booking: BookingMixin, departure_time: datetime.datetime, vertical: str = None) -> Dict[str, Any]:
        now = datetime.datetime.utcnow()
        hours_to_departure = (departure_time - now).total_seconds() / 3600.0 if departure_time else 9999.0
        
        total = float(booking.total_amount)
        vertical = vertical or getattr(booking, "__tablename__", "").replace("_bookings", "").replace("_applications", "").replace("_policies", "").replace("_orders", "")
        
        # Defaults
        refund_pct = 0.95
        fee = total * 0.05
        
        # Deduct exactly 5% globally for all bookings
        refund_pct = 0.95
        fee = total * 0.05
                
        # Clamps
        fee = min(fee, total)
        refund_amount = max(0.0, total - fee)
        refund_pct = refund_amount / total if total > 0 else 0.0
        
        return {
            "booking_reference": booking.booking_reference,
            "total_amount": total,
            "refund_amount": refund_amount,
            "cancellation_fee": fee,
            "refund_percentage": refund_pct * 100,
            "hours_before_departure": hours_to_departure
        }


class InvoiceGenerator:
    """Generates a text-based itemized receipt summary mimicking a PDF invoice layout"""

    @staticmethod
    def generate_invoice(booking: BookingMixin, item_details: List[Dict[str, Any]]) -> str:
        lines = [
            "==================================================",
            "                TRAVEL OS INVOICE                 ",
            "==================================================",
            f"Invoice Date : {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Reference    : {booking.booking_reference}",
            f"Customer ID  : {booking.user_id}",
            f"Status       : {booking.status.value.upper()}",
            "--------------------------------------------------",
            "ITEM DESCRIPTION                         AMOUNT   ",
            "--------------------------------------------------"
        ]
        
        for item in item_details:
            name = item.get("name", "Travel Booking Item")[:35]
            price = float(item.get("price", 0.0))
            lines.append(f"{name:<40} ₹{price:>8.2f}")
            
        lines.append("--------------------------------------------------")
        lines.append(f"TOTAL AMOUNT                             ₹{float(booking.total_amount):>8.2f}")
        lines.append("==================================================")
        lines.append("Thank you for booking with Travel OS!")
        lines.append("==================================================")
        
        return "\n".join(lines)


class CancellationPolicyEngine:
    """Calculates refunds and penalties based on cancellation timelines"""
    @staticmethod
    def compute_refund(booking, departure_time, vertical=None):
        return BookingStateMachine.compute_refund(booking, departure_time, vertical)
