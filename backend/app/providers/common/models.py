import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class LiveVehicleOffer(BaseModel):
    id: str = Field(..., description="Unique Ghumne Chale normalized offer identifier")
    provider: str = Field(..., description="Provider attribution name (e.g. Amadeus, Duffel, Ghumne Chale Fleet)")
    provider_offer_id: str = Field(..., description="Raw provider quote / offer reference")
    offer_type: str = Field("cab", description="cab, transfer, or self_drive")
    brand: str
    model: str
    display_name: str
    variant: Optional[str] = "Standard"
    category: str = Field("Sedan", description="Hatchback, Sedan, SUV, MPV, Luxury, EV, Bike")
    image: str = Field(..., description="URL to vehicle photo/asset")
    image_key: str
    seats: int = 4
    luggage: int = 2
    fuel_type: str = "Petrol"
    transmission: str = "Automatic"
    air_conditioning: bool = True
    rating: float = 4.8
    review_count: int = 1200
    plate_number: Optional[str] = None
    price: float = Field(..., description="Total price in target currency")
    currency: str = "INR"
    taxes: float = 0.0
    fees: float = 0.0
    deposit: Optional[float] = None
    included_mileage: Optional[str] = None
    extra_mileage_price: Optional[float] = None
    pickup: str
    dropoff: str
    availability: str = "available"
    cancellation_policy: str
    is_live: bool = False
    source: str = "demo"  # "live" or "demo"
    expires_at: str = Field(..., description="ISO 8601 timestamp of quote validity")


class ProviderQuote(BaseModel):
    quote_id: str
    offer_id: str
    provider: str
    provider_offer_id: str
    base_price: float
    taxes: float
    fees: float
    total_price: float
    currency: str = "INR"
    expires_at: str
    is_price_changed: bool = False
    old_price: Optional[float] = None
    new_price: Optional[float] = None


class ProviderBookingResult(BaseModel):
    success: bool
    booking_reference: str
    provider_booking_id: str
    provider: str
    status: str
    pickup_instructions: Optional[str] = None
    voucher_url: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    vehicle_number: Optional[str] = None
    reconciliation_required: bool = False
    message: str = "Booking confirmed"


class ProviderHealthStatus(BaseModel):
    provider: str
    service: str
    status: str  # HEALTHY, DEGRADED, OFFLINE, NOT_CONFIGURED
    latency_ms: float
    last_success: Optional[str] = None
    last_failure: Optional[str] = None
    failure_count: int = 0
    rate_limit_state: str = "NORMAL"


class UniversalNormalizedOffer(BaseModel):
    id: str = Field(..., description="Unique Ghumne Chale normalized offer ID")
    provider: str = Field(..., description="Upstream provider source (e.g. Amadeus, Hotelbeds, Ghumne Chale Fleet)")
    provider_offer_id: str = Field(..., description="Raw provider quote / offer reference")
    vertical: str = Field(..., description="flights, hotels, trains, cabs, cars, activities")
    title: str
    description: Optional[str] = ""
    image: str
    location: str
    availability: str = "available"
    price: float = Field(..., description="Total price in target currency")
    currency: str = "INR"
    taxes: float = 0.0
    fees: float = 0.0
    total: float
    cancellation_policy: str = "Standard cancellation rules apply"
    expires_at: str = Field(..., description="ISO 8601 timestamp of quote validity")
    provider_metadata: Dict[str, Any] = Field(default_factory=dict)

