"""
File Storage Abstraction Layer
Supports:
  - LocalFileSystem (current default)
  - AWS S3           (hook point — requires boto3 + AWS credentials)
  - Cloudflare R2    (hook point — S3-compatible, requires boto3 + R2 credentials)
  - Google Cloud Storage (hook point — requires google-cloud-storage)

Usage:
    storage = get_storage_backend()
    url = await storage.upload(file_bytes, filename, content_type)
    signed = await storage.get_signed_url(path, expiry_seconds=3600)
"""
import os
import uuid
import logging
import mimetypes
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Allowed file types and size limits ──────────────────────────────────────

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def validate_upload(file_bytes: bytes, filename: str) -> str:
    """Validates file size and MIME type. Returns detected content_type."""
    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise ValueError(f"File too large: {len(file_bytes)} bytes. Maximum allowed: {MAX_UPLOAD_SIZE_BYTES} bytes.")

    content_type, _ = mimetypes.guess_type(filename)
    if content_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"File type '{content_type}' is not allowed. Allowed: {ALLOWED_MIME_TYPES}")

    return content_type


# ─── Abstract Interface ───────────────────────────────────────────────────────

class StorageBackend(ABC):
    @abstractmethod
    async def upload(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        """Upload file and return its public or internal URL/path."""

    @abstractmethod
    async def get_signed_url(self, path: str, expiry_seconds: int = 3600) -> str:
        """Generate a signed (time-limited) URL for secure access."""

    @abstractmethod
    async def delete(self, path: str) -> bool:
        """Delete a stored object."""


# ─── Local Filesystem Adapter ────────────────────────────────────────────────

class LocalStorageBackend(StorageBackend):
    """
    Stores files on the local filesystem under backend/static/uploads/.
    Suitable for development and Railway single-container deployments.
    For production multi-replica deployments, use S3/R2/GCS instead.
    """

    def __init__(self, upload_dir: Optional[str] = None):
        self.upload_dir = upload_dir or os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads"
        )
        os.makedirs(self.upload_dir, exist_ok=True)

    async def upload(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        ext = os.path.splitext(filename)[1] or ".bin"
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(self.upload_dir, unique_name)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        logger.info(f"[LocalStorage] Uploaded {filename} -> {unique_name} ({len(file_bytes)} bytes)")
        # Return relative path; host prefixes it
        return f"/static/uploads/{unique_name}"

    async def get_signed_url(self, path: str, expiry_seconds: int = 3600) -> str:
        # Local storage doesn't support real signed URLs — return the path directly
        logger.warning("[LocalStorage] Signed URLs not supported; returning direct path.")
        return path

    async def delete(self, path: str) -> bool:
        filename = os.path.basename(path)
        full_path = os.path.join(self.upload_dir, filename)
        if os.path.exists(full_path):
            os.remove(full_path)
            logger.info(f"[LocalStorage] Deleted {filename}")
            return True
        return False


# ─── AWS S3 / Cloudflare R2 Adapter ─────────────────────────────────────────

class S3StorageBackend(StorageBackend):
    """
    AWS S3 or Cloudflare R2 (S3-compatible) storage backend.

    PROVIDER LIMITATION:
        Requires boto3 installed and the following env vars set:
          AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME
        For Cloudflare R2, additionally set:
          S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com

    If credentials are not configured, this backend will raise a clear error.
    """

    def __init__(self):
        self._client = None
        self.bucket = os.getenv("S3_BUCKET_NAME", "")
        self.endpoint_url = os.getenv("S3_ENDPOINT_URL", None)  # None = AWS default

    def _get_client(self):
        if self._client:
            return self._client
        try:
            import boto3  # type: ignore
            self._client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "ap-south-1"),
            )
            return self._client
        except ImportError:
            raise RuntimeError(
                "S3StorageBackend requires boto3. Install it: pip install boto3. "
                "Alternatively, set STORAGE_BACKEND=local in your environment."
            )

    async def upload(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        if not self.bucket:
            raise RuntimeError("S3_BUCKET_NAME is not set. Configure your environment or use STORAGE_BACKEND=local.")
        import io
        client = self._get_client()
        ext = os.path.splitext(filename)[1] or ".bin"
        key = f"uploads/{uuid.uuid4().hex}{ext}"
        client.upload_fileobj(
            io.BytesIO(file_bytes),
            self.bucket,
            key,
            ExtraArgs={"ContentType": content_type, "ServerSideEncryption": "AES256"},
        )
        logger.info(f"[S3Storage] Uploaded {filename} -> s3://{self.bucket}/{key}")
        endpoint = self.endpoint_url or f"https://{self.bucket}.s3.amazonaws.com"
        return f"{endpoint}/{key}"

    async def get_signed_url(self, path: str, expiry_seconds: int = 3600) -> str:
        client = self._get_client()
        key = path.split("/", maxsplit=3)[-1] if "/" in path else path
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expiry_seconds,
        )
        return url

    async def delete(self, path: str) -> bool:
        client = self._get_client()
        key = path.split("/", maxsplit=3)[-1] if "/" in path else path
        client.delete_object(Bucket=self.bucket, Key=key)
        return True


