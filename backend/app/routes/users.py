import os
import uuid
import datetime
from enum import Enum as PyEnum
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models.core import User, UserProfile, RefreshToken, SecurityEvent, SavedCompanion
from app.auth.dependencies import get_current_user
from app.auth.jwt import verify_password

router = APIRouter(prefix="/users", tags=["users"])

# ─── Schemas ───────────────────────────────────────────────────────────────────

class UserProfileResponse(BaseModel):
    id: int
    name: str
    full_name: str
    email: str
    email_verified: bool
    phone: Optional[str] = None
    phone_verified: bool = False
    avatar_url: Optional[str] = None
    avatar_initials: Optional[str] = "U"
    dob: Optional[str] = None
    gender: Optional[str] = None
    preferred_language: str = "en"
    preferred_currency: str = "INR"
    joined_date: Optional[str] = None
    created_at: Optional[str] = None
    profile_completion: int = 0

    # Financial & Security Metrics
    wallet_balance: float = 0.0
    loyalty_points: int = 0
    loyalty_tier: str = "BRONZE"
    total_spend: float = 0.0
    monthly_spend: float = 0.0
    total_bookings: int = 0
    pin_enabled: bool = False
    pin_status: str = "No Payment PIN Set"

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    preferred_language: Optional[str] = None
    preferred_currency: Optional[str] = None
    avatar_url: Optional[str] = None
    email: Optional[str] = None


class SavedCompanionCreate(BaseModel):
    name: str
    age: int
    relationship_label: Optional[str] = "Friend"


class SavedCompanionResponse(BaseModel):
    id: int
    user_id: int
    name: str
    age: int
    relationship_label: Optional[str] = "Friend"
    created_at: str

    class Config:
        from_attributes = True


class ActiveSessionResponse(BaseModel):
    id: int
    device_id: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    issued_at: str
    last_used_at: str
    is_current: bool = False


class SecurityEventResponse(BaseModel):
    id: int
    event_type: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[str] = None
    created_at: str


class DeleteAccountRequest(BaseModel):
    password: str
    confirm: bool = False
    reason: Optional[str] = None


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _get_avatar_initials(name: str) -> str:
    if not name:
        return "U"
    parts = name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    elif len(parts) == 1 and parts[0]:
        return parts[0][0].upper()
    return "U"


def _calc_profile_completion(user: User, profile: Optional[UserProfile]) -> int:
    score = 0
    total = 6
    if profile and profile.full_name:
        score += 1
    if user.email:
        score += 1
    if user.email_verified:
        score += 1
    if user.phone or (profile and profile.mobile_number):
        score += 1
    if profile and profile.dob:
        score += 1
    if profile and profile.avatar_url:
        score += 1
    return int((score / total) * 100)


