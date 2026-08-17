import os
from dotenv import load_dotenv
# Load backend/.env file from root
load_dotenv(dotenv_path="backend/.env")

from app.database import SessionLocal
from app.models.core import User, LoyaltyAccount, WalletAccount
from app.auth.jwt import hash_password

def main():
    db = SessionLocal()
    emails = ["tanishrajput673@gmail.com", "tanishrajput673@gmial.com"]
    password = "Tanish@3162"

    for email in emails:
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"User {email} already exists! Updating password to {password}...")
            user.password_hash = hash_password(password)
            db.commit()
            print("Password updated successfully.")
        else:
            print(f"Creating user {email} with password {password}...")
            user = User(
                email=email,
                phone="9988776655",
                password_hash=hash_password(password),
                role="user",
                preferred_language="en",
                preferred_currency="INR"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Add loyalty and wallet accounts
            db.add(LoyaltyAccount(user_id=user.id, points_balance=5000, tier="Gold"))
            db.add(WalletAccount(user_id=user.id, balance=25000.0, currency="INR"))
            db.commit()
            print(f"User {email} and associated profiles created successfully.")

if __name__ == "__main__":
    main()
