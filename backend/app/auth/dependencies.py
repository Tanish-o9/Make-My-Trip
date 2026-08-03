from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.jwt import decode_token, verify_token_type
from app.models.core import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    from app.utils.token_blacklist import is_token_blacklisted
    if is_token_blacklisted(token):
        raise HTTPException(status_code=401, detail="Token is blacklisted")
        
    from app.auth.jwt import JWT_SECRET, ALGORITHM
    from jose import jwt, JWTError
    import logging
    logger = logging.getLogger("travel_os")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError as e:
        logger.error(f"JWT Decode Error on token: {e}")
        # Print first 4 chars of secret and token length for debugging
        secret_prefix = JWT_SECRET[:4] if JWT_SECRET else "None"
        raise HTTPException(
            status_code=401,
            detail=f"JWT Decode Error: {str(e)} (Secret prefix: {secret_prefix}, Token len: {len(token)})"
        )
    except Exception as e:
        logger.error(f"JWT Decode Unhandled Exception: {e}")
        raise HTTPException(status_code=401, detail=f"JWT Decode Unhandled Exception: {str(e)}")
        
    if not payload.get("type") == "access":
        raise HTTPException(status_code=401, detail=f"Invalid token type: {payload.get('type')}")
    
    email: str = payload.get("sub")
    if email is None:
        raise HTTPException(status_code=401, detail="Token payload missing 'sub'")
        
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        driver = db.bind.url.drivername if db.bind else "unknown"
        db_url = str(db.bind.url) if db.bind else "unknown"
        # Mask password in URL for logs
        if "@" in db_url:
            db_url = db_url.split("@")[1]
        raise HTTPException(
            status_code=401, 
            detail=f"Authenticated user '{email}' not found in database (Engine: {driver}, Host: {db_url})"
        )
        
    from app.utils.logging_config import user_id_ctx_var
    user_id_ctx_var.set(str(user.id))
    
    return user


def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if not payload or not verify_token_type(payload, "access"):
        raise credentials_exception
    
    token_role = payload.get("role")
    allowed_roles = ["admin", "super_admin", "finance_admin", "approver"]
    if token_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User does not have administrative privileges."
        )
        
    user = get_current_user(token, db)
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User does not have administrative privileges."
        )
    return user
