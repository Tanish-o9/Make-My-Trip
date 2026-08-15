import datetime
import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import User, Trip, TripMember, TripInvitation
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

    db.delete(member)
    db.commit()

    return {"message": "Member removed successfully."}
