from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

class BusProvider(ABC):
    @abstractmethod
    async def search(self, origin: str, destination: str, date: str) -> List[Dict[str, Any]]:
        """
        Search for available buses between origin and destination on a given date.
        """
        pass

    @abstractmethod
    async def get_details(self, bus_id: str) -> Dict[str, Any]:
        """
        Retrieve full details and boarding/dropping points for a specific bus.
        """
        pass

    @abstractmethod
    async def hold(self, offer_id: str, passengers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Place a temporary hold on the seats/berths before payment capture.
        """
        pass

class LocalBusProvider(BusProvider):
    async def search(self, origin: str, destination: str, date: str) -> List[Dict[str, Any]]:
        # Locally served from database
        return []

    async def get_details(self, bus_id: str) -> Dict[str, Any]:
        return {}

    async def hold(self, offer_id: str, passengers: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Return success hold response for the backend hold router
        import uuid
        return {
            "success": True,
            "hold_id": f"BUS-HLD-{uuid.uuid4().hex[:6].upper()}",
            "message": "Seats held successfully with local adapter."
        }
