import os
import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet

def get_fernet_key() -> bytes:
    """
    Derive a base64 32-byte Fernet key from the application secret key.
    """
    secret = os.getenv("SECRET_KEY", "ghumne_chale_fallback_secret_key_32_bytes_123")
    hashed = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(hashed)

def encrypt_id_number(plain_text: Optional[str]) -> Optional[str]:
    """
    Encrypts a plain ID number string using Fernet symmetric encryption.
    """
    if not plain_text:
        return None
    try:
        key = get_fernet_key()
        f = Fernet(key)
        return f.encrypt(plain_text.strip().encode("utf-8")).decode("utf-8")
    except Exception:
        # Fallback/safeguard to prevent database operations from failing
        return plain_text

def decrypt_id_number(cipher_text: Optional[str]) -> Optional[str]:
    """
    Decrypts a Fernet encrypted ID number back to plaintext.
    """
    if not cipher_text:
        return None
    try:
        key = get_fernet_key()
        f = Fernet(key)
        return f.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except Exception:
        # If decryption fails (e.g. it was stored as plaintext before), return the original
        return cipher_text

def mask_id_number(id_num: Optional[str]) -> Optional[str]:
    """
    Masks the ID number so that only the last 4 characters are visible (e.g. •••••••1234).
    """
    if not id_num:
        return None
    id_num = id_num.strip()
    if len(id_num) <= 4:
        return "••••"
    return f"{'•' * (len(id_num) - 4)}{id_num[-4:]}"
