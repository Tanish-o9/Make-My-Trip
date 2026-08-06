import asyncio
import logging
import json
import datetime
from typing import Dict, Any, List
from difflib import SequenceMatcher
from app.providers.registry import provider_registry
from app.providers.base import NormalizedOffer
from app.utils.redis_client import redis_client

logger = logging.getLogger(__name__)

def normalize_flight_number(flight_num: str) -> str:
    if not flight_num:
        return ""
    cleaned = flight_num.replace(" ", "").replace("-", "").upper()
    if len(cleaned) > 2 and cleaned[:2].isalpha():
        carrier = cleaned[:2]
        number = cleaned[2:].lstrip("0")
        return f"{carrier}{number}"
    return cleaned

def clean_hotel_name(name: str) -> str:
    if not name:
        return ""
    name = name.lower()
    cleaned = "".join(c if c.isalnum() or c.isspace() else " " for c in name)
    stop_words = {"hotel", "resort", "spa", "villas", "suites", "inn", "and", "the", "by", "of", "stay", "palace"}
    words = [w for w in cleaned.split() if w not in stop_words]
    return " ".join(words)

def hotel_names_match(name1: str, name2: str) -> bool:
    n1 = clean_hotel_name(name1)
    n2 = clean_hotel_name(name2)
    if not n1 or not n2:
        return False
    
    # Token-sorted comparison
    w1 = sorted(n1.split())
    w2 = sorted(n2.split())
    
    if w1 == w2:
        return True
        
    s1 = " ".join(w1)
    s2 = " ".join(w2)
    return SequenceMatcher(None, s1, s2).ratio() >= 0.80

class PriceCompareAgent:
    @staticmethod
    async def compare_flights(origin: str, destination: str, date: str) -> List[NormalizedOffer]:
        cache_key = f"price_compare:flights:{origin}:{destination}:{date}"
        
        if redis_client:
            try:
                cached_data = redis_client.get(cache_key)
                if cached_data:
                    logger.info("Found cached flight results in Redis.")
                    parsed = json.loads(cached_data)
                    return [NormalizedOffer(**item) for item in parsed]
            except Exception as ce:
                logger.warning(f"Failed to read from Redis cache: {ce}")

        try:
            results = await asyncio.wait_for(provider_registry.flight_manager.search_all(origin, destination, date), timeout=8.0)
        except asyncio.TimeoutError:
            logger.warning("Flight search parallel gather timed out!")
            results = []

        if not results:
            return []

        # Deduplicate by normalized flight_number
        grouped: Dict[str, List[NormalizedOffer]] = {}
        for offer in results:
            flight_num = normalize_flight_number(offer.raw_provider_ref)
            if flight_num not in grouped:
                grouped[flight_num] = []
            grouped[flight_num].append(offer)

        final_offers = []
        for flight_num, offers_list in grouped.items():
            offers_list.sort(key=lambda o: o.price)
            best_offer = offers_list[0]
            alts = []
            for alt in offers_list[1:]:
                alts.append({
                    "provider_name": alt.provider_name,
                    "price": alt.price,
                    "offer_id": alt.id,
                    "is_simulated": alt.is_simulated
                })
            best_offer.details["alternatives"] = alts
            final_offers.append(best_offer)

        final_offers.sort(key=lambda o: o.price)

        if redis_client and final_offers:
            try:
                serialized = json.dumps([o.model_dump() for o in final_offers], default=str)
                redis_client.setex(cache_key, 120, serialized)
            except Exception as ce:
                logger.warning(f"Failed to cache to Redis: {ce}")

        return final_offers

    @staticmethod
    async def compare_hotels(destination: str, check_in: str, check_out: str) -> List[NormalizedOffer]:
        cache_key = f"price_compare:hotels:{destination}:{check_in}:{check_out}"
        
        if redis_client:
            try:
                cached_data = redis_client.get(cache_key)
                if cached_data:
                    parsed = json.loads(cached_data)
                    return [NormalizedOffer(**item) for item in parsed]
            except Exception as ce:
                logger.warning(f"Redis cache read error: {ce}")

        try:
            results = await asyncio.wait_for(provider_registry.hotel_manager.search_all(destination, check_in, check_out), timeout=8.0)
        except asyncio.TimeoutError:
            logger.warning("Hotel search parallel gather timed out!")
            results = []

        if not results:
            return []

        # Deduplicate by fuzzy hotel name match
        grouped: Dict[str, List[NormalizedOffer]] = {}
        for offer in results:
            hotel_name = offer.details.get("name", "Unknown Hotel")
            matched_key = None
            for key in grouped.keys():
                if hotel_names_match(hotel_name, key):
                    matched_key = key
                    break
            if matched_key is None:
                matched_key = hotel_name
                grouped[matched_key] = []
            grouped[matched_key].append(offer)

        final_offers = []
        for hotel_name, offers_list in grouped.items():
            offers_list.sort(key=lambda o: o.price)
            best_offer = offers_list[0]
            alts = []
            for alt in offers_list[1:]:
                alts.append({
                    "provider_name": alt.provider_name,
                    "price": alt.price,
                    "offer_id": alt.id,
                    "is_simulated": alt.is_simulated
                })
            best_offer.details["alternatives"] = alts
            final_offers.append(best_offer)

        final_offers.sort(key=lambda o: o.price)

        if redis_client and final_offers:
            try:
                serialized = json.dumps([o.model_dump() for o in final_offers], default=str)
                redis_client.setex(cache_key, 120, serialized)
            except Exception as ce:
                logger.warning(f"Redis cache write error: {ce}")

        return final_offers

    @staticmethod
    async def compare_vehicles(city: str, pickup: str, drop: str, type: str, self_drive: bool) -> List[NormalizedOffer]:
        cache_key = f"price_compare:vehicles:{city}:{pickup}:{drop}:{type}:{self_drive}"
        
        if redis_client:
            try:
                cached_data = redis_client.get(cache_key)
                if cached_data:
                    parsed = json.loads(cached_data)
                    return [NormalizedOffer(**item) for item in parsed]
            except Exception as ce:
                logger.warning(f"Redis cache read error: {ce}")

        providers = provider_registry.get_vehicle_providers()
        tasks = [provider.search(city, pickup, drop, type, self_drive) for provider in providers]
        results = []
        try:
            completed_tasks = await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=8.0)
            for task_res in completed_tasks:
                if not isinstance(task_res, Exception) and isinstance(task_res, list):
                    results.extend(task_res)
        except asyncio.TimeoutError:
            logger.warning("Vehicle search parallel gather timed out!")

        if not results:
            return []

        # Deduplicate by vehicle name
        grouped: Dict[str, List[NormalizedOffer]] = {}
        for offer in results:
            veh_name = offer.details.get("name", "Unknown Vehicle").lower()
            if veh_name not in grouped:
                grouped[veh_name] = []
            grouped[veh_name].append(offer)

        final_offers = []
        for veh_name, offers_list in grouped.items():
            offers_list.sort(key=lambda o: o.price)
            best_offer = offers_list[0]
            alts = []
            for alt in offers_list[1:]:
                alts.append({
                    "provider_name": alt.provider_name,
                    "price": alt.price,
                    "offer_id": alt.id
                })
            best_offer.details["alternatives"] = alts
            final_offers.append(best_offer)

        final_offers.sort(key=lambda o: o.price)

        if redis_client and final_offers:
            try:
                serialized = json.dumps([o.model_dump() for o in final_offers], default=str)
                redis_client.setex(cache_key, 120, serialized)
            except Exception as ce:
                logger.warning(f"Redis cache write error: {ce}")

        return final_offers
