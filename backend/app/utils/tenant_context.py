import logging
from contextvars import ContextVar
from fastapi import Request
from sqlalchemy.orm import Session
from app.database import SessionLocal

logger = logging.getLogger(__name__)

# Global ContextVar for the current request's tenant_id (default 1 = system tenant)
tenant_id_ctx_var: ContextVar[int] = ContextVar("tenant_id", default=1)

def get_current_tenant_id() -> int:
    """Returns the current request's scoped tenant_id."""
    return tenant_id_ctx_var.get()

async def tenant_isolation_middleware(request: Request, call_next):
    """
    Middleware to resolve the active tenant_id for the request.
    Priority:
      1. X-Tenant-ID Request Header
      2. Subdomain check (e.g. agency1.travelos.com)
      3. Custom domain lookup (mapped in database)
      4. Fallback default tenant_id = 1
    """
    tenant_id = 1
    
    # 1. Header resolution
    header_tenant = request.headers.get("X-Tenant-ID")
    if header_tenant:
        try:
            tenant_id = int(header_tenant)
        except ValueError:
            logger.warning(f"Invalid X-Tenant-ID header value: {header_tenant}")

    # 2. Host resolution (subdomain or custom domain)
    host = request.headers.get("host", "")
    if host and tenant_id == 1:
        db = SessionLocal()
        try:
            from app.models.saas import Tenant
            # Check subdomain (e.g., tenant_sub.travelos.com)
            parts = host.split(".")
            if len(parts) > 2 and parts[-2] == "travelos" and parts[-1] == "com":
                subdomain = parts[0]
                tenant = db.query(Tenant).filter(Tenant.subdomain == subdomain).first()
                if tenant:
                    tenant_id = tenant.id
            else:
                # Check custom domain lookup
                tenant = db.query(Tenant).filter(Tenant.custom_domain == host).first()
                if tenant:
                    tenant_id = tenant.id
        except Exception as e:
            logger.error(f"Error resolving tenant from host header '{host}': {e}")
        finally:
            db.close()

    # Set the ContextVar for this request
    token = tenant_id_ctx_var.set(tenant_id)
    try:
        response = await call_next(request)
        return response
    finally:
        tenant_id_ctx_var.reset(token)
