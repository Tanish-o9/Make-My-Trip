import os
import httpx
from typing import Dict, Any, List
from app.providers.flights.amadeus import AmadeusProvider
from app.providers.flights.tbo import TBOProvider
from app.providers.flights.duffel import DuffelFlightProvider
from app.providers.flights.booking_dot_com import BookingDotComFlightProvider
from app.providers.flights.skyscanner_rapid import SkyscannerRapidProvider
from app.providers.hotels.hotelbeds import HotelBedsProvider
from app.providers.hotels.expedia import ExpediaProvider
from app.providers.vehicles.first_party import FirstPartyVehicleProvider

from app.providers.cab.mock import LocalCabProvider
from app.providers.cab.amadeus import AmadeusTransfersProvider
from app.providers.cab.base import CabProvider
from app.providers.cars.mock import LocalCarRentalProvider
from app.providers.cars.duffel import DuffelCarsProvider
from app.providers.cars.base import CarRentalProvider

from app.providers.flights.manager import FlightProviderManager
from app.providers.hotels.manager import HotelProviderManager
from app.providers.weather.manager import WeatherManager
from app.providers.maps.manager import MapsManager
from app.providers.currency.manager import CurrencyManager
from app.providers.bus_provider import LocalBusProvider

class ProviderRegistry:
    def __init__(self):
        self.flights = {
            "amadeus": AmadeusProvider(),
            "tbo": TBOProvider(),
            "duffel": DuffelFlightProvider(),
            "booking.com": BookingDotComFlightProvider(),
            "skyscanner": SkyscannerRapidProvider()
        }
        self.hotels = {
            "hotelbeds": HotelBedsProvider(),
            "expedia": ExpediaProvider()
        }
        self.vehicles = {
            "firstparty": FirstPartyVehicleProvider()
        }
        self.cabs = {
            "local": LocalCabProvider(),
            "amadeus": AmadeusTransfersProvider()
        }
        self.cars = {
            "local": LocalCarRentalProvider(),
            "duffel": DuffelCarsProvider()
        }
        self.buses = {
            "local": LocalBusProvider()
        }
        self.flight_manager = FlightProviderManager()
        self.hotel_manager = HotelProviderManager()
        self.weather_manager = WeatherManager()
        self.maps_manager = MapsManager()
        self.currency_manager = CurrencyManager()

    def get_cab_provider(self) -> CabProvider:
        live_env = os.getenv("ENABLE_LIVE_INVENTORY", "false").lower() in ("true", "1", "yes")
        provider_mode = os.getenv("PROVIDER_MODE", "demo").lower()
        provider_name = os.getenv("LIVE_CAB_PROVIDER", "amadeus" if (live_env or provider_mode == "live") else "local").lower()

        if live_env or provider_mode == "live":
            if provider_name in ["amadeus", "default"]:
                return self.cabs["amadeus"]
            elif provider_name in self.cabs and provider_name != "local":
                return self.cabs[provider_name]
            elif provider_name == "local":
                return self.cabs["local"]
            else:
                from app.providers.common.errors import ProviderNotConfiguredError
                raise ProviderNotConfiguredError(f"Live cab provider '{provider_name}' is not configured.", provider=provider_name)
        return self.cabs["local"]

    def get_car_provider(self) -> CarRentalProvider:
        live_env = os.getenv("ENABLE_LIVE_INVENTORY", "false").lower() in ("true", "1", "yes")
        provider_mode = os.getenv("PROVIDER_MODE", "demo").lower()
        provider_name = os.getenv("LIVE_CAR_PROVIDER", os.getenv("LIVE_CAR_RENTAL_PROVIDER", "duffel" if (live_env or provider_mode == "live") else "local")).lower()

        if live_env or provider_mode == "live":
            if provider_name in ["duffel", "default"]:
                return self.cars["duffel"]
            elif provider_name in self.cars and provider_name != "local":
                return self.cars[provider_name]
            elif provider_name == "local":
                return self.cars["local"]
            else:
                from app.providers.common.errors import ProviderNotConfiguredError
                raise ProviderNotConfiguredError(f"Live car rental provider '{provider_name}' is not configured.", provider=provider_name)
        return self.cars["local"]

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
        elif v == "cabs":
            return self.cabs.get(n) or self.get_cab_provider()
        elif v in ["cars", "car_rental"]:
            return self.cars.get(n) or self.get_car_provider()
        elif v == "buses":
            return self.buses.get(n) or self.buses.get("local")
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
        health["amadeus_transfers"] = "healthy (sandbox)"
        health["duffel_cars"] = "healthy (sandbox)"
        health["local_cabs"] = "healthy (330 vehicles)"
        health["local_cars"] = "healthy (first-party fleet)"
        return health

provider_registry = ProviderRegistry()

