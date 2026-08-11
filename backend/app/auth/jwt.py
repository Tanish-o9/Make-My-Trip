import os
import datetime
from typing import Optional, Dict, Any
from jose import jwt, JWTError
import bcrypt

_raw_jwt_secret = os.getenv("JWT_SECRET", "").strip()
if not _raw_jwt_secret or _raw_jwt_secret in ["supersecretjwtkeychangeinproduction", "your-development-jwt-secret-key-make-it-secure", "your-production-jwt-secret-key"]:
    _env = os.getenv("ENVIRONMENT", "development").lower()
    if _env in ["production", "prod", "staging"] or os.getenv("RAILWAY_ENVIRONMENT") is not None:
        raise RuntimeError("CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable must be configured in production/staging environments to prevent token forgery.")
    else:
        JWT_SECRET = "supersecretjwtkeychangeinproduction"
else:
    JWT_SECRET = _raw_jwt_secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

import uuid

def create_access_token(data: Dict[str, Any], expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + datetime.timedelta(minutes=15)  # 15 minutes standard
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": "access"
    })
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + datetime.timedelta(days=7)  # 7 days standard
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": "refresh"
    })
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return {}

def verify_token_type(payload: Dict[str, Any], expected_type: str) -> bool:
    return payload.get("type") == expected_type

def hash_token(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

