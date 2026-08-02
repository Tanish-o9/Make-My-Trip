import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from abc import ABC, abstractmethod

class NormalizedOffer(BaseModel):
    id: str = Field(..., description="Unique offer identifier generated/provided by adapter")
    provider_name: str = Field(..., description="Name of the source provider/aggregator")
    price: float = Field(..., description="The calculated cost for the offer")
    currency: str = Field("INR", description="Currency code")
    availability_status: str = Field("available", description="available or sold_out")
    cancellation_policy: str = Field("Refundable", description="Refundable, Non-Refundable, or custom policy text")
    raw_provider_ref: str = Field(..., description="Internal reference ID from the raw provider API")
    expires_at: datetime.datetime = Field(..., description="Expiration timestamp for the quote validity")
    details: Dict[str, Any] = Field(default_factory=dict, description="Custom properties: flights, hotels or vehicles specific info")
    is_simulated: bool = Field(False, description="True if this offer came from a simulated/mock provider with no real API connection. Frontend MUST NOT show provider attribution for simulated offers.")

class BaseFlightProvider(ABC):
    @abstractmethod
    async def search(self, origin: str, destination: str, date: str) -> List[NormalizedOffer]:
        """Search flight offers matching criteria"""
        pass

    @abstractmethod
    async def hold(self, offer_id: str, passenger_details: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Place a provider-side price/seat hold"""
        pass

    @abstractmethod
    async def confirm(self, hold_id: str, payment_ref: str) -> Dict[str, Any]:
        """Confirm/Capture the booking at the provider"""
        pass

    @abstractmethod
    async def cancel(self, booking_ref: str) -> Dict[str, Any]:
        """Cancel booking at the provider"""
        pass

class BaseHotelProvider(ABC):
    @abstractmethod
    async def search(self, destination: str, check_in: str, check_out: str) -> List[NormalizedOffer]:
        """Search hotel offers matching criteria"""
        pass

    @abstractmethod
    async def hold(self, offer_id: str, guest_details: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Place a provider-side room/price hold"""
        pass

    @abstractmethod
    async def confirm(self, hold_id: str, payment_ref: str) -> Dict[str, Any]:
        """Confirm/Capture the booking at the provider"""
        pass

    @abstractmethod
    async def cancel(self, booking_ref: str) -> Dict[str, Any]:
        """Cancel booking at the provider"""
        pass

class BaseVehicleProvider(ABC):
    @abstractmethod
    async def search(self, city: str, pickup: str, drop: str, type: str, self_drive: bool) -> List[NormalizedOffer]:
        """Search vehicle rental offers matching criteria"""
        pass

    @abstractmethod
    async def hold(self, offer_id: str, driver_details: Dict[str, Any]) -> Dict[str, Any]:
        """Place a provider-side vehicle/price hold"""
        pass

    @abstractmethod
    async def confirm(self, hold_id: str, payment_ref: str) -> Dict[str, Any]:
        """Confirm/Capture the booking at the provider"""
        pass

    @abstractmethod
    async def cancel(self, booking_ref: str) -> Dict[str, Any]:
        """Cancel booking at the provider"""
        pass
