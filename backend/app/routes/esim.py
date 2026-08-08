from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/esim", tags=["esim"])

from app.services.esim_service import esim_service

class EsimPurchaseRequest(BaseModel):
    country: str
    plan_name: str

@router.get("/plans")
async def list_esim_plans(country: str = Query("USA")):
    return await esim_service.list_plans(country)

@router.post("/purchase")
async def purchase_esim(
    req: EsimPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = await esim_service.purchase_esim(req.plan_name)
    return result
