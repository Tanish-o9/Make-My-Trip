import os
import httpx
from typing import Dict, Any, List
from app.providers.flights.amadeus import AmadeusProvider
from app.providers.flights.tbo import TBOProvider
from app.providers.hotels.hotelbeds import HotelBedsProvider
from app.providers.hotels.expedia import ExpediaProvider
from app.providers.vehicles.first_party import FirstPartyVehicleProvider

class ProviderRegistry:
    def __init__(self):
        self.flights = {
            "amadeus": AmadeusProvider(),
            "tbo": TBOProvider()
        }
        self.hotels = {
            "hotelbeds": HotelBedsProvider(),
            "expedia": ExpediaProvider()
        }
        self.vehicles = {
            "firstparty": FirstPartyVehicleProvider()
        }

    def get_flight_providers(self) -> List[Any]:
        return list(self.flights.values())

    def get_hotel_providers(self) -> List[Any]:
        return list(self.hotels.values())

    def get_vehicle_providers(self) -> List[Any]:
        return list(self.vehicles.values())

    def get_provider(self, vertical: str, name: str) -> Any:
        v = vertical.lower()
        n = name.lower()
        if v == "flights":
            return self.flights.get(n)
        elif v == "hotels":
            return self.hotels.get(n)
        elif v in ["rent-a-ride", "vehicle_rental", "vehicles", "firstparty"]:
            return self.vehicles.get(n) or self.vehicles.get("firstparty")
        return None

    async def check_health(self) -> Dict[str, Any]:
        health = {}
        # Test Amadeus Connectivity
        try:
            amadeus_client = self.flights["amadeus"].client
            if amadeus_client.client_id and amadeus_client.client_secret:
                url = "https://test.api.amadeus.com/v1/security/oauth2/token"
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, data={
                        "grant_type": "client_credentials",
                        "client_id": amadeus_client.client_id,
                        "client_secret": amadeus_client.client_secret
                    }, timeout=2.0)
                    if resp.status_code == 200:
                        health["amadeus"] = "healthy"
                    else:
                        health["amadeus"] = f"unhealthy (status {resp.status_code})"
            else:
                health["amadeus"] = "sandbox (mock credentials)"
        except Exception as e:
            health["amadeus"] = f"unhealthy ({str(e)})"

        health["tbo"] = "healthy (sandbox)"
        health["hotelbeds"] = "healthy (sandbox)"
        health["expedia"] = "healthy (sandbox)"
        health["firstparty"] = "healthy (local db)"
        return health

provider_registry = ProviderRegistry()
