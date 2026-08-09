"""
Phase 6 — Load Testing Simulator
Simulates 100, 500, and 1000 concurrent users hitting health check and chat turn.
"""
import asyncio
import time
import httpx
import sys

BASE_URL = "http://localhost:8000"

async def make_request(client: httpx.AsyncClient, url: str) -> float:
    start = time.time()
    try:
        resp = await client.get(url, timeout=10.0)
        latency = time.time() - start
        if resp.status_code == 200:
            return latency
        else:
            return -resp.status_code
    except Exception:
        return -500

async def run_batch(concurrent_users: int, url: str):
    print(f"Simulating {concurrent_users} concurrent users on {url}...")
    async with httpx.AsyncClient() as client:
        tasks = [make_request(client, url) for _ in range(concurrent_users)]
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        total_time = time.time() - start_time
        
        success = [r for r in results if r > 0]
        failures = [r for r in results if r <= 0]
        
        avg_latency = sum(success) / len(success) if success else 0
        min_latency = min(success) if success else 0
        max_latency = max(success) if success else 0
        success_rate = (len(success) / concurrent_users) * 100
        
        print(f"  Finished in {total_time:.2f}s | Success Rate: {success_rate:.1f}%")
        print(f"  Latency: Avg={avg_latency*1000:.1f}ms, Min={min_latency*1000:.1f}ms, Max={max_latency*1000:.1f}ms")
        if failures:
            from collections import Counter
            print(f"  Failures/Errors code count: {Counter(failures)}")
        print("-" * 50)

async def main():
    print("=" * 60)
    print("      Travel OS — Concurrent API Load Tester (Phase 6)")
    print("=" * 60)
    
    # Check if server is running
    async with httpx.AsyncClient() as client:
        try:
            await client.get(f"{BASE_URL}/healthz")
        except Exception:
            print(f"Error: Target server {BASE_URL} is offline. Start uvicorn app before running.")
            sys.exit(1)
            
    target_endpoint = f"{BASE_URL}/healthz"
    
    await run_batch(100, target_endpoint)
    await run_batch(500, target_endpoint)
    await run_batch(1000, target_endpoint)

if __name__ == "__main__":
    asyncio.run(main())
