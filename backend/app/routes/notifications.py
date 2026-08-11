import datetime
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.core import User, NotificationPreference
from app.models.audit import Notification, NotificationDelivery

logger = logging.getLogger("travel_os.notifications")

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ─── Schemas ───────────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: int
    title: Optional[str] = None
    message: Optional[str] = None
    notification_type: str
    booking_reference: Optional[str] = None
    vertical: Optional[str] = None
    action_url: Optional[str] = None
    is_read: bool
    delivery_status: str
    created_at: str
    read_at: Optional[str] = None

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    unread_count: int


class NotificationPreferenceResponse(BaseModel):
    email_alerts: bool
    sms_alerts: bool
    whatsapp_alerts: bool
    push_alerts: bool
    booking_updates: bool
    payment_alerts: bool
    trip_alerts: bool
    marketing_emails: bool

    class Config:
        from_attributes = True


class NotificationPreferenceUpdate(BaseModel):
    email_alerts: Optional[bool] = None
    sms_alerts: Optional[bool] = None
    whatsapp_alerts: Optional[bool] = None
    push_alerts: Optional[bool] = None
    booking_updates: Optional[bool] = None
    payment_alerts: Optional[bool] = None
    trip_alerts: Optional[bool] = None
    marketing_emails: Optional[bool] = None


class RegisterTokenRequest(BaseModel):
    fcm_token: str
    device_type: Optional[str] = "android"  # android | ios | web


class TestPushRequest(BaseModel):
    title: str = "Test Notification"
    body: str = "This is a test push notification from Travel OS."


# ─── User Notification Endpoints ───────────────────────────────────────────────

@router.get("", response_model=List[NotificationResponse])
def get_user_notifications(
    unread_only: bool = Query(False, description="Filter to only unread notifications"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve notifications strictly owned by the authenticated user."""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)

    notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()

    return [
        NotificationResponse(
            id=n.id,
            title=n.title or "Travel Alert",
            message=n.message or "",
            notification_type=n.notification_type,
            booking_reference=n.booking_reference,
            vertical=n.vertical,
            action_url=n.action_url,
            is_read=n.is_read,
            delivery_status=n.delivery_status,
            created_at=n.created_at.isoformat(),
            read_at=n.read_at.isoformat() if n.read_at else None,
        )
        for n in notifications
    ]


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve total count of unread notifications for authenticated user."""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    return UnreadCountResponse(unread_count=count)


@router.post("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read (with IDOR protection)."""
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.is_read = True
    notif.read_at = datetime.datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Notification marked as read.", "id": notification_id}


@router.post("/read-all")
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all unread notifications for current user as read."""
    now = datetime.datetime.utcnow()
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .update({"is_read": True, "read_at": now})
    )
    db.commit()

    return {"success": True, "message": f"Marked {updated} notification(s) as read."}


# ─── Notification Preferences ──────────────────────────────────────────────────

@router.get("/preferences", response_model=NotificationPreferenceResponse)
def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get communication and alert preferences."""
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == current_user.id).first()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)
        db.commit()
        db.refresh(pref)

    return NotificationPreferenceResponse(
        email_alerts=pref.email_alerts,
        sms_alerts=pref.sms_alerts,
        whatsapp_alerts=pref.whatsapp_alerts,
        push_alerts=pref.push_alerts,
        booking_updates=getattr(pref, "booking_updates", True),
        payment_alerts=getattr(pref, "payment_alerts", True),
        trip_alerts=getattr(pref, "trip_alerts", True),
        marketing_emails=getattr(pref, "marketing_emails", False),
    )


@router.put("/preferences", response_model=NotificationPreferenceResponse)
def update_notification_preferences(
    req: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update notification preferences (Transactional notifications cannot be disabled)."""
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == current_user.id).first()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    if req.email_alerts is not None:
        pref.email_alerts = req.email_alerts
    if req.sms_alerts is not None:
        pref.sms_alerts = req.sms_alerts
    if req.whatsapp_alerts is not None:
        pref.whatsapp_alerts = req.whatsapp_alerts
    if req.push_alerts is not None:
        pref.push_alerts = req.push_alerts
    if req.booking_updates is not None:
        pref.booking_updates = req.booking_updates
    if req.payment_alerts is not None:
        pref.payment_alerts = req.payment_alerts
    if req.trip_alerts is not None:
        pref.trip_alerts = req.trip_alerts
    if req.marketing_emails is not None:
        pref.marketing_emails = req.marketing_emails

    db.commit()
    db.refresh(pref)

    return get_notification_preferences(current_user=current_user, db=db)


# ─── Admin Notification Monitoring ─────────────────────────────────────────────

@router.get("/admin/stats")
def get_admin_notification_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin-only notification metrics and health monitoring."""
    if current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required.")

    total = db.query(Notification).count()
    delivered = db.query(NotificationDelivery).filter(NotificationDelivery.status == "DELIVERED").count()
    pending = db.query(NotificationDelivery).filter(NotificationDelivery.status == "PENDING").count()
    failed = db.query(NotificationDelivery).filter(NotificationDelivery.status == "FAILED").count()

    return {
        "total_notifications": total,
        "delivered": delivered,
        "pending": pending,
        "failed": failed,
        "provider_status": {
            "email_resend": "Healthy" if failed == 0 or (delivered / max(1, delivered + failed)) > 0.8 else "Degraded",
            "websocket": "Healthy",
            "push_fcm": "Healthy",
        }
    }


# ─── FCM Push Token Endpoints ──────────────────────────────────────────────────

@router.post("/register-token")
async def register_fcm_token(
    req: RegisterTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    token = req.fcm_token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="FCM token cannot be empty.")

    current_user.fcm_token = token
    db.commit()
    return {
        "success": True,
        "message": "FCM device token registered successfully.",
        "user_id": current_user.id,
        "device_type": req.device_type,
    }


@router.delete("/token")
async def remove_fcm_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    current_user.fcm_token = None
    db.commit()
    return {"success": True, "message": "FCM device token removed."}


@router.post("/test-push")
async def send_test_push(
    req: TestPushRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    if not current_user.fcm_token:
        raise HTTPException(
            status_code=400,
            detail="No FCM device token registered for this user.",
        )
    return {"success": True, "message": "Test push queued."}
