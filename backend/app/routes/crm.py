"""
CRM — Customer Support Engine
POST   /api/v1/crm/tickets            Create support ticket
GET    /api/v1/crm/tickets            List own tickets (customers) or all (support+)
GET    /api/v1/crm/tickets/{id}       Get ticket details + timeline
POST   /api/v1/crm/tickets/{id}/reply Add reply / internal note
POST   /api/v1/crm/tickets/{id}/escalate  Escalate ticket
POST   /api/v1/crm/tickets/{id}/close Close ticket
GET    /api/v1/crm/tickets/{id}/ai-reply  AI suggested reply (support only)
"""
import datetime
import uuid
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum as SAEnum
from sqlalchemy.orm import Session, relationship
from pydantic import BaseModel
from app.database import get_db, Base
from app.auth.dependencies import get_current_user
from app.models.core import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crm", tags=["crm"])

# ─── ORM Models ──────────────────────────────────────────────────────────────

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_ref = Column(String(30), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    subject = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)          # flight / hotel / payment / visa / other
    priority = Column(String(20), default="normal")        # low / normal / high / critical
    status = Column(String(30), default="open")            # open / in_progress / escalated / resolved / closed
    booking_reference = Column(String(100), nullable=True)
    assigned_to = Column(String(100), nullable=True)
    is_escalated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    replies = relationship("TicketReply", back_populates="ticket", cascade="all, delete-orphan")


class TicketReply(Base):
    __tablename__ = "ticket_replies"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), index=True, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author_role = Column(String(30), default="customer")   # customer / support / system
    message = Column(Text, nullable=False)
    is_internal_note = Column(Boolean, default=False)      # Internal notes not visible to customers
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    ticket = relationship("SupportTicket", back_populates="replies")


# ─── Schemas ─────────────────────────────────────────────────────────────────

class TicketCreateRequest(BaseModel):
    subject: str
    category: str
    message: str
    booking_reference: Optional[str] = None
    priority: str = "normal"


class TicketReplyRequest(BaseModel):
    message: str
    is_internal_note: bool = False


class TicketEscalateRequest(BaseModel):
    reason: str


# ─── Helper ──────────────────────────────────────────────────────────────────

SUPPORT_ROLES = {"admin", "super_admin", "support", "operations", "finance_admin", "approver"}

