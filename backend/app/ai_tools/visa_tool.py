import logging
from typing import Dict, Any
from langchain_core.tools import tool
from app.rag.retriever import rag_system

logger = logging.getLogger(__name__)

@tool
def visa_check_tool(country: str) -> Dict[str, Any]:
    """
    Checks visa rules and travel policies for a destination country.
    Args:
        country: The target destination country or region (e.g. 'Schengen', 'France', 'Japan').
    """
    try:
        # Use retriever query
        rag_res = rag_system.rag_query(
            question=f"What are the visa rules, documents required and entry policies for travelling to {country}?",
            filters={"country": country.strip().capitalize()}
        )
        return {
            "success": True,
            "country": country,
            "requirements": rag_res.get("answer", "No specific policy rules found."),
            "sources": rag_res.get("sources", [])
        }
    except Exception as e:
        logger.error(f"visa_check_tool failed: {e}")
        return {"success": False, "error": str(e)}
