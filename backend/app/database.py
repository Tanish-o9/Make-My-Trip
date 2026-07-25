import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

import sys
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://travel_user:travel_password@localhost:5432/travel_os")

# Automatically switch to local SQLite database when running inside pytest
if "pytest" in sys.modules or "pytest" in "".join(sys.argv):
    DATABASE_URL = "sqlite:///./test_travel_os.db"


engine = None
try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    # Test connection
    with engine.connect() as conn:
        pass
except Exception as e:
    if "postgresql" in DATABASE_URL:
        DATABASE_URL = "sqlite:///./travel_os.db"
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
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
