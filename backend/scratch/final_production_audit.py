import httpx
import asyncio
import json

async def audit_route(client, origin, dest):
    url = f"https://make-my-trip-production.up.railway.app/api/v1/flights/search"
    params = {"from": origin, "to": dest, "passengers": 1}
    try:
        resp = await client.get(url, params=params, timeout=20.0)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                # Check for mix of mock data
                has_db = any(item.get("provider_name") == "Local Database" for item in data)
                has_booking = any(item.get("provider_name") == "Booking.com" for item in data)
                
                # Check mapping correctness
                first = data[0]
                mapping_ok = all(
                    first.get(k) is not None for k in 
                    ["airline", "flight_number", "departureTime", "arrivalTime", "duration", "price", "currency", "baggage", "cancellation_policy"]
                )
                
                return {
                    "success": True,
                    "count": len(data),
                    "first_price": first.get("price"),
                    "first_airline": first.get("airline"),
                    "first_flight": first.get("flight_number"),
                    "provider": first.get("provider_name"),
                    "source": first.get("provider_source"),
                    "status": first.get("provider_status"),
                    "is_simulated": first.get("is_simulated"),
                    "is_cached": first.get("is_cached"),
                    "has_db": has_db,
                    "has_booking": has_booking,
                    "mapping_ok": mapping_ok
                }
            else:
                return {"success": True, "count": 0, "reason": "No offers returned"}
        else:
            return {"success": False, "status_code": resp.status_code, "reason": resp.text[:100]}
    except Exception as e:
        return {"success": False, "reason": str(e)}

async def main():
    routes = [
        ("DEL", "GOI"),
        ("DEL", "BOM"),
        ("DEL", "BLR"),
        ("BOM", "DXB"),
        ("DEL", "BKK"),
        ("DEL", "SIN"),
        ("BOM", "GOI"),
        ("HYD", "DEL"),
        ("CCU", "BOM"),
        ("MAA", "DEL")
    ]
    
    print("==================================================")
    print("FINAL PRODUCTION AUDIT: QUERYING 10 ROUTES")
    print("==================================================")
    
    async with httpx.AsyncClient() as client:
        results = {}
        for origin, dest in routes:
            res = await audit_route(client, origin, dest)
            results[f"{origin}->{dest}"] = res
            print(f"{origin}->{dest}: Success={res.get('success')} | Count={res.get('count')} | Provider={res.get('provider')} | Price={res.get('first_price')} | HasDB={res.get('has_db')} | MappingOK={res.get('mapping_ok')}")
            
        print("\nAudit Summary (JSON):")
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
