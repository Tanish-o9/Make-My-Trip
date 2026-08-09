import os
import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware


from sqlalchemy.orm import Session
from dotenv import load_dotenv
import sentry_sdk

# Load environment variables from .env BEFORE anything else
load_dotenv()

# Sentry initialization
sentry_dsn = os.getenv("SENTRY_DSN", "").strip()
if sentry_dsn and sentry_dsn != "your-sentry-dsn":
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

from app.database import engine, Base, get_db
from app.models import search_entities, payments
from app.routes import auth, wallet, agents, voice, showcase, bookings, search, tracker, mybiz, wishlist, admin_panel, media, rent_a_ride, localities, payments as payments_routes, webhooks, profile, flights, hotels, weather, maps, system, currency, notifications, cabs, activities, visa, insurance, forex, esim, documents, loyalty, crm, insights, saas_routes, gateway, partner, feedback
from fastapi.staticfiles import StaticFiles
import os
from app.ml import fraud_model
from app.rag.retriever import rag_system
from app.utils.websocket_gateway import ws_gateway
import asyncio

from app.utils.logging_config import setup_structured_logging, request_id_ctx_var, user_id_ctx_var
import uuid

# Configure structured logging
setup_structured_logging()
logger = logging.getLogger("travel_os")

app = FastAPI(
    title="Travel OS API",
    description="Backend AI-First Travel Operating System Monolith",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS Configuration - Strict whitelist loading from environment variable
allowed_origins_str = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,https://make-my-trip-delta.vercel.app"
)
origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|.*\.vercel\.app|.*\.up\.railway\.app)(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Device-Id", "X-Tenant-ID", "X-Request-ID"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)



# Custom CORS/Origin restriction for admin endpoints
@app.middleware("http")
async def restrict_admin_origin_middleware(request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    if request.url.path.startswith("/api/admin"):
        origin = request.headers.get("origin")
        if origin is not None:
            allowed_origins = os.getenv(
                "ADMIN_ALLOWED_ORIGINS",
                "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,https://make-my-trip-delta.vercel.app,https://admin.travelos.com"
            ).split(",")
            allowed_origins = [o.strip() for o in allowed_origins]
            if origin not in allowed_origins:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"Access denied: Origin '{origin}' is not allowed for Admin API calls."}
                )
    return await call_next(request)

