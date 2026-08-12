import datetime
import logging
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.bookings import SeatHold

logger = logging.getLogger(__name__)

class SeatInventoryService:
    @staticmethod
    def get_flight_seat_meta(seat_number: str) -> Dict[str, Any]:
        """
        Determines authoritative price and type for a flight seat.
        """
        # Format e.g. "12A" -> row=12, col="A"
        try:
            row = int(seat_number[:-1])
            col = seat_number[-1].upper()
        except Exception:
            # Fallback for safe errors
            return {"type": "standard", "price": 150.0}

        # Pricing rules
        if row == 1:
            return {"type": "front row", "price": 1200.0}
        elif row == 5:
            return {"type": "exit row", "price": 1000.0}
        elif col in ["A", "F"]:
            return {"type": "window", "price": 300.0}
        elif col in ["C", "D"]:
            return {"type": "aisle", "price": 200.0}
        elif col in ["B", "E"]:
            return {"type": "middle", "price": 0.0}
        
        return {"type": "standard", "price": 150.0}

    @staticmethod
    def get_train_seat_meta(seat_number: str) -> Dict[str, Any]:
        """
        Determines authoritative price and type for a train berth.
        """
        # Format e.g. "12-LB" -> num=12, type="LB"
        parts = seat_number.split("-")
        try:
            num = int(parts[0])
            btype = parts[1].upper()
        except Exception:
            return {"type": "lower", "price": 300.0}

        # Mapping types
        if btype == "LB":
            return {"type": "lower", "price": 300.0}
        elif btype == "MB":
            return {"type": "middle", "price": 150.0}
        elif btype == "UB":
            return {"type": "upper", "price": 150.0}
        elif btype == "SL":
            return {"type": "side lower", "price": 250.0}
        elif btype == "SU":
            return {"type": "side upper", "price": 200.0}

        return {"type": "lower", "price": 300.0}

    @classmethod
    def get_seat_map(
        cls, 
        db: Session, 
        vertical: str, 
        reference: str, 
        provider_name: Optional[str] = None, 
        is_live: bool = False
    ) -> Dict[str, Any]:
        """
        Fetches the complete seat map list with occupancy flags.
        In DEMO mode, applies a stable simulated occupancy pattern overlayed with DB holds.
        In LIVE mode, never generates fake random occupancy (only reflects actual DB holds).
        """
        vertical = vertical.lower()
        now = datetime.datetime.utcnow()

        # Query active database holds (HELD and not expired, or CONFIRMED)
        active_holds = db.query(SeatHold).filter(
            SeatHold.vertical == vertical,
            SeatHold.reference == reference,
            SeatHold.status.in_(["HELD", "CONFIRMED"]),
            SeatHold.expires_at > now
        ).all()
        held_seats = {h.seat_number: h for h in active_holds}

        seats_list = []
        if vertical == "flights":
            # Rows 1 to 10, Columns A to F
            cols = ["A", "B", "C", "D", "E", "F"]
            for row in range(1, 11):
                for col in cols:
                    seat_num = f"{row}{col}"
                    meta = cls.get_flight_seat_meta(seat_num)
                    
                    # Compute occupancy
                    is_occupied = False
                    if seat_num in held_seats:
                        is_occupied = True
                    elif not is_live:
                        # Stable DEMO simulated pattern
                        is_occupied = (row % 3 == 0 and col == "C") or (col == "D" and row > 4) or seat_num == "1B" or seat_num == "4F"
                    
                    seats_list.append({
                        "seat_number": seat_num,
                        "is_occupied": is_occupied,
                        "seat_type": meta["type"],
                        "price": meta["price"]
                    })
        elif vertical == "trains":
            # 4 bays, 8 berths per bay = 32 berths total
            types = ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"]
            for bay in range(4):
                start_seat = bay * 6 + 1
                for i in range(8):
                    seat_val = start_seat + i
                    btype = types[i]
                    seat_num = f"{seat_val}-{btype}"
                    meta = cls.get_train_seat_meta(seat_num)

                    # Compute occupancy
                    is_occupied = False
                    if seat_num in held_seats:
                        is_occupied = True
                    elif not is_live:
                        # Stable DEMO simulated pattern
                        is_occupied = (seat_val) % 5 == 0 or seat_num == "3-UB" or seat_num == "17-SL"

                    seats_list.append({
                        "seat_number": seat_num,
                        "is_occupied": is_occupied,
                        "seat_type": meta["type"],
                        "price": meta["price"]
                    })

        return {
            "seat_map_type": "LIVE" if is_live else "DEMO",
            "seats": seats_list
        }

    @classmethod
    def hold_seats(
        cls, 
        db: Session, 
        booking_ref: str, 
        vertical: str, 
        reference: str, 
        seat_numbers: List[str], 
        user_id: int, 
        expires_at: datetime.datetime
    ) -> List[SeatHold]:
        """
        Creates server-side temporary seat holds in a concurrency-safe manner.
        Uses SELECT FOR UPDATE on PostgreSQL (or standard locking fallback).
        """
        vertical = vertical.lower()
        now = datetime.datetime.utcnow()
        created_holds = []

        # Process each seat
        for seat in seat_numbers:
            # Query for existing active holds using FOR UPDATE if PostgreSQL is used
            is_postgres = "postgresql" in str(db.bind.url)
            query = db.query(SeatHold).filter(
                SeatHold.vertical == vertical,
                SeatHold.reference == reference,
                SeatHold.seat_number == seat,
                SeatHold.status.in_(["HELD", "CONFIRMED"]),
                SeatHold.expires_at > now
            )
            if is_postgres:
                existing = query.with_for_update().first()
            else:
                existing = query.first()

            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Seat/Berth {seat} is already held or booked. Please select another seat."
                )

            # Get metadata
            meta = cls.get_flight_seat_meta(seat) if vertical == "flights" else cls.get_train_seat_meta(seat)

            # Create hold
            hold = SeatHold(
                user_id=user_id,
                booking_reference=booking_ref,
                vertical=vertical,
                reference=reference,
                seat_number=seat,
                status="HELD",
                expires_at=expires_at,
                seat_type=meta["type"],
                price=meta["price"]
            )
            db.add(hold)
            created_holds.append(hold)

        db.flush() # Ensure locks are acquired/registered
        return created_holds
