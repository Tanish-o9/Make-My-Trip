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

router = APIRouter(prefix="/auth", tags=["auth"])

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
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    return {"access_token": access_token, "refresh_token": refresh_token}

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: TokenRefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if not decoded or not verify_token_type(decoded, "refresh"):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    email = decoded.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    access_token = create_access_token(data={"sub": user.email})
    new_refresh = create_refresh_token(data={"sub": user.email})
    return {"access_token": access_token, "refresh_token": new_refresh}

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
        
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    return {"access_token": access_token, "refresh_token": refresh_token}
