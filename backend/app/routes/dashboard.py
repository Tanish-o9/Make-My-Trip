import datetime
import io
import os
import zipfile
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User, UserProfile, WalletAccount, LoyaltyAccount, Wishlist, Trip, TripMember
from app.models.audit import Notification
from app.models.wishlist import WishlistItem
from app.services.notification_service import NotificationService

from app.models.bookings import (
    FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking,
    HolidayPackageBooking, ActivityBooking, CruiseBooking, VisaApplication,
    InsurancePolicy, VillaBooking, ForexOrder, VehicleRentalBooking, BookingTicket, BookingInvoice
)

logger = logging.getLogger("travel_os.dashboard")

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

class TripCreateRequest(BaseModel):
    name: str
    destination: Optional[str] = None
    start_date: Optional[str] = None # YYYY-MM-DD
    end_date: Optional[str] = None # YYYY-MM-DD
    booking_references: Optional[List[str]] = []

class TripUpdateRequest(BaseModel):
    name: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[str] = None # YYYY-MM-DD
    end_date: Optional[str] = None # YYYY-MM-DD
    is_archived: Optional[bool] = None
    booking_references: Optional[List[str]] = None


# Helper to list all bookings for a user
def get_all_user_bookings(db: Session, user_id: int):
    models = [
        FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking,
        HolidayPackageBooking, ActivityBooking, CruiseBooking, VisaApplication,
        InsurancePolicy, VillaBooking, ForexOrder, VehicleRentalBooking
    ]
    all_bookings = []
    for model in models:
        bookings = db.query(model).filter(model.user_id == user_id).all()
        # translate vertical
        vertical = model.__tablename__.replace("_bookings", "").replace("_orders", "").replace("_policies", "").replace("_applications", "")
        vertical_map = {
            "flight": "flights",
            "hotel": "hotels",
            "train": "trains",
            "bus": "buses",
            "cab": "cabs",
            "activity": "activities",
            "cruise": "cruises",
            "villa": "villas",
            "vehicle_rental": "cars",
            "holiday_package": "holidays",
            "forex_order": "forex",
            "visa_application": "visa",
            "insurance_policy": "insurance"
        }
        vertical = vertical_map.get(vertical, vertical)
        for b in bookings:
            b.vertical = vertical
            all_bookings.append(b)
    # Sort by created_at desc
    all_bookings.sort(key=lambda x: x.created_at, reverse=True)
    return all_bookings


# Helper to identify travel dates for grouping & timeline
def get_booking_dates(booking):
    start = booking.created_at
    end = booking.created_at
    vertical = getattr(booking, 'vertical', '')
    
    if vertical == "flights":
        start = booking.departure_time
        end = booking.arrival_time
    elif vertical == "hotels":
        start = booking.check_in
        end = booking.check_out
    elif vertical == "trains":
        start = booking.departure_time
        end = booking.departure_time + datetime.timedelta(hours=6)
    elif vertical == "buses":
        start = booking.departure_time
        end = booking.departure_time + datetime.timedelta(hours=4)
    elif vertical == "cabs":
        start = booking.pickup_time
        end = booking.pickup_time + datetime.timedelta(hours=2)
    elif vertical == "activities":
        start = booking.activity_time
        end = booking.activity_time + datetime.timedelta(hours=3)
    elif vertical == "holidays":
        start = booking.start_date
        end = booking.end_date
    elif vertical == "cruises":
        start = booking.departure_time
        duration = getattr(booking, 'duration_days', 1)
        end = start + datetime.timedelta(days=duration)
    elif vertical == "villas":
        start = booking.check_in
        end = booking.check_out
    elif vertical == "cars":
        start = booking.pickup_time
        end = booking.drop_time
        
    if isinstance(start, datetime.date) and not isinstance(start, datetime.datetime):
        start = datetime.datetime.combine(start, datetime.time.min)
    if isinstance(end, datetime.date) and not isinstance(end, datetime.datetime):
        end = datetime.datetime.combine(end, datetime.time.max)
        
    return start, end


