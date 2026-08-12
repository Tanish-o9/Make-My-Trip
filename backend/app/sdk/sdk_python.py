import httpx
from typing import Dict, Any, Optional

class TravelOSClient:
    """Official Python SDK Client for Ghumne Chale Global Gateway."""
    def __init__(self, api_key: str, base_url: str = "https://api.travelos.com/api/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "X-API-Key": api_key,
            "X-Tenant-ID": "1",
            "Content-Type": "application/json"
        }

    def get_tenant_details(self) -> Dict[str, Any]:
        """Fetches active tenant metadata profiles."""
        url = f"{self.base_url}/tenant/me"
        with httpx.Client() as client:
            resp = client.get(url, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    def search_global(self, query: str) -> Dict[str, Any]:
        """Global search across isolated bookings, users, and documents."""
        url = f"{self.base_url}/search"
        with httpx.Client() as client:
            resp = client.get(url, headers=self.headers, params={"q": query})
            resp.raise_for_status()
            return resp.json()

    def post_webhook_event(self, event_type: str, payload: dict) -> Dict[str, Any]:
        """Post custom developer webhook simulation events."""
        url = f"{self.base_url}/events/emit"
        with httpx.Client() as client:
            resp = client.post(url, headers=self.headers, params={"event_type": event_type}, json=payload)
            resp.raise_for_status()
            return resp.json()
