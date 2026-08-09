import logging
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from app.database import get_db
from app.models.saas import BetaFeedback
from app.auth.dependencies import get_current_user
from app.models.core import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["feedback"])

class FeedbackSubmitRequest(BaseModel):
    feedback_type: str # bug, feature, general
    message: str
    screenshot_url: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: int
    user_id: int
    feedback_type: str
    message: str
    screenshot_url: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

@router.post("/submit")
def submit_feedback(
    req: FeedbackSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submits beta feedback bug reports or feature requests."""
    if req.feedback_type not in ["bug", "feature", "general"]:
        raise HTTPException(status_code=400, detail="Invalid feedback type. Must be 'bug', 'feature', or 'general'.")
        
    feedback = BetaFeedback(
        user_id=current_user.id,
        feedback_type=req.feedback_type,
        message=req.message,
        screenshot_url=req.screenshot_url
    )
    
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    
    logger.info(f"Feedback submitted successfully by user: {current_user.email} (Type: {req.feedback_type})")
    return {
        "success": True,
        "message": "Feedback submitted successfully. Thank you for helping improve Travel OS!",
        "feedback_id": feedback.id
    }

@router.get("/list", response_model=List[FeedbackResponse])
def list_feedback(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists submitted feedbacks (restricted to admins)."""
    # BUG-008 FIX: Check role only \u2014 email domain check was a security bypass vector
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Administrators only.")
        
    feedbacks = db.query(BetaFeedback).order_by(BetaFeedback.created_at.desc()).all()
    return feedbacks