def is_support_user(user: User) -> bool:
    return getattr(user, "role", "user") in SUPPORT_ROLES


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/tickets")
async def create_ticket(
    req: TicketCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket_ref = f"TKT-{uuid.uuid4().hex[:8].upper()}"
    ticket = SupportTicket(
        ticket_ref=ticket_ref,
        user_id=current_user.id,
        subject=req.subject,
        category=req.category,
        priority=req.priority,
        booking_reference=req.booking_reference,
        status="open",
    )
    db.add(ticket)
    db.flush()

    # First message as a reply
    reply = TicketReply(
        ticket_id=ticket.id,
        author_id=current_user.id,
        author_role="customer",
        message=req.message,
        is_internal_note=False,
    )
    db.add(reply)
    db.commit()
    db.refresh(ticket)

    logger.info(f"Support ticket created: {ticket_ref} by user {current_user.id}")
    return {"ticket_ref": ticket.ticket_ref, "status": ticket.status, "message": "Ticket created successfully."}


@router.get("/tickets")
async def list_tickets(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(SupportTicket)
    # Customers only see their own tickets; support sees all
    if not is_support_user(current_user):
        query = query.filter(SupportTicket.user_id == current_user.id)
    if status:
        query = query.filter(SupportTicket.status == status)
    if category:
        query = query.filter(SupportTicket.category == category)

    total = query.count()
    tickets = query.order_by(SupportTicket.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "tickets": [
            {
                "ticket_ref": t.ticket_ref,
                "subject": t.subject,
                "category": t.category,
                "priority": t.priority,
                "status": t.status,
                "is_escalated": t.is_escalated,
                "created_at": t.created_at,
            }
            for t in tickets
        ],
    }


@router.get("/tickets/{ticket_ref}")
async def get_ticket(
    ticket_ref: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_ref == ticket_ref).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    # Customers can only view their own
    if not is_support_user(current_user) and ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    show_internal = is_support_user(current_user)
    replies = [
        {
            "author_role": r.author_role,
            "message": r.message,
            "is_internal_note": r.is_internal_note,
            "created_at": r.created_at,
        }
        for r in ticket.replies
        if show_internal or not r.is_internal_note
    ]

    return {
        "ticket_ref": ticket.ticket_ref,
        "subject": ticket.subject,
        "category": ticket.category,
        "priority": ticket.priority,
        "status": ticket.status,
        "is_escalated": ticket.is_escalated,
        "booking_reference": ticket.booking_reference,
        "assigned_to": ticket.assigned_to,
        "created_at": ticket.created_at,
        "timeline": replies,
    }


@router.post("/tickets/{ticket_ref}/reply")
async def reply_to_ticket(
    ticket_ref: str,
    req: TicketReplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_ref == ticket_ref).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot reply to a closed ticket.")
    if not is_support_user(current_user) and ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")
    # Only support can post internal notes
    is_internal = req.is_internal_note and is_support_user(current_user)
    role = "support" if is_support_user(current_user) else "customer"

    reply = TicketReply(
        ticket_id=ticket.id,
        author_id=current_user.id,
        author_role=role,
        message=req.message,
        is_internal_note=is_internal,
    )
    db.add(reply)
    if ticket.status == "open" and role == "support":
        ticket.status = "in_progress"
    ticket.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"success": True, "message": "Reply added."}


@router.post("/tickets/{ticket_ref}/escalate")
async def escalate_ticket(
    ticket_ref: str,
    req: TicketEscalateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_ref == ticket_ref).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    if not is_support_user(current_user) and ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    ticket.is_escalated = True
    ticket.status = "escalated"
    ticket.priority = "critical"
    db.add(TicketReply(
        ticket_id=ticket.id,
        author_id=current_user.id,
        author_role="system",
        message=f"Ticket escalated. Reason: {req.reason}",
        is_internal_note=True,
    ))
    db.commit()
    return {"success": True, "message": "Ticket escalated to critical priority."}


@router.post("/tickets/{ticket_ref}/close")
async def close_ticket(
    ticket_ref: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_ref == ticket_ref).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    if not is_support_user(current_user) and ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    ticket.status = "closed"
    ticket.updated_at = datetime.datetime.utcnow()
    db.add(TicketReply(
        ticket_id=ticket.id,
        author_id=current_user.id,
        author_role="system",
        message="Ticket has been closed.",
        is_internal_note=False,
    ))
    db.commit()
    return {"success": True, "message": "Ticket closed."}


@router.get("/tickets/{ticket_ref}/ai-reply")
async def get_ai_suggested_reply(
    ticket_ref: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate an AI-suggested reply for a support ticket.
    Only available to support staff.
    """
    if not is_support_user(current_user):
        raise HTTPException(status_code=403, detail="AI replies are only available to support staff.")

    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_ref == ticket_ref).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    # Build context from ticket replies
    replies = ticket.replies
    conversation = "\n".join(
        f"[{r.author_role.upper()}]: {r.message}"
        for r in replies if not r.is_internal_note
    )

    # Use the existing LLM router if available, else return a template
    try:
        from app.ai_router.router import llm_router
        prompt = (
            f"You are a professional travel support agent for Ghumne Chale.\n"
            f"Ticket Subject: {ticket.subject}\n"
            f"Category: {ticket.category}\n\n"
            f"Conversation so far:\n{conversation}\n\n"
            f"Write a helpful, empathetic, and professional reply to resolve this ticket. "
            f"Be concise and action-oriented."
        )
        suggested = await llm_router.complete(prompt=prompt, task_type="support_reply")
        return {"suggested_reply": suggested, "source": "llm"}
    except Exception as e:
        logger.warning(f"LLM reply generation failed: {e}")
        templates = {
            "flight": "Thank you for contacting us regarding your flight booking. We're reviewing your case and will get back to you within 2 business hours with a resolution.",
            "hotel": "We sincerely apologize for the inconvenience with your hotel booking. Our team is actively working on your case.",
            "payment": "We understand payment issues are stressful. Our finance team is reviewing your transaction and will provide an update within 4 hours.",
            "visa": "We're currently reviewing your visa application status. Please allow 1–2 business days for our team to follow up.",
        }
        reply = templates.get(ticket.category, "Thank you for reaching out to Ghumne Chale Support. We've received your request and our team will respond within 24 hours.")
        return {"suggested_reply": reply, "source": "template"}


# ─── Admin Analytics: ticket stats ───────────────────────────────────────────

@router.get("/admin/stats")
async def get_crm_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_support_user(current_user):
        raise HTTPException(status_code=403, detail="Access denied.")

    total = db.query(SupportTicket).count()
    open_count = db.query(SupportTicket).filter(SupportTicket.status == "open").count()
    escalated = db.query(SupportTicket).filter(SupportTicket.is_escalated == True).count()
    resolved = db.query(SupportTicket).filter(SupportTicket.status.in_(["resolved", "closed"])).count()

    return {
        "total_tickets": total,
        "open": open_count,
        "escalated": escalated,
        "resolved": resolved,
        "resolution_rate_pct": round(resolved / total * 100, 1) if total > 0 else 0,
    }
