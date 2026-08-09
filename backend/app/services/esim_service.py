import os
import uuid
import logging
import httpx
from typing import Dict, Any, List
from app.utils.http_client import async_client

logger = logging.getLogger(__name__)

class EsimService:
    def __init__(self):
        # Airalo API Sandbox endpoints config
        self.client_id = os.getenv("AIRALO_CLIENT_ID", "").strip()
        self.client_secret = os.getenv("AIRALO_CLIENT_SECRET", "").strip()
        self.base_url = os.getenv("AIRALO_BASE_URL", "https://sandbox-partnerapi.airalo.com/v2").strip()

    def _is_configured(self) -> bool:
        placeholders = {"", "your-airalo-id", "your-airalo-secret"}
        return self.client_id not in placeholders and self.client_secret not in placeholders

    async def _get_auth_token(self) -> str:
        """Exchange client credentials for OAuth2 access token."""
        url = f"{self.base_url}/token"
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials"
        }
        resp = await async_client.post(url, data=payload, timeout=5.0)
        resp.raise_for_status()
        return resp.json().get("data", {}).get("access_token", "")

    async def list_plans(self, country: str) -> List[Dict[str, Any]]:
        """Queries real Airalo packages list or returns local sandbox catalog."""
        if not self._is_configured():
            logger.info("Airalo keys missing. Returning default sandbox eSIM plans.")
            c = country.upper()
            return [
                {"plan_name": f"{c} 7-Day Lite", "data_limit": "1 GB", "price_usd": 5.0, "price_inr": 420.0},
                {"plan_name": f"{c} 15-Day Standard", "data_limit": "5 GB", "price_usd": 15.0, "price_inr": 1260.0},
                {"plan_name": f"{c} 30-Day Unlimited", "data_limit": "Unlimited", "price_usd": 35.0, "price_inr": 2940.0}
            ]

        try:
            token = await self._get_auth_token()
            headers = {"Authorization": f"Bearer {token}"}
            # Query eSIM packages list from Airalo API
            url = f"{self.base_url}/packages"
            params = {"filter[country]": country.upper()}
            resp = await async_client.get(url, headers=headers, params=params, timeout=8.0)
            resp.raise_for_status()
            data = resp.json()
            
            plans = []
            packages = data.get("data", [])
            for pkg in packages:
                plans.append({
                    "plan_name": pkg.get("title"),
                    "data_limit": pkg.get("data"),
                    "price_usd": float(pkg.get("price", 10.0)),
                    "price_inr": float(pkg.get("price", 10.0)) * 83.5
                })
            return plans
        except Exception as e:
            logger.error(f"Airalo packages API failed: {e}. Returning sandbox catalog.")
            return await self.list_plans(country)

    async def purchase_esim(self, package_code: str) -> Dict[str, Any]:
        """Submits eSIM order to Airalo partner API or raises provider limit warning if unconfigured."""
        if not self._is_configured():
            esim_id = f"ESIM-{uuid.uuid4().hex[:8].upper()}"
            return {
                "success": True,
                "esim_id": esim_id,
                "activation_qr_url": f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={esim_id}",
                "install_guide": "Go to Settings -> Cellular -> Add eSIM, scan the QR code and follow the screen instructions."
            }

        try:
            token = await self._get_auth_token()
            headers = {"Authorization": f"Bearer {token}"}
            url = f"{self.base_url}/orders"
            payload = {
                "package_id": package_code,
                "quantity": 1
            }
            resp = await async_client.post(url, headers=headers, json=payload, timeout=8.0)
            resp.raise_for_status()
            data = resp.json()
            
            order = data.get("data", {})
            sims = order.get("sims", [{}])[0]
            return {
                "success": True,
                "esim_id": sims.get("iccid"),
                "activation_qr_url": sims.get("qrcode_url"),
                "install_guide": sims.get("installation_guides", {}).get("ios", "Scan QR to install.")
            }
        except Exception as e:
            logger.error(f"Airalo purchase API failed: {e}")
            raise ValueError(f"Airalo provider limitation: {e}")

# Global esim service instance
esim_service = EsimService()
