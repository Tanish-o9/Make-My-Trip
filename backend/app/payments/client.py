import razorpay
import logging
from app.payments.config import settings

logger = logging.getLogger(__name__)

# Initialize Razorpay client singleton.
# razorpay.Client stores the credentials and handles the request session.
razorpay_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

def check_razorpay_health() -> dict:
    """
    Checks connection to Razorpay API by querying the /orders endpoint.
    This serves as a credentials check.
    
    Returns:
        dict: Status details of the health check, including mode (test/live)
              and success indicator.
    """
    is_test_mode = settings.RAZORPAY_KEY_ID.startswith("rzp_test_")
    
    try:
        # We query for a single order to verify credentials without fetching a large payload.
        # This calls the GET /orders endpoint.
        orders = razorpay_client.order.all({"count": 1})
        
        return {
            "status": "healthy",
            "success": True,
            "message": "Successfully connected to Razorpay API and verified credentials.",
            "mode": "test" if is_test_mode else "live",
            "count": len(orders.get("items", [])) if isinstance(orders, dict) else 0
        }
    except Exception as e:
        logger.error(f"Razorpay health check failed: {e}")
        return {
            "status": "unhealthy",
            "success": False,
            "message": f"Razorpay connection/credential check failed: {str(e)}",
            "mode": "test" if is_test_mode else "live"
        }
