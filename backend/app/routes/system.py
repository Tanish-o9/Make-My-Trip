from fastapi import APIRouter
from app.database import SessionLocal
from app.utils.redis_client import redis_client
import os
import logging
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["system"])


def _key_set(*keys) -> bool:
    """Returns True if ALL keys are non-empty and non-placeholder."""
    placeholders = {"", "your-key", "your-amadeus-id", "your-amadeus-secret",
                    "your-google-maps-key", "your-openweather-key", "your-exchange-rate-key",
                    "your-resend-key", "your-sendgrid-key", "your-twilio-sid",
                    "your-twilio-token", "your-twilio-number", "your-groq-key",
                    "your-rapidapi-key", "your-firebase-key", "your-geoapify-key"}
    return all(k and k.strip() not in placeholders for k in keys)


@router.get("/provider-health")
async def get_provider_health():
    """
    Extended provider health check for all 12 integrated services.
    Returns 'healthy' when keys are configured, 'unconfigured' when keys are placeholder/absent,
    and 'unhealthy' when the service responds with an error.
    """
    health = {}

    # ── 1. Database ──────────────────────────────────────────
    try:
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        health["database"] = "healthy"
    except Exception as e:
        logger.error(f"DB health check failed: {e}")
        health["database"] = "unhealthy"

    # ── 2. Redis ─────────────────────────────────────────────
    if redis_client:
        try:
            redis_client.ping()
            health["redis"] = "healthy"
        except Exception:
            health["redis"] = "unhealthy"
    else:
        health["redis"] = "unconfigured (in-memory fallback active)"

    # ── 3. Amadeus ───────────────────────────────────────────
    cid = os.getenv("AMADEUS_CLIENT_ID", "")
    csec = os.getenv("AMADEUS_CLIENT_SECRET", "")
    if _key_set(cid, csec):
        try:
            env = os.getenv("AMADEUS_ENV", "test").lower()
            base = "https://api.amadeus.com" if env == "production" else "https://test.api.amadeus.com"
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{base}/v1/security/oauth2/token",
                    data={"grant_type": "client_credentials", "client_id": cid, "client_secret": csec},
                    timeout=4.0,
                )
                health["amadeus"] = "healthy" if resp.status_code == 200 else f"unhealthy (HTTP {resp.status_code})"
        except Exception as e:
            health["amadeus"] = f"unhealthy ({str(e)[:60]})"
    else:
        health["amadeus"] = "unconfigured"

    # ── 4. Google Maps ───────────────────────────────────────
    gmaps_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if _key_set(gmaps_key):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/geocode/json",
                    params={"address": "Delhi", "key": gmaps_key},
                    timeout=4.0,
                )
                data = resp.json()
                status = data.get("status", "")
                if status in ("OK", "ZERO_RESULTS"):
                    health["google_maps"] = "healthy"
                elif status == "REQUEST_DENIED":
                    health["google_maps"] = "unhealthy (API key rejected)"
                else:
                    health["google_maps"] = f"unhealthy ({status})"
        except Exception as e:
            health["google_maps"] = f"unhealthy ({str(e)[:60]})"
    else:
        health["google_maps"] = "unconfigured"

    # ── 5. OpenWeather ───────────────────────────────────────
    ow_key = os.getenv("OPENWEATHER_API_KEY", "")
    if _key_set(ow_key):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.openweathermap.org/data/2.5/weather",
                    params={"q": "Delhi", "appid": ow_key},
                    timeout=4.0,
                )
                health["openweather"] = "healthy" if resp.status_code == 200 else f"unhealthy (HTTP {resp.status_code})"
        except Exception as e:
            health["openweather"] = f"unhealthy ({str(e)[:60]})"
    else:
        health["openweather"] = "unconfigured"

    # ── 6. ExchangeRate ──────────────────────────────────────
    er_key = os.getenv("EXCHANGE_RATE_API_KEY", "")
    if _key_set(er_key):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://v6.exchangerate-api.com/v6/{er_key}/pair/USD/INR",
                    timeout=4.0,
                )
                data = resp.json()
                health["currency"] = "healthy" if data.get("result") == "success" else f"unhealthy ({data.get('error-type', 'unknown')})"
        except Exception as e:
            health["currency"] = f"unhealthy ({str(e)[:60]})"
    else:
        health["currency"] = "unconfigured (static fallback active)"

    # ── 7. Resend (Email) ────────────────────────────────────
    resend_key = os.getenv("RESEND_API_KEY", "")
    if _key_set(resend_key):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.resend.com/domains",
                    headers={"Authorization": f"Bearer {resend_key}"},
                    timeout=4.0,
                )
                health["resend"] = "healthy" if resp.status_code in (200, 404) else f"unhealthy (HTTP {resp.status_code})"
        except Exception as e:
            health["resend"] = f"unhealthy ({str(e)[:60]})"
    else:
        health["resend"] = "unconfigured"

    # ── 8. Twilio (SMS) ──────────────────────────────────────
    tw_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    tw_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    if _key_set(tw_sid, tw_token):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://api.twilio.com/2010-04-01/Accounts/{tw_sid}.json",
                    auth=(tw_sid, tw_token),
                    timeout=4.0,
                )
                health["twilio"] = "healthy" if resp.status_code == 200 else f"unhealthy (HTTP {resp.status_code})"
        except Exception as e:
            health["twilio"] = f"unhealthy ({str(e)[:60]})"
    else:
        health["twilio"] = "unconfigured"

    # ── 9. Firebase FCM ──────────────────────────────────────
    fb_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    fb_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    if _key_set(fb_json) or (fb_path and __import__("os").path.exists(fb_path)):
        health["firebase"] = "healthy (credentials configured)"
    else:
        health["firebase"] = "unconfigured"

    # ── 10. Groq (LLM) ───────────────────────────────────────
    groq_key = os.getenv("GROQ_API_KEY", "")
    if _key_set(groq_key):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {groq_key}"},
                    timeout=4.0,
                )
                health["groq"] = "healthy" if resp.status_code == 200 else f"unhealthy (HTTP {resp.status_code})"
        except Exception as e:
            health["groq"] = f"unhealthy ({str(e)[:60]})"
    else:
        health["groq"] = "unconfigured"

    # ── 11. ChromaDB ──────────────────────────────────────────
    chroma_host = os.getenv("CHROMADB_HOST", "localhost")
    chroma_port = os.getenv("CHROMADB_PORT", "8004")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"http://{chroma_host}:{chroma_port}/api/v1/heartbeat", timeout=2.0)
            health["chromadb"] = "healthy" if resp.status_code == 200 else "unhealthy"
    except Exception:
        health["chromadb"] = "unconfigured (mock RAG active)"

    # ── 12. RapidAPI ─────────────────────────────────────────
    rapid_key = os.getenv("RAPIDAPI_KEY", "")
    if _key_set(rapid_key):
        health["rapidapi"] = "healthy (key configured)"
    else:
        health["rapidapi"] = "unconfigured"

    # ── 13. Duffel ───────────────────────────────────────────
    from app.payments.config import settings
    dkey = settings.DUFFEL_API_KEY
    dbase = settings.DUFFEL_BASE_URL or "https://api.duffel.com"
    dver = settings.DUFFEL_VERSION or "v2"

    duffel_diag = {
        "provider": "Duffel",
        "configured": False,
        "healthy": False,
        "base_url": dbase,
        "version": dver,
        "status": "MISSING_CREDENTIALS",
        "authentication": "FAIL"
    }

    if not dkey or dkey.strip() in ["", "your-duffel-key"]:
        duffel_diag["status"] = "MISSING_CREDENTIALS"
        duffel_diag["reason"] = "Missing API Key"
    else:
        duffel_diag["configured"] = True
        duffel_diag["status"] = "CONFIGURED"
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{dbase}/air/airlines",
                    params={"limit": "1"},
                    headers={
                        "Authorization": f"Bearer {dkey}",
                        "Duffel-Version": dver
                    },
                    timeout=3.0
                )
                if resp.status_code == 200:
                    duffel_diag["healthy"] = True
                    duffel_diag["status"] = "AUTHENTICATED"
                    duffel_diag["authentication"] = "PASS"
                elif resp.status_code in (401, 403):
                    duffel_diag["status"] = "UNAUTHORIZED"
                    duffel_diag["reason"] = f"API returned HTTP {resp.status_code}"
                else:
                    duffel_diag["status"] = "NETWORK_ERROR"
                    duffel_diag["reason"] = f"API returned HTTP {resp.status_code}"
        except httpx.RequestError as e:
            duffel_diag["status"] = "NETWORK_ERROR"
            duffel_diag["reason"] = str(e)[:60]
        except Exception as e:
            duffel_diag["status"] = "NETWORK_ERROR"
            duffel_diag["reason"] = str(e)[:60]

    health["duffel"] = duffel_diag

    # ── 14. Razorpay ──────────────────────────────────────────
    from app.payments.client import check_razorpay_health
    rzp_health = check_razorpay_health()
    health["razorpay"] = {
        "provider": "Razorpay",
        "configured": rzp_health.get("success", False),
        "healthy": rzp_health.get("success", False),
        "environment": "LIVE" if rzp_health.get("mode") == "live" else "SANDBOX",
        "authentication": "PASS" if rzp_health.get("success") else "FAIL",
        "payment": "ENABLED" if rzp_health.get("success") else "DISABLED",
        "webhook": "PASS" if os.getenv("RAZORPAY_WEBHOOK_SECRET") else "FAIL"
    }

    # ── 15. Nodemailer (OTP Email) ─────────────────────────────
    from app.services.communication import get_email_provider, NodemailerEmailProvider
    email_prov = get_email_provider()
    is_nodemailer = isinstance(email_prov, NodemailerEmailProvider)
    health["nodemailer"] = {
        "provider": "Nodemailer",
        "configured": email_prov._is_configured() if is_nodemailer else True,
        "healthy": email_prov._is_configured() if is_nodemailer else True,
        "environment": "SANDBOX" if is_nodemailer and not email_prov._is_configured() else "PRODUCTION",
        "authentication": "PASS" if not is_nodemailer or email_prov._is_configured() else "FAIL",
        "email_delivery": "ENABLED" if not is_nodemailer or email_prov._is_configured() else "DISABLED"
    }

    # Summary
    configured_count = sum(1 for v in health.values() if v == "healthy" or "configured)" in v or (isinstance(v, dict) and v.get("configured") is True))
    total = len(health)

    return {
        **health,
        "fallback_enabled": True,
        "summary": f"{configured_count}/{total} providers healthy/configured",
    }
