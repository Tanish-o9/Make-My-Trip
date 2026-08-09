"""
Push notification and device token management routes.

Endpoints:
  POST /api/v1/notifications/register-token  — save FCM device token for the current user
  DELETE /api/v1/notifications/token          — remove FCM token on logout/uninstall
  POST /api/v1/notifications/test-push        — send a test push notification to self (dev/debug)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.core import User
from app.services.push_notifications import PushNotificationService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


class RegisterTokenRequest(BaseModel):
    fcm_token: str
    device_type: Optional[str] = "android"  # android | ios | web


class TestPushRequest(BaseModel):
    title: str = "Test Notification"
    body: str = "This is a test push notification from Travel OS."


@router.post("/register-token")
async def register_fcm_token(
    req: RegisterTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Register or update the FCM device token for the authenticated user.
    Called by the mobile/web app after FCM initialization.
    
    Example: POST /api/v1/notifications/register-token
    Body: {"fcm_token": "fxxx...", "device_type": "android"}
    """
    token = req.fcm_token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="FCM token cannot be empty.")

    try:
        current_user.fcm_token = token
        db.commit()
        logger.info(f"FCM token registered for user {current_user.id} ({req.device_type})")
        return {
            "success": True,
            "message": "FCM device token registered successfully.",
            "user_id": current_user.id,
            "device_type": req.device_type,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save FCM token for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to save device token.")


@router.delete("/token")
async def remove_fcm_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Remove the FCM device token for the current user (call on logout or uninstall).
    Example: DELETE /api/v1/notifications/token
    """
    try:
        current_user.fcm_token = None
        db.commit()
        logger.info(f"FCM token removed for user {current_user.id}")
        return {"success": True, "message": "FCM device token removed."}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to remove FCM token for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove device token.")


@router.post("/test-push")
async def send_test_push(
    req: TestPushRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Send a test push notification to the current user's registered device.
    Useful for verifying FCM setup. Requires an FCM token to be registered.
    Example: POST /api/v1/notifications/test-push
    """
    if not current_user.fcm_token:
        raise HTTPException(
            status_code=400,
            detail="No FCM device token registered. Call /notifications/register-token first.",
        )

    result = PushNotificationService._fcm().send_to_token(
        device_token=current_user.fcm_token,
        title=req.title,
        body=req.body,
        data={"type": "test", "user_id": str(current_user.id)},
    )
    return result
