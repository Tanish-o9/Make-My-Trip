from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.jwt import decode_token, verify_token_type
from app.models.core import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    from app.utils.token_blacklist import is_token_blacklisted
    import logging
    logger = logging.getLogger("travel_os")
    
    # Audit: Log path and header keys
    logger.info(f"AUDIT get_current_user path: {request.url.path}, headers: {list(request.headers.keys())}")
    
    from app.auth.jwt import JWT_SECRET, ALGORITHM
    from jose import jwt, JWTError
    
    # 4. Logger debug details
    secret_prefix = JWT_SECRET[:4] if JWT_SECRET else "None"
    logger.debug(f"SECRET_KEY prefix: '{secret_prefix}...' (len={len(JWT_SECRET)})")
    logger.debug(f"ALGORITHM: '{ALGORITHM}'")
    
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    
    if not auth_header:
        logger.warning(f"AUDIT get_current_user: Missing Authorization header. Available: {list(request.headers.keys())}")
        raise HTTPException(
            status_code=401,
            detail=f"Missing Authorization Header. Received headers: {list(request.headers.keys())}"
        )
        
    if not auth_header.startswith("Bearer "):
        logger.warning(f"AUDIT get_current_user: Invalid format for header: {auth_header[:15]}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid Authorization Header format. Must start with 'Bearer '. Value starts with: '{auth_header[:15]}'"
        )
        
    token = auth_header.split(" ")[1]
    
    if is_token_blacklisted(token):
        logger.warning("AUDIT get_current_user: Token is blacklisted")
        raise HTTPException(status_code=401, detail="Token is blacklisted")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        logger.debug(f"Decoded JWT Payload - sub: '{payload.get('sub')}', role: '{payload.get('role')}', type: '{payload.get('type')}', exp: {payload.get('exp')}")
        
    except JWTError as e:
        exception_name = type(e).__name__
        logger.error(f"Exception inside get_current_user: {exception_name} - {str(e)}")
        raise HTTPException(
            status_code=401,
            detail=f"JWT Decode Error ({exception_name}): {str(e)} (Secret prefix: {secret_prefix}, Token len: {len(token)})"
        )
    except Exception as e:
        exception_name = type(e).__name__
        logger.error(f"Exception inside get_current_user: {exception_name} - {str(e)}")
        raise HTTPException(
            status_code=401,
            detail=f"JWT Decode Unhandled Exception ({exception_name}): {str(e)}"
        )
        
    if not payload.get("type") == "access":
        logger.error(f"Exception inside get_current_user: InvalidTokenType - expected 'access', got '{payload.get('type')}'")
        raise HTTPException(status_code=401, detail=f"InvalidTokenType: expected 'access', got '{payload.get('type')}'")
    
    email: str = payload.get("sub")
    if email is None:
        logger.error("Exception inside get_current_user: TokenPayloadMissingSub")
        raise HTTPException(status_code=401, detail="TokenPayloadMissingSub: Token payload missing 'sub'")
        
    user = db.query(User).filter(User.email == email).first()
    
    if user is None:
        driver = db.bind.url.drivername if db.bind else "unknown"
        db_url = str(db.bind.url) if db.bind else "unknown"
        if "@" in db_url:
            db_url = db_url.split("@")[1]
        logger.error(f"Exception inside get_current_user: UserNotFound - '{email}' not found in DB")
        raise HTTPException(
            status_code=401, 
            detail=f"UserNotFound: Authenticated user '{email}' not found in database (Engine: {driver}, Host: {db_url})"
        )
    else:
        logger.debug(f"Database lookup for email '{email}': User found (id={user.id}, role={user.role})")

        
    logger.info(f"AUDIT get_current_user: Successfully resolved user: id={user.id}, email={user.email}, role={user.role}")
        
    from app.utils.logging_config import user_id_ctx_var
    user_id_ctx_var.set(str(user.id))
    
    return user


def get_current_admin(request: Request, db: Session = Depends(get_db)) -> User:
    user = get_current_user(request, db)
    allowed_roles = ["admin", "super_admin", "finance_admin", "approver", "booking_approver"]
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User does not have administrative privileges."
        )
    return user
