import re
import html
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Common SQL Injection patterns
SQL_INJECTION_REGEX = re.compile(
    r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)|"
    r"(['\"/]\s*(OR|AND)\s*['\"/\d=])|"
    r"(--)|(/\*)|(\*/)|(;)",
    re.IGNORECASE
)

# Common XSS payload patterns
XSS_REGEX = re.compile(
    r"(<script.*?>)|(javascript:)|(onerror\s*=)|(onload\s*=)|(eval\(.*?\))|(document\.cookie)",
    re.IGNORECASE
)


def sanitize_text(text: str) -> str:
    """
    Sanitizes string inputs to prevent XSS.
    Escapes HTML entities.
    """
    if not text:
        return text
    # Escape standard HTML tags
    cleaned = html.escape(text.strip())
    # Remove dangerous script injection words
    cleaned = re.sub(r"(?i)<script.*?>.*?</script.*?>", "", cleaned)
    return cleaned


def validate_input_safety(text: str) -> str:
    """
    Scans inputs for SQL injection and XSS patterns.
    Raises HTTPException (400) if a threat is detected.
    Otherwise returns the sanitized text.
    """
    if not text:
        return text

    # 1. Check SQL Injection patterns
    if SQL_INJECTION_REGEX.search(text):
        logger.warning(f"SECURITY ALERT: SQL Injection pattern matched in input: {text}")
        raise HTTPException(
            status_code=400,
            detail="Forbidden characters or patterns detected in request parameters."
        )

    # 2. Check XSS patterns
    if XSS_REGEX.search(text):
        logger.warning(f"SECURITY ALERT: XSS payload pattern matched in input: {text}")
        raise HTTPException(
            status_code=400,
            detail="Forbidden scripting characters detected in request parameters."
        )

    # 3. Sanitize
    return sanitize_text(text)
