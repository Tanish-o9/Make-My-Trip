import httpx
import sys

async def main():
    url = "http://localhost:8000/api/v1/flights/search"
    params = {"from": "DEL", "to": "GOI", "passengers": 1}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params, timeout=10.0)
            print(f"Status Code: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"Returned {len(data)} offers.")
                for idx, item in enumerate(data[:3]):
                    print(f"Offer {idx}: provider_name={item.get('provider_name')}, provider={item.get('provider')}, is_simulated={item.get('is_simulated')}, is_cached={item.get('is_cached')}")
            else:
                print(f"Error body: {resp.text}")
    except Exception as e:
        print(f"Failed to connect to local server: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