# Helper to identify destination for grouping
def get_booking_destination(booking):
    vertical = getattr(booking, 'vertical', '')
    if vertical == "flights":
        return booking.destination
    elif vertical == "hotels":
        return booking.hotel_name.split()[0] if booking.hotel_name else "Hotel"
    elif vertical == "trains":
        return booking.destination_station
    elif vertical == "buses":
        return booking.destination
    elif vertical == "cabs":
        return booking.drop_address.split(",")[0] if booking.drop_address else "Cab"
    elif vertical == "activities":
        return booking.location
    elif vertical == "holidays":
        return booking.destination
    elif vertical == "cruises":
        return booking.arrival_port
    elif vertical == "villas":
        return getattr(booking, 'city', 'Villa')
    elif vertical == "cars":
        return booking.city
    return "Trip"


# Helper to serialize booking object
def serialize_booking(b):
    vertical = getattr(b, 'vertical', '')
    start_date, end_date = get_booking_dates(b)
    
    res = {
        "id": b.id,
        "booking_reference": b.booking_reference,
        "status": b.status.value if hasattr(b.status, 'value') else b.status,
        "total_amount": float(b.total_amount),
        "currency": b.currency,
        "created_at": b.created_at.isoformat(),
        "vertical": vertical,
        "start_time": start_date.isoformat(),
        "end_time": end_date.isoformat(),
    }
    
    if vertical == "flights":
        res.update({
            "title": f"Flight: {b.origin} ➔ {b.destination}",
            "description": f"Flight {b.airline_code}{b.flight_number} | Class: {b.cabin_class}",
            "origin": b.origin,
            "destination": b.destination,
            "details": f"Airline: {b.airline_code} | Flight: {b.flight_number}"
        })
    elif vertical == "hotels":
        res.update({
            "title": f"Hotel: {b.hotel_name}",
            "description": f"Room: {b.room_type} | Address: {b.address}",
            "hotel_name": b.hotel_name,
            "room_type": b.room_type,
            "details": f"Address: {b.address}"
        })
    elif vertical == "trains":
        res.update({
            "title": f"Train: {b.train_name}",
            "description": f"Train {b.train_number} | Class: {b.coach_class}",
            "origin": b.origin_station,
            "destination": b.destination_station,
            "details": f"Train No: {b.train_number}"
        })
    elif vertical == "buses":
        res.update({
            "title": f"Bus: {b.operator_name}",
            "description": f"Type: {b.bus_type} | Seats: {', '.join(b.seat_numbers) if isinstance(b.seat_numbers, list) else b.seat_numbers}",
            "origin": b.origin,
            "destination": b.destination,
            "details": f"Operator: {b.operator_name}"
        })
    elif vertical == "cabs":
        res.update({
            "title": f"Cab Transfer",
            "description": f"{b.pickup_address} ➔ {b.drop_address}",
            "origin": b.pickup_address,
            "destination": b.drop_address,
            "details": f"Provider: {b.provider_name} | Cab: {b.cab_type}"
        })
    elif vertical == "activities":
        res.update({
            "title": f"Activity: {b.activity_name}",
            "description": f"Location: {b.location} | Tickets: {b.ticket_count}",
            "details": f"Location: {b.location} | Tickets: {b.ticket_count}"
        })
    elif vertical == "holidays":
        res.update({
            "title": f"Holiday Package: {b.package_name}",
            "description": f"Destination: {b.destination}",
            "details": f"Summary: {b.itinerary_summary}"
        })
    elif vertical == "cruises":
        res.update({
            "title": f"Cruise: {b.cruise_line} - {b.ship_name}",
            "description": f"From: {b.departure_port} ➔ {b.arrival_port}",
            "details": f"Cabin: {b.cabin_number}"
        })
    elif vertical == "villas":
        res.update({
            "title": f"Villa: {b.villa_name}",
            "description": f"Max Occupancy: {b.max_occupancy}",
            "details": f"Villa: {b.villa_name}"
        })
    elif vertical == "cars":
        res.update({
            "title": f"Car Rental: {b.vehicle_name}",
            "description": f"City: {b.city} | Type: {b.vehicle_type}",
            "details": f"Fuel: {b.fuel_type} | Transmission: {b.transmission}"
        })
    elif vertical == "forex":
        res.update({
            "title": f"Forex Order: {b.currency_pair}",
            "description": f"Amount: {b.amount}",
            "details": f"Currency Pair: {b.currency_pair}"
        })
    elif vertical == "visa":
        res.update({
            "title": f"Visa Application: {b.country}",
            "description": f"Status: {b.status}",
            "details": f"Country: {b.country}"
        })
    return res