def calculate_user_metrics(db: Session, user_id: int) -> dict:
    from app.models.core import WalletAccount, LoyaltyAccount, UserPaymentPin, WalletTransaction
    from app.models.payments import Payment, Refund, RefundStatus
    from app.models.bookings import (
        FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking,
        HolidayPackageBooking, ActivityBooking, VisaApplication, CruiseBooking,
        InsurancePolicy, VillaBooking, ForexOrder
    )
    from sqlalchemy import func, or_
    from enum import Enum as PyEnum

    # 1. Wallet Balance (authoritative from WalletAccount table)
    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user_id).first()
    wallet_balance = float(wallet.balance) if wallet else 0.0

    # 2. Loyalty (authoritative from LoyaltyAccount table)
    loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user_id).first()
    loyalty_points = int(loyalty.points) if loyalty else 0
    loyalty_tier = loyalty.tier if loyalty else "BRONZE"

    # 3. Security PIN status
    pin_rec = db.query(UserPaymentPin).filter(UserPaymentPin.user_id == user_id).first()
    pin_enabled = pin_rec is not None
    pin_status = "Payment PIN Protected" if pin_enabled else "No Payment PIN Set"

    # 4. Bookings & Gross Spend Calculation (Authoritative source for booking spend)
    booking_tables = [
        FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking,
        HolidayPackageBooking, ActivityBooking, VisaApplication, CruiseBooking,
        InsurancePolicy, VillaBooking, ForexOrder
    ]

    now = datetime.datetime.utcnow()
    INVALID_KEYWORDS = ["fail", "cancel", "pending", "reject", "expire", "hold", "draft"]

    total_bookings = 0
    gross_spend = 0.0
    monthly_gross_spend = 0.0

    for model in booking_tables:
        try:
            records = db.query(model).filter(model.user_id == user_id).all()
            for r in records:
                st = r.status.value if isinstance(r.status, PyEnum) else str(r.status)
                st_lower = st.lower()
                
                # Exclude invalid / failed / cancelled / pending / draft / hold bookings
                if any(kw in st_lower for kw in INVALID_KEYWORDS):
                    continue

                total_bookings += 1
                amt = float(r.total_amount or 0.0)
                gross_spend += amt

                dt = r.created_at
                if dt and dt.year == now.year and dt.month == now.month:
                    monthly_gross_spend += amt
        except Exception:
            pass

    # 5. Refunds Calculation (Subtract refunds to yield Net Spend)
    total_refunds = 0.0
    monthly_refunds = 0.0
    refunded_refs = set()

    # A. WalletTransaction credits marked as refund
    if wallet:
        try:
            refund_txs = db.query(WalletTransaction).filter(
                WalletTransaction.wallet_account_id == wallet.id,
                WalletTransaction.type.ilike("%credit%"),
                or_(
                    WalletTransaction.description.ilike("%refund%"),
                    WalletTransaction.reference.ilike("%refund%")
                )
            ).all()
            for rtx in refund_txs:
                amt = float(rtx.amount or 0.0)
                total_refunds += amt
                if rtx.reference:
                    refunded_refs.add(rtx.reference.lower())
                dt = rtx.timestamp
                if dt and dt.year == now.year and dt.month == now.month:
                    monthly_refunds += amt
        except Exception:
            pass

    # B. Refund table records for gateway refunds not already in wallet_txs
    try:
        payment_refunds = db.query(Refund).join(Payment).filter(
            Payment.user_id == user_id,
            Refund.status != RefundStatus.FAILED
        ).all()
        for pr in payment_refunds:
            amt = float(pr.amount or 0.0)
            ref_key = f"ref_{pr.id}".lower()
            if ref_key not in refunded_refs:
                total_refunds += amt
                dt = pr.created_at
                if dt and dt.year == now.year and dt.month == now.month:
                    monthly_refunds += amt
    except Exception:
        pass

    # C. Inline booking refund_amount attribute if set on model
    for model in booking_tables:
        try:
            records = db.query(model).filter(model.user_id == user_id).all()
            for r in records:
                st = r.status.value if isinstance(r.status, PyEnum) else str(r.status)
                if not any(kw in st.lower() for kw in INVALID_KEYWORDS):
                    ref_amt = float(getattr(r, "refund_amount", 0.0) or 0.0)
                    if ref_amt > 0 and getattr(r, "booking_reference", None) not in refunded_refs:
                        total_refunds += ref_amt
                        dt = r.created_at
                        if dt and dt.year == now.year and dt.month == now.month:
                            monthly_refunds += ref_amt
        except Exception:
            pass

    # 6. Standalone Non-Booking Wallet Debits
    # Exclude any transaction related to bookings, orders, payments, topups, or recharges to prevent double counting
    standalone_debit_spend = 0.0
    monthly_standalone_debit_spend = 0.0

    if wallet:
        try:
            debits = db.query(WalletTransaction).filter(
                WalletTransaction.wallet_account_id == wallet.id,
                WalletTransaction.type.ilike("%debit%")
            ).all()
            for d in debits:
                desc = (d.description or "").lower()
                ref = (d.reference or "").lower()
                if any(kw in desc or kw in ref for kw in [
                    "booking", "flight", "hotel", "train", "bus", "cab", "holiday",
                    "activity", "visa", "cruise", "forex", "insurance", "villa",
                    "trip", "order", "pay", "recharge", "topup", "bk-", "fl-", "ht-", "tr-", "cb-"
                ]):
                    continue
                amt = float(d.amount or 0.0)
                standalone_debit_spend += amt
                dt = d.timestamp
                if dt and dt.year == now.year and dt.month == now.month:
                    monthly_standalone_debit_spend += amt
        except Exception:
            pass

    net_total_spend = max(0.0, gross_spend + standalone_debit_spend - total_refunds)
    net_monthly_spend = max(0.0, monthly_gross_spend + monthly_standalone_debit_spend - monthly_refunds)

    return {
        "wallet_balance": wallet_balance,
        "loyalty_points": loyalty_points,
        "loyalty_tier": loyalty_tier,
        "pin_enabled": pin_enabled,
        "pin_status": pin_status,
        "total_bookings": total_bookings,
        "total_spend": round(net_total_spend, 2),
        "monthly_spend": round(net_monthly_spend, 2)
    }


