from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User
from app.services import security_pin_service

router = APIRouter(prefix="/wallet/security-pin", tags=["security-pin"])
wallet_loyalty_pin_router = APIRouter(prefix="/wallet-loyalty/wallet/security-pin", tags=["security-pin"])

class SetPinRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=4, description="4-digit payment security PIN")

class VerifyPinRequest(BaseModel):
    pin: str = Field(..., description="4-digit payment security PIN")
    purpose: Optional[str] = Field("booking_payment", description="Purpose of verification")

class ChangePinRequest(BaseModel):
    old_pin: str = Field(..., description="Current 4-digit PIN")
    new_pin: str = Field(..., min_length=4, max_length=4, description="New 4-digit PIN")

class RemovePinRequest(BaseModel):
    pin: str = Field(..., description="Current 4-digit PIN")


def get_pin_status_impl(user: User, db: Session):
    rec = security_pin_service.get_user_pin_record(db, user.id)
    if not rec:
        return {
            "pin_enabled": False,
            "locked": False,
            "locked_until": None,
            "failed_attempts": 0
        }
    locked = security_pin_service.check_lockout(rec)
    return {
        "pin_enabled": True,
        "locked": locked,
        "locked_until": rec.locked_until.isoformat() if rec.locked_until else None,
        "failed_attempts": rec.failed_attempts
    }

def set_pin_impl(req: SetPinRequest, user: User, db: Session):
    security_pin_service.set_pin(db, user.id, req.pin)
    return {
        "success": True,
        "pin_enabled": True,
        "message": "Payment security PIN set successfully."
    }

def verify_pin_impl(req: VerifyPinRequest, user: User, db: Session):
    res = security_pin_service.verify_pin(db, user.id, req.pin, req.purpose or "booking_payment")
    return res

def change_pin_impl(req: ChangePinRequest, user: User, db: Session):
    security_pin_service.change_pin(db, user.id, req.old_pin, req.new_pin)
    return {
        "success": True,
        "pin_enabled": True,
        "message": "Payment PIN changed successfully."
    }

def remove_pin_impl(req: RemovePinRequest, user: User, db: Session):
    security_pin_service.remove_pin(db, user.id, req.pin)
    return {
        "success": True,
        "pin_enabled": False,
        "message": "Payment PIN removed successfully."
    }


# Router 1: /wallet/security-pin
@router.get("")
@router.get("/")
def get_pin_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_pin_status_impl(user, db)

@router.post("")
@router.post("/")
def set_pin_endpoint(req: SetPinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return set_pin_impl(req, user, db)

@router.post("/verify")
def verify_pin_endpoint(req: VerifyPinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return verify_pin_impl(req, user, db)

@router.post("/change")
def change_pin_endpoint(req: ChangePinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return change_pin_impl(req, user, db)

@router.post("/remove")
@router.delete("")
@router.delete("/")
def remove_pin_endpoint(req: RemovePinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return remove_pin_impl(req, user, db)


# Router 2: /wallet-loyalty/wallet/security-pin aliases
@wallet_loyalty_pin_router.get("")
@wallet_loyalty_pin_router.get("/")
def get_pin_status_wl(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_pin_status_impl(user, db)

@wallet_loyalty_pin_router.post("")
@wallet_loyalty_pin_router.post("/")
def set_pin_endpoint_wl(req: SetPinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return set_pin_impl(req, user, db)

@wallet_loyalty_pin_router.post("/verify")
def verify_pin_endpoint_wl(req: VerifyPinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return verify_pin_impl(req, user, db)

@wallet_loyalty_pin_router.post("/change")
def change_pin_endpoint_wl(req: ChangePinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return change_pin_impl(req, user, db)

@wallet_loyalty_pin_router.post("/remove")
@wallet_loyalty_pin_router.delete("")
@wallet_loyalty_pin_router.delete("/")
def remove_pin_endpoint_wl(req: RemovePinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return remove_pin_impl(req, user, db)
