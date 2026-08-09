import httpx
import asyncio

async def test_cache():
    url = "https://make-my-trip-production.up.railway.app/api/v1/flights/search"
    params = {"from": "DEL", "to": "GOI", "passengers": 1}
    
    print("--- First Search (Should cache the result if cache miss) ---")
    async with httpx.AsyncClient() as client:
        resp1 = await client.get(url, params=params, timeout=20.0)
        print(f"First Status: {resp1.status_code}")
        if resp1.status_code == 200:
            data1 = resp1.json()
            print(f"First offers returned: {len(data1)}")
            if data1:
                print(f"First offer is_cached: {data1[0].get('is_cached')}")
                
        print("\n--- Second Search (Should be a Redis Cache Hit) ---")
        resp2 = await client.get(url, params=params, timeout=20.0)
        print(f"Second Status: {resp2.status_code}")
        if resp2.status_code == 200:
            data2 = resp2.json()
            print(f"Second offers returned: {len(data2)}")
            if data2:
                print(f"Second offer is_cached: {data2[0].get('is_cached')}")
                print(f"Second offer provider_name: {data2[0].get('provider_name')}")
                print(f"Second offer provider_latency: {data2[0].get('provider_latency')}")
                print(f"Second offer provider_source: {data2[0].get('provider_source')}")

if __name__ == "__main__":
    asyncio.run(test_cache())