def log_security_event(
    db: Session,
    user_id: int,
    event_type: str,
    request: Optional[Request] = None,
    details: Optional[str] = None,
) -> None:
    ip = request.client.host if request and request.client else None
    ua = request.headers.get("user-agent") if request else None
    ev = SecurityEvent(
        user_id=user_id,
        event_type=event_type,
        ip_address=ip,
        user_agent=ua[:500] if ua else None,
        details=details,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(ev)
    try:
        db.commit()
    except Exception:
        db.rollback()


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full backend-authoritative profile details for the authenticated user."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    user_name = getattr(current_user, "full_name", None) or getattr(current_user, "name", None) or current_user.email.split("@")[0].capitalize()
    if not profile:
        profile = UserProfile(
            user_id=current_user.id,
            full_name=user_name,
            email=current_user.email,
            mobile_number=current_user.phone,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    else:
        if not profile.full_name or profile.full_name == "User":
            profile.full_name = user_name
            db.commit()
        if not profile.mobile_number and current_user.phone:
            profile.mobile_number = current_user.phone
            db.commit()

    completion = _calc_profile_completion(current_user, profile)
    dob_str = profile.dob.isoformat() if profile.dob else None
    created_str = current_user.created_at.isoformat() if current_user.created_at else None
    joined_str = current_user.created_at.strftime("%b %Y") if current_user.created_at else None

    metrics = calculate_user_metrics(db, current_user.id)
    fn = profile.full_name or user_name
    phone_num = profile.mobile_number or current_user.phone or ""

    return UserProfileResponse(
        id=current_user.id,
        name=fn,
        full_name=fn,
        email=current_user.email,
        email_verified=current_user.email_verified,
        phone=phone_num,
        phone_verified=getattr(current_user, "phone_verified", False),
        avatar_url=getattr(profile, "avatar_url", None),
        avatar_initials=_get_avatar_initials(fn),
        dob=dob_str,
        gender=profile.gender,
        preferred_language=current_user.preferred_language or "en",
        preferred_currency=current_user.preferred_currency or "INR",
        joined_date=joined_str,
        created_at=created_str,
        profile_completion=completion,
        wallet_balance=metrics["wallet_balance"],
        loyalty_points=metrics["loyalty_points"],
        loyalty_tier=metrics["loyalty_tier"],
        total_spend=metrics["total_spend"],
        monthly_spend=metrics["monthly_spend"],
        total_bookings=metrics["total_bookings"],
        pin_enabled=metrics["pin_enabled"],
        pin_status=metrics["pin_status"],
    )


@router.patch("/me", response_model=UserProfileResponse)
def update_current_user_profile(
    req: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update profile fields with anti-tampering guards on email and restricted metrics."""
    if req.email and req.email.strip().lower() != current_user.email.lower():
        raise HTTPException(
            status_code=400,
            detail="Email cannot be changed directly. Please use the email change verification flow.",
        )

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id, full_name="User")
        db.add(profile)

    target_name = req.full_name or req.name
    if target_name is not None:
        profile.full_name = target_name.strip()
    if req.phone is not None:
        profile.mobile_number = req.phone.strip()
        current_user.phone = req.phone.strip()
    if req.dob is not None:
        try:
            profile.dob = datetime.date.fromisoformat(req.dob) if req.dob else None
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if req.gender is not None:
        profile.gender = req.gender
    if req.preferred_language is not None:
        current_user.preferred_language = req.preferred_language
    if req.preferred_currency is not None:
        current_user.preferred_currency = req.preferred_currency
    if req.avatar_url is not None:
        profile.avatar_url = req.avatar_url

    db.commit()
    db.refresh(profile)

    return get_current_user_profile(current_user=current_user, db=db)


# ─── Companions Endpoints ──────────────────────────────────────────────────────

@router.get("/me/companions", response_model=List[SavedCompanionResponse])
def get_user_companions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comps = db.query(SavedCompanion).filter(SavedCompanion.user_id == current_user.id).all()
    res = []
    for c in comps:
        res.append(SavedCompanionResponse(
            id=c.id,
            user_id=c.user_id,
            name=c.name,
            age=c.age,
            relationship_label=c.relationship_label or "Friend",
            created_at=c.created_at.isoformat() if c.created_at else ""
        ))
    return res


@router.post("/me/companions", response_model=SavedCompanionResponse)
def add_user_companion(
    req: SavedCompanionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="Companion name is required.")
    if req.age <= 0 or req.age > 120:
        raise HTTPException(status_code=400, detail="Valid companion age is required.")
    
    comp = SavedCompanion(
        user_id=current_user.id,
        name=req.name.strip(),
        age=req.age,
        relationship_label=req.relationship_label or "Friend"
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    return SavedCompanionResponse(
        id=comp.id,
        user_id=comp.user_id,
        name=comp.name,
        age=comp.age,
        relationship_label=comp.relationship_label or "Friend",
        created_at=comp.created_at.isoformat() if comp.created_at else ""
    )


@router.delete("/me/companions/{companion_id}")
def delete_user_companion(
    companion_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    comp = db.query(SavedCompanion).filter(
        SavedCompanion.id == companion_id,
        SavedCompanion.user_id == current_user.id
    ).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Companion not found.")

    db.delete(comp)
    db.commit()
    return {"success": True, "message": "Companion deleted successfully."}


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Securely upload and validate a user avatar (JPG, PNG, WEBP, max 5MB)."""
    ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
    ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
    MAX_SIZE = 5 * 1024 * 1024  # 5 MB

    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Allowed formats: JPG, PNG, WEBP.",
        )

    filename = file.filename or ""
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail="Invalid file extension. Allowed extensions: .jpg, .jpeg, .png, .webp.",
        )

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds maximum allowed limit of 5MB.",
        )
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    upload_dir = os.path.join("static", "uploads", "avatars")
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = f"avatar_{current_user.id}_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    avatar_url = f"/static/uploads/avatars/{safe_filename}"

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id, full_name="User")
        db.add(profile)
    profile.avatar_url = avatar_url
    db.commit()

    return {"success": True, "avatar_url": avatar_url}


