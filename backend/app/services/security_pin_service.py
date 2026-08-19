import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.core import UserPaymentPin
from app.auth.jwt import hash_password, verify_password

MAX_FAILED_ATTEMPTS = 3
LOCKOUT_MINUTES = 15

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

def verify_pin(db: Session, user_id: int, plain_pin: str, purpose: str = "booking_payment") -> Dict[str, Any]:
    record = get_user_pin_record(db, user_id)
    if not record:
        # If user has no PIN configured in DB, return verified: True
        return {"verified": True, "pin_enabled": False}

    if check_lockout(record):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Try again later."
        )

    if not is_pin_format_valid(plain_pin):
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

    if not verify_password(plain_pin, record.pin_hash):
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
    return {"verified": True, "pin_enabled": True}

def change_pin(db: Session, user_id: int, old_pin: str, new_pin: str) -> bool:
    record = get_user_pin_record(db, user_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No payment PIN is currently set."
        )

    # Verify old PIN first (which will check lockout and increment failed attempts on mismatch)
    verify_pin(db, user_id, old_pin, purpose="change_pin")
    
    # Set new PIN
    set_pin(db, user_id, new_pin)
    return True

def remove_pin(db: Session, user_id: int, current_pin: str) -> bool:
    record = get_user_pin_record(db, user_id)
    if not record:
        return True

    # Verify current PIN first
    verify_pin(db, user_id, current_pin, purpose="remove_pin")
    
    db.delete(record)
    db.commit()
    return True
