from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from app.providers.car_rental_provider import NormalizedCarRentalOffer, NormalizedCarRentalQuote, NormalizedCarRentalBookingResult


class CarRentalProvider(ABC):
    """Abstract interface for Self-Drive Car Rental providers"""
    
    @abstractmethod
    async def search(
        self,
        pickup_location: str,
        drop_location: str,
        pickup_date: str,
        pickup_time: str,
        return_date: str,
        return_time: str,
        driver_age: int = 25,
        driver_country: str = "India",
        category: Optional[str] = None,
        transmission: Optional[str] = None,
        fuel_type: Optional[str] = None,
    ) -> List[NormalizedCarRentalOffer]:
        """Search self-drive car rental offers"""
        pass

    @abstractmethod
    async def get_vehicle(self, offer_id: str) -> Optional[NormalizedCarRentalOffer]:
        """Fetch details of a specific rental offer"""
        pass

    @abstractmethod
    async def get_quote(
        self,
        offer_id: str,
        rental_days: int = 2,
        insurance_code: Optional[str] = "basic",
        current_price: Optional[float] = None
    ) -> NormalizedCarRentalQuote:
        """Fetch authoritative price quote for self-drive rental"""
        pass

    @abstractmethod
    async def create_booking(
        self,
        quote_id: str,
        driver_details: Dict[str, Any],
        idempotency_key: str,
        amount: float
    ) -> NormalizedCarRentalBookingResult:
        """Create self-drive rental booking"""
        pass

    @abstractmethod
    async def cancel_booking(self, booking_ref: str, reason: Optional[str] = None) -> Dict[str, Any]:
        """Cancel self-drive rental booking"""
        pass
