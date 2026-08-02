from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.jwt import decode_token, verify_token_type
from app.models.core import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    from app.utils.token_blacklist import is_token_blacklisted
    if is_token_blacklisted(token):
        raise credentials_exception
        
    payload = decode_token(token)
    if not payload or not verify_token_type(payload, "access"):
        raise credentials_exception
    
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
        
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
        
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
