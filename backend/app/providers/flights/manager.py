import os
import logging
from typing import List, Dict, Any
from app.providers.base import BaseFlightProvider, NormalizedOffer
from app.providers.flights.amadeus import AmadeusProvider
from app.providers.flights.skyscanner_rapid import SkyscannerRapidProvider
from app.providers.flights.booking_dot_com import BookingDotComFlightProvider
from app.providers.flights.duffel import DuffelFlightProvider
from app.database import SessionLocal
from app.models.search_entities import FlightRoute

logger = logging.getLogger(__name__)


def _amadeus_is_configured() -> bool:
    cid = os.getenv("AMADEUS_CLIENT_ID", "")
    csec = os.getenv("AMADEUS_CLIENT_SECRET", "")
    placeholders = {"", "your-amadeus-id", "your-amadeus-secret"}
    return cid not in placeholders and csec not in placeholders


class FlightProviderManager:
    def __init__(self):
        # Priority 1: Amadeus (only if real credentials are configured)
        # Priority 2: Booking.com Flights via RapidAPI (uses subscribed RAPIDAPI_KEY)
        # Priority 3: Duffel Flights (uses DUFFEL_API_KEY)
        # Priority 4: Skyscanner via RapidAPI (uses existing RAPIDAPI_KEY)
        self.providers: List[BaseFlightProvider] = []
        self.providers.append(DuffelFlightProvider())
        if _amadeus_is_configured():
            self.providers.append(AmadeusProvider())
            logger.info("FlightProviderManager: Amadeus provider registered.")
        self.providers.append(BookingDotComFlightProvider())
        self.providers.append(SkyscannerRapidProvider())

    async def search_all(self, origin: str, destination: str, date: str) -> List[NormalizedOffer]:
        import time
        last_error = None
        for provider in self.providers:
            start_time = time.time()
            try:
                offers = await provider.search(origin, destination, date)
                latency = int((time.time() - start_time) * 1000)
                if offers:
                    logger.info(f"FlightProviderManager: {provider.__class__.__name__} returned {len(offers)} offers in {latency}ms.")
                    for o in offers:
                        o.details["provider_latency"] = f"{latency} ms"
                        o.details["provider_status"] = "Success"
                        o.details["provider_source"] = "Live API"
                    return offers[:7]
                else:
                    logger.warning(f"FlightProviderManager: {provider.__class__.__name__} returned 0 offers, trying next.")
            except Exception as e:
                latency = int((time.time() - start_time) * 1000)
                logger.error(f"FlightProviderManager: {provider.__class__.__name__} failed in {latency}ms: {e}")
                last_error = e
                continue


        # External providers failed — run Database Fallback
        logger.warning("FlightProviderManager: All external API providers failed. Attempting database fallback...")
        try:
            db = SessionLocal()
            db_routes = db.query(FlightRoute).filter(
                FlightRoute.origin == origin.upper().strip(),
                FlightRoute.destination == destination.upper().strip()
            ).all()
            db.close()

            if db_routes:
                offers = []
                import uuid
                import datetime
                for route in db_routes:
                    dep_time = f"{date}T{route.departure_time or '08:00'}:00"
                    # Default duration: 2 hours
                    arr_time = f"{date}T10:00:00"
                    if route.departure_time and ":" in route.departure_time:
                        try:
                            parts = route.departure_time.split(":")
                            arr_hour = (int(parts[0]) + 2) % 24
                            arr_time = f"{date}T{arr_hour:02d}:{parts[1]}:00"
                        except Exception:
                            pass

                    details = {
                        "flight_number": route.flight_number,
                        "airline": route.airline_name,
                        "airline_code": route.airline_code,
                        "origin": route.origin,
                        "destination": route.destination,
                        "departure_time": dep_time,
                        "arrival_time": arr_time,
                        "duration": "2h 0m",
                        "duration_minutes": 120,
                        "layovers": [],
                        "cabin_class": "ECONOMY",
                        "cabin": "ECONOMY",
                        "price": float(route.base_price),
                        "price_per_passenger": float(route.base_price),
                        "total_price": float(route.base_price),
                        "currency": "INR",
                        "seats_remaining": 9,
                        "taxes": 150.0,
                        "stop_count": 0,
                        "terminal": "T1",
                        "baggage": "15 KG Checked, 7 KG Cabin",
                        "logo": f"https://r-xx.bstatic.com/data/airlines_logo/{route.airline_code}.png",
                        "provider": "Local Database",
                        "availability": "available",
                        "provider_latency": "0 ms",
                        "provider_status": "Fallback",
                        "provider_source": "Local Database"
                    }
                    offers.append(NormalizedOffer(
                        id=f"OF-DB-{uuid.uuid4().hex[:6].upper()}",
                        provider_name="Local Database",
                        price=float(route.base_price),
                        currency="INR",
                        availability_status="available",
                        cancellation_policy="Non-Refundable",
                        raw_provider_ref=route.flight_number,
                        expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=24),
                        details=details,
                        is_simulated=True
                    ))
                logger.info(f"FlightProviderManager: Database fallback returned {len(offers)} offers.")
                return offers
        except Exception as dbe:
            logger.error(f"FlightProviderManager: Database fallback query failed: {dbe}")
            last_error = dbe

        # If everything including database queries fails or yields nothing
        raise ValueError(
            f"No flights found matching the route {origin} to {destination}."
        )



