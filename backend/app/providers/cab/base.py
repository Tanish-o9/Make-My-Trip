from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from app.providers.cab_provider import NormalizedCabOffer, NormalizedCabQuote, NormalizedCabBookingResult


class CabProvider(ABC):
    """Abstract interface for all Chauffeur Cab and Transfer providers"""
    
    @abstractmethod
    async def search(
        self,
        pickup_address: str,
        drop_address: str,
        trip_type: str,
        pickup_date: Optional[str] = None,
        pickup_time: Optional[str] = None,
        return_date: Optional[str] = None,
        return_time: Optional[str] = None,
        passengers: int = 1,
        luggage_count: int = 0,
        hourly_duration: Optional[int] = 4,
        flight_number: Optional[str] = None,
        terminal: Optional[str] = None,
        category: Optional[str] = None,
    ) -> List[NormalizedCabOffer]:
        """Search available cab transfers matching criteria"""
        pass

    @abstractmethod
    async def get_quote(self, offer_id: str, current_price: Optional[float] = None) -> NormalizedCabQuote:
        """Validate live quote and price validity"""
        pass

    @abstractmethod
    async def create_booking(
        self,
        offer_id: str,
        passenger_details: Dict[str, Any],
        idempotency_key: str,
        amount: float
    ) -> NormalizedCabBookingResult:
        """Create provider-authoritative booking"""
        pass

    @abstractmethod
    async def cancel_booking(self, booking_ref: str, reason: Optional[str] = None) -> Dict[str, Any]:
        """Cancel booking with provider"""
        pass

    @abstractmethod
    async def get_tracking(self, booking_ref: str) -> Dict[str, Any]:
        """Get live driver tracking coordinates and ETA"""
        pass
