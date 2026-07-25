import logging
from typing import Dict, Any
from app.ai_agents.state import AgentState, log_agent_execution
from app.models.audit import AuditLog
from app.database import SessionLocal

logger = logging.getLogger(__name__)

class FraudDetectionService:
    @staticmethod
    def evaluate_transaction(
        user_id: int,
        ip_country: str,
        card_country: str,
        recent_bookings_count: int
    ) -> Dict[str, Any]:
        """
        Evaluates risk signals and returns a verdict: approved, review, blocked.
        """
        score = 0.0
        reasons = []

        # Signal 1: Geography Mismatch
        if ip_country.upper() != card_country.upper():
            score += 0.45
            reasons.append("Billing card country mismatch with IP geolocation.")

        # Signal 2: Velocity Check
        if recent_bookings_count >= 3:
            score += 0.40
            reasons.append("High booking rate: multiple checkouts in a short duration.")

        # Signals evaluation
        if score >= 0.80:
            verdict = "blocked"
        elif score >= 0.40:
            verdict = "review"
        else:
            verdict = "approved"

        return {
            "risk_score": round(score, 2),
            "verdict": verdict,
            "reasons": reasons
        }


@log_agent_execution("fraud_detection_agent")
def fraud_detection_node(state: AgentState) -> dict:
    """Evaluates checkout signals and records the transaction safety audit trail"""
    context = state.get("trip_context", {})
    user_id = state.get("user_id", 1)

    ip_country = context.get("ip_country", "IN")
    card_country = context.get("card_country", "US")  # Dummy mismatch trigger
    recent_bookings = context.get("recent_bookings_count", 1)

    result = FraudDetectionService.evaluate_transaction(
        user_id=user_id,
        ip_country=ip_country,
        card_country=card_country,
        recent_bookings_count=recent_bookings
    )

    verdict = result["verdict"]
    score = result["risk_score"]
    reasons_str = "; ".join(result["reasons"])

    # Log to Audit Database
    db = SessionLocal()
    try:
        audit = AuditLog(
            actor=f"system_fraud_agent",
            action=f"fraud_check_verdict",
            entity=f"user_{user_id}",
            before_json={"status": "pending_checkout"},
            after_json={"verdict": verdict, "risk_score": score, "reasons": reasons_str}
        )
        db.add(audit)
        db.commit()
    except Exception as ex:
        logger.error(f"Failed to save fraud audit log: {ex}")
    finally:
        db.close()

    result_text = f"Checkout security clearance: **{verdict.upper()}** (Score: {score}). {reasons_str}"
    return {
        "final_response": result_text,
        "trip_context": dict(context, security_clearance=verdict, risk_score=score),
        "messages": [{"role": "assistant", "content": result_text}]
    }