@router.get("/me/sessions", response_model=List[ActiveSessionResponse])
def get_active_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_device = request.headers.get("X-Device-Id")
    now = datetime.datetime.utcnow()

    tokens = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > now,
        )
        .order_by(RefreshToken.last_used_at.desc())
        .all()
    )

    result = []
    for t in tokens:
        result.append(
            ActiveSessionResponse(
                id=t.id,
                device_id=t.device_id or "Web Browser",
                user_agent=t.user_agent or "Standard Client",
                ip_address=t.ip_address or "Masked",
                issued_at=t.issued_at.isoformat() if t.issued_at else now.isoformat(),
                last_used_at=t.last_used_at.isoformat() if t.last_used_at else now.isoformat(),
                is_current=(current_device and t.device_id == current_device),
            )
        )
    return result


@router.post("/me/sessions/revoke-others")
def revoke_other_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_device = request.headers.get("X-Device-Id")

    query = db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked == False,
    )
    if current_device:
        query = query.filter(RefreshToken.device_id != current_device)

    revoked_count = query.update({"revoked": True})
    db.commit()

    log_security_event(
        db,
        current_user.id,
        "SESSION_REVOKED",
        request,
        f"Revoked {revoked_count} other session(s)",
    )

    return {
        "success": True,
        "message": f"Successfully revoked {revoked_count} other active session(s).",
    }


@router.get("/me/security-events", response_model=List[SecurityEventResponse])
def get_security_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.user_id == current_user.id)
        .order_by(SecurityEvent.created_at.desc())
        .limit(20)
        .all()
    )

    return [
        SecurityEventResponse(
            id=ev.id,
            event_type=ev.event_type,
            ip_address=ev.ip_address or "Internal",
            user_agent=ev.user_agent or "Web Client",
            details=ev.details,
            created_at=ev.created_at.isoformat(),
        )
        for ev in events
    ]


@router.post("/me/delete")
def delete_account(
    req: DeleteAccountRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.confirm:
        raise HTTPException(
            status_code=400,
            detail="You must confirm your intent to delete your account.",
        )

    if not current_user.password_hash or not verify_password(req.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect password. Account deletion aborted.")

    current_user.is_active = False

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile:
        profile.full_name = "Deactivated Traveler"
        profile.mobile_number = None
        profile.avatar_url = None

    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).update({"revoked": True})

    log_security_event(
        db,
        current_user.id,
        "ACCOUNT_DELETION_REQUESTED",
        request,
        f"Reason: {req.reason or 'User self-service deletion'}",
    )
    db.commit()

    return {
        "success": True,
        "message": "Account successfully deactivated. Your historical booking receipts are retained for accounting and compliance purposes.",
    }
