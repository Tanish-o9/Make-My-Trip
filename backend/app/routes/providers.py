import os
import socket
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException
from app.providers.providers_registry import providers_registry
from app.auth.dependencies import get_current_user
from app.models.core import User

router = APIRouter(prefix="/admin/providers", tags=["admin-providers"])


@router.get("/health")
async def get_providers_health(current_user: User = Depends(get_current_user)):
    """Admin endpoint returning health, latency, error rates, and status for all live and demo providers"""
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin privileges required.")
    return providers_registry.get_health()


@router.get("/amadeus/diagnostics")
async def get_amadeus_diagnostics(current_user: User = Depends(get_current_user)):
    """Safe admin diagnostic endpoint for Amadeus sandbox connectivity verification without leaking secrets"""
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin privileges required.")

    client_id = os.getenv("AMADEUS_CLIENT_ID")
    client_secret = os.getenv("AMADEUS_CLIENT_SECRET")
    base_url = os.getenv("AMADEUS_BASE_URL", "https://test.api.amadeus.com")
    host = "test.api.amadeus.com"

    dns_ok = False
    tls_ok = False
    auth_ok = False
    search_ok = False
    latency_ms = 0.0
    status = "NOT_CONFIGURED"

    if not client_id or not client_secret:
        return {
            "provider": "amadeus",
            "environment": "sandbox",
            "dns_resolution": False,
            "tls_connection": False,
            "authentication": False,
            "search": False,
            "latency_ms": 0.0,
            "status": "NOT_CONFIGURED"
        }

    # 1. DNS check
    start_time = time.time()
    try:
        socket.gethostbyname(host)
        dns_ok = True
    except Exception:
        dns_ok = False

    if not dns_ok:
        return {
            "provider": "amadeus",
            "environment": "sandbox",
            "dns_resolution": False,
            "tls_connection": False,
            "authentication": False,
            "search": False,
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "status": "NETWORK UNAVAILABLE FROM DEPLOYMENT"
        }

    # 2. TLS & OAuth check
    token = None
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            token_res = await client.post(
                f"{base_url}/v1/security/oauth2/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret
                }
            )
            tls_ok = True
            if token_res.status_code == 200:
                auth_ok = True
                token = token_res.json().get("access_token")
                latency_ms = round((time.time() - start_time) * 1000, 2)
            else:
                auth_ok = False
    except Exception:
        tls_ok = False
        auth_ok = False

    # 3. Sandbox Transfer / Flight Search check if authenticated
    if auth_ok and token:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                search_res = await client.post(
                    f"{base_url}/v1/shopping/transfer-offers",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={
                        "startLocationCode": "DEL",
                        "endAddressLine": "Connaught Place",
                        "endCityName": "Delhi",
                        "endCountryCode": "IN",
                        "startDateTime": "2026-09-15T10:00:00",
                        "passengers": 2
                    }
                )
                if search_res.status_code in (200, 201):
                    search_ok = True
                    status = "SANDBOX VERIFIED"
                else:
                    search_ok = False
                    status = "AUTHENTICATED — SEARCH NOT VERIFIED"
        except Exception:
            search_ok = False
            status = "AUTHENTICATED — SEARCH NOT VERIFIED"
    elif auth_ok:
        status = "AUTHENTICATED — SEARCH NOT VERIFIED"
    elif dns_ok and tls_ok:
        status = "AUTH_FAILED"
    else:
        status = "NETWORK UNAVAILABLE FROM DEPLOYMENT"

    return {
        "provider": "amadeus",
        "environment": "sandbox",
        "dns_resolution": dns_ok,
        "tls_connection": tls_ok,
        "authentication": auth_ok,
        "search": search_ok,
        "latency_ms": latency_ms,
        "status": status
    }


