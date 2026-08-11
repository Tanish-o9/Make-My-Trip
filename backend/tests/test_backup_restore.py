import os
import pytest
from decimal import Decimal
from sqlalchemy import text
from app.tasks.backup_daemon import backup_database, restore_database
from app.database import SessionLocal
from app.models.core import User, WalletAccount
from app.models.core import UserProfile

@pytest.fixture
def test_seeder():
    """Seeds a standard test user with a funded wallet and user profile"""
    db = SessionLocal()
    user = db.query(User).filter(User.email == "backup_test@travelos.com").first()
    if not user:
        user = User(email="backup_test@travelos.com", role="user")
        db.add(user)
        db.commit()
        db.refresh(user)

    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(user_id=user.id, full_name="Backup Tester", mobile_number="9999999999")
        db.add(profile)
        db.commit()

    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user.id).first()
    if not wallet:
        wallet = WalletAccount(user_id=user.id, balance=Decimal("12000.00"), currency="INR")
        db.add(wallet)
    else:
        wallet.balance = Decimal("12000.00")
    db.commit()
    db.refresh(wallet)
    db.close()
    return user

def test_backup_and_restore_cycle(test_seeder):
    db = SessionLocal()
    user_count = db.query(User).count()
    assert user_count > 0
    db.close()
    
    # 1. Run backup
    backup_file = backup_database()
    assert os.path.exists(backup_file)
    
    # 2. Delete data to simulate disaster
    db = SessionLocal()
    db.execute(text("DELETE FROM user_profiles"))
    db.execute(text("DELETE FROM wallet_accounts"))
    db.execute(text("DELETE FROM users"))
    db.commit()
    assert db.query(User).count() == 0
    db.close()
    
    # 3. Run restore
    success = restore_database(backup_file)
    assert success is True
    
    # 4. Verify data is back
    db = SessionLocal()
    assert db.query(User).count() == user_count
    db.close()
    
    # Cleanup backup file
    if os.path.exists(backup_file):
        try:
            os.remove(backup_file)
        except Exception:
            pass
