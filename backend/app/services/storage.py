import os
import uuid
import base64
import logging
from io import BytesIO
from typing import Tuple

logger = logging.getLogger(__name__)

# Try importing Pillow for image compression & conversion
HAS_PILLOW = False
try:
    from PIL import Image
    HAS_PILLOW = True
except ImportError:
    logger.warning("Pillow library not found. Image optimizations and WebP conversions will be skipped. Installing Pillow is recommended.")

# Static uploads directory in workspace
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads")

class BaseStorageProvider:
    """Interface outlining media file storage and deletions"""
    def save_file(self, content: bytes, filename: str) -> Tuple[str, str]:
        """Saves file and returns (url, blur_hash_base64)"""
        raise NotImplementedError
        
    def delete_file(self, file_url: str) -> None:
        """Deletes file from storage"""
        raise NotImplementedError


class LocalStorageProvider(BaseStorageProvider):
    """Saves uploads to a local folder and serves them as static routes"""
    
    def __init__(self):
        # Create static upload folder if missing
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    def save_file(self, content: bytes, filename: str) -> Tuple[str, str]:
        ext = os.path.splitext(filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex}"
        
        # Determine format and save path
        if HAS_PILLOW:
            target_filename = f"{unique_name}.webp"
            save_path = os.path.join(UPLOAD_DIR, target_filename)
            
            try:
                img = Image.open(BytesIO(content))
                
                # 1. Enforce max source-file dimensions (1920x1080)
                max_w, max_h = 1920, 1080
                w, h = img.size
                if w > max_w or h > max_h:
                    ratio = min(max_w / w, max_h / h)
                    img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
                
                # 2. Convert to WebP format
                img.save(save_path, "WEBP", quality=80)
                
                # 3. Generate 16x16 tiny blur-up preview
                thumb = img.resize((16, 16), Image.Resampling.NEAREST)
                thumb_buffer = BytesIO()
                thumb.save(thumb_buffer, "WEBP", quality=30)
                blur_hash = f"data:image/webp;base64,{base64.b64encode(thumb_buffer.getvalue()).decode('utf-8')}"
                
                return f"/static/uploads/{target_filename}", blur_hash
                
            except Exception as e:
                logger.error(f"Pillow image optimization failed: {e}. Saving raw file.")
        
        # Fallback raw saving
        target_filename = f"{unique_name}{ext}"
        save_path = os.path.join(UPLOAD_DIR, target_filename)
        with open(save_path, "wb") as f:
            f.write(content)
            
        # Pre-seeded basic grey inline base64 block for raw fallbacks
        fallback_blur = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        return f"/static/uploads/{target_filename}", fallback_blur

    def delete_file(self, file_url: str) -> None:
        if not file_url.startswith("/static/uploads/"):
            return
            
        filename = os.path.basename(file_url)
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as e:
                logger.error(f"Failed to delete static file: {e}")


class S3StorageProvider(BaseStorageProvider):
    """Saves uploads to AWS S3, Cloudflare R2, or Google Cloud Storage using boto3 client."""
    def __init__(self):
        self.access_key = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
        self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
        self.bucket_name = os.getenv("AWS_STORAGE_BUCKET_NAME", "").strip()
        self.region_name = os.getenv("AWS_S3_REGION_NAME", "us-east-1").strip()
        self.endpoint_url = os.getenv("AWS_S3_ENDPOINT_URL", "").strip() # Cloudflare R2 / GCS support

    def _is_configured(self) -> bool:
        placeholders = {"", "placeholder", "key"}
        return (
            self.access_key not in placeholders
            and self.secret_key not in placeholders
            and self.bucket_name not in placeholders
        )

    def save_file(self, content: bytes, filename: str) -> Tuple[str, str]:
        if not self._is_configured():
            logger.info("AWS S3 credentials not configured. Falling back to LocalStorageProvider.")
            local = LocalStorageProvider()
            return local.save_file(content, filename)

        try:
            import boto3
            # Initialize boto3 client config
            kwargs = {
                "aws_access_key_id": self.access_key,
                "aws_secret_access_key": self.secret_key,
                "region_name": self.region_name
            }
            if self.endpoint_url:
                kwargs["endpoint_url"] = self.endpoint_url

            s3_client = boto3.client("s3", **kwargs)
            unique_name = f"{uuid.uuid4().hex}_{filename}"
            
            # Upload file content to S3
            s3_client.put_object(
                Bucket=self.bucket_name,
                Key=unique_name,
                Body=content,
                ContentType="image/webp" if filename.lower().endswith(".webp") else "application/octet-stream"
            )
            
            # Generate pre-signed URL (valid for 24 hours)
            url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": unique_name},
                ExpiresIn=86400
            )
            
            fallback_blur = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            logger.info(f"Successfully uploaded file to S3 bucket: {unique_name}")
            return url, fallback_blur
        except Exception as e:
            logger.error(f"Failed to upload file to S3: {e}. Falling back to LocalStorageProvider.")
            local = LocalStorageProvider()
            return local.save_file(content, filename)

    def delete_file(self, file_url: str) -> None:
        if not self._is_configured():
            local = LocalStorageProvider()
            return local.delete_file(file_url)

        try:
            import boto3
            import urllib.parse
            # Extract key name from pre-signed URL
            parsed = urllib.parse.urlparse(file_url)
            # Key name is path segment or parameter depending on style
            key = parsed.path.lstrip("/")
            
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region_name
            )
            s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            logger.info(f"Successfully deleted file from S3: {key}")
        except Exception as e:
            logger.error(f"Failed to delete file from S3: {e}")

# Global storage client instance (dynamically picks provider)
storage_provider = S3StorageProvider()
