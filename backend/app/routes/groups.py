import datetime
import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import (
    User, Trip, TripMember, TripInvitation, 
    TripActivity, TripTask, TripPoll, TripPollOption, 
    TripPollVote, TripMessage, TripActivityLog
)
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/trips", tags=["groups"])

class InviteRequest(BaseModel):
    email: Optional[str] = None

class JoinActionRequest(BaseModel):
    token: str

@router.get("/{trip_id}/members")
def list_trip_members(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all members and their roles for a specific trip group"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")

    # Isolation check: requesting user must be OWNER or MEMBER
    is_owner = (trip.user_id == current_user.id)
    is_member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id
    ).first() is not None

    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Access denied: You are not a member of this trip.")

    members = db.query(TripMember).filter(TripMember.trip_id == trip_id).all()
    res = []
    for m in members:
        # Fetch user details
        u = db.query(User).filter(User.id == m.user_id).first()
        res.append({
            "user_id": m.user_id,
            "username": u.email.split("@")[0] if u else "Unknown",
            "email": u.email if u else "Unknown",
            "role": m.role,
            "joined_at": m.joined_at.isoformat()
        })
    return res

@router.post("/{trip_id}/invite")
def create_trip_invite(
    trip_id: int,
    payload: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generates a secure UUID token for group trip invitations. Restricted to OWNER."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")

    # Only owner can invite
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: Only the trip owner can invite members.")

    token = str(uuid.uuid4())
    expires = datetime.datetime.utcnow() + datetime.timedelta(days=7)

    invitation = TripInvitation(
        trip_id=trip_id,
        token=token,
        email=payload.email,
        invited_by=current_user.id,
        status="PENDING",
        expires_at=expires
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    return {
        "token": token,
        "invite_url": f"/join/{token}",
        "expires_at": expires.isoformat()
    }

@router.get("/invite/{token}")
def get_invite_details(
    token: str,
    db: Session = Depends(get_db)
):
    """Retrieves metadata of a trip invitation by its secure token"""
    inv = db.query(TripInvitation).filter(TripInvitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation token not found or invalid.")

    if inv.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Invitation has already been {inv.status.lower()}.")

    if inv.expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invitation token has expired.")

    trip = db.query(Trip).filter(Trip.id == inv.trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip associated with this invitation not found.")

    owner = db.query(User).filter(User.id == trip.user_id).first()

    return {
        "trip_id": trip.id,
        "trip_name": trip.name,
        "destination": trip.destination,
        "owner_name": owner.email.split("@")[0] if owner else "Unknown",
        "expires_at": inv.expires_at.isoformat()
    }

@router.post("/join/accept")
def accept_trip_invite(
    payload: JoinActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accepts a trip invitation and adds the current user as a MEMBER"""
    inv = db.query(TripInvitation).filter(TripInvitation.token == payload.token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation token not found or invalid.")

    if inv.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Invitation has already been {inv.status.lower()}.")

    if inv.expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invitation token has expired.")

    # Check if user is already a member
    exists = db.query(TripMember).filter(
        TripMember.trip_id == inv.trip_id,
        TripMember.user_id == current_user.id
    ).first()
    if exists:
        inv.status = "ACCEPTED"
        db.commit()
        return {"message": "You are already a member of this trip.", "trip_id": inv.trip_id}

    # Add as member
    member = TripMember(
        trip_id=inv.trip_id,
        user_id=current_user.id,
        role="MEMBER"
    )
    inv.status = "ACCEPTED"
    db.add(member)
    db.commit()

    return {"message": "Successfully joined the group trip.", "trip_id": inv.trip_id}

@router.post("/join/reject")
def reject_trip_invite(
    payload: JoinActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rejects a trip invitation"""
    inv = db.query(TripInvitation).filter(TripInvitation.token == payload.token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation token not found or invalid.")

    if inv.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Invitation has already been {inv.status.lower()}.")

    inv.status = "REJECTED"
    db.commit()
    return {"message": "Invitation rejected successfully."}

@router.delete("/{trip_id}/members/{user_id}")
def remove_trip_member(
    trip_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Removes a member from the group. Restricted to OWNER."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")

    # Only OWNER can manage members
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: Only the trip owner can remove members.")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="The owner cannot be removed from the trip.")

    member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == user_id
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="User is not a member of this trip.")

    if not member:
        raise HTTPException(status_code=404, detail="User is not a member of this trip.")

    db.delete(member)
    db.commit()

    return {"message": "Member removed successfully."}


# ─── EXTRA TRIP CRUD & COLLABORATION ENDPOINTS ──────────────────────────────────

class TripCreate(BaseModel):
    name: str
    destination: Optional[str] = None
    start_date: Optional[str] = None # YYYY-MM-DD
    end_date: Optional[str] = None # YYYY-MM-DD
    booking_references: Optional[List[str]] = []
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    budget: Optional[float] = 0.0
    trip_type: Optional[str] = "Friends"

class TripUpdate(BaseModel):
    name: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_archived: Optional[bool] = None
    booking_references: Optional[List[str]] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    budget: Optional[float] = None
    trip_type: Optional[str] = None
    status: Optional[str] = None

class ActivityCreate(BaseModel):
    title: str
    date: str # YYYY-MM-DD
    start_time: str # "10:00 AM"
    end_time: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    estimated_cost: Optional[float] = 0.0
    category: Optional[str] = "Other"
    assigned_member_id: Optional[int] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[str] = None
    priority: Optional[str] = "MEDIUM"
    status: Optional[str] = "TODO"

class PollCreate(BaseModel):
    question: str
    options: List[str]

class PollVotePayload(BaseModel):
    option_id: int

class MessageCreate(BaseModel):
    message: str

class AssociateBookingPayload(BaseModel):
    booking_reference: str


@router.get("")
def list_trips(
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists trips where user is owner or member, including budget and custom fields"""
    from sqlalchemy import or_
    member_trip_ids = [m.trip_id for m in db.query(TripMember).filter(TripMember.user_id == current_user.id).all()]
    query = db.query(Trip).filter(or_(Trip.user_id == current_user.id, Trip.id.in_(member_trip_ids)))
    if not include_archived:
        query = query.filter(Trip.is_archived == False)
    
    trips = query.order_by(Trip.start_date.desc()).all()
    res = []
    for t in trips:
        member_count = db.query(TripMember).filter(TripMember.trip_id == t.id).count()
        res.append({
            "id": t.id,
            "name": t.name,
            "destination": t.destination,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "is_archived": t.is_archived,
            "booking_references": t.booking_references or [],
            "bookings_count": len(t.booking_references or []),
            "budget": float(t.budget or 0.0),
            "description": t.description,
            "cover_image_url": t.cover_image_url,
            "trip_type": t.trip_type or "Friends",
            "status": t.status or "Planning",
            "member_count": member_count,
            "created_at": t.created_at.isoformat()
        })
    return res


@router.post("")
def create_trip(
    payload: TripCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    s_date = datetime.date.fromisoformat(payload.start_date) if payload.start_date else None
    e_date = datetime.date.fromisoformat(payload.end_date) if payload.end_date else None
    
    new_trip = Trip(
        user_id=current_user.id,
        name=payload.name,
        destination=payload.destination,
        start_date=s_date,
        end_date=e_date,
        booking_references=payload.booking_references or [],
        budget=payload.budget or 0.0,
        description=payload.description,
        cover_image_url=payload.cover_image_url,
        trip_type=payload.trip_type or "Friends",
        status="Planning",
        is_archived=False
    )
    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)
    
    # Add creator as OWNER in trip_members
    member = TripMember(
        trip_id=new_trip.id,
        user_id=current_user.id,
        role="OWNER"
    )
    db.add(member)
    db.commit()
    
    # Log activity
    log = TripActivityLog(
        trip_id=new_trip.id,
        actor_id=current_user.id,
        action="created the trip workspace"
    )
    db.add(log)
    db.commit()

    return {
        "id": new_trip.id,
        "name": new_trip.name,
        "destination": new_trip.destination
    }


@router.patch("/{trip_id}")
def update_group_trip(
    trip_id: int,
    payload: TripUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    # Check permissions: OWNER or ADMIN role
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem or mem.role not in ["OWNER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied: Only trip owners or admins can modify this trip.")
        
    if payload.name is not None:
        trip.name = payload.name
    if payload.destination is not None:
        trip.destination = payload.destination
    if payload.start_date is not None:
        trip.start_date = datetime.date.fromisoformat(payload.start_date) if payload.start_date else None
    if payload.end_date is not None:
        trip.end_date = datetime.date.fromisoformat(payload.end_date) if payload.end_date else None
    if payload.is_archived is not None:
        trip.is_archived = payload.is_archived
    if payload.booking_references is not None:
        trip.booking_references = payload.booking_references
    if payload.description is not None:
        trip.description = payload.description
    if payload.cover_image_url is not None:
        trip.cover_image_url = payload.cover_image_url
    if payload.budget is not None:
        trip.budget = payload.budget
    if payload.trip_type is not None:
        trip.trip_type = payload.trip_type
    if payload.status is not None:
        trip.status = payload.status
        
    db.commit()
    db.refresh(trip)
    
    # Log activity
    log = TripActivityLog(
        trip_id=trip_id,
        actor_id=current_user.id,
        action="updated the trip details"
    )
    db.add(log)
    db.commit()
    
    return {"message": "Trip updated successfully."}


@router.delete("/{trip_id}")
def delete_group_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    # Only owner can delete
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem or mem.role != "OWNER":
        raise HTTPException(status_code=403, detail="Access denied: Only the trip owner can delete this trip.")
        
    db.delete(trip)
    db.commit()
    return {"success": True, "message": "Trip deleted."}


@router.get("/{trip_id}/itinerary")
def get_trip_itinerary(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    activities = db.query(TripActivity).filter(TripActivity.trip_id == trip_id).order_by(TripActivity.date, TripActivity.start_time).all()
    res = []
    for a in activities:
        assigned_user = db.query(User).filter(User.id == a.assigned_member_id).first()
        res.append({
            "id": a.id,
            "title": a.title,
            "date": a.date.isoformat(),
            "start_time": a.start_time,
            "end_time": a.end_time,
            "location": a.location,
            "description": a.description,
            "estimated_cost": float(a.estimated_cost),
            "category": a.category,
            "assigned_member_id": a.assigned_member_id,
            "assigned_member_name": assigned_user.email.split("@")[0] if assigned_user else None
        })
    return res


@router.post("/{trip_id}/itinerary")
def add_itinerary_activity(
    trip_id: int,
    payload: ActivityCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem or mem.role not in ["OWNER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied: Only trip owners or admins can add itinerary activities.")
        
    try:
        act_date = datetime.datetime.strptime(payload.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        
    activity = TripActivity(
        trip_id=trip_id,
        title=payload.title,
        date=act_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        location=payload.location,
        description=payload.description,
        estimated_cost=payload.estimated_cost or 0.0,
        category=payload.category or "Other",
        assigned_member_id=payload.assigned_member_id
    )
    db.add(activity)
    
    # Log activity
    log = TripActivityLog(
        trip_id=trip_id,
        actor_id=current_user.id,
        action=f"added itinerary item: \"{payload.title}\""
    )
    db.add(log)
    db.commit()
    return {"message": "Activity added successfully.", "id": activity.id}


@router.patch("/{trip_id}/itinerary/{item_id}")
def update_itinerary_activity(
    trip_id: int,
    item_id: int,
    payload: ActivityCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem or mem.role not in ["OWNER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied: Only trip owners or admins can edit itinerary activities.")
        
    activity = db.query(TripActivity).filter(TripActivity.id == item_id, TripActivity.trip_id == trip_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found.")
        
    if payload.title is not None:
        activity.title = payload.title
    if payload.date is not None:
        try:
            activity.date = datetime.datetime.strptime(payload.date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if payload.start_time is not None:
        activity.start_time = payload.start_time
    if payload.end_time is not None:
        activity.end_time = payload.end_time
    if payload.location is not None:
        activity.location = payload.location
    if payload.description is not None:
        activity.description = payload.description
    if payload.estimated_cost is not None:
        activity.estimated_cost = payload.estimated_cost
    if payload.category is not None:
        activity.category = payload.category
    if payload.assigned_member_id is not None:
        activity.assigned_member_id = payload.assigned_member_id
        
    # Log activity
    log = TripActivityLog(
        trip_id=trip_id,
        actor_id=current_user.id,
        action=f"updated itinerary item: \"{activity.title}\""
    )
    db.add(log)
    db.commit()
    return {"message": "Activity updated successfully."}


@router.delete("/{trip_id}/itinerary/{item_id}")
def delete_itinerary_activity(
    trip_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem or mem.role not in ["OWNER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied: Only trip owners or admins can delete itinerary activities.")
        
    activity = db.query(TripActivity).filter(TripActivity.id == item_id, TripActivity.trip_id == trip_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found.")
        
    db.delete(activity)
    
    # Log activity
    log = TripActivityLog(
        trip_id=trip_id,
        actor_id=current_user.id,
        action=f"deleted itinerary item: \"{activity.title}\""
    )
    db.add(log)
    db.commit()
    return {"message": "Activity deleted successfully."}


@router.get("/{trip_id}/tasks")
def get_trip_tasks(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    tasks = db.query(TripTask).filter(TripTask.trip_id == trip_id).all()
    res = []
    for t in tasks:
        assignee_user = db.query(User).filter(User.id == t.assignee_id).first()
        res.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "assignee_id": t.assignee_id,
            "assignee_name": assignee_user.email.split("@")[0] if assignee_user else None,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "priority": t.priority,
            "status": t.status
        })
    return res


@router.post("/{trip_id}/tasks")
def create_trip_task(
    trip_id: int,
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    d_date = datetime.datetime.strptime(payload.due_date, "%Y-%m-%d").date() if payload.due_date else None
    task = TripTask(
        trip_id=trip_id,
        title=payload.title,
        description=payload.description,
        assignee_id=payload.assignee_id,
        due_date=d_date,
        priority=payload.priority or "MEDIUM",
        status=payload.status or "TODO"
    )
    db.add(task)
    
    # Log activity
    log = TripActivityLog(
        trip_id=trip_id,
        actor_id=current_user.id,
        action=f"created task: \"{payload.title}\""
    )
    db.add(log)
    db.commit()
    return {"message": "Task created successfully.", "id": task.id}


@router.patch("/{trip_id}/tasks/{task_id}")
def update_trip_task(
    trip_id: int,
    task_id: int,
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    task = db.query(TripTask).filter(TripTask.id == task_id, TripTask.trip_id == trip_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
        
    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.assignee_id is not None:
        task.assignee_id = payload.assignee_id
    if payload.due_date is not None:
        task.due_date = datetime.datetime.strptime(payload.due_date, "%Y-%m-%d").date() if payload.due_date else None
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.status is not None:
        task.status = payload.status
        
    # Log activity
    log = TripActivityLog(
        trip_id=trip_id,
        actor_id=current_user.id,
        action=f"updated status of task \"{task.title}\" to {task.status}"
    )
    db.add(log)
    db.commit()
    return {"message": "Task updated successfully."}


@router.delete("/{trip_id}/tasks/{task_id}")
def delete_trip_task(
    trip_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem or mem.role not in ["OWNER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied: Only trip owners or admins can delete tasks.")
        
    task = db.query(TripTask).filter(TripTask.id == task_id, TripTask.trip_id == trip_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
        
    db.delete(task)
    
    # Log activity
    log = TripActivityLog(
        trip_id=trip_id,
        actor_id=current_user.id,
        action=f"deleted task: \"{task.title}\""
    )
    db.add(log)
    db.commit()
    return {"message": "Task deleted successfully."}


@router.get("/{trip_id}/polls")
def get_trip_polls(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    polls = db.query(TripPoll).filter(TripPoll.trip_id == trip_id).order_by(TripPoll.created_at.desc()).all()
    res = []
    for p in polls:
        creator = db.query(User).filter(User.id == p.created_by).first()
        opts = db.query(TripPollOption).filter(TripPollOption.poll_id == p.id).all()
        opts_list = []
        user_voted_option_id = None
        for o in opts:
            vote_count = db.query(TripPollVote).filter(TripPollVote.poll_id == p.id, TripPollVote.option_id == o.id).count()
            opts_list.append({
                "id": o.id,
                "option_text": o.option_text,
                "votes": vote_count
            })
            
            # Check if current user voted for this option
            user_vote = db.query(TripPollVote).filter(
                TripPollVote.poll_id == p.id,
                TripPollVote.option_id == o.id,
                TripPollVote.user_id == current_user.id
            ).first()
            if user_vote:
                user_voted_option_id = o.id
                
        res.append({
            "id": p.id,
            "question": p.question,
            "created_by": p.created_by,
            "creator_name": creator.email.split("@")[0] if creator else "Unknown",
            "is_closed": p.is_closed,
            "options": opts_list,
            "user_voted_option_id": user_voted_option_id,
            "created_at": p.created_at.isoformat()
        })
    return res


@router.post("/{trip_id}/polls")
def create_trip_poll(
    trip_id: int,
    payload: PollCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem or mem.role not in ["OWNER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied: Only trip owners or admins can create polls.")
        
    poll = TripPoll(
        trip_id=trip_id,
        question=payload.question,
        created_by=current_user.id,
        is_closed=False
    )
    db.add(poll)
    db.commit()
    db.refresh(poll)
    
    for opt_text in payload.options:
        opt = TripPollOption(
            poll_id=poll.id,
            option_text=opt_text
        )
        db.add(opt)
    db.commit()
    
    # Log activity
    log = TripActivityLog(
        trip_id=trip_id,
        actor_id=current_user.id,
        action=f"created poll: \"{payload.question}\""
    )
    db.add(log)
    db.commit()
    return {"message": "Poll created successfully.", "id": poll.id}


@router.post("/{trip_id}/polls/{poll_id}/vote")
def vote_trip_poll(
    trip_id: int,
    poll_id: int,
    payload: PollVotePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    poll = db.query(TripPoll).filter(TripPoll.id == poll_id, TripPoll.trip_id == trip_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found.")
        
    if poll.is_closed:
        raise HTTPException(status_code=400, detail="This poll is closed.")
        
    # Check duplicate voting - if already voted, update the vote, otherwise create new
    existing_vote = db.query(TripPollVote).filter(
        TripPollVote.poll_id == poll_id,
        TripPollVote.user_id == current_user.id
    ).first()
    
    if existing_vote:
        existing_vote.option_id = payload.option_id
    else:
        new_vote = TripPollVote(
            poll_id=poll_id,
            option_id=payload.option_id,
            user_id=current_user.id
        )
        db.add(new_vote)
        
    db.commit()
    return {"message": "Vote registered successfully."}


@router.delete("/{trip_id}/polls/{poll_id}")
def delete_trip_poll(
    trip_id: int,
    poll_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem or mem.role not in ["OWNER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied: Only trip owners or admins can delete polls.")
        
    poll = db.query(TripPoll).filter(TripPoll.id == poll_id, TripPoll.trip_id == trip_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found.")
        
    db.delete(poll)
    db.commit()
    return {"message": "Poll deleted successfully."}


@router.get("/{trip_id}/messages")
def get_trip_messages(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    messages = db.query(TripMessage).filter(TripMessage.trip_id == trip_id).order_by(TripMessage.timestamp.asc()).all()
    res = []
    for m in messages:
        sender = db.query(User).filter(User.id == m.sender_id).first()
        res.append({
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_name": sender.email.split("@")[0] if sender else "Unknown",
            "message": m.message,
            "timestamp": m.timestamp.isoformat()
        })
    return res


@router.post("/{trip_id}/messages")
def send_trip_message(
    trip_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    msg = TripMessage(
        trip_id=trip_id,
        sender_id=current_user.id,
        message=payload.message
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.email.split("@")[0],
        "message": msg.message,
        "timestamp": msg.timestamp.isoformat()
    }


@router.get("/{trip_id}/activity")
def get_trip_activity_logs(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    logs = db.query(TripActivityLog).filter(TripActivityLog.trip_id == trip_id).order_by(TripActivityLog.timestamp.desc()).all()
    res = []
    for l in logs:
        actor = db.query(User).filter(User.id == l.actor_id).first()
        res.append({
            "id": l.id,
            "actor_name": actor.email.split("@")[0] if actor else "Unknown",
            "action": l.action,
            "timestamp": l.timestamp.isoformat()
        })
    return res


@router.post("/{trip_id}/associate-booking")
def associate_booking_to_trip(
    trip_id: int,
    payload: AssociateBookingPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    mem = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first()
    if not mem or mem.role not in ["OWNER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Access denied: Only trip owners or admins can link bookings.")
        
    refs = list(trip.booking_references or [])
    if payload.booking_reference not in refs:
        refs.append(payload.booking_reference)
        trip.booking_references = refs
        db.commit()
        
        # Log activity
        log = TripActivityLog(
            trip_id=trip_id,
            actor_id=current_user.id,
            action=f"linked booking reference: {payload.booking_reference}"
        )
        db.add(log)
        db.commit()
        
    return {"message": "Booking associated successfully.", "booking_references": refs}


# Re-route timeline and documents calls from dashboard.py directly
from app.routes.dashboard import get_trip_timeline as db_get_timeline, get_trip_documents as db_get_docs, download_all_trip_documents as db_download_all

@router.get("/{trip_id}/timeline")
def get_trip_timeline_redirect(trip_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db_get_timeline(trip_id, current_user, db)

@router.get("/{trip_id}/documents")
def get_trip_documents_redirect(trip_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db_get_docs(trip_id, current_user, db)

@router.get("/{trip_id}/documents/download-all")
def get_trip_documents_zip_redirect(trip_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db_download_all(trip_id, current_user, db)