# Smart travel reminders generator
def check_and_generate_travel_reminders(db: Session, user_id: int):
    bookings = get_all_user_bookings(db, user_id)
    now = datetime.datetime.utcnow()
    
    for b in bookings:
        status = b.status.value if hasattr(b.status, 'value') else b.status
        if status not in ["confirmed", "completed", "trip_active"]:
            continue
            
        vertical = b.vertical
        ref = b.booking_reference
        start_time, _ = get_booking_dates(b)
        
        hours_remaining = (start_time - now).total_seconds() / 3600.0
        
        if vertical == "flights":
            if 0 < hours_remaining <= 24:
                idempotency_key = f"reminder_{ref}_24h"
                NotificationService.send_notification(
                    db=db,
                    user_id=user_id,
                    notification_type="TRAVEL",
                    title="✈️ Upcoming Flight Departure",
                    message=f"Your flight {b.airline_code}{b.flight_number} from {b.origin} to {b.destination} departs in {int(hours_remaining)} hours. Remember to web check-in!",
                    booking_reference=ref,
                    vertical=vertical,
                    idempotency_key=idempotency_key
                )
            if 0 < hours_remaining <= 3:
                idempotency_key = f"reminder_{ref}_3h"
                NotificationService.send_notification(
                    db=db,
                    user_id=user_id,
                    notification_type="TRAVEL",
                    title="✈️ Flight Departing Soon",
                    message=f"Your flight {b.airline_code}{b.flight_number} is departing in {int(hours_remaining)} hours. Boarding gate closes 20 minutes before departure.",
                    booking_reference=ref,
                    vertical=vertical,
                    idempotency_key=idempotency_key
                )
        elif vertical == "hotels":
            if 0 < hours_remaining <= 24:
                idempotency_key = f"reminder_{ref}_24h"
                NotificationService.send_notification(
                    db=db,
                    user_id=user_id,
                    notification_type="TRAVEL",
                    title="🏨 Hotel Check-in Tomorrow",
                    message=f"Your check-in at {b.hotel_name} is scheduled for tomorrow at 14:00. Safe travels!",
                    booking_reference=ref,
                    vertical=vertical,
                    idempotency_key=idempotency_key
                )
        elif vertical == "trains":
            if 0 < hours_remaining <= 24:
                idempotency_key = f"reminder_{ref}_24h"
                NotificationService.send_notification(
                    db=db,
                    user_id=user_id,
                    notification_type="TRAVEL",
                    title="🚆 Train Departure Reminder",
                    message=f"Train {b.train_number} ({b.train_name}) departs from {b.origin_station} in {int(hours_remaining)} hours. Check your coach assignment.",
                    booking_reference=ref,
                    vertical=vertical,
                    idempotency_key=idempotency_key
                )
        elif vertical == "buses":
            if 0 < hours_remaining <= 24:
                idempotency_key = f"reminder_{ref}_24h"
                NotificationService.send_notification(
                    db=db,
                    user_id=user_id,
                    notification_type="TRAVEL",
                    title="🚌 Bus Journey Reminder",
                    message=f"Your bus operated by {b.operator_name} departs in {int(hours_remaining)} hours. Be at boarding point 15 mins early.",
                    booking_reference=ref,
                    vertical=vertical,
                    idempotency_key=idempotency_key
                )
        elif vertical == "activities":
            if 0 < hours_remaining <= 24:
                idempotency_key = f"reminder_{ref}_24h"
                NotificationService.send_notification(
                    db=db,
                    user_id=user_id,
                    notification_type="TRAVEL",
                    title="🎟️ Activity Scheduled Tomorrow",
                    message=f"Get ready! Your activity '{b.activity_name}' is scheduled for tomorrow. Have a wonderful time!",
                    booking_reference=ref,
                    vertical=vertical,
                    idempotency_key=idempotency_key
                )


