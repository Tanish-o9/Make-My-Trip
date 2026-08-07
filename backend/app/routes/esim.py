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

class EsimPurchaseRequest(BaseModel):
    country: str
    plan_name: str

@router.get("/plans")
async def list_esim_plans(country: str = Query("USA")):
    c = country.upper()
    return [
        {"plan_name": f"{c} 7-Day Lite", "data_limit": "1 GB", "price_usd": 5.0, "price_inr": 420.0},
        {"plan_name": f"{c} 15-Day Standard", "data_limit": "5 GB", "price_usd": 15.0, "price_inr": 1260.0},
        {"plan_name": f"{c} 30-Day Unlimited", "data_limit": "Unlimited", "price_usd": 35.0, "price_inr": 2940.0}
    ]

@router.post("/purchase")
async def purchase_esim(
    req: EsimPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    esim_id = f"ESIM-{uuid.uuid4().hex[:8].upper()}"
    qr_code_mock = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={esim_id}"
    
    return {
        "success": True,
        "esim_id": esim_id,
        "activation_qr_url": qr_code_mock,
        "install_guide": "Go to Settings -> Cellular -> Add eSIM, scan the QR code and follow the screen instructions."
    }
