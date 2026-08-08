from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.core import User, LoyaltyAccount, WalletAccount, RefreshToken
from app.auth.jwt import (
    create_access_token, create_refresh_token, decode_token,
    verify_token_type, hash_password, verify_password, hash_token
)
from typing import Optional, List
import hashlib
import datetime
import logging
from pydantic import BaseModel, EmailStr
from app.utils.rate_limiter import RateLimiter
from app.auth.dependencies import oauth2_scheme, get_current_admin, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
auth_limiter = RateLimiter(max_requests=10, window_seconds=60, scope="auth_exchange")

logger = logging.getLogger(__name__)



class UserSignUp(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: str
    country: Optional[str] = None
    preferred_language: str = "en"
    preferred_currency: str = "INR"

class UserResponse(BaseModel):
    id: int
    email: str
    preferred_language: str
    preferred_currency: str

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenRefreshRequest(BaseModel):
    refresh_token: str
    device_id: Optional[str] = None

class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None

class SessionResponse(BaseModel):
    id: int
    device_id: Optional[str]
    user_agent: Optional[str]
    ip_address: Optional[str]
    issued_at: datetime.datetime
    expires_at: datetime.datetime
    revoked: bool
    last_used_at: datetime.datetime

    class Config:
        from_attributes = True

class RevokeSessionRequest(BaseModel):
    session_id: int


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(auth_limiter)])
def signup(user_data: UserSignUp, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_pwd = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        password_hash=hashed_pwd,
        phone=user_data.phone,
        preferred_language=user_data.preferred_language,
        preferred_currency=user_data.preferred_currency
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize UserProfile row automatically (Phase 1)
    from app.models.core import UserProfile
    profile = UserProfile(
        user_id=user.id,
        full_name=user_data.full_name,
        email=user_data.email,
        mobile_number=user_data.phone,
        country=user_data.country
    )
    db.add(profile)

    # Initialize wallet and loyalty accounts for user
    wallet = WalletAccount(user_id=user.id, balance=0.00, currency=user.preferred_currency)
    loyalty = LoyaltyAccount(user_id=user.id, points_balance=0, tier="Bronze")
    db.add(wallet)
    db.add(loyalty)
    db.commit()
    
    return user

@router.post("/token", response_model=TokenResponse, dependencies=[Depends(auth_limiter)])
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    try:
        user = db.query(User).filter(User.email == form_data.username).first()
        
        # BUG-001 FIX: Never auto-create accounts on login. Always reject unknown emails.
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.password_hash or not verify_password(form_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        access_token = create_access_token(data={"sub": user.email, "role": user.role, "id": user.id})
        refresh_token = create_refresh_token(data={"sub": user.email, "role": user.role, "id": user.id})

        # Securely record refresh token session
        user_agent = request.headers.get("User-Agent")
        device_id = request.headers.get("X-Device-Id")
        ip_address = request.client.host if request.client else None
        
        decoded_refresh = decode_token(refresh_token)
        expires_at = datetime.datetime.utcfromtimestamp(decoded_refresh.get("exp"))

        db_refresh = RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            device_id=device_id,
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=expires_at
        )
        db.add(db_refresh)
        db.commit()

        return {"access_token": access_token, "refresh_token": refresh_token}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unhandled login exception: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: Request, payload: TokenRefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if not decoded or not verify_token_type(decoded, "refresh"):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    t_hash = hash_token(payload.refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == t_hash).first()

    # Replay reuse breach check
    if db_token and db_token.revoked:
        logger.warning(
            f"SECURITY EXCEPTION: Replay attack detected for user ID {db_token.user_id} using rotated token!"
        )
        # Invalidate all active tokens to protect the user
        db.query(RefreshToken).filter(RefreshToken.user_id == db_token.user_id).update({"revoked": True})
        db.commit()
        raise HTTPException(status_code=401, detail="Token compromised. All sessions revoked.")

    if not db_token:
        raise HTTPException(status_code=401, detail="Invalid or untracked refresh token")

    if db_token.expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=401, detail="Refresh token expired")

    email = decoded.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    # Revoke/rotate old token
    db_token.revoked = True
    db_token.last_used_at = datetime.datetime.utcnow()
    
    # Issue new tokens
    access_token = create_access_token(data={"sub": user.email, "role": user.role, "id": user.id})
    new_refresh = create_refresh_token(data={"sub": user.email, "role": user.role, "id": user.id})

    new_decoded = decode_token(new_refresh)
    new_expires_at = datetime.datetime.utcfromtimestamp(new_decoded.get("exp"))

    # Record new refresh token session
    user_agent = request.headers.get("User-Agent") or db_token.user_agent
    device_id = payload.device_id or request.headers.get("X-Device-Id") or db_token.device_id
    ip_address = request.client.host if request.client else db_token.ip_address

    new_db_token = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_refresh),
        device_id=device_id,
        user_agent=user_agent,
        ip_address=ip_address,
        expires_at=new_expires_at
    )
    db.add(new_db_token)
    db.commit()

    return {"access_token": access_token, "refresh_token": new_refresh}