# Secure Headers Middleware
@app.middleware("http")
async def add_secure_headers_middleware(request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data:; frame-ancestors 'none';"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Tenant Isolation Middleware
@app.middleware("http")
async def tenant_isolation_middleware_hook(request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    from app.utils.tenant_context import tenant_isolation_middleware
    return await tenant_isolation_middleware(request, call_next)

# Request ID, Context and Metrics Middleware
@app.middleware("http")
async def request_id_middleware(request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    from app.utils.metrics import API_RESPONSE_TIMES, HTTP_REQUESTS_TOTAL
    from app.utils.rate_limit import global_rate_limiter, llm_rate_limiter
    from fastapi.responses import JSONResponse
    import time
    
    start_time = time.time()
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request_id_token = request_id_ctx_var.set(request_id)
    user_id_token = user_id_ctx_var.set("anonymous")
    
    logger = logging.getLogger("travel_os")
    if "/payments/create-order" in request.url.path or "/create-order" in request.url.path:
        logger.info(f"AUDIT [create-order] headers: {dict(request.headers)}")

    # 1. Rate Limiting Check (bypass documentation/metrics/health checks and pytest runs)
    path = request.url.path
    import sys
    is_testing = "pytest" in sys.modules
    if not is_testing and request.method != "OPTIONS" and not any(path.startswith(p) for p in ["/metrics", "/healthz", "/static", "/api/docs", "/api/openapi.json"]):
        # Extract client IP
        forwarded = request.headers.get("X-Forwarded-For")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
        
        # Apply rate limits
        if "/agents/chat" in path:
            allowed, remaining = llm_rate_limiter.is_allowed(client_ip, rate_limit=15, refill_period=60)
            limit_max = 15
        else:
            allowed, remaining = global_rate_limiter.is_allowed(client_ip, rate_limit=60, refill_period=60)
            limit_max = 60
            
        if not allowed:
            logger.warning(f"Rate limit exceeded for IP: {client_ip} on path: {path}")
            HTTP_REQUESTS_TOTAL.labels(endpoint=path, method=request.method, status="429").inc()
            request_id_ctx_var.reset(request_id_token)
            user_id_ctx_var.reset(user_id_token)
            return JSONResponse(
                status_code=429,
                content={
                    "error_code": "TOO_MANY_REQUESTS",
                    "message": f"Rate limit exceeded. Maximum {limit_max} requests per minute are allowed.",
                    "request_id": request_id
                }
            )

    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        # Observe response times and request count
        if path != "/metrics":
            latency = time.time() - start_time
            API_RESPONSE_TIMES.labels(endpoint=path, method=request.method).observe(latency)
            HTTP_REQUESTS_TOTAL.labels(endpoint=path, method=request.method, status=str(response.status_code)).inc()
            
        return response
    except Exception as exc:
        HTTP_REQUESTS_TOTAL.labels(endpoint=path, method=request.method, status="500").inc()
        raise exc
    finally:
        request_id_ctx_var.reset(request_id_token)
        user_id_ctx_var.reset(user_id_token)


from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    request_id = request_id_ctx_var.get() or "system"
    logger.error(f"Validation error: {exc.errors()}. Request ID: {request_id}")
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": "Invalid request payload or query parameters.",
            "detail": exc.errors(),
            "details": exc.errors(),
            "request_id": request_id
        }
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    request_id = request_id_ctx_var.get() or "system"
    logger.warning(f"HTTP error {exc.status_code}: {exc.detail}. Request ID: {request_id}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": f"HTTP_{exc.status_code}",
            "message": exc.detail,
            "detail": exc.detail,
            "request_id": request_id
        }
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    request_id = request_id_ctx_var.get() or "system"
    logger.error(f"[ERROR_TRACKING_OUTAGE] Unhandled exception occurred: {exc}. Request ID: {request_id}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred. Please contact support and reference the Request ID.",
            "detail": "An unexpected error occurred. Please contact support and reference the Request ID.",
            "request_id": request_id
        }
    )

# Include Route subtrees
app.include_router(auth.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(wallet.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(fraud_model.router, prefix="/api/v1")
app.include_router(voice.router, prefix="/api/v1")
app.include_router(showcase.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(saas_routes.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(tracker.router, prefix="/api/v1")
app.include_router(mybiz.router, prefix="/api/v1")
app.include_router(wishlist.router, prefix="/api/v1")
app.include_router(admin_panel.router, prefix="/api")
app.include_router(admin_panel.admin_auth_router, prefix="/api")
app.include_router(media.router, prefix="/api/v1")
app.include_router(payments_routes.router, prefix="/api/v1")
app.include_router(rent_a_ride.router, prefix="/api/v1")
app.include_router(localities.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(flights.router, prefix="/api/flights")
app.include_router(flights.router, prefix="/api/v1/flights")
app.include_router(hotels.router, prefix="/api/hotels")
app.include_router(hotels.router, prefix="/api/v1/hotels")
app.include_router(weather.router, prefix="/api/weather")
app.include_router(weather.router, prefix="/api/v1/weather")
app.include_router(maps.router, prefix="/api/maps")
app.include_router(maps.router, prefix="/api/v1/maps")
app.include_router(system.router, prefix="/api")
app.include_router(system.router, prefix="/api/v1")
app.include_router(currency.router, prefix="/api")
app.include_router(currency.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(cabs.router, prefix="/api/v1")
app.include_router(activities.router, prefix="/api/v1")
app.include_router(visa.router, prefix="/api/v1")
app.include_router(insurance.router, prefix="/api/v1")
app.include_router(forex.router, prefix="/api/v1")
app.include_router(esim.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(loyalty.router, prefix="/api/v1")
app.include_router(crm.router, prefix="/api/v1")
app.include_router(insights.router, prefix="/api/v1")
app.include_router(gateway.router, prefix="/api/v1")
app.include_router(partner.router, prefix="/api/v1")
app.include_router(feedback.router, prefix="/api/v1")

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def startup_db_seed():
    # ── Startup Environment Variable Validation ──
    critical_missing = []
    
    # 1. DATABASE_URL check
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url or "placeholder" in db_url:
        critical_missing.append("DATABASE_URL")
        
    # 2. JWT_SECRET check
    jwt_sec = os.getenv("JWT_SECRET", "").strip()
    is_prod = os.getenv("PRODUCTION", "false").lower() == "true" or "neon" in db_url
    if not jwt_sec or (is_prod and jwt_sec in ["supersecretjwtkeychangeinproduction", "your-development-jwt-secret-key-make-it-secure"]):
        import secrets
        generated_secret = secrets.token_hex(32)
        os.environ["JWT_SECRET"] = generated_secret
        logger.warning("JWT_SECRET was not set or insecure in production. Generated a secure fallback random secret.")

    # 3. REDIS_URL check
    redis_url = os.getenv("REDIS_URL", "").strip()
    if not redis_url:
        logger.warning("REDIS_URL is not configured. Running without Redis cache fallback.")

    # 4. LLM provider check
    llm_keys = ["GROQ_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]
    configured_llm = False
    for k in llm_keys:
        val = os.getenv(k, "").strip()
        if val and not any(p in val.lower() for p in ["your-", "placeholder", "todo", "example"]):
            configured_llm = True
            break
    if not configured_llm:
        logger.warning("No active LLM API Key is configured. AI Chat/Agent features will be disabled.")

    if critical_missing:
        err_msg = f"CRITICAL ENV CONFIGURATION FAILURE: The following environment variables are missing or unconfigured: {', '.join(critical_missing)}. Refusing to start application."
        logger.error(err_msg)
        raise SystemExit(err_msg)

    # Duffel validation print
    from app.payments.config import settings
    dkey = settings.DUFFEL_API_KEY
    dbase = settings.DUFFEL_BASE_URL
    dver = settings.DUFFEL_VERSION
    if dkey and dkey.strip() not in ["", "your-duffel-key"] and dbase and dver:
        # Mask key for diagnostics
        masked = dkey[:12] + "xxxxxxxx" + "*" * (len(dkey) - 20) if len(dkey) > 20 else "xxxx"
        logger.info(f"Duffel configuration loaded. Base URL: {dbase}, Version: {dver}, Key: {masked}")
        try:
            print("✓ Duffel Provider Loaded")
        except UnicodeEncodeError:
            print("Duffel Provider Loaded")
    else:
        try:
            print("⚠ Duffel Provider Disabled")
        except UnicodeEncodeError:
            print("Duffel Provider Disabled")

    logger.info("Initializing database schemas...")
    # Create tables locally if using SQLite database
    if "sqlite" in str(engine.url):
        Base.metadata.create_all(bind=engine)

    # Check if database is unseeded, and if so, run full seeding sequence automatically!
    from app.database import SessionLocal
    from app.models.search_entities import City, HotelProperty
    db_init = SessionLocal()
    try:
        from app.models.bookings import SpecialFareConfig
        if db_init.query(SpecialFareConfig).count() == 0:
            logger.info("Pre-seeding default Special Fare Configurations...")
            defaults = [
                SpecialFareConfig(fare_type="regular", discount_percent=0.0, minimum_age=None, maximum_age=None, verification_required=False, active=True),
                SpecialFareConfig(fare_type="student", discount_percent=10.0, minimum_age=5, maximum_age=30, verification_required=True, active=True),
                SpecialFareConfig(fare_type="senior", discount_percent=5.0, minimum_age=60, maximum_age=None, verification_required=False, active=True),
                SpecialFareConfig(fare_type="armed_forces", discount_percent=10.0, minimum_age=None, maximum_age=None, verification_required=True, active=True)
            ]
            db_init.add_all(defaults)
            db_init.commit()
            logger.info("Special Fare Configurations seeded successfully!")

        if db_init.query(City).count() < 22 or db_init.query(HotelProperty).count() < 550:
            logger.info("Database has incomplete cities or hotel properties. Triggering automatic database seeding...")
            from app.commands.seed import (
                run_reference, run_locations, run_flights, run_hotels,
                run_villas, run_packages, run_trains, run_buses, run_cabs,
                run_rental_vehicles, run_tours, run_cruises, run_insurance,
                run_content, run_users
            )
            run_reference()
            run_locations()
            run_flights()
            run_hotels()
            run_villas()
            run_packages()
            run_trains()
            run_buses()
            run_cabs()
            run_rental_vehicles()
            run_tours()
            run_cruises()
            run_insurance()
            run_content()
            run_users()
            logger.info("Automatic database seeding completed successfully!")
    except Exception as seed_err:
        logger.error(f"Failed during automatic database seeding on startup: {seed_err}", exc_info=True)
    finally:
        db_init.close()
    
    # Pre-seed default pending approvals for the Admin Queue
    from app.database import SessionLocal
    from app.models.payments import ApprovalRequest, VendorPayout, Dispute, AutoApprovalRule
    from app.models.bookings import FlightBooking, BookingStatus
    from app.models.core import User, WalletAccount
    import datetime
    from decimal import Decimal
    
    db = SessionLocal()
    try:
        # Seed default auto-approval rules if empty
        if db.query(AutoApprovalRule).count() == 0:
            logger.info("Pre-seeding default conservative auto-approval rule...")
            rule = AutoApprovalRule(
                applies_to="all",
                max_amount=Decimal("5000.00"),
                min_user_trust_score=Decimal("4.00"),
                requires_clean_fraud_check=True,
                active=False
            )
            db.add(rule)
            db.commit()

        # Seed test user if not exist
        from app.auth.jwt import hash_password
        admin_email = os.getenv("ADMIN_SEED_EMAIL", "admin_test@travelos.com")
        admin_password = os.getenv("ADMIN_SEED_PASSWORD", "adminpass123")
        
        # Query by email first to avoid unique constraint violations
        test_user = db.query(User).filter(User.email == admin_email).first()
        if not test_user:
            # Check if id=1 is already taken by some other email
            id_one_user = db.query(User).filter(User.id == 1).first()
            if not id_one_user:
                test_user = User(
                    id=1,
                    email=admin_email,
                    role="finance_admin",
                    trust_score=Decimal("4.80"),
                    password_hash=hash_password(admin_password)
                )
            else:
                test_user = User(
                    email=admin_email,
                    role="finance_admin",
                    trust_score=Decimal("4.80"),
                    password_hash=hash_password(admin_password)
                )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
            
            # Seed wallet if not exists
            if not db.query(WalletAccount).filter(WalletAccount.user_id == test_user.id).first():
                wallet = WalletAccount(user_id=test_user.id, balance=Decimal("150000.00"), currency="INR")
                db.add(wallet)
                db.commit()
        else:
            # Update password and role if needed
            test_user.role = "finance_admin"
            test_user.password_hash = hash_password(admin_password)
            db.commit()


        # Seed approval requests if empty
        if db.query(ApprovalRequest).count() == 0:
            logger.info("Pre-seeding mock pending approval requests for the Admin Console...")
            
            # 1. Suspicious Fraud Review Case
            fb = FlightBooking(
                booking_reference="BK-FRD-998",
                user_id=1,
                status=BookingStatus.PENDING_APPROVAL,
                total_amount=Decimal("18500.00"),
                origin="DEL", destination="DXB",
                departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=10),
                arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=10, hours=4),
                airline_code="EK", flight_number="512",
                pricing_snapshot={"base": 16000.0, "tax": 2500.0, "discount": 0.0},
                passenger_details=[{"name": "John Doe", "age": 34}]
            )
            db.add(fb)
            db.commit()
            
            req1 = ApprovalRequest(
                request_type="fraud_review",
                reference_id="BK-FRD-998",
                requested_by="system_fraud_guard",
                amount=18500.00,
                reason="Fraud review: Risk score exceeds threshold. Card billing country mismatch with user IP.",
                status="PENDING"
            )
            db.add(req1)
            
            # 2. High-value Payout Case
            vp = VendorPayout(
                vendor_id="host_premium",
                gross_bookings_amount=Decimal("3500.00"),
                commission_deducted=Decimal("3500.00"),
                net_payout_amount=Decimal("31500.00"),
                period="2026-31",
                status="pending_approval"
            )
            db.add(vp)
            db.commit()
            
            req2 = ApprovalRequest(
                request_type="high_value_payout",
                reference_id=str(vp.id),
                requested_by="payout_scheduler",
                amount=31500.00,
                reason="Vendor host_premium payout of ₹31,500 net exceeds automated clearance threshold of ₹25,000.",
                status="PENDING"
            )
            db.add(req2)
            
            # 3. Dispute/Chargeback Claim Case
            disp = Dispute(
                booking_reference="BK-DSP-404",
                amount=Decimal("4500.00"),
                reason_code="unrecognized_charge",
                status="under_review",
                evidence_due_by=datetime.datetime.utcnow() + datetime.timedelta(days=7)
            )
            db.add(disp)
            db.commit()
            
            req3 = ApprovalRequest(
                request_type="price_drop_claim_dispute",
                reference_id=str(disp.id),
                requested_by="stripe_webhook",
                amount=4500.00,
                reason="Chargeback dispute raised by customer for booking BK-DSP-404 (Stripe ref: dp_101_chargeback). Reason: unrecognized charge.",
                status="PENDING"
            )
            db.add(req3)
            db.commit()
            logger.info("Pre-seeding completed successfully.")
    except Exception as e:
        logger.error(f"Failed to seed approvals: {e}")
        db.rollback()
    finally:
        db.close()
    
    logger.info("Starting WebSocket Redis Pub/Sub gateway listener...")
    try:
        ws_gateway.start_redis_listener(asyncio.get_event_loop())
    except Exception as e:
        logger.warning(f"Could not start Redis Pub/Sub gateway: {e}")

    logger.info("Initializing SLA / Timeout background checker thread...")
    try:
        from app.tasks import start_sla_daemon
        start_sla_daemon()
        logger.info("SLA background daemon started successfully.")
    except Exception as e:
        logger.warning(f"Could not start SLA background daemon: {e}")

    logger.info("Seeding verified travel rules in RAG vector database in background...")
    try:
        import threading
        thread = threading.Thread(target=rag_system.seed_Schengen_visa_data, daemon=True)
        thread.start()
        logger.info("RAG pre-seeding background thread started.")
    except Exception as e:
        logger.warning(f"Could not start RAG pre-seeding background thread: {e}")

@app.on_event("shutdown")
def shutdown_event():
    logger.info("SIGTERM/SIGINT received. Initiating graceful shutdown sequence...")
    logger.info("Graceful shutdown completed successfully.")

@app.get("/docs", include_in_schema=False)
async def redirect_docs():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/docs")

@app.get("/redoc", include_in_schema=False)
async def redirect_redoc():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/redoc")

@app.get("/openapi.json", include_in_schema=False)
async def redirect_openapi():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/openapi.json")

@app.get("/healthz", tags=["monitoring"])
def health_check():
    """Liveness probe validating API health"""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=200,
        content={"status": "healthy"}
    )

@app.get("/metrics", tags=["monitoring"])
def get_metrics():
    """Prometheus metrics endpoint"""
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from fastapi import Response
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/api/v1/debug/db-stats", tags=["monitoring"])
def get_db_stats():
    """Debug route returning current database counts"""
    from app.database import SessionLocal
    from app.models.search_entities import City, HotelProperty, HotelRoom, FlightRoute, VillaProperty
    db = SessionLocal()
    try:
        return {
            "cities": db.query(City).count(),
            "hotels": db.query(HotelProperty).count(),
            "rooms": db.query(HotelRoom).count(),
            "flights": db.query(FlightRoute).count(),
            "villas": db.query(VillaProperty).count()
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()

# Helper import inside function or use standard text
from sqlalchemy import text
