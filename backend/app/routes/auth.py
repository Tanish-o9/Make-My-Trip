from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.core import User, LoyaltyAccount, WalletAccount
from app.auth.jwt import (
    create_access_token, create_refresh_token, decode_token,
    verify_token_type, hash_password, verify_password
)
from pydantic import BaseModel, EmailStr
from app.utils.rate_limiter import RateLimiter
from app.auth.dependencies import oauth2_scheme, get_current_admin

router = APIRouter(prefix="/auth", tags=["auth"])
auth_limiter = RateLimiter(max_requests=10, window_seconds=60, scope="auth_exchange")

class UserSignUp(BaseModel):
    email: EmailStr
    password: str
    phone: str = None
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

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
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

    # Initialize wallet and loyalty accounts for user
    wallet = WalletAccount(user_id=user.id, balance=0.00, currency=user.preferred_currency)
    loyalty = LoyaltyAccount(user_id=user.id, points_balance=0, tier="Bronze")
    db.add(wallet)
    db.add(loyalty)
    db.commit()
    
    return user

@router.post("/token", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.email == form_data.username).first()
        
        if not user:
            # Auto-registration for new clients
            hashed_pwd = hash_password(form_data.password)
            user = User(
                email=form_data.username,
                password_hash=hashed_pwd,
                role="user",
                preferred_language="en",
                preferred_currency="INR"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            # Initialize wallet and loyalty accounts for new user
            wallet = WalletAccount(user_id=user.id, balance=50000.00, currency="INR")
            loyalty = LoyaltyAccount(user_id=user.id, points_balance=0, tier="Bronze")
            db.add(wallet)
            db.add(loyalty)
            db.commit()
        else:
            if not user.password_hash or not verify_password(form_data.password, user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
        access_token = create_access_token(data={"sub": user.email, "role": user.role})
        refresh_token = create_refresh_token(data={"sub": user.email, "role": user.role})
        return {"access_token": access_token, "refresh_token": refresh_token}
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Unhandled login exception: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: TokenRefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if not decoded or not verify_token_type(decoded, "refresh"):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    email = decoded.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    new_refresh = create_refresh_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "refresh_token": new_refresh}

@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme)):
    """Logs out the user and revokes their JWT access token"""
    from app.utils.token_blacklist import blacklist_token
    blacklist_token(token)
    return {"message": "Logged out successfully."}

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
        
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    refresh_token = create_refresh_token(data={"sub": user.email, "role": user.role})
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

