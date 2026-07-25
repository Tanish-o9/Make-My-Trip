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

# Global storage client instance
storage_provider = LocalStorageProvider()
