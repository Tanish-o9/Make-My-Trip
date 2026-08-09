import time
import asyncio
import httpx
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.search_entities import HotelProperty
from app.routes.search import attach_media_to_results
from app.utils.http_client import async_client

async def benchmark_search_media():
    print("--- Benchmarking Unified Search Media Attachment ---")
    
    # Setup mock search results
    mock_results = []
    for i in range(25):
        mock_results.append({
            "name": f"Hotel Mock HB-{i}",
            "provider": f"HB-{i}",
            "room_type": "Standard Room"
        })
        
    start_time = time.perf_counter()
    # Execute batch attach
    res = attach_media_to_results(mock_results, "hotel")
    end_time = time.perf_counter()
    
    latency_ms = (end_time - start_time) * 1000
    print(f"Attached media to {len(mock_results)} items in {latency_ms:.2f}ms")
    print(f"First item photo: {res[0].get('primary_photo_url')}")
    print("---------------------------------------------------\n")

async def benchmark_http_reuse():
    print("--- Benchmarking Shared HTTP Client Connection Reuse vs. New Clients ---")
    
    test_url = "https://www.google.com"
    count = 10
    
    # 1. Hot instantiation (creating new client each time)
    start_time = time.perf_counter()
    for _ in range(count):
        async with httpx.AsyncClient() as client:
            try:
                await client.get(test_url, timeout=2.0)
            except Exception:
                pass
    new_client_time = time.perf_counter() - start_time
    print(f"Creating new httpx.AsyncClient per request ({count} requests): {new_client_time:.2f}s total (avg: {new_client_time/count*1000:.2f}ms)")
    
    # 2. Connection Reuse (pooled shared async_client)
    start_time = time.perf_counter()
    for _ in range(count):
        try:
            await async_client.get(test_url, timeout=2.0)
        except Exception:
            pass
    pooled_client_time = time.perf_counter() - start_time
    print(f"Reusing shared async_client connection pool ({count} requests): {pooled_client_time:.2f}s total (avg: {pooled_client_time/count*1000:.2f}ms)")
    
    speedup = (new_client_time / pooled_client_time) if pooled_client_time > 0 else 0
    print(f"TCP Connection Reuse Speedup: {speedup:.2f}x faster!")
    print("---------------------------------------------------\n")

async def main():
    await benchmark_search_media()
    try:
        await benchmark_http_reuse()
    except Exception as e:
        print(f"HTTP benchmark skipped/failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
