import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.media import Media
from app.services.storage import storage_provider
from app.auth.dependencies import get_current_user
from app.models.core import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["media"])

# Enforce only one primary per entity constraint helper
def reset_sibling_primaries(db: Session, owner_type: str, owner_id: str, exclude_media_id: int):
    siblings = db.query(Media).filter(
        Media.owner_type == owner_type,
        Media.owner_id == owner_id,
        Media.id != exclude_media_id
    ).all()
    for sib in siblings:
        sib.is_primary = False
    db.commit()


@router.post("")
async def upload_media(
    owner_type: str = Form(...),
    owner_id: str = Form(...),
    alt_text: str = Form("Travel asset photo"),
    display_order: int = Form(0),
    is_primary: bool = Form(False),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Uploads file, compresses to WebP, and saves polymorphic Media record"""
    # BUG-012m FIX: Restrict write operations to administrators and support personnel
    allowed_roles = {"admin", "super_admin", "support"}
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Access denied: Administrative write permissions required.")
    # 1. Validation size limit (10MB)
    max_size = 10 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 10MB.")
        
    # Validation file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image type.")

    # 2. Save file through optimization provider
    try:
        url, blur_hash = storage_provider.save_file(content, file.filename)
    except Exception as e:
        logger.error(f"Failed to process and store media file: {e}")
        raise HTTPException(status_code=500, detail="Internal file processing error.")

    # Check if this is the first image for this entity. If so, auto-force it to be primary!
    has_siblings = db.query(Media).filter(
        Media.owner_type == owner_type,
        Media.owner_id == owner_id
    ).first() is not None
    
    final_primary = is_primary or (not has_siblings)

    # Save to db
    media = Media(
        owner_type=owner_type,
        owner_id=owner_id,
        url=url,
        alt_text=alt_text,
        display_order=display_order,
        is_primary=final_primary,
        blur_hash_base64=blur_hash
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    if final_primary:
        reset_sibling_primaries(db, owner_type, owner_id, media.id)

    return {

        "id": media.id,
        "owner_type": media.owner_type,
        "owner_id": media.owner_id,
        "url": media.url,
        "alt_text": media.alt_text,
        "display_order": media.display_order,
        "is_primary": media.is_primary,
        "blur_hash_base64": media.blur_hash_base64
    }



@router.put("/{media_id}/primary")
def set_primary_photo(
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sets photo as primary and unsets all other sibling images of this entity"""
    # BUG-012m FIX: Restrict write operations to administrators and support personnel
    allowed_roles = {"admin", "super_admin", "support"}
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Access denied: Administrative write permissions required.")
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found.")
        
    media.is_primary = True
    db.commit()
    
    reset_sibling_primaries(db, media.owner_type, media.owner_id, media.id)
    return {
        "message": f"Photo {media_id} is now primary.",
        "media": {
            "id": media.id,
            "owner_type": media.owner_type,
            "owner_id": media.owner_id,
            "url": media.url,
            "alt_text": media.alt_text,
            "display_order": media.display_order,
            "is_primary": media.is_primary,
            "blur_hash_base64": media.blur_hash_base64
        }
    }



@router.delete("/{media_id}")
def delete_media(
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes local WebP asset file and database entry, re-assigning primary if needed"""
    # BUG-012m FIX: Restrict write operations to administrators and support personnel
    allowed_roles = {"admin", "super_admin", "support"}
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Access denied: Administrative write permissions required.")
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found.")
        
    was_primary = media.is_primary
    owner_type = media.owner_type
    owner_id = media.owner_id
    
    # 1. Clear static file from storage
    storage_provider.delete_file(media.url)
    
    # 2. Delete database record
    db.delete(media)
    db.commit()
    
    # 3. If primary was deleted, reassign to next sibling if available
    if was_primary:
        next_sibling = db.query(Media).filter(
            Media.owner_type == owner_type,
            Media.owner_id == owner_id
        ).order_by(Media.display_order.asc(), Media.id.asc()).first()
        
        if next_sibling:
            next_sibling.is_primary = True
            db.commit()
            
    return {"message": "Photo deleted successfully."}


@router.get("")
def list_media(
    owner_type: str,
    owner_id: str,
    db: Session = Depends(get_db)
):
    """Lists photos for a given travel entity type and ID"""
    return db.query(Media).filter(
        Media.owner_type == owner_type,
        Media.owner_id == owner_id
    ).order_by(Media.display_order.asc(), Media.id.asc()).all()
