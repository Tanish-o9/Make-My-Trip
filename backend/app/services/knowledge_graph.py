"""
Travel Knowledge Graph Service — Phase 10
Builds a localized in-memory travel knowledge graph for a user.
Entities:
  - User
  - FlightBooking
  - HotelBooking
  - Destination
  - Airline
Provides relationship traversal (e.g. User -> booked -> Flight -> operated_by -> Airline).
"""
import logging
from typing import Dict, Any, List
from app.database import SessionLocal
from app.models.bookings import FlightBooking, HotelBooking, BookingStatus
from app.models.core import User

logger = logging.getLogger(__name__)

class TravelKnowledgeGraph:
    def build_user_graph(self, user_id: int) -> Dict[str, Any]:
        """
        Builds and returns adjacency list representation of the user's travel graph.
        """
        db = SessionLocal()
        nodes = []
        edges = []

        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return {"nodes": [], "edges": []}

            # User node
            nodes.append({"id": f"user_{user_id}", "label": user.email, "type": "User"})

            # Flight bookings
            flights = db.query(FlightBooking).filter(
                FlightBooking.user_id == user_id,
                FlightBooking.status == BookingStatus.CONFIRMED
            ).all()

            for f in flights:
                flight_node_id = f"flight_{f.id}"
                nodes.append({
                    "id": flight_node_id,
                    "label": f"Flight {f.airline_code} {f.flight_number or ''}",
                    "type": "Flight"
                })
                # Edge: User -> booked -> Flight
                edges.append({
                    "source": f"user_{user_id}",
                    "target": flight_node_id,
                    "relation": "booked"
                })

                # Destination node
                if f.destination:
                    dest_node_id = f"dest_{f.destination.lower()}"
                    if not any(n["id"] == dest_node_id for n in nodes):
                        nodes.append({"id": dest_node_id, "label": f.destination, "type": "Destination"})
                    edges.append({
                        "source": flight_node_id,
                        "target": dest_node_id,
                        "relation": "destined_for"
                    })

                # Airline node
                if f.airline_code:
                    airline_node_id = f"airline_{f.airline_code.lower()}"
                    if not any(n["id"] == airline_node_id for n in nodes):
                        nodes.append({"id": airline_node_id, "label": f.airline_code, "type": "Airline"})
                    edges.append({
                        "source": flight_node_id,
                        "target": airline_node_id,
                        "relation": "operated_by"
                    })

            # Hotel bookings
            hotels = db.query(HotelBooking).filter(
                HotelBooking.user_id == user_id,
                HotelBooking.status == BookingStatus.CONFIRMED
            ).all()

            for h in hotels:
                hotel_node_id = f"hotel_{h.id}"
                nodes.append({
                    "id": hotel_node_id,
                    "label": h.hotel_name,
                    "type": "Hotel"
                })
                edges.append({
                    "source": f"user_{user_id}",
                    "target": hotel_node_id,
                    "relation": "stayed_at"
                })

                # Hotel destination
                # Extract destination from address or hotel name if possible
                if h.hotel_name:
                    dest_node_id = f"dest_local"
                    if not any(n["id"] == dest_node_id for n in nodes):
                        nodes.append({"id": dest_node_id, "label": "Stay Destination", "type": "Destination"})
                    edges.append({
                        "source": hotel_node_id,
                        "target": dest_node_id,
                        "relation": "located_in"
                    })

            return {
                "nodes": nodes,
                "edges": edges,
                "total_nodes": len(nodes),
                "total_edges": len(edges)
            }

        except Exception as e:
            logger.error(f"[KnowledgeGraph] Error building graph: {e}")
            return {"nodes": [], "edges": []}
        finally:
            db.close()

# Singleton
knowledge_graph = TravelKnowledgeGraph()
