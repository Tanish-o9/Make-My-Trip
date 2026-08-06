import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.core import User, UserProfile, Traveller, EmergencyContact, TravelPreference, Documents, NotificationPreference
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])

# Schema Definitions
class ProfileResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    dob: Optional[str] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    mobile_number: Optional[str] = None
    alternate_phone: Optional[str] = None
    email: Optional[str] = None
    passport_number: Optional[str] = None
    passport_expiry: Optional[str] = None
    pan_card: Optional[str] = None
    aadhaar: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    
    # Emergency Contact Embedded
    emergency_name: Optional[str] = None
    emergency_relationship: Optional[str] = None
    emergency_phone: Optional[str] = None

    class Config:
        from_attributes = True

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    dob: Optional[str] = None # format YYYY-MM-DD
    gender: Optional[str] = None
    nationality: Optional[str] = None
    mobile_number: Optional[str] = None
    alternate_phone: Optional[str] = None
    email: Optional[str] = None
    passport_number: Optional[str] = None
    passport_expiry: Optional[str] = None # format YYYY-MM-DD
    pan_card: Optional[str] = None
    aadhaar: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    
    emergency_name: Optional[str] = None
    emergency_relationship: Optional[str] = None
    emergency_phone: Optional[str] = None

class PreferencesResponse(BaseModel):
    preferred_airline: Optional[str] = None
    preferred_hotel_chain: Optional[str] = None
    preferred_cabin_class: Optional[str] = None
    meal_preference: Optional[str] = None
    seat_preference: Optional[str] = None
    travel_style: Optional[str] = None

class PreferencesUpdate(BaseModel):
    preferred_airline: Optional[str] = None
    preferred_hotel_chain: Optional[str] = None
    preferred_cabin_class: Optional[str] = None
    meal_preference: Optional[str] = None
    seat_preference: Optional[str] = None
    travel_style: Optional[str] = None

class TravellerResponse(BaseModel):
    id: int
    user_id: int
    name: str
    age: int
    gender: str
    passport: Optional[str] = None
    nationality: Optional[str] = None
    meal: Optional[str] = None
    seat: Optional[str] = None

    class Config:
        from_attributes = True

class TravellerCreate(BaseModel):
    name: str
    age: int
    gender: str
    passport: Optional[str] = None
    nationality: Optional[str] = None
    meal: Optional[str] = None
    seat: Optional[str] = None

# Helper to mask sensitive values (Phase 10)
def mask_sensitive_string(val: Optional[str], visible_chars: int = 4) -> Optional[str]:
    if not val:
        return None
    val_str = str(val).strip()
    if len(val_str) <= visible_chars:
        return "****"
    return "*" * (len(val_str) - visible_chars) + val_str[-visible_chars:]

@router.get("", response_model=ProfileResponse)
def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        # Auto-create profile using signup credentials
        profile = UserProfile(
            user_id=current_user.id,
            full_name=current_user.email.split("@")[0].capitalize(),
            email=current_user.email,
            mobile_number=current_user.phone
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    emergency = db.query(EmergencyContact).filter(EmergencyContact.user_id == current_user.id).first()
    
    # Map model to response schema
    dob_str = profile.dob.isoformat() if profile.dob else None
    expiry_str = profile.passport_expiry.isoformat() if profile.passport_expiry else None

    return ProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        full_name=profile.full_name,
        dob=dob_str,
        gender=profile.gender,
        nationality=profile.nationality,
        mobile_number=profile.mobile_number,
        alternate_phone=profile.alternate_phone,
        email=profile.email,
        passport_number=mask_sensitive_string(profile.passport_number),
        passport_expiry=expiry_str,
        pan_card=mask_sensitive_string(profile.pan_card),
        aadhaar=mask_sensitive_string(profile.aadhaar),
        country=profile.country,
        state=profile.state,
        city=profile.city,
        postal_code=profile.postal_code,
        emergency_name=emergency.name if emergency else None,
        emergency_relationship=emergency.relationship if emergency else None,
        emergency_phone=emergency.phone if emergency else None
    )

