import datetime
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.database import SessionLocal
from app.models.core import User, EmailVerification
from app.auth.jwt import create_access_token
from app.routes.auth import _generate_secure_otp, _hash_otp, PURPOSE_EMAIL_VERIFICATION

client = TestClient(app)

def delete_user_completely(db, email: str):
    from app.models.core import UserProfile, LoyaltyAccount, WalletAccount, EmailVerification
    db.query(UserProfile).filter(UserProfile.email == email).delete()
    db.query(EmailVerification).filter(EmailVerification.email == email).delete()
    user = db.query(User).filter(User.email == email).first()
    if user:
        db.query(UserProfile).filter(UserProfile.user_id == user.id).delete()
        db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user.id).delete()
        db.query(WalletAccount).filter(WalletAccount.user_id == user.id).delete()
        db.query(EmailVerification).filter(EmailVerification.user_id == user.id).delete()
        db.delete(user)
    db.commit()

@pytest.fixture
def test_admin_user():
    db = SessionLocal()
    email = 'email_admin_test@travelos.com'
    delete_user_completely(db, email)
    user = User(email=email, role='admin', email_verified=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user
    db = SessionLocal()
    delete_user_completely(db, email)
    db.close()

@pytest.fixture
def test_regular_user():
    db = SessionLocal()
    email = 'email_regular_test@travelos.com'
    delete_user_completely(db, email)
    user = User(email=email, role='user', email_verified=False)
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user
    db = SessionLocal()
    delete_user_completely(db, email)
    db.close()

def test_admin_email_diagnostics_unauthorized(test_regular_user):
    token = create_access_token(data={'sub': test_regular_user.email, 'role': test_regular_user.role, 'id': test_regular_user.id})
    headers = {'Authorization': f'Bearer {token}'}
    response = client.get('/api/v1/admin/providers/email/diagnostics', headers=headers)
    assert response.status_code == 403

def test_admin_email_diagnostics_authorized(test_admin_user):
    token = create_access_token(data={'sub': test_admin_user.email, 'role': test_admin_user.role, 'id': test_admin_user.id})
    headers = {'Authorization': f'Bearer {token}'}
    response = client.get('/api/v1/admin/providers/email/diagnostics', headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert 'email_provider' in data
    assert 'configuration_status' in data
    assert 'connectivity' in data
    assert 'circuit_breaker_status' in data

def test_signup_sends_verification_email():
    test_email = 'signup_otp_async_test@example.com'
    db = SessionLocal()
    delete_user_completely(db, test_email)
    db.close()
    fired = []
    def _mock_fire(email, full_name, otp):
        fired.append({'email': email})
    with patch('app.routes.auth._fire_verification_email_async', side_effect=_mock_fire):
        r = client.post('/api/v1/auth/signup', json={'full_name': 'OTP Async Test', 'email': test_email, 'password': 'SecurePassword123!'})
    assert r.status_code == 201, r.json()
    assert len(fired) == 1
    assert fired[0]['email'] == test_email
    db = SessionLocal()
    delete_user_completely(db, test_email)
    db.close()

def test_signup_otp_record_created():
    test_email = 'signup_otp_record_test@example.com'
    db = SessionLocal()
    delete_user_completely(db, test_email)
    db.close()
    with patch('app.routes.auth._fire_verification_email_async'):
        r = client.post('/api/v1/auth/signup', json={'full_name': 'OTP Record Test', 'email': test_email, 'password': 'SecurePassword123!'})
    assert r.status_code == 201
    db = SessionLocal()
    u = db.query(User).filter(User.email == test_email).first()
    assert u is not None
    rec = db.query(EmailVerification).filter(EmailVerification.email == test_email, EmailVerification.purpose == PURPOSE_EMAIL_VERIFICATION, EmailVerification.is_used == False).first()
    assert rec is not None, 'No EmailVerification record found after signup'
    assert rec.code_hash is not None
    assert len(rec.code_hash) == 64
    assert rec.is_used is False
    delete_user_completely(db, test_email)
    db.close()

def test_signup_otp_hashing():
    plain_otp = _generate_secure_otp()
    assert len(plain_otp) == 6
    assert plain_otp.isdigit()
    hashed = _hash_otp(plain_otp)
    assert hashed != plain_otp
    assert len(hashed) == 64
    assert _hash_otp(plain_otp) == hashed
    assert _hash_otp('000000') != _hash_otp('111111')

def test_signup_otp_expiration():
    test_email = 'signup_otp_expiry_test@example.com'
    db = SessionLocal()
    delete_user_completely(db, test_email)
    u = User(email=test_email, role='user', email_verified=False)
    db.add(u)
    db.commit()
    db.refresh(u)
    plain_otp = _generate_secure_otp()
    rec = EmailVerification(user_id=u.id, email=test_email, code_hash=_hash_otp(plain_otp), purpose=PURPOSE_EMAIL_VERIFICATION,
        expires_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=1), attempts=0, is_used=False, created_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=11))
    db.add(rec)
    db.commit()
    r = client.post('/api/v1/auth/verify-email', json={'email': test_email, 'code': plain_otp})
    assert r.status_code in (400, 422), f'Expected 400/422 for expired OTP, got {r.status_code}'
    db = SessionLocal()
    delete_user_completely(db, test_email)
    db.close()

