import os
from dotenv import load_dotenv

# Load backend/.env
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

from app.database import SessionLocal
from app.models.core import User
from app.auth.jwt import verify_password

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == "tanishrajput673@gmail.com").first()
    if user:
        print("User found!")
        print("Email:", user.email)
        print("Hash:", user.password_hash)
        # Test password
        matches = verify_password("Tanish@3162", user.password_hash)
        print("Password 'Tanish@3162' matches hash:", matches)
    else:
        print("User not found in DB!")
finally:
    db.close()