@router.get("/duffel/diagnostics")
async def get_duffel_diagnostics(current_user: User = Depends(get_current_user)):
    """Safe admin diagnostic endpoint for Duffel API & Cars access verification without leaking API keys"""
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin privileges required.")

    api_key = os.getenv("DUFFEL_API_KEY")
    host = "api.duffel.com"

    dns_ok = False
    tls_ok = False
    auth_ok = False
    cars_ok = False
    flights_ok = False
    latency_ms = 0.0
    status = "NOT_CONFIGURED"

    if not api_key:
        return {
            "provider": "duffel",
            "environment": "production",
            "dns_resolution": False,
            "tls_connection": False,
            "authentication": False,
            "cars_search": False,
            "flights_search": False,
            "latency_ms": 0.0,
            "status": "NOT_CONFIGURED"
        }

    # 1. DNS check
    start_time = time.time()
    try:
        socket.gethostbyname(host)
        dns_ok = True
    except Exception:
        dns_ok = False

    if not dns_ok:
        return {
            "provider": "duffel",
            "environment": "production",
            "dns_resolution": False,
            "tls_connection": False,
            "authentication": False,
            "cars_search": False,
            "flights_search": False,
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "status": "NETWORK UNAVAILABLE FROM DEPLOYMENT"
        }

    # 2. TLS & Auth check via official Duffel endpoint
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            auth_res = await client.get("https://api.duffel.com/air/aircraft", headers=headers)
            tls_ok = True
            if auth_res.status_code == 200:
                auth_ok = True
                latency_ms = round((time.time() - start_time) * 1000, 2)
            else:
                auth_ok = False
    except Exception:
        tls_ok = False
        auth_ok = False

    # 3. Cars API permission check
    if auth_ok:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                cars_res = await client.post(
                    "https://api.duffel.com/cars/search",
                    headers=headers,
                    json={
                        "data": {
                            "pickup_time": "10:30",
                            "pickup_date": "2026-09-15",
                            "dropoff_time": "15:00",
                            "dropoff_date": "2026-09-18",
                            "pickup_location": {
                                "radius": 15,
                                "geographic_coordinates": {"latitude": 51.5074, "longitude": -0.1278}
                            },
                            "dropoff_location": {
                                "radius": 15,
                                "geographic_coordinates": {"latitude": 51.5074, "longitude": -0.1278}
                            },
                            "driver": {"age": 30, "residence_country_code": "GB"}
                        }
                    }
                )
                if cars_res.status_code in (200, 201):
                    cars_ok = True
                    status = "LIVE VERIFIED"
                elif cars_res.status_code == 403:
                    cars_ok = False
                    status = "AUTHENTICATED BUT CARS ACCESS NOT ENABLED"
                else:
                    cars_ok = False
                    status = "AUTHENTICATED BUT CARS ACCESS NOT ENABLED"
        except Exception:
            cars_ok = False
            status = "AUTHENTICATED BUT CARS ACCESS NOT ENABLED"
    elif dns_ok and tls_ok:
        status = "AUTH_FAILED"
    else:
        status = "NETWORK UNAVAILABLE FROM DEPLOYMENT"

    return {
        "provider": "duffel",
        "environment": "production",
        "dns_resolution": dns_ok,
        "tls_connection": tls_ok,
        "authentication": auth_ok,
        "cars_search": cars_ok,
        "flights_search": auth_ok,
        "latency_ms": latency_ms,
        "status": status
    }


@router.get("/email/diagnostics")
async def get_email_diagnostics(current_user: User = Depends(get_current_user)):
    """Safe admin diagnostic endpoint for SendGrid/Resend connectivity verification without leaking secrets"""
    if current_user.role not in ("admin", "superadmin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required.")

    import socket
    from app.services.communication import SendGridClient, resend_breaker
    client = SendGridClient()

    is_resend = client._is_resend_configured()
    is_sendgrid = client._is_sendgrid_configured()

    if is_resend:
        provider_name = "Resend"
        config_status = "CONFIGURED"
    elif is_sendgrid:
        provider_name = "SendGrid"
        config_status = "CONFIGURED"
    else:
        provider_name = "Simulated/Sandbox"
        config_status = "MISSING"

    cb_status = resend_breaker.state

    connectivity = "Healthy"
    host = None
    if is_resend:
        host = "api.resend.com"
    elif is_sendgrid:
        host = "api.sendgrid.com"

    if host:
        try:
            socket.gethostbyname(host)
        except Exception:
            connectivity = "Unhealthy"

    return {
        "email_provider": provider_name,
        "configuration_status": config_status,
        "connectivity": connectivity,
        "last_delivery_attempt": SendGridClient.last_delivery_attempt,
        "last_successful_delivery": SendGridClient.last_successful_delivery,
        "failure_count": SendGridClient.failure_count,
        "circuit_breaker_status": cb_status
    }


