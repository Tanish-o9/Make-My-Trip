from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])

class DocumentMetadata(BaseModel):
    document_type: str # Passport, Visa, Insurance, Ticket
    file_name: str
    file_url: str

@router.get("/list")
async def list_user_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Mock list of documents associated with the profile
    return [
        {
            "id": f"DOC-{uuid.uuid4().hex[:6].upper()}",
            "document_type": "Passport",
            "file_name": "passport_copy.pdf",
            "file_url": "https://travelos.com/documents/passport_copy.pdf",
            "expiry_date": "2031-10-15"
        },
        {
            "id": f"DOC-{uuid.uuid4().hex[:6].upper()}",
            "document_type": "Visa",
            "file_name": "visa_turkey.pdf",
            "file_url": "https://travelos.com/documents/visa_turkey.pdf",
            "expiry_date": "2026-12-25"
        }
    ]

@router.post("/upload")
async def upload_user_document(
    document_type: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_id = f"DOC-{uuid.uuid4().hex[:6].upper()}"
    return {
        "success": True,
        "id": doc_id,
        "document_type": document_type,
        "file_name": file.filename,
        "file_url": f"https://travelos.com/documents/{doc_id}_{file.filename}"
    }
