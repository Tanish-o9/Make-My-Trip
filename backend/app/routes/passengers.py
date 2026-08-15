import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, EmailStr
from datetime import date

from app.database import get_db
from app.models.core import User, SavedPassenger
from app.auth.dependencies import get_current_user
from app.utils.encryption import encrypt_id_number, decrypt_id_number, mask_id_number

router = APIRouter(prefix="/passengers", tags=["passengers"])

# --- Schema Definitions ---

class SavedPassengerBase(BaseModel):
    full_name: str = Field(..., description="Full Name of the passenger")
    date_of_birth: Optional[date] = Field(None, description="Date of Birth")
    gender: Optional[str] = Field(None, description="Gender")
    nationality: Optional[str] = Field(None, description="Nationality")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    id_type: Optional[str] = Field(None, description="ID Document Type (e.g. Passport, Aadhaar)")
    id_number: Optional[Optional[str]] = Field(None, description="Plain ID Document Number")
    label: Optional[str] = Field(None, description="Nickname / Label")

class SavedPassengerCreate(SavedPassengerBase):
    force_update: Optional[bool] = Field(False, description="Update existing record if duplicate is detected")

class SavedPassengerUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[Optional[str]] = None
    label: Optional[str] = None

class SavedPassengerResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    id_number_masked: Optional[str] = None
    label: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    last_used_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

# --- API Endpoints ---

