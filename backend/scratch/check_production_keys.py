import httpx
import asyncio
import json

async def test_route(client, origin, dest):
    url = f"https://make-my-trip-production.up.railway.app/api/v1/flights/search"
    params = {"from": origin, "to": dest, "passengers": 1}
    print(f"\nSearching: {origin} -> {dest}")
    try:
        resp = await client.get(url, params=params, timeout=20.0)
        print(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Offers returned: {len(data)}")
            if data:
                print(f"First offer detail:")
                print(f"  provider_name: {data[0].get('provider_name')}")
                print(f"  provider_source: {data[0].get('provider_source')}")
                print(f"  provider_latency: {data[0].get('provider_latency')}")
                print(f"  provider_status: {data[0].get('provider_status')}")
                print(f"  is_cached: {data[0].get('is_cached')}")
                print(f"  is_simulated: {data[0].get('is_simulated')}")
            else:
                print("  No offers in list.")
        else:
            print(f"  Error: {resp.text}")
    except Exception as e:
        print(f"  Failed: {e}")

async def main():
    async with httpx.AsyncClient() as client:
        # Phase 1: Provider Health
        health_url = "https://make-my-trip-production.up.railway.app/api/v1/system/provider-health"
        print("--- PHASE 1: Provider Health ---")
        try:
            resp = await client.get(health_url, timeout=10.0)
            print(f"Health check status: {resp.status_code}")
            print(json.dumps(resp.json(), indent=2))
        except Exception as e:
            print(f"Health check failed: {e}")
            
        # Phase 3: Live searches
        print("\n--- PHASE 3: Live Flight Searches ---")
        routes = [
            ("DEL", "GOI"),
            ("DEL", "BOM"),
            ("DEL", "BLR"),
            ("BOM", "DXB"),
            ("DEL", "BKK"),
            ("DEL", "SIN")
        ]
        for origin, dest in routes:
            await test_route(client, origin, dest)

if __name__ == "__main__":
    asyncio.run(main())
