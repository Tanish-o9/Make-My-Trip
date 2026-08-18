from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any, Optional
from app.services.flight_service import FlightService
from app.services.amadeus_client import AmadeusClient
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Shared Amadeus client instance for auxiliary endpoints
_amadeus = AmadeusClient()


@router.get("/search", response_model=List[Dict[str, Any]])
async def search_flights(
    from_airport: str = Query(..., alias="from", description="Departure IATA code"),
    to_airport: str = Query(..., alias="to", description="Arrival IATA code"),
    passengers: int = Query(1, description="Number of passengers"),
    date: Optional[str] = Query(None, description="Departure date YYYY-MM-DD"),
    time: Optional[str] = Query(None, description="Preferred departure time"),
    cabin: Optional[str] = Query(None, description="Cabin class"),
    refresh: bool = Query(False, description="Bypass cache for fresh search results"),
):
    """
    Search flights from departure to arrival airports.
    Example: GET /api/v1/flights/search?from=DEL&to=GOI&passengers=1&date=2026-08-14&refresh=true
    """
    from_clean = from_airport.strip().upper()
    to_clean = to_airport.strip().upper()

    if len(from_clean) != 3 or not from_clean.isalpha():
        raise HTTPException(status_code=400, detail="Departure airport IATA code must be exactly 3 alphabetic letters.")

    if len(to_clean) != 3 or not to_clean.isalpha():
        raise HTTPException(status_code=400, detail="Arrival airport IATA code must be exactly 3 alphabetic letters.")

    try:
        results = await FlightService.search_flights(from_clean, to_clean, passengers, date_str=date, refresh=refresh)
        if not results:
            raise HTTPException(status_code=404, detail=f"No flights found matching the route {from_clean} to {to_clean}.")
        return results[:7]
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in search_flights endpoint: {e}")
        err_msg = str(e)
        if "no flights found" in err_msg.lower() or "0 offers" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)


@router.get("/airports", response_model=List[Dict[str, Any]])
async def search_airports(
    q: str = Query(..., description="Search keyword (airport name, city, or IATA code)"),
    type: str = Query("AIRPORT,CITY", description="Location type: AIRPORT, CITY, or AIRPORT,CITY"),
):
    """
    Airport autocomplete search using Amadeus reference data.
    Example: GET /api/v1/flights/airports?q=DEL
    """
    keyword = q.strip()
    if len(keyword) < 2:
        raise HTTPException(status_code=400, detail="Keyword must be at least 2 characters.")

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, _amadeus.search_airports, keyword, type)
        return results
    except Exception as e:
        logger.error(f"Error in airport search endpoint: {e}")
        return _amadeus._mock_airports(keyword)


@router.get("/inspiration", response_model=List[Dict[str, Any]])
async def get_flight_inspiration(
    origin: str = Query(..., description="Origin IATA code, e.g. DEL"),
    max_price: Optional[int] = Query(None, description="Maximum price filter"),
    date: Optional[str] = Query(None, description="Preferred departure date YYYY-MM-DD"),
):
    """
    Get cheap flight destination ideas from an origin airport.
    Example: GET /api/v1/flights/inspiration?origin=DEL&max_price=10000
    """
    origin_clean = origin.strip().upper()
    if len(origin_clean) != 3 or not origin_clean.isalpha():
        raise HTTPException(status_code=400, detail="Origin must be a valid 3-letter IATA code.")

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None, _amadeus.get_flight_inspiration, origin_clean, max_price, date
        )
        return results
    except Exception as e:
        logger.error(f"Error in flight inspiration endpoint: {e}")
        return _amadeus._mock_inspiration(origin_clean)


@router.get("/status", response_model=List[Dict[str, Any]])
async def get_flight_status(
    carrier: str = Query(..., description="Airline IATA carrier code, e.g. 6E"),
    flight: str = Query(..., description="Flight number (digits only), e.g. 201"),
    date: str = Query(..., description="Scheduled departure date YYYY-MM-DD"),
):
    """
    Get real-time flight schedule/status for a specific flight.
    Example: GET /api/v1/flights/status?carrier=6E&flight=201&date=2026-08-10
    """
    carrier_clean = carrier.strip().upper()
    flight_clean = flight.strip()
    date_clean = date.strip()

    if not carrier_clean or not flight_clean or not date_clean:
        raise HTTPException(status_code=400, detail="carrier, flight, and date are all required.")

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None, _amadeus.get_flight_status, carrier_clean, flight_clean, date_clean
        )
        return results
    except Exception as e:
        logger.error(f"Error in flight status endpoint: {e}")
        return _amadeus._mock_flight_status(carrier_clean, flight_clean, date_clean)