@router.get("", response_model=List[SavedPassengerResponse])
def get_saved_passengers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all saved passengers of the authenticated user, sorted by last_used_at DESC.
    """
    passengers = db.query(SavedPassenger).filter(
        SavedPassenger.user_id == current_user.id
    ).order_by(SavedPassenger.last_used_at.desc()).all()

    # Decrypt ID number and compute masked ID number before returning
    res = []
    for p in passengers:
        dec_num = decrypt_id_number(p.id_number)
        p_res = SavedPassengerResponse(
            id=p.id,
            user_id=p.user_id,
            full_name=p.full_name,
            date_of_birth=p.date_of_birth,
            gender=p.gender,
            nationality=p.nationality,
            email=p.email,
            phone=p.phone,
            id_type=p.id_type,
            id_number=dec_num,
            id_number_masked=mask_id_number(dec_num),
            label=p.label,
            created_at=p.created_at,
            updated_at=p.updated_at,
            last_used_at=p.last_used_at
        )
        res.append(p_res)
    
    return res

@router.post("", response_model=SavedPassengerResponse)
def create_saved_passenger(
    req: SavedPassengerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save a new passenger. Protects against duplicate passenger records.
    """
    # 1. Check for duplicate passenger belonging to this user
    # Duplicates match case-insensitive full_name AND either DOB, Email, or Phone.
    existing = db.query(SavedPassenger).filter(
        SavedPassenger.user_id == current_user.id
    ).all()

    duplicate = None
    req_name_lower = req.full_name.strip().lower()
    for p in existing:
        if p.full_name.strip().lower() == req_name_lower:
            # Match DOB or non-empty Email/Phone
            dob_match = (req.date_of_birth is not None and p.date_of_birth == req.date_of_birth)
            email_match = (req.email and p.email and req.email.strip().lower() == p.email.strip().lower())
            phone_match = (req.phone and p.phone and req.phone.strip() == p.phone.strip())
            
            if dob_match or email_match or phone_match:
                duplicate = p
                break

    if duplicate:
        if not req.force_update:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Passenger already saved. Update existing passenger?"
            )
        else:
            # Force update duplicate existing passenger
            duplicate.full_name = req.full_name
            duplicate.date_of_birth = req.date_of_birth
            duplicate.gender = req.gender
            duplicate.nationality = req.nationality
            duplicate.email = req.email
            duplicate.phone = req.phone
            duplicate.id_type = req.id_type
            duplicate.id_number = encrypt_id_number(req.id_number)
            duplicate.label = req.label
            duplicate.last_used_at = datetime.datetime.utcnow()
            db.commit()
            db.refresh(duplicate)
            
            dec_num = decrypt_id_number(duplicate.id_number)
            return SavedPassengerResponse(
                id=duplicate.id,
                user_id=duplicate.user_id,
                full_name=duplicate.full_name,
                date_of_birth=duplicate.date_of_birth,
                gender=duplicate.gender,
                nationality=duplicate.nationality,
                email=duplicate.email,
                phone=duplicate.phone,
                id_type=duplicate.id_type,
                id_number=dec_num,
                id_number_masked=mask_id_number(dec_num),
                label=duplicate.label,
                created_at=duplicate.created_at,
                updated_at=duplicate.updated_at,
                last_used_at=duplicate.last_used_at
            )

    # 2. Create new saved passenger
    p = SavedPassenger(
        user_id=current_user.id,
        full_name=req.full_name,
        date_of_birth=req.date_of_birth,
        gender=req.gender,
        nationality=req.nationality,
        email=req.email,
        phone=req.phone,
        id_type=req.id_type,
        id_number=encrypt_id_number(req.id_number),
        label=req.label,
        last_used_at=datetime.datetime.utcnow()
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    dec_num = decrypt_id_number(p.id_number)
    return SavedPassengerResponse(
        id=p.id,
        user_id=p.user_id,
        full_name=p.full_name,
        date_of_birth=p.date_of_birth,
        gender=p.gender,
        nationality=p.nationality,
        email=p.email,
        phone=p.phone,
        id_type=p.id_type,
        id_number=dec_num,
        id_number_masked=mask_id_number(dec_num),
        label=p.label,
        created_at=p.created_at,
        updated_at=p.updated_at,
        last_used_at=p.last_used_at
    )

@router.patch("/{passenger_id}", response_model=SavedPassengerResponse)
def update_saved_passenger(
    passenger_id: int,
    req: SavedPassengerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update details of a saved passenger.
    """
    p = db.query(SavedPassenger).filter(
        SavedPassenger.id == passenger_id,
        SavedPassenger.user_id == current_user.id
    ).first()

    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passenger not found.")

    if req.full_name is not None:
        p.full_name = req.full_name
    if req.date_of_birth is not None:
        p.date_of_birth = req.date_of_birth
    if req.gender is not None:
        p.gender = req.gender
    if req.nationality is not None:
        p.nationality = req.nationality
    if req.email is not None:
        p.email = req.email
    if req.phone is not None:
        p.phone = req.phone
    if req.id_type is not None:
        p.id_type = req.id_type
    if req.id_number is not None:
        p.id_number = encrypt_id_number(req.id_number)
    if req.label is not None:
        p.label = req.label

    db.commit()
    db.refresh(p)

    dec_num = decrypt_id_number(p.id_number)
    return SavedPassengerResponse(
        id=p.id,
        user_id=p.user_id,
        full_name=p.full_name,
        date_of_birth=p.date_of_birth,
        gender=p.gender,
        nationality=p.nationality,
        email=p.email,
        phone=p.phone,
        id_type=p.id_type,
        id_number=dec_num,
        id_number_masked=mask_id_number(dec_num),
        label=p.label,
        created_at=p.created_at,
        updated_at=p.updated_at,
        last_used_at=p.last_used_at
    )

@router.delete("/{passenger_id}")
def delete_saved_passenger(
    passenger_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a saved passenger. Historical bookings will not be affected.
    """
    p = db.query(SavedPassenger).filter(
        SavedPassenger.id == passenger_id,
        SavedPassenger.user_id == current_user.id
    ).first()

    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passenger not found.")

    db.delete(p)
    db.commit()

    return {"success": True, "message": "Saved passenger removed successfully."}

@router.post("/{passenger_id}/use")
def mark_passenger_used(
    passenger_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update the last_used_at timestamp of a saved passenger to bubble it up to the top.
    """
    p = db.query(SavedPassenger).filter(
        SavedPassenger.id == passenger_id,
        SavedPassenger.user_id == current_user.id
    ).first()

    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passenger not found.")

    p.last_used_at = datetime.datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Passenger usage recorded."}
