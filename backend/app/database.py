import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

import sys
DATABASE_URL = os.getenv("DATABASE_URL")
IS_EXPLICIT_DB = DATABASE_URL is not None
is_railway = os.getenv("RAILWAY_ENVIRONMENT_NAME") is not None

# Automatically switch to local SQLite database when running inside pytest
if "pytest" in sys.modules or "pytest" in "".join(sys.argv):
    DATABASE_URL = "sqlite:///./test_travel_os.db"
elif is_railway:
    if not DATABASE_URL:
        print("WARNING: DATABASE_URL is missing in Railway production environment! Falling back to local SQLite.", file=sys.stderr)
        DATABASE_URL = "sqlite:///./fallback.db"
    elif "localhost" in DATABASE_URL or "127.0.0.1" in DATABASE_URL:
        print(f"WARNING: DATABASE_URL points to localhost/127.0.0.1 in production: {DATABASE_URL}. Falling back to local SQLite.", file=sys.stderr)
        DATABASE_URL = "sqlite:///./fallback.db"
else:
    # Local development fallback
    if not DATABASE_URL:
        DATABASE_URL = "postgresql://travel_user:travel_password@localhost:5432/travel_os"

engine = None
fallback_needed = False

try:
    if "postgresql" in DATABASE_URL:
        engine = create_engine(
            DATABASE_URL,
            pool_size=int(os.getenv("DATABASE_POOL_SIZE", "15")),
            max_overflow=int(os.getenv("DATABASE_MAX_OVERFLOW", "25")),
            pool_recycle=int(os.getenv("DATABASE_POOL_RECYCLE", "1800")),
            pool_timeout=int(os.getenv("DATABASE_POOL_TIMEOUT", "30")),
            pool_pre_ping=True
        )
    else:
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
            pool_pre_ping=True
        )
    # Test connection and run auto-migration for column drift
    with engine.connect() as conn:
        from sqlalchemy import inspect, text
        try:
            inspector = inspect(engine)
            if "users" in inspector.get_table_names():
                columns = [c["name"] for c in inspector.get_columns("users")]
                if "fcm_token" not in columns:
                    print("Auto-migrating database: adding fcm_token column to users table.")
                    conn.execute(text("ALTER TABLE users ADD COLUMN fcm_token VARCHAR(512)"))
                    conn.commit()
            if "seat_holds" in inspector.get_table_names():
                columns = [c["name"] for c in inspector.get_columns("seat_holds")]
                if "seat_type" not in columns:
                    print("Auto-migrating database: adding seat_type column to seat_holds table.")
                    conn.execute(text("ALTER TABLE seat_holds ADD COLUMN seat_type VARCHAR(50)"))
                    conn.commit()
                if "price" not in columns:
                    print("Auto-migrating database: adding price column to seat_holds table.")
                    conn.execute(text("ALTER TABLE seat_holds ADD COLUMN price FLOAT"))
                    conn.commit()
        except Exception as migrate_err:
            print(f"WARNING: Schema auto-migration failed: {migrate_err}", file=sys.stderr)
except Exception as e:

    print(f"CRITICAL: Failed to connect to DATABASE_URL: {e}. Falling back to local SQLite to prevent startup crash.", file=sys.stderr)
    DATABASE_URL = "sqlite:///./fallback.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, pool_pre_ping=True)
    fallback_needed = True

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Import all models to ensure they are registered on Base.metadata
import app.models

# Auto-create all tables for all environments (including Postgres on Neon to auto-initialize missing tables)
try:
    Base.metadata.create_all(bind=engine)
except Exception:
    pass