@router.put("", response_model=ProfileResponse)
def update_user_profile(
    req: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id, full_name="User")
        db.add(profile)

    # Apply updates
    if req.full_name is not None:
        profile.full_name = req.full_name
    if req.dob is not None:
        profile.dob = datetime.date.fromisoformat(req.dob) if req.dob else None
    if req.gender is not None:
        profile.gender = req.gender
    if req.nationality is not None:
        profile.nationality = req.nationality
    if req.mobile_number is not None:
        profile.mobile_number = req.mobile_number
    if req.alternate_phone is not None:
        profile.alternate_phone = req.alternate_phone
    if req.email is not None:
        profile.email = req.email
    
    # ID Details (Only overwrite if not masked placeholder and not empty)
    if req.passport_number is not None and not req.passport_number.startswith("*"):
        profile.passport_number = req.passport_number
    if req.passport_expiry is not None:
        profile.passport_expiry = datetime.date.fromisoformat(req.passport_expiry) if req.passport_expiry else None
    if req.pan_card is not None and not req.pan_card.startswith("*"):
        profile.pan_card = req.pan_card
    if req.aadhaar is not None and not req.aadhaar.startswith("*"):
        profile.aadhaar = req.aadhaar
        
    # Address
    if req.country is not None:
        profile.country = req.country
    if req.state is not None:
        profile.state = req.state
    if req.city is not None:
        profile.city = req.city
    if req.postal_code is not None:
        profile.postal_code = req.postal_code

    # Emergency Contact
    emergency = db.query(EmergencyContact).filter(EmergencyContact.user_id == current_user.id).first()
    if not emergency:
        emergency = EmergencyContact(user_id=current_user.id)
        db.add(emergency)
    
    if req.emergency_name is not None:
        emergency.name = req.emergency_name
    if req.emergency_relationship is not None:
        emergency.relationship = req.emergency_relationship
    if req.emergency_phone is not None:
        emergency.phone = req.emergency_phone

    db.commit()
    db.refresh(profile)
    
    # Reload and mask
    return get_user_profile(current_user=current_user, db=db)

@router.get("/preferences", response_model=PreferencesResponse)
def get_user_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(TravelPreference).filter(TravelPreference.user_id == current_user.id).first()
    if not pref:
        return PreferencesResponse()
    return PreferencesResponse(
        preferred_airline=pref.preferred_airline,
        preferred_hotel_chain=pref.preferred_hotel_chain,
        preferred_cabin_class=pref.preferred_cabin_class,
        meal_preference=pref.meal_preference,
        seat_preference=pref.seat_preference,
        travel_style=pref.travel_style
    )

@router.put("/preferences", response_model=PreferencesResponse)
def update_user_preferences(
    req: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(TravelPreference).filter(TravelPreference.user_id == current_user.id).first()
    if not pref:
        pref = TravelPreference(user_id=current_user.id)
        db.add(pref)
        
    if req.preferred_airline is not None:
        pref.preferred_airline = req.preferred_airline
    if req.preferred_hotel_chain is not None:
        pref.preferred_hotel_chain = req.preferred_hotel_chain
    if req.preferred_cabin_class is not None:
        pref.preferred_cabin_class = req.preferred_cabin_class
    if req.meal_preference is not None:
        pref.meal_preference = req.meal_preference
    if req.seat_preference is not None:
        pref.seat_preference = req.seat_preference
    if req.travel_style is not None:
        pref.travel_style = req.travel_style
        
    db.commit()
    return get_user_preferences(current_user=current_user, db=db)

@router.get("/travellers", response_model=List[TravellerResponse])
def get_saved_travellers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    travellers = db.query(Traveller).filter(Traveller.user_id == current_user.id).all()
    # Mask passport numbers before returning (Phase 10)
    for t in travellers:
        t.passport = mask_sensitive_string(t.passport)
    return travellers

@router.post("/travellers", response_model=TravellerResponse)
def add_saved_traveller(
    req: TravellerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    t = Traveller(
        user_id=current_user.id,
        name=req.name,
        age=req.age,
        gender=req.gender,
        passport=req.passport,
        nationality=req.nationality,
        meal=req.meal,
        seat=req.seat
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    t.passport = mask_sensitive_string(t.passport)
    return t

@router.put("/travellers/{traveller_id}", response_model=TravellerResponse)
def update_saved_traveller(
    traveller_id: int,
    req: TravellerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    t = db.query(Traveller).filter(Traveller.id == traveller_id, Traveller.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Traveller not found.")
        
    t.name = req.name
    t.age = req.age
    t.gender = req.gender
    if req.passport is not None and not req.passport.startswith("*"):
        t.passport = req.passport
    t.nationality = req.nationality
    t.meal = req.meal
    t.seat = req.seat
    
    db.commit()
    db.refresh(t)
    t.passport = mask_sensitive_string(t.passport)
    return t

@router.delete("/travellers/{traveller_id}")
def delete_saved_traveller(
    traveller_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    t = db.query(Traveller).filter(Traveller.id == traveller_id, Traveller.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Traveller not found.")
    db.delete(t)
    db.commit()
    return {"success": True, "message": "Traveller deleted successfully."}
