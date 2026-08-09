import asyncio
import os
import sys
import logging
from dotenv import load_dotenv

# Load env
load_dotenv()

logging.basicConfig(level=logging.WARNING)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.providers.flights.booking_dot_com import BookingDotComFlightProvider
from app.providers.flights.skyscanner_rapid import SkyscannerRapidProvider
from app.providers.flights.amadeus import AmadeusProvider

async def test_route(origin: str, dest: str, date: str):
    print(f"\n--- Testing Route: {origin} -> {dest} ---")
    
    # 1. Booking.com
    b_provider = BookingDotComFlightProvider()
    try:
        offers = await b_provider.search(origin, dest, date)
        print(f"  Booking.com: SUCCESS | Returned {len(offers)} offers. (is_simulated={offers[0].is_simulated if offers else 'N/A'})")
    except Exception as e:
        print(f"  Booking.com: FAILED | {str(e)[:100]}")
        
    # 2. Skyscanner
    s_provider = SkyscannerRapidProvider()
    try:
        offers = await s_provider.search(origin, dest, date)
        print(f"  Skyscanner: SUCCESS | Returned {len(offers)} offers. (is_simulated={offers[0].is_simulated if offers else 'N/A'})")
    except Exception as e:
        print(f"  Skyscanner: FAILED | {str(e)[:100]}")

async def main():
    date = "2026-10-15"
    routes = [
        ("DEL", "GOI"),
        ("DEL", "BOM"),
        ("DEL", "BLR"),
        ("BOM", "GOI"),
        ("HYD", "DEL")
    ]
    for orig, dest in routes:
        await test_route(orig, dest, date)

if __name__ == "__main__":
    asyncio.run(main())
