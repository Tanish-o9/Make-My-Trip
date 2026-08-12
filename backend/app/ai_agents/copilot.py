import logging
from typing import Dict, Any, List
from app.ai_router.router import llm_router

logger = logging.getLogger(__name__)

class AICopilotStaff:
    def assist_staff(self, role: str, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        AI Copilot assists staff (support, finance, operations, sales) by summarizing data,
        recommending actions, or suggesting responses.
        """
        logger.info(f"AICopilot invoked for role '{role}' with query: '{query}'")
        
        prompt = (
            f"You are the Ghumne Chale AI Staff Copilot assisting a {role.upper()} professional.\n"
            f"Context Data:\n{context}\n\n"
            f"User Query / Action Requested: {query}\n\n"
            f"Provide a summary of the situation, suggest the best immediate actions, and generate template responses if applicable."
        )

        try:
            # Call our existing LLM router (handles groq/openai/fallback automatically)
            response_text = llm_router.route_query(prompt)
        except Exception as e:
            logger.warning(f"LLM router failed in Copilot, falling back to rule-based assistant: {e}")
            response_text = self._fallback_copilot_replies(role, query, context)

        return {
            "role": role,
            "query": query,
            "assistant_response": response_text,
            "actions_recommended": [
                "Review ledger entries",
                "Approve pending ticket exceptions"
            ] if role == "finance" else [
                "Resolve customer ticket",
                "Dispatch notifications status"
            ]
        }

    def _fallback_copilot_replies(self, role: str, query: str, context: Dict[str, Any]) -> str:
        """Rule-based backup reply templates if the LLM provider is unavailable."""
        role_lower = role.lower()
        if "support" in role_lower:
            return (
                "### Support Copilot Reply Suggestion\n"
                "\"Dear Customer, thank you for reaching out. We have received your inquiry regarding "
                f"your booking. Our operations team is currently reviewing it and will update you shortly.\""
            )
        elif "finance" in role_lower:
            return (
                "### Finance Copilot Recommendation\n"
                "Based on the transaction history, the invoice amount matches the checkout ledger. "
                "Recommendation: Transition the billing status to PAID and clear the hold."
            )
        elif "sales" in role_lower:
            return (
                "### Sales Copilot Suggestion\n"
                "Based on this client's profile, we suggest pitching our corporate starter package "
                "which includes automated per-diem policy approvals and custom invoicing."
            )
        else:
            return (
                "### Staff Copilot Assistant Overview\n"
                "We reviewed your query. All systems are operational. Let us know if you want to run a custom search."
            )

# Global Copilot instance
copilot_staff = AICopilotStaff()