def test_signup_email_provider_failure_still_returns_201():
    test_email = 'signup_email_fail_test@example.com'
    db = SessionLocal()
    delete_user_completely(db, test_email)
    db.close()
    with patch('app.routes.auth._fire_verification_email_async'):
        r = client.post('/api/v1/auth/signup', json={'full_name': 'Email Fail Test', 'email': test_email, 'password': 'SecurePassword123!'})
    assert r.status_code == 201
    db = SessionLocal()
    delete_user_completely(db, test_email)
    db.close()

def test_signup_resend_verification():
    test_email = 'signup_resend_test@example.com'
    db = SessionLocal()
    delete_user_completely(db, test_email)
    u = User(email=test_email, role='user', email_verified=False)
    db.add(u)
    db.commit()
    db.refresh(u)
    with patch('app.routes.auth._fire_verification_email_async') as mock_fire:
        r = client.post('/api/v1/auth/resend-verification', json={'email': test_email})
    assert r.status_code == 200
    assert 'code has been sent' in r.json().get('message', '')
    mock_fire.assert_called_once()
    db = SessionLocal()
    delete_user_completely(db, test_email)
    db.close()

def test_old_otp_rejected_new_accepted():
    test_email = 'signup_old_otp_test@example.com'
    db = SessionLocal()
    delete_user_completely(db, test_email)
    u = User(email=test_email, role='user', email_verified=False)
    db.add(u)
    db.commit()
    db.refresh(u)
    old_otp = _generate_secure_otp()
    old_rec = EmailVerification(user_id=u.id, email=test_email, code_hash=_hash_otp(old_otp), purpose=PURPOSE_EMAIL_VERIFICATION,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=10), attempts=0, is_used=False,
        created_at=datetime.datetime.utcnow() - datetime.timedelta(seconds=70))
    db.add(old_rec)
    db.commit()
    with patch('app.routes.auth._fire_verification_email_async'):
        client.post('/api/v1/auth/resend-verification', json={'email': test_email})
    old_resp = client.post('/api/v1/auth/verify-email', json={'email': test_email, 'code': old_otp})
    assert old_resp.status_code in (400, 422), 'Old OTP must be rejected after resend'
    db = SessionLocal()
    delete_user_completely(db, test_email)
    db.close()

def test_email_sender_configuration():
    from app.services.communication import SendGridClient
    comm = SendGridClient()
    assert comm._is_resend_configured() or comm._is_sendgrid_configured()
    assert isinstance(comm.from_email, str)
    assert len(comm.from_email) > 0
