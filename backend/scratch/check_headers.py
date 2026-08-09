import httpx
import asyncio

async def main():
    url = "https://make-my-trip-production.up.railway.app/api/v1/system/provider-health"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10.0)
        print("Status:", resp.status_code)
        print("Headers:")
        for k, v in resp.headers.items():
            print(f"  {k}: {v}")
            
if __name__ == "__main__":
    asyncio.run(main())
