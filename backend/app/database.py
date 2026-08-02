import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

import sys
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://travel_user:travel_password@localhost:5432/travel_os")
IS_EXPLICIT_DB = os.getenv("DATABASE_URL") is not None

# Automatically switch to local SQLite database when running inside pytest
if "pytest" in sys.modules or "pytest" in "".join(sys.argv):
    DATABASE_URL = "sqlite:///./test_travel_os.db"

engine = None
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
    # Test connection
    with engine.connect() as conn:
        pass
except Exception as e:
    is_railway = os.getenv("RAILWAY_ENVIRONMENT_NAME") is not None
    if IS_EXPLICIT_DB or is_railway:
        print(f"CRITICAL: Failed to connect to explicit DATABASE_URL: {e}", file=sys.stderr)
        raise e
    else:
        if "postgresql" in DATABASE_URL:
            DATABASE_URL = "sqlite:///./travel_os.db"
            engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, pool_pre_ping=True)
        else:
            raise e

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

