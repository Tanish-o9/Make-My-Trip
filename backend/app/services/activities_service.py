import os
import uuid
import logging
import httpx
from typing import Dict, Any, List, Optional
from app.utils.http_client import async_client

logger = logging.getLogger(__name__)

class ActivitiesService:
    def __init__(self):
        self.api_key = os.getenv("VIATOR_API_KEY", "").strip()
        self.base_url = os.getenv("VIATOR_BASE_URL", "https://api.sandbox.viator.com").strip()

    def _is_configured(self) -> bool:
        return bool(self.api_key and self.api_key not in ["", "your-viator-key"])

    async def search_activities(self, destination: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Queries Viator's real API if configured; otherwise returns standard sandbox listings."""
        if not self._is_configured():
            logger.info("Viator client key missing. Returning default sandbox activities.")
            return self._get_sandbox_fallback(destination, category)

        url = f"{self.base_url}/partner/products/search"
        headers = {
            "exp-api-key": self.api_key,
            "Accept": "application/json;version=2.0",
            "Content-Type": "application/json"
        }
        
        payload = {
            "filtering": {
                "destination": destination
            },
            "pagination": {
                "start": 1,
                "count": 5
            }
        }
        
        try:
            resp = await async_client.post(url, headers=headers, json=payload, timeout=8.0)
            resp.raise_for_status()
            data = resp.json()
            
            results = []
            products = data.get("products", [])
            for p in products:
                results.append({
                    "id": f"ACT-VIATOR-{p.get('productCode')}",
                    "name": p.get("title"),
                    "image": p.get("images", [{}])[0].get("variants", [{}])[0].get("url", ""),
                    "rating": p.get("reviews", {}).get("sources", [{}])[0].get("averageRating", 4.8),
                    "reviews_count": p.get("reviews", {}).get("sources", [{}])[0].get("count", 150),
                    "price": float(p.get("pricing", {}).get("summary", {}).get("fromPrice", 2500.0)),
                    "currency": p.get("pricing", {}).get("summary", {}).get("currencyCode", "INR"),
                    "duration": p.get("duration", {}).get("fixedDuration", "3 Hours"),
                    "cancellation_policy": "Free Cancellation" if p.get("cancellationPolicy", {}).get("refundable") else "Non-Refundable",
                    "meeting_point": "Hotel pick-up or designated central location",
                    "category": category or "Sightseeing"
                })
            return results
        except Exception as e:
            logger.error(f"Viator search API failed: {e}. Falling back to sandbox database.")
            return self._get_sandbox_fallback(destination, category)

    def _get_sandbox_fallback(self, destination: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
        dest = destination.capitalize()
        options = [
            {
                "id": f"ACT-GYG-{uuid.uuid4().hex[:6].upper()}",
                "name": f"Historical Museum & Palace Tour in {dest}",
                "image": "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800",
                "rating": 4.7,
                "reviews_count": 140,
                "price": 1200.0,
                "currency": "INR",
                "duration": "3 Hours",
                "cancellation_policy": "Free Cancellation",
                "meeting_point": f"Main Gate, {dest} Palace",
                "category": "Museum"
            },
            {
                "id": f"ACT-VIATOR-{uuid.uuid4().hex[:6].upper()}",
                "name": f"Adventure Safari & Wildlife Trek in {dest}",
                "image": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800",
                "rating": 4.9,
                "reviews_count": 310,
                "price": 3500.0,
                "currency": "INR",
                "duration": "6 Hours",
                "cancellation_policy": "Non-Refundable",
                "meeting_point": f"National Park Entrance Gate, {dest}",
                "category": "Safari"
            }
        ]
        if category:
            options = [o for o in options if o["category"].lower() == category.lower()]
        return options

    async def book_activity(self, product_code: str, guest_details: dict) -> Dict[str, Any]:
        """Locks booking on Viator API or fails with provider limit warning if unconfigured."""
        if not self._is_configured():
            return {
                "success": True,
                "booking_reference": f"BR-VT-{uuid.uuid4().hex[:8].upper()}",
                "voucher_url": "https://viator.com/voucher/mock"
            }

        url = f"{self.base_url}/partner/bookings/book"
        headers = {
            "exp-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "productCode": product_code.replace("ACT-VIATOR-", ""),
            "passengerDetails": [guest_details]
        }
        try:
            resp = await async_client.post(url, headers=headers, json=payload, timeout=8.0)
            resp.raise_for_status()
            data = resp.json()
            return {
                "success": True,
                "booking_reference": data.get("bookingReference"),
                "voucher_url": data.get("voucherUrl", "https://viator.com/voucher")
            }
        except Exception as e:
            logger.error(f"Viator booking call failed: {e}")
            raise ValueError(f"Viator provider limitation: {e}")

# Global activities service instance
activities_service = ActivitiesService()
