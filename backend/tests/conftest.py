import os
import sys

# Force SQLite DATABASE_URL for all tests before any module imports app.database
os.environ["DATABASE_URL"] = "sqlite:///./test_travel_os.db"

if os.path.exists("./test_travel_os.db"):
    try:
        os.remove("./test_travel_os.db")
    except Exception:
        pass

# Initialize SQLite database schema
from app.database import engine, Base

# Import all models to register them on Base.metadata
from app.models import core, bookings, showcase, mybiz, wishlist, agents, payments, audit

Base.metadata.create_all(bind=engine)


