import logging
from sqlalchemy.orm import Session
from app.models.bookings import PaymentAttempt
from app.utils.event_bus import emit_event

logger = logging.getLogger(__name__)

# Dunning intervals in hours for corporate subscriptions / recurring charges
DUNNING_SCHEDULE = [1, 4, 24]  # Attempt 1 after 1h, Attempt 2 after 4h, Attempt 3 after 24h

class DunningService:
    @staticmethod
    def is_retryable(error_code: str) -> bool:
        """
        Classifies errors into retryable (insufficient funds, temporary API issues)
        and non-retryable (invalid card, expired card, blocked fraud).
        """
        retryable_codes = {
            "insufficient_funds",
            "temporary_gateway_error",
            "network_timeout",
            "rate_limit_exceeded",
            "api_connection_error"
        }
        return error_code.lower() in retryable_codes

    @classmethod
    def handle_failed_payment(
        cls,
        db: Session,
        attempt: PaymentAttempt,
        error_code: str
    ) -> dict:
        """
        Handles payment failure: triggers dunning sequence for retryable failures on subscriptions,
        or alerts the user instantly.
        """
        retryable = cls.is_retryable(error_code)
        logger.info(f"Dunning: Classifying payment error '{error_code}' — Retryable: {retryable}")

        if not retryable:
            # Hard failure
            emit_event("payment_failed", {
                "user_id": attempt.user_id,
                "booking_reference": attempt.booking_reference,
                "amount": float(attempt.amount),
                "reason": "Hard decline: invalid card credentials or fraud check failure."
            })
            return {"status": "hard_failure", "retry_allowed": False}

        # If it is a myBiz/corporate billing or wallet top-up that was interrupted
        # Simulate scheduler scheduling dunning retry attempts
        attempt.status = "dunning_retrying"
        db.commit()

        # Alert user about payment failure, notifying them that we will re-attempt automatically
        emit_event("payment_failed", {
            "user_id": attempt.user_id,
            "booking_reference": attempt.booking_reference,
            "amount": float(attempt.amount),
            "reason": f"Retryable error: {error_code}. We will auto-retry shortly."
        })

        return {
            "status": "dunning_queued",
            "retry_allowed": True,
            "next_retry_in_hours": DUNNING_SCHEDULE[0]
        }
