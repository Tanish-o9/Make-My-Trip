import uuid
import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from jose import jwt, JWTError

from app.models.core import UserPaymentPin, UsedPaymentAuthToken, User
from app.auth.jwt import JWT_SECRET, ALGORITHM, hash_password, verify_password

MAX_FAILED_ATTEMPTS = 3
LOCKOUT_MINUTES = 15
TOKEN_EXPIRE_SECONDS = 300  # 5-minute short-lived authorization token lifetime

def is_pin_format_valid(pin: str) -> bool:
    return bool(pin and isinstance(pin, str) and len(pin) == 4 and pin.isdigit())

def get_user_pin_record(db: Session, user_id: int) -> Optional[UserPaymentPin]:
    return db.query(UserPaymentPin).filter(UserPaymentPin.user_id == user_id).first()

def is_pin_enabled(db: Session, user_id: int) -> bool:
    rec = get_user_pin_record(db, user_id)
    return rec is not None

def check_lockout(record: UserPaymentPin) -> bool:
    if record.locked_until:
        if datetime.datetime.utcnow() < record.locked_until:
            return True
    return False

def generate_payment_auth_token(user_id: int, user_email: str, purpose: str = "booking_payment", expires_seconds: int = TOKEN_EXPIRE_SECONDS) -> Dict[str, Any]:
    jti = uuid.uuid4().hex
    now = datetime.datetime.utcnow()
    expire = now + datetime.timedelta(seconds=expires_seconds)
    payload = {
        "sub": user_email,
        "user_id": user_id,
        "purpose": purpose,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": expire,
        "type": "payment_auth"
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)
    return {
        "payment_authorization_token": token,
        "expires_in": expires_seconds
    }

def set_pin(db: Session, user_id: int, plain_pin: str) -> UserPaymentPin:
    if not is_pin_format_valid(plain_pin):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN must be exactly 4 numeric digits."
        )
    
    hashed = hash_password(plain_pin)
    record = get_user_pin_record(db, user_id)
    if record:
        record.pin_hash = hashed
        record.failed_attempts = 0
        record.locked_until = None
        record.updated_at = datetime.datetime.utcnow()
    else:
        record = UserPaymentPin(
            user_id=user_id,
            pin_hash=hashed,
            failed_attempts=0,
            locked_until=None
        )
        db.add(record)
    
    db.commit()
    db.refresh(record)
    return record

def verify_pin(db: Session, user_id: int, plain_pin: str, purpose: str = "booking_payment", user_email: Optional[str] = None) -> Dict[str, Any]:
    if not user_email:
        user = db.query(User).filter(User.id == user_id).first()
        user_email = user.email if user else f"user_{user_id}@travelos.com"

    record = get_user_pin_record(db, user_id)
    if not record:
        # If user has no PIN configured in DB, issue token as un-protected verified status
        token_info = generate_payment_auth_token(user_id, user_email, purpose=purpose)
        return {
            "verified": True,
            "pin_enabled": False,
            "payment_authorization_token": token_info["payment_authorization_token"],
            "expires_in": token_info["expires_in"]
        }

    if check_lockout(record):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Try again later."
        )

    if not is_pin_format_valid(plain_pin) or not verify_password(plain_pin, record.pin_hash):
        record.failed_attempts += 1
        if record.failed_attempts >= MAX_FAILED_ATTEMPTS:
            record.locked_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=LOCKOUT_MINUTES)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many incorrect attempts. Try again later."
            )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect security PIN."
        )

    # Success: reset failed attempts & clear lockout
    record.failed_attempts = 0
    record.locked_until = None
    db.commit()

    token_info = generate_payment_auth_token(user_id, user_email, purpose=purpose)
    return {
        "verified": True,
        "pin_enabled": True,
        "payment_authorization_token": token_info["payment_authorization_token"],
        "expires_in": token_info["expires_in"]
    }

def validate_payment_authorization(
    db: Session,
    user: User,
    expected_purpose: str,
    auth_token: Optional[str] = None,
    raw_pin: Optional[str] = None
) -> bool:
    """
    Validates payment authorization.
    1. If user has no PIN set, passes through.
    2. If auth_token provided: checks JWT signature, expiration, user match, purpose binding, and replay (one-time jti).
    3. If raw_pin provided (fallback): verifies PIN hash.
    4. If neither provided when PIN is active: raises 400.
    """
    if not is_pin_enabled(db, user.id):
        return True

    if auth_token and auth_token.strip():
        token_str = auth_token.strip()
        try:
            payload = jwt.decode(token_str, JWT_SECRET, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment authorization expired. Please verify your PIN again."
            )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment authorization token signature."
            )

        if payload.get("type") != "payment_auth":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment authorization token type."
            )

        token_user_id = payload.get("user_id")
        token_sub = payload.get("sub")
        if (token_user_id and token_user_id != user.id) or (token_sub and token_sub.lower() != user.email.lower()):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Payment authorization belongs to a different user."
            )

        token_purpose = payload.get("purpose")
        allowed_purposes = [expected_purpose]
        if expected_purpose in ["booking_payment", "create_order"]:
            allowed_purposes.extend(["booking_payment", "create_order"])

        if token_purpose not in allowed_purposes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment authorization token invalid for purpose: {expected_purpose}."
            )

        jti = payload.get("jti")
        if not jti:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment authorization token missing unique ID."
            )

        already_used = db.query(UsedPaymentAuthToken).filter(UsedPaymentAuthToken.jti == jti).first()
        if already_used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment authorization token has already been used."
            )

        # Mark token as consumed (one-time use)
        used_record = UsedPaymentAuthToken(
            jti=jti,
            user_id=user.id,
            purpose=token_purpose
        )
        db.add(used_record)
        db.commit()
        return True

    if raw_pin and raw_pin.strip():
        verify_pin(db, user.id, raw_pin.strip(), purpose=expected_purpose, user_email=user.email)
        return True

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Payment security PIN or authorization token required."
    )

def change_pin(db: Session, user_id: int, old_pin: str, new_pin: str) -> bool:
    record = get_user_pin_record(db, user_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No payment PIN is currently set."
        )

    verify_pin(db, user_id, old_pin, purpose="change_pin")
    set_pin(db, user_id, new_pin)
    return True

def remove_pin(db: Session, user_id: int, current_pin: str) -> bool:
    record = get_user_pin_record(db, user_id)
    if not record:
        return True

    verify_pin(db, user_id, current_pin, purpose="remove_pin")
    db.delete(record)
    db.commit()
    return True
