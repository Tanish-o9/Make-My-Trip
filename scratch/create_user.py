import sys
from app.database import SessionLocal
from app.models.core import User, LoyaltyAccount, WalletAccount
from app.auth.jwt import hash_password

def create_user():
    db = SessionLocal()
    email = "tanishrajput673@gmail.com"
    password = "userpass123"
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        print(f"User {email} already exists! Setting password to {password}...")
        existing_user.password_hash = hash_password(password)
        db.commit()
        print("Password updated successfully.")
        return
        
    print(f"Creating user {email}...")
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
    print("User and associated profiles created successfully.")

if __name__ == "__main__":
    create_user()
