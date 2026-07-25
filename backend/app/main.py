import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import engine, Base, get_db
from app.models import search_entities, payments
from app.routes import auth, wallet, agents, voice, showcase, bookings, search, tracker, mybiz, wishlist, admin_panel, media, payments as payments_routes
from fastapi.staticfiles import StaticFiles
import os
from app.ml import fraud_model
from app.rag.retriever import rag_system
from app.utils.websocket_gateway import ws_gateway
import asyncio

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "name": "%(name)s", "message": "%(message)s"}'
)

logger = logging.getLogger("travel_os")

app = FastAPI(
    title="Travel OS API",
    description="Backend AI-First Travel Operating System Monolith",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify front-end hosting domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom CORS/Origin restriction for admin endpoints
@app.middleware("http")
async def restrict_admin_origin_middleware(request, call_next):
    if request.url.path.startswith("/api/admin"):
        origin = request.headers.get("origin")
        if origin is not None:
            allowed_origins = os.getenv(
                "ADMIN_ALLOWED_ORIGINS",
                "http://localhost:5174,https://admin.travelos.com,http://localhost:3000,http://127.0.0.1:5174"
            ).split(",")
            allowed_origins = [o.strip() for o in allowed_origins]
            if origin not in allowed_origins:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"Access denied: Origin '{origin}' is not allowed for Admin API calls."}
                )
    return await call_next(request)

# Include Route subtrees
app.include_router(auth.router, prefix="/api/v1")
app.include_router(wallet.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(fraud_model.router, prefix="/api/v1")
app.include_router(voice.router, prefix="/api/v1")
app.include_router(showcase.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(tracker.router, prefix="/api/v1")
app.include_router(mybiz.router, prefix="/api/v1")
app.include_router(wishlist.router, prefix="/api/v1")
app.include_router(admin_panel.router, prefix="/api")
app.include_router(admin_panel.admin_auth_router, prefix="/api")
app.include_router(media.router, prefix="/api/v1")
app.include_router(payments_routes.router, prefix="/api/v1")

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def startup_db_seed():
    logger.info("Initializing database schemas...")
    # Create tables locally if not using migrations in dev mode
    Base.metadata.create_all(bind=engine)
    
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
        test_user = db.query(User).filter(User.id == 1).first()
        if not test_user:
            test_user = User(
                id=1,
                email="admin_test@travelos.com",
                role="finance_admin",
                trust_score=Decimal("4.80"),
                password_hash=hash_password("adminpass123")
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
            
            # Seed wallet
            wallet = WalletAccount(user_id=test_user.id, balance=Decimal("150000.00"), currency="INR")
            db.add(wallet)
            db.commit()
        elif not test_user.password_hash:
            test_user.password_hash = hash_password("adminpass123")
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
                gross_bookings_amount=Decimal("35000.00"),
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

    logger.info("Seeding verified travel rules in RAG vector database...")
    try:
        rag_system.seed_Schengen_visa_data()
        logger.info("RAG pre-seeding successful.")
    except Exception as e:
        logger.warning(f"Could not pre-seed RAG database on startup: {e}")

@app.get("/healthz", tags=["monitoring"])
def health_check(db: Session = Depends(get_db)):
    """Liveness probe validating API health and DB connectivity"""
    try:
        # Trivial DB execution check
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

# Helper import inside function or use standard text
from sqlalchemy import text
