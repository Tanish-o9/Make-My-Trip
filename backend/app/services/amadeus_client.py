import os
import httpx
import logging
from typing import Dict, Any, List
from app.services.resilience import CircuitBreaker, retry_with_backoff

logger = logging.getLogger(__name__)

# Global circuit breaker for Amadeus API calls
amadeus_breaker = CircuitBreaker("AmadeusAPI", max_failures=3, cooldown_seconds=30)

class AmadeusClient:
    def __init__(self):
        self.client_id = os.getenv("AMADEUS_CLIENT_ID")
        self.client_secret = os.getenv("AMADEUS_CLIENT_SECRET")
        self.token = None
        self.token_expiry = 0

    @retry_with_backoff(max_retries=2, initial_delay=0.5)
    def _authenticate(self):
        """Authenticates with Amadeus using OAuth2 credentials"""
        url = "https://test.api.amadeus.com/v1/security/oauth2/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        resp = httpx.post(url, data=payload, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
        self.token = data["access_token"]
        logger.info("Successfully authenticated with Amadeus OAuth portal.")

    def search_flights(self, origin: str, destination: str, date: str) -> List[Dict[str, Any]]:
        if not self.client_id or not self.client_secret:
            logger.info("Amadeus credentials not set. Returning mock results.")
            return []

        def execute_api_call():
            if not self.token:
                self._authenticate()
            
            headers = {"Authorization": f"Bearer {self.token}"}
            url = "https://test.api.amadeus.com/v2/shopping/flight-offers"
            params = {
                "originLocationCode": origin,
                "destinationLocationCode": destination,
                "departureDate": date,
                "adults": 1,
                "max": 5
            }
            resp = httpx.get(url, headers=headers, params=params, timeout=5.0)
            if resp.status_code == 401: # Token expired
                self._authenticate()
                headers = {"Authorization": f"Bearer {self.token}"}
                resp = httpx.get(url, headers=headers, params=params, timeout=5.0)
            resp.raise_for_status()
            return resp.json().get("data", [])

        try:
            # Wrap API call with Circuit Breaker
            raw_offers = amadeus_breaker.call(execute_api_call)
            
            # Format raw offers into standard schema
            flights = []
            for offer in raw_offers:
                itinerary = offer["itineraries"][0]
                segment = itinerary["segments"][0]
                price = offer["price"]["total"]
                
                flights.append({
                    "flight_number": f"{segment['carrierCode']}-{segment['number']}",
                    "airline": segment['carrierCode'],
                    "airline_code": segment['carrierCode'],
                    "origin": origin,
                    "destination": destination,
                    "departure_time": segment['departure']['at'],
                    "arrival_time": segment['arrival']['at'],
                    "duration_minutes": 150,  # parsed duration stub
                    "layovers": [],
                    "cabin_class": "ECONOMY",
                    "price_per_passenger": float(price),
                    "total_price": float(price),
                    "currency": "INR"
                })
            return flights
        except Exception as e:
            logger.error(f"Amadeus Client search failed: {e}. Falling back.")
            # Return empty to allow upstream mock fallback
            return []