# ─── Google Cloud Storage Adapter ────────────────────────────────────────────

class GCSStorageBackend(StorageBackend):
    """
    Google Cloud Storage backend.

    PROVIDER LIMITATION:
        Requires google-cloud-storage installed and env var:
          GCS_BUCKET_NAME, GOOGLE_APPLICATION_CREDENTIALS (service account JSON path)
    """

    def __init__(self):
        self.bucket_name = os.getenv("GCS_BUCKET_NAME", "")

    def _get_client(self):
        try:
            from google.cloud import storage as gcs  # type: ignore
            return gcs.Client()
        except ImportError:
            raise RuntimeError(
                "GCSStorageBackend requires google-cloud-storage. "
                "Install: pip install google-cloud-storage"
            )

    async def upload(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        if not self.bucket_name:
            raise RuntimeError("GCS_BUCKET_NAME is not set.")
        client = self._get_client()
        ext = os.path.splitext(filename)[1] or ".bin"
        key = f"uploads/{uuid.uuid4().hex}{ext}"
        bucket = client.bucket(self.bucket_name)
        blob = bucket.blob(key)
        blob.upload_from_string(file_bytes, content_type=content_type)
        logger.info(f"[GCSStorage] Uploaded {filename} -> gs://{self.bucket_name}/{key}")
        return f"https://storage.googleapis.com/{self.bucket_name}/{key}"

    async def get_signed_url(self, path: str, expiry_seconds: int = 3600) -> str:
        import datetime as dt
        client = self._get_client()
        key = path.split("/")[-1]
        bucket = client.bucket(self.bucket_name)
        blob = bucket.blob(key)
        url = blob.generate_signed_url(expiration=dt.timedelta(seconds=expiry_seconds))
        return url

    async def delete(self, path: str) -> bool:
        client = self._get_client()
        key = path.split("/")[-1]
        bucket = client.bucket(self.bucket_name)
        blob = bucket.blob(key)
        blob.delete()
        return True


# ─── Factory ─────────────────────────────────────────────────────────────────

def get_storage_backend() -> StorageBackend:
    """
    Returns the configured storage backend based on STORAGE_BACKEND env var.

    STORAGE_BACKEND=local   → LocalStorageBackend  (default)
    STORAGE_BACKEND=s3      → S3StorageBackend     (AWS S3 or Cloudflare R2)
    STORAGE_BACKEND=gcs     → GCSStorageBackend    (Google Cloud Storage)
    """
    backend = os.getenv("STORAGE_BACKEND", "local").lower().strip()
    if backend == "s3":
        logger.info("Using S3/R2 storage backend.")
        return S3StorageBackend()
    elif backend == "gcs":
        logger.info("Using Google Cloud Storage backend.")
        return GCSStorageBackend()
    else:
        if backend != "local":
            logger.warning(f"Unknown STORAGE_BACKEND='{backend}'; falling back to local storage.")
        logger.info("Using Local filesystem storage backend.")
        return LocalStorageBackend()


# Singleton instance for the application lifetime
_storage_instance: Optional[StorageBackend] = None


def storage() -> StorageBackend:
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = get_storage_backend()
    return _storage_instance