# Smart auto-grouping generator
def auto_group_user_bookings(db: Session, user_id: int):
    all_bookings = get_all_user_bookings(db, user_id)
    if not all_bookings:
        return
        
    persisted_trips = db.query(Trip).filter(Trip.user_id == user_id).all()
    
    linked_refs = set()
    for trip in persisted_trips:
        if trip.booking_references:
            for ref in trip.booking_references:
                linked_refs.add(ref)
                
    unlinked_bookings = [b for b in all_bookings if b.booking_reference not in linked_refs]
    if not unlinked_bookings:
        return
        
    bookings_with_dates = []
    for b in unlinked_bookings:
        start_date, end_date = get_booking_dates(b)
        bookings_with_dates.append((b, start_date, end_date))
        
    bookings_with_dates.sort(key=lambda x: x[1])
    
    groups = []
    current_group = []
    for item in bookings_with_dates:
        booking, start, end = item
        if not current_group:
            current_group.append(item)
        else:
            prev_booking, prev_start, prev_end = current_group[-1]
            gap = (start - prev_end).days
            if gap <= 5:
                current_group.append(item)
            else:
                groups.append(current_group)
                current_group = [item]
                
    if current_group:
        groups.append(current_group)
        
    for group in groups:
        dest = None
        for booking, _, _ in group:
            dest = get_booking_destination(booking)
            if dest and dest != "Trip":
                break
        if not dest:
            dest = "Adventure"
            
        group_start = min(item[1] for item in group).date()
        group_end = max(item[2] for item in group).date()
        refs = [item[0].booking_reference for item in group]
        
        name = f"{dest} Trip"
        
        new_trip = Trip(
            user_id=user_id,
            name=name,
            destination=dest,
            start_date=group_start,
            end_date=group_end,
            booking_references=refs,
            is_archived=False
        )
        db.add(new_trip)
        
    db.commit()


@router.get("")
def get_dashboard_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ── 1. Fetch all bookings ONCE and reuse everywhere ──────────────────────
    all_bookings = get_all_user_bookings(db, current_user.id)

    # ── 2. Background side-effects (non-blocking, skip if no bookings) ───────
    if all_bookings:
        try:
            check_and_generate_travel_reminders(db, current_user.id)
        except Exception as exc:
            logger.warning(f"Travel reminders skipped for user {current_user.id}: {exc}")
        try:
            auto_group_user_bookings(db, current_user.id)
        except Exception as exc:
            logger.warning(f"Auto-grouping skipped for user {current_user.id}: {exc}")

    # ── 3. User profile ───────────────────────────────────────────────────────
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    full_name = profile.full_name if profile else current_user.email.split("@")[0].capitalize()
    first_name = full_name.split()[0] if full_name else "Traveler"

    user_summary = {
        "first_name": first_name,
        "full_name": full_name,
        "email": current_user.email,
        "role": current_user.role
    }

    # ── 4. Wallet, loyalty, counts — single query each ───────────────────────
    wallet = db.query(WalletAccount).filter(WalletAccount.user_id == current_user.id).first()
    wallet_summary = {
        "balance": float(wallet.balance) if wallet else 0.0,
        "currency": wallet.currency if wallet else "INR"
    }

    loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == current_user.id).first()
    reward_points = loyalty.points_balance if loyalty else 0

    wishlist_count = db.query(WishlistItem).filter(WishlistItem.user_id == current_user.id).count()
    notification_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()

    # ── 5. Price alerts — from wishlist items (already queried above) ─────────
    wish_items = db.query(WishlistItem).filter(WishlistItem.user_id == current_user.id).all()
    price_alerts_count = sum(
        1 for item in wish_items
        if float((item.snapshot_json or {}).get("price", 0.0)) > 0
    )

    # ── 6. Recent bookings (already have all_bookings, just slice) ────────────
    recent_bookings = [serialize_booking(b) for b in all_bookings[:5]]

    # ── 7. Upcoming trip ──────────────────────────────────────────────────────
    now = datetime.datetime.utcnow().date()
    trips = db.query(Trip).filter(
        Trip.user_id == current_user.id,
        Trip.is_archived == False
    ).all()

    upcoming_trip = None
    future_trips = [t for t in trips if t.start_date and t.start_date >= now]
    if future_trips:
        future_trips.sort(key=lambda x: x.start_date)
        t = future_trips[0]
        upcoming_bookings = []
        if t.booking_references:
            booking_map = {b.booking_reference: b for b in all_bookings}
            for ref in t.booking_references:
                if ref in booking_map:
                    upcoming_bookings.append(serialize_booking(booking_map[ref]))

        upcoming_trip = {
            "id": t.id,
            "name": t.name,
            "destination": t.destination,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "bookings": upcoming_bookings
        }

    return {
        "user_summary": user_summary,
        "wallet_summary": wallet_summary,
        "reward_points": reward_points,
        "wishlist_count": wishlist_count,
        "notification_count": notification_count,
        "active_price_alerts": price_alerts_count,
        "recent_bookings": recent_bookings,
        "upcoming_trip": upcoming_trip
    }


# ─── TRIP CRUD ENDPOINTS ──────────────────────────────────────────────────────

