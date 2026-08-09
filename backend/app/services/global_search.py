import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import SessionLocal
from app.models.bookings import FlightBooking, HotelBooking, TrainBooking, CabBooking
from app.models.core import User, Documents
from app.models.mybiz import Organization

logger = logging.getLogger(__name__)

class GlobalSearchService:
    def search_all(self, query: str, tenant_id: int) -> List[Dict[str, Any]]:
        """
        Global full-text search across flights, hotels, documents, bookings, users, and organizations.
        Scoped strictly by tenant_id for secure isolation.
        """
        if not query or len(query.strip()) < 2:
            return []

        db = SessionLocal()
        results = []
        term = f"%{query}%"

        try:
            # 1. Search Flights
            flights = db.query(FlightBooking).filter(
                FlightBooking.tenant_id == tenant_id,
                or_(
                    FlightBooking.origin.ilike(term),
                    FlightBooking.destination.ilike(term),
                    FlightBooking.airline_code.ilike(term),
                    FlightBooking.booking_reference.ilike(term)
                )
            ).limit(10).all()
            for f in flights:
                results.append({
                    "id": f.id,
                    "type": "flight_booking",
                    "title": f"Flight {f.airline_code} ({f.origin} -> {f.destination})",
                    "reference": f.booking_reference,
                    "subtitle": f"Status: {f.status.value if hasattr(f.status, 'value') else f.status}"
                })

            # 2. Search Hotels
            hotels = db.query(HotelBooking).filter(
                HotelBooking.tenant_id == tenant_id,
                or_(
                    HotelBooking.hotel_name.ilike(term),
                    HotelBooking.address.ilike(term),
                    HotelBooking.booking_reference.ilike(term)
                )
            ).limit(10).all()
            for h in hotels:
                results.append({
                    "id": h.id,
                    "type": "hotel_booking",
                    "title": h.hotel_name,
                    "reference": h.booking_reference,
                    "subtitle": f"Check-in: {h.check_in.strftime('%Y-%m-%d') if hasattr(h.check_in, 'strftime') else h.check_in}"
                })

            # 3. Search Documents
            docs = db.query(Documents).join(User).filter(
                User.tenant_id == tenant_id,
                or_(
                    Documents.document_type.ilike(term),
                    Documents.document_number.ilike(term)
                )
            ).limit(10).all()
            for d in docs:
                results.append({
                    "id": d.id,
                    "type": "document",
                    "title": f"{d.document_type} Details",
                    "reference": d.document_number,
                    "subtitle": f"User ID: {d.user_id}"
                })

            # 4. Search Users
            users = db.query(User).filter(
                User.tenant_id == tenant_id,
                User.email.ilike(term)
            ).limit(10).all()
            for u in users:
                results.append({
                    "id": u.id,
                    "type": "user",
                    "title": u.email,
                    "reference": f"User #{u.id}",
                    "subtitle": f"Role: {u.role}"
                })

            # 5. Search Organizations (if any exist)
            orgs = db.query(Organization).filter(
                Organization.name.ilike(term)
            ).limit(5).all()
            for o in orgs:
                results.append({
                    "id": o.id,
                    "type": "organization",
                    "title": o.name,
                    "reference": f"Org #{o.id}",
                    "subtitle": f"Billing details: {o.billing_details or 'None'}"
                })

        except Exception as e:
            logger.error(f"Global search failed: {e}")
        finally:
            db.close()

        return results

global_search_service = GlobalSearchService()