@router.post("/logout")
def logout(
    request: Request,
    payload: Optional[LogoutRequest] = None,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """Logs out the user, blacklists access token, and revokes active refresh token sessions"""
    from app.utils.token_blacklist import blacklist_token
    blacklist_token(token)

    # Resolve user
    decoded = decode_token(token)
    if decoded and decoded.get("id"):
        user_id = decoded.get("id")
        
        # 1. Revoke by token payload if provided
        if payload and payload.refresh_token:
            t_hash = hash_token(payload.refresh_token)
            db.query(RefreshToken).filter(
                RefreshToken.token_hash == t_hash,
                RefreshToken.user_id == user_id
            ).update({"revoked": True})

        # 2. Revoke by device_id if provided
        device_id = request.headers.get("X-Device-Id")
        if device_id:
            db.query(RefreshToken).filter(
                RefreshToken.device_id == device_id,
                RefreshToken.user_id == user_id
            ).update({"revoked": True})
            
        db.commit()

    return {"message": "Logged out successfully."}

@router.get("/sessions", response_model=List[SessionResponse])
def list_active_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists all active and unexpired sessions for the authenticated user"""
    now = datetime.datetime.utcnow()
    sessions = db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked == False,
        RefreshToken.expires_at > now
    ).all()
    return sessions

@router.post("/sessions/revoke")
def revoke_specific_session(
    payload: RevokeSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revokes a specific device session for the authenticated user"""
    session = db.query(RefreshToken).filter(
        RefreshToken.id == payload.session_id,
        RefreshToken.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session.revoked = True
    db.commit()
    return {"success": True, "message": "Session successfully revoked."}


@router.get("/google/login")
def google_login_url():
    """Stub to return Google Auth URL for PKCE frontend redirect"""
    return {
        "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=GOOGLE_CLIENT_ID&redirect_uri=REDIRECT_URI&response_type=code&scope=openid%20email%20profile"
    }

@router.post("/google/callback", response_model=TokenResponse)
def google_callback(code: str, code_verifier: str, db: Session = Depends(get_db)):
    """Stub processing Google Auth exchange and returning user token"""
    # In production, call token endpoint, parse id_token and fetch profile
    email = "google_user@example.com"
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            auth_provider="google",
            preferred_language="en",
            preferred_currency="INR"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        wallet = WalletAccount(user_id=user.id, balance=0.00, currency="INR")
        loyalty = LoyaltyAccount(user_id=user.id, points_balance=0, tier="Bronze")
        db.add(wallet)
        db.add(loyalty)
        db.commit()
        
    access_token = create_access_token(data={"sub": user.email, "role": user.role, "id": user.id})
    refresh_token = create_refresh_token(data={"sub": user.email, "role": user.role, "id": user.id})
    return {"access_token": access_token, "refresh_token": refresh_token}

import time
import secrets
import threading
import json
import logging
from app.utils.redis_client import redis_client

logger = logging.getLogger(__name__)

class ExchangeCodeStore:
    def __init__(self):
        self.local_store = {}
        self.lock = threading.Lock()

        # Multi-instance Production Centralized Store Warning Check
        if not redis_client:
            import os
            env = os.getenv("ENVIRONMENT", "development").lower()
            if env in ("production", "prod", "staging"):
                logger.error(
                    "❌ CENTRALIZED STORE REQUIRED: Redis is unavailable, but the active ENVIRONMENT is set to '%s'. "
                    "Centralized Redis is a hard dependency for the token exchange flow in multi-instance production deployments. "
                    "In-memory fallback is active under severe risk of authentication sync failures across instances.",
                    env
                )
            else:
                logger.warning(
                    "⚠️ V1 Auth Exchange: Redis is unavailable. Falling back to local in-memory ExchangeCodeStore. "
                    "Note: Centralized Redis is a hard dependency for the token exchange flow in multi-instance production environments."
                )

    def set(self, code: str, data: dict, ttl: int = 60):
        if redis_client:
            try:
                redis_client.setex(f"exch:{code}", ttl, json.dumps(data))
                return
            except Exception:
                pass
        
        with self.lock:
            self.local_store[code] = {
                "data": data,
                "expires_at": time.time() + ttl
            }

    def get_and_delete(self, code: str) -> dict | None:
        if redis_client:
            try:
                key = f"exch:{code}"
                val = redis_client.get(key)
                if val:
                    redis_client.delete(key)
                    return json.loads(val)
                return None
            except Exception:
                pass
        
        with self.lock:
            now = time.time()
            # clean expired keys
            expired = [k for k, v in self.local_store.items() if v["expires_at"] < now]
            for k in expired:
                del self.local_store[k]
                
            entry = self.local_store.pop(code, None)
            if entry and entry["expires_at"] >= now:
                return entry["data"]
            return None

exchange_store = ExchangeCodeStore()

class ExchangeCodeRequest(BaseModel):
    exchange_code: str

class ExchangeResponse(BaseModel):
    token: str
    role: str
    email: str

@router.post("/exchange-code", dependencies=[Depends(auth_limiter)])
def generate_exchange_code(
    current_admin: User = Depends(get_current_admin),
    token: str = Depends(oauth2_scheme)
):
    """Generate a short-lived single-use exchange code for cross-origin session transfer"""
    code = f"exch_{secrets.token_urlsafe(32)}"
    data = {
        "token": token,
        "role": current_admin.role,
        "email": current_admin.email
    }
    exchange_store.set(code, data, ttl=60)
    return {"exchange_code": code}

@router.post("/exchange", response_model=ExchangeResponse, dependencies=[Depends(auth_limiter)])
def exchange_code_for_token(req: ExchangeCodeRequest):
    """Exchange a short-lived single-use code for real session credentials"""
    data = exchange_store.get_and_delete(req.exchange_code)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired exchange code"
        )
    return data


# ─────────────────────────────────────────────────────────────────────────────
# BUG-010 FIX: Forgot Password / Reset Password
# ─────────────────────────────────────────────────────────────────────────────
import os as _os
import secrets as _secrets
import threading as _threading
import time as _time

_reset_limiter = RateLimiter(max_requests=5, window_seconds=60, scope="password_reset")


class _PasswordResetStore:
    """Thread-safe, Redis-backed (with in-memory fallback) store for reset tokens."""

    def __init__(self):
        self.local: dict = {}
        self.lock = _threading.Lock()

    def set(self, token: str, user_id: int, ttl: int = 900):
        try:
            from app.utils.redis_client import redis_client as _rc
            if _rc:
                _rc.setex(f"pwd_reset:{token}", ttl, str(user_id))
                return
        except Exception:
            pass
        with self.lock:
            self.local[token] = {"user_id": user_id, "expires_at": _time.time() + ttl}

    def pop(self, token: str):
        try:
            from app.utils.redis_client import redis_client as _rc
            if _rc:
                val = _rc.get(f"pwd_reset:{token}")
                if val:
                    _rc.delete(f"pwd_reset:{token}")
                    return int(val)
                return None
        except Exception:
            pass
        with self.lock:
            entry = self.local.pop(token, None)
            if not entry:
                return None
            if entry["expires_at"] < _time.time():
                return None
            return entry["user_id"]


_reset_store = _PasswordResetStore()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password", dependencies=[Depends(_reset_limiter)])
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Request a password reset email.
    Always returns 200 — never discloses whether the email is registered (anti-enumeration).
    """
    user = db.query(User).filter(User.email == req.email).first()
    if user:
        token = _secrets.token_urlsafe(48)
        _reset_store.set(token, user.id, ttl=900)  # 15-minute expiry
        frontend_url = _os.getenv("FRONTEND_URL", "http://localhost:5173")
        reset_link = f"{frontend_url}/reset-password?token={token}"
        try:
            from app.services.communication import CommunicationService
            comm = CommunicationService()
            comm.send_email(
                to_email=user.email,
                subject="Travel OS – Password Reset Request",
                body=(
                    f"Click the link to reset your password (valid 15 min):\n{reset_link}\n\n"
                    "If you didn't request this, ignore this email."
                ),
                html_body=f"""
                <p>You requested a password reset for your <strong>Travel OS</strong> account.</p>
                <p style="margin:24px 0">
                  <a href="{reset_link}"
                     style="background:#1976d2;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
                     Reset Password
                  </a>
                </p>
                <p style="color:#666;font-size:13px;">
                  This link expires in 15 minutes. If you didn't request this, please ignore this email.
                </p>
                """,
            )
        except Exception as e:
            logger.warning(f"Password reset email failed for {req.email}: {e}")

    # Always succeed — do not reveal whether the email exists
    return {"message": "If that email is registered, a password reset link has been sent."}


@router.post("/reset-password", dependencies=[Depends(_reset_limiter)])
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Consume a one-time reset token and update the user's password.
    Invalidates all existing refresh tokens on success.
    """
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user_id = _reset_store.pop(req.token)
    if user_id is None:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.hashed_password = hash_password(req.new_password)
    # Invalidate all active refresh tokens so old sessions cannot be reused
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
    db.commit()

    logger.info(f"Password reset completed for user ID {user.id}")
    return {"message": "Password reset successfully. Please log in with your new password."}