@router.get("/trips")
def get_user_trips(
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    auto_group_user_bookings(db, current_user.id)
    from sqlalchemy import or_
    member_trip_ids = [m.trip_id for m in db.query(TripMember).filter(TripMember.user_id == current_user.id).all()]
    query = db.query(Trip).filter(or_(Trip.user_id == current_user.id, Trip.id.in_(member_trip_ids)))
    if not include_archived:
        query = query.filter(Trip.is_archived == False)
    
    trips = query.order_by(Trip.start_date.desc()).all()
    
    res = []
    for t in trips:
        member_ids = [m.user_id for m in db.query(TripMember).filter(TripMember.trip_id == t.id).all()]
        if t.user_id not in member_ids:
            member_ids.append(t.user_id)
        
        all_bookings = []
        for m_id in member_ids:
            all_bookings.extend(get_all_user_bookings(db, m_id))
            
        t_bookings = []
        if t.booking_references:
            for ref in t.booking_references:
                for b in all_bookings:
                    if b.booking_reference == ref:
                        t_bookings.append(serialize_booking(b))
                        
        res.append({
            "id": t.id,
            "name": t.name,
            "destination": t.destination,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "is_archived": t.is_archived,
            "booking_references": t.booking_references or [],
            "bookings_count": len(t_bookings),
            "created_at": t.created_at.isoformat()
        })
    return res


@router.post("/trips")
def create_trip(
    req: TripCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    s_date = datetime.date.fromisoformat(req.start_date) if req.start_date else None
    e_date = datetime.date.fromisoformat(req.end_date) if req.end_date else None
    
    new_trip = Trip(
        user_id=current_user.id,
        name=req.name,
        destination=req.destination,
        start_date=s_date,
        end_date=e_date,
        booking_references=req.booking_references or [],
        is_archived=False
    )
    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)
    
    # Add creator as OWNER in trip_members
    member = TripMember(
        trip_id=new_trip.id,
        user_id=current_user.id,
        role="OWNER"
    )
    db.add(member)
    db.commit()
    
    return {
        "id": new_trip.id,
        "user_id": new_trip.user_id,
        "name": new_trip.name,
        "destination": new_trip.destination,
        "start_date": new_trip.start_date.isoformat() if new_trip.start_date else None,
        "end_date": new_trip.end_date.isoformat() if new_trip.end_date else None,
        "booking_references": new_trip.booking_references or [],
        "is_archived": new_trip.is_archived,
        "status": new_trip.status,
        "budget": float(new_trip.budget or 0.0)
    }


@router.patch("/trips/{trip_id}")
def update_trip(
    trip_id: int,
    req: TripUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: Only the owner can modify this trip.")
        
    if req.name is not None:
        trip.name = req.name
    if req.destination is not None:
        trip.destination = req.destination
    if req.start_date is not None:
        trip.start_date = datetime.date.fromisoformat(req.start_date) if req.start_date else None
    if req.end_date is not None:
        trip.end_date = datetime.date.fromisoformat(req.end_date) if req.end_date else None
    if req.is_archived is not None:
        trip.is_archived = req.is_archived
    if req.booking_references is not None:
        trip.booking_references = req.booking_references
        
    db.commit()
    db.refresh(trip)
    return {
        "id": trip.id,
        "user_id": trip.user_id,
        "name": trip.name,
        "destination": trip.destination,
        "start_date": trip.start_date.isoformat() if trip.start_date else None,
        "end_date": trip.end_date.isoformat() if trip.end_date else None,
        "booking_references": trip.booking_references or [],
        "is_archived": trip.is_archived,
        "status": trip.status,
        "budget": float(trip.budget or 0.0)
    }


@router.delete("/trips/{trip_id}")
def delete_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: Only the owner can delete this trip.")
    db.delete(trip)
    db.commit()
    return {"success": True, "message": "Trip deleted."}


@router.get("/trips/{trip_id}/timeline")
def get_trip_timeline(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    is_owner = (trip.user_id == current_user.id)
    is_member = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first() is not None
    if not (is_owner or is_member):
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    # Get all members
    member_ids = [m.user_id for m in db.query(TripMember).filter(TripMember.trip_id == trip_id).all()]
    if trip.user_id not in member_ids:
        member_ids.append(trip.user_id)
        
    all_bookings = []
    for m_id in member_ids:
        all_bookings.extend(get_all_user_bookings(db, m_id))
        
    trip_bookings = []
    
    if trip.booking_references:
        for ref in trip.booking_references:
            for b in all_bookings:
                if b.booking_reference == ref:
                    trip_bookings.append(serialize_booking(b))
                    
    trip_bookings.sort(key=lambda x: x["start_time"])
    return {
        "trip": {
            "id": trip.id,
            "name": trip.name,
            "destination": trip.destination,
            "start_date": trip.start_date.isoformat() if trip.start_date else None,
            "end_date": trip.end_date.isoformat() if trip.end_date else None,
        },
        "timeline": trip_bookings
    }


# ─── TRIP DOCUMENT VAULT ENDPOINTS ────────────────────────────────────────────

@router.get("/trips/{trip_id}/documents")
def get_trip_documents(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    is_owner = (trip.user_id == current_user.id)
    is_member = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first() is not None
    if not (is_owner or is_member):
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    member_ids = [m.user_id for m in db.query(TripMember).filter(TripMember.trip_id == trip_id).all()]
    if trip.user_id not in member_ids:
        member_ids.append(trip.user_id)
        
    all_bookings = []
    for m_id in member_ids:
        all_bookings.extend(get_all_user_bookings(db, m_id))
        
    trip_bookings = []
    
    if trip.booking_references:
        for ref in trip.booking_references:
            for b in all_bookings:
                if b.booking_reference == ref:
                    trip_bookings.append(b)
                    
    docs = []
    for b in trip_bookings:
        vertical = b.vertical
        ref = b.booking_reference
        
        docs.append({
            "id": f"doc-{ref}-ticket",
            "booking_reference": ref,
            "name": f"{vertical.capitalize()} Ticket/Voucher ({ref})",
            "document_type": "TICKET" if vertical in ["flights", "trains", "buses", "activities"] else "VOUCHER",
            "file_name": f"{vertical}_{ref}_Ticket.pdf",
            "url": f"/api/v1/bookings/{ref}/pdf"
        })
        
        docs.append({
            "id": f"doc-{ref}-invoice",
            "booking_reference": ref,
            "name": f"Invoice ({ref})",
            "document_type": "INVOICE",
            "file_name": f"{vertical}_{ref}_Invoice.pdf",
            "url": f"/api/v1/bookings/{ref}/pdf"
        })
        
        docs.append({
            "id": f"doc-{ref}-receipt",
            "booking_reference": ref,
            "name": f"Payment Receipt ({ref})",
            "document_type": "RECEIPT",
            "file_name": f"{vertical}_{ref}_Receipt.pdf",
            "url": f"/api/v1/bookings/{ref}/pdf"
        })
        
    return docs


@router.get("/trips/{trip_id}/documents/download-all")
def download_all_trip_documents(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    is_owner = (trip.user_id == current_user.id)
    is_member = db.query(TripMember).filter(TripMember.trip_id == trip_id, TripMember.user_id == current_user.id).first() is not None
    if not (is_owner or is_member):
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    member_ids = [m.user_id for m in db.query(TripMember).filter(TripMember.trip_id == trip_id).all()]
    if trip.user_id not in member_ids:
        member_ids.append(trip.user_id)
        
    all_bookings = []
    for m_id in member_ids:
        all_bookings.extend(get_all_user_bookings(db, m_id))
        
    trip_bookings = []
    
    if trip.booking_references:
        for ref in trip.booking_references:
            for b in all_bookings:
                if b.booking_reference == ref:
                    trip_bookings.append(b)
                    
    if not trip_bookings:
        raise HTTPException(status_code=400, detail="No bookings associated with this trip.")
        
    for b in trip_bookings:
        ref = b.booking_reference
        pdf_path = f"static/tickets/{ref}.pdf"
        if not os.path.exists(pdf_path):
            ticket = db.query(BookingTicket).filter(BookingTicket.booking_reference == ref).first()
            invoice = db.query(BookingInvoice).filter(BookingInvoice.booking_reference == ref).first()
            if ticket and invoice:
                from app.utils.booking_helpers import generate_booking_pdf
                generate_booking_pdf(b, ticket, invoice, current_user, b.vertical)
                
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for b in trip_bookings:
            ref = b.booking_reference
            pdf_path = f"static/tickets/{ref}.pdf"
            if os.path.exists(pdf_path):
                zip_file.writestr(f"Ticket_{ref}.pdf", open(pdf_path, "rb").read())
                
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=GhumneChale-Trip-{trip_id}-Documents.zip"}
    )
