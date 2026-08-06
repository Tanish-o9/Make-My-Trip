from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any
from app.services.flight_service import FlightService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/search", response_model=List[Dict[str, Any]])
async def search_flights(
    from_airport: str = Query(..., alias="from", description="Departure IATA code"),
    to_airport: str = Query(..., alias="to", description="Arrival IATA code"),
    passengers: int = Query(1, description="Number of passengers")
):
    """
    Endpoint to search flights from departure to arrival airports.
    Example: GET /api/flights/search?from=DEL&to=GOI&passengers=1
    """
    from_clean = from_airport.strip().upper()
    to_clean = to_airport.strip().upper()
    
    if len(from_clean) != 3 or not from_clean.isalpha():
        raise HTTPException(
            status_code=400,
            detail="Departure airport IATA code must be exactly 3 alphabetic letters."
        )
        
    if len(to_clean) != 3 or not to_clean.isalpha():
        raise HTTPException(
            status_code=400,
            detail="Arrival airport IATA code must be exactly 3 alphabetic letters."
        )

    try:
        results = await FlightService.search_flights(from_clean, to_clean, passengers)
        if not results:
            raise HTTPException(
                status_code=404,
                detail=f"No flights found matching the route {from_clean} to {to_clean}."
            )
        return results
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in search_flights endpoint: {e}")
        err_msg = str(e)
        if "no flights found" in err_msg.lower() or "0 offers" in err_msg.lower():
            raise HTTPException(
                status_code=404,
                detail=err_msg
            )
        raise HTTPException(
            status_code=400,
            detail=err_msg
        )
