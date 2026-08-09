import httpx
import asyncio

async def main():
    url = "https://make-my-trip-production.up.railway.app/api/v1/system/provider-health"
    print(f"Querying production health: {url}")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            print(f"Status Code: {resp.status_code}")
            if resp.status_code == 200:
                import json
                print(json.dumps(resp.json(), indent=2))
            else:
                # Try the other prefix: /api/system/provider-health
                url_alt = "https://make-my-trip-production.up.railway.app/api/system/provider-health"
                print(f"Alt Querying: {url_alt}")
                resp_alt = await client.get(url_alt, timeout=10.0)
                print(f"Alt Status Code: {resp_alt.status_code}")
                if resp_alt.status_code == 200:
                    import json
                    print(json.dumps(resp_alt.json(), indent=2))
                else:
                    print(f"Error: {resp_alt.text}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
