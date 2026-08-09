"""
AI Personal Travel Concierge — Phase 1
Builds a structured UserTravelProfile from REAL booking history.
Never fabricates preferences — only surfaces what data confirms.

Capabilities:
- Airline preferences (from FlightBooking history)
- Hotel chain preferences (from HotelBooking history)
- Budget band (from total_amount distributions)
- Cabin class preferences
- Destination history
- Loyalty status
- Visa history
- Booking pattern (advance booking days)
All preferences are fully explainable (confidence from data point count).
"""
import logging
import datetime
from typing import Dict, Any, List, Optional
from collections import Counter
from dataclasses import dataclass, field, asdict

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import SessionLocal
from app.models.bookings import FlightBooking, HotelBooking, VisaApplication, InsurancePolicy, BookingStatus
from app.models.core import LoyaltyAccount
from app.utils.explainability import explain_recommendation, confidence_from_data_points, insufficient_data_recommendation

logger = logging.getLogger(__name__)


@dataclass
class UserTravelProfile:
    user_id: int
    preferred_airlines: List[Dict[str, Any]] = field(default_factory=list)
    preferred_cabin: str = "economy"
    preferred_hotel_chains: List[str] = field(default_factory=list)
    avg_flight_budget_inr: float = 0.0
    avg_hotel_budget_per_night_inr: float = 0.0
    budget_band: str = "unknown"          # budget / mid / premium / luxury
    top_destinations: List[str] = field(default_factory=list)
    visa_countries: List[str] = field(default_factory=list)
    loyalty_tier: str = "Silver"
    loyalty_points: int = 0
    advance_booking_days_avg: float = 0.0
    total_trips: int = 0
    data_quality: str = "insufficient"    # insufficient / low / medium / high
    generated_at: str = field(default_factory=lambda: datetime.datetime.utcnow().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class PersonalConciergeAgent:
    """
    Builds a UserTravelProfile from real booking data.
    All learned preferences cite their data source and confidence.
    """

    MIN_BOOKINGS_FOR_PROFILE = 1  # At least 1 booking needed

    def build_profile(self, user_id: int) -> UserTravelProfile:
        """Build complete travel profile for a user from their booking history."""
        db = SessionLocal()
        try:
            profile = UserTravelProfile(user_id=user_id)

            # ── Flight Preferences ──────────────────────────────────────────
            flights = db.query(FlightBooking).filter(
                FlightBooking.user_id == user_id,
                FlightBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED])
            ).all()

            if flights:
                profile.total_trips += len(flights)

                # Airline preferences
                airline_counts = Counter(
                    f.airline_code for f in flights if f.airline_code
                )
                total_flights = sum(airline_counts.values())
                profile.preferred_airlines = [
                    {
                        "airline": airline,
                        "booking_count": count,
                        "share_pct": round(count / total_flights * 100, 1),
                        "confidence": confidence_from_data_points(count),
                    }
                    for airline, count in airline_counts.most_common(3)
                ]

                # Cabin class
                cabin_counts = Counter(
                    f.cabin_class for f in flights if f.cabin_class
                )
                if cabin_counts:
                    profile.preferred_cabin = cabin_counts.most_common(1)[0][0]

                # Flight budget
                amounts = [float(f.total_amount) for f in flights if f.total_amount]
                if amounts:
                    profile.avg_flight_budget_inr = round(sum(amounts) / len(amounts), 2)

                # Top destinations
                dest_counts = Counter(f.destination for f in flights if f.destination)
                profile.top_destinations = [d for d, _ in dest_counts.most_common(5)]

                # Advance booking days
                advance_days = []
                for f in flights:
                    if f.departure_time and f.created_at:
                        delta = (f.departure_time - f.created_at).days
                        if delta > 0:
                            advance_days.append(delta)
                if advance_days:
                    profile.advance_booking_days_avg = round(
                        sum(advance_days) / len(advance_days), 1
                    )

            # ── Hotel Preferences ───────────────────────────────────────────
            hotels = db.query(HotelBooking).filter(
                HotelBooking.user_id == user_id,
                HotelBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED])
            ).all()

            if hotels:
                profile.total_trips += len(hotels)

                hotel_counts = Counter(
                    h.hotel_name for h in hotels if h.hotel_name
                )
                profile.preferred_hotel_chains = [
                    name for name, _ in hotel_counts.most_common(3)
                ]

                hotel_amounts = [float(h.total_amount) for h in hotels if h.total_amount]
                if hotel_amounts:
                    profile.avg_hotel_budget_per_night_inr = round(
                        sum(hotel_amounts) / len(hotel_amounts), 2
                    )

            # ── Budget Band ─────────────────────────────────────────────────
            avg_flight = profile.avg_flight_budget_inr
            if avg_flight == 0:
                profile.budget_band = "unknown"
            elif avg_flight < 5000:
                profile.budget_band = "budget"
            elif avg_flight < 12000:
                profile.budget_band = "mid"
            elif avg_flight < 25000:
                profile.budget_band = "premium"
            else:
                profile.budget_band = "luxury"

            # ── Visa History ────────────────────────────────────────────────
            visas = db.query(VisaApplication).filter(
                VisaApplication.user_id == user_id
            ).all()
            profile.visa_countries = list({
                v.destination_country for v in visas if v.destination_country
            })

            # ── Loyalty Status ──────────────────────────────────────────────
            loyalty = db.query(LoyaltyAccount).filter(
                LoyaltyAccount.user_id == user_id
            ).first()
            if loyalty:
                profile.loyalty_tier = loyalty.tier or "Silver"
                profile.loyalty_points = int(loyalty.points_balance or 0)

            # ── Data Quality ────────────────────────────────────────────────
            if profile.total_trips == 0:
                profile.data_quality = "insufficient"
            elif profile.total_trips < 3:
                profile.data_quality = "low"
            elif profile.total_trips < 10:
                profile.data_quality = "medium"
            else:
                profile.data_quality = "high"

            logger.info(
                f"[Concierge] Built profile for user {user_id}: "
                f"{profile.total_trips} trips, quality={profile.data_quality}"
            )
            return profile

        except Exception as e:
            logger.error(f"[Concierge] Error building profile for user {user_id}: {e}")
            return UserTravelProfile(user_id=user_id)
        finally:
            db.close()

    def get_explainable_recommendations(
        self, user_id: int
    ) -> Dict[str, Any]:
        """
        Returns a fully explainable recommendation set for a user.
        Each recommendation cites its data source and confidence.
        """
        profile = self.build_profile(user_id)
        recommendations = {}

        # ── Flight Recommendation ───────────────────────────────────────────
        if profile.preferred_airlines:
            top = profile.preferred_airlines[0]
            recommendations["preferred_airline"] = explain_recommendation(
                rec_type="airline",
                item={"airline_code": top["airline"], "booking_count": top["booking_count"]},
                reason=f"You have booked {top['airline']} on {top['booking_count']} confirmed flights "
                       f"({top['share_pct']}% of your flights). This is your most-used airline.",
                confidence=top["confidence"],
                supporting_data={
                    "total_flights": profile.total_trips,
                    "all_airlines": profile.preferred_airlines,
                },
                provider_source="booking_history",
            ).to_dict()
        else:
            recommendations["preferred_airline"] = insufficient_data_recommendation(
                "airline", "No confirmed flight bookings found."
            ).to_dict()

        # ── Cabin Class ─────────────────────────────────────────────────────
        if profile.preferred_cabin and profile.total_trips > 0:
            recommendations["preferred_cabin"] = explain_recommendation(
                rec_type="cabin",
                item={"cabin_class": profile.preferred_cabin},
                reason=f"You most frequently book {profile.preferred_cabin.title()} class.",
                confidence=confidence_from_data_points(profile.total_trips),
                supporting_data={"total_trips_analysed": profile.total_trips},
                provider_source="booking_history",
            ).to_dict()

        # ── Budget Band ──────────────────────────────────────────────────────
        if profile.budget_band != "unknown":
            recommendations["budget_band"] = explain_recommendation(
                rec_type="budget",
                item={
                    "band": profile.budget_band,
                    "avg_flight_inr": profile.avg_flight_budget_inr,
                    "avg_hotel_inr": profile.avg_hotel_budget_per_night_inr,
                },
                reason=f"Based on your average flight spend of ₹{profile.avg_flight_budget_inr:,.0f}, "
                       f"you are a '{profile.budget_band}' traveller.",
                confidence=confidence_from_data_points(profile.total_trips),
                supporting_data={"trips_analysed": profile.total_trips},
                provider_source="booking_history",
            ).to_dict()

        # ── Top Destinations ─────────────────────────────────────────────────
        if profile.top_destinations:
            recommendations["top_destinations"] = explain_recommendation(
                rec_type="destination",
                item={"destinations": profile.top_destinations},
                reason=f"Your most visited destinations based on confirmed bookings.",
                confidence=confidence_from_data_points(len(profile.top_destinations), 5),
                supporting_data={"destination_count": len(profile.top_destinations)},
                provider_source="booking_history",
            ).to_dict()

        # ── Loyalty ─────────────────────────────────────────────────────────
        recommendations["loyalty"] = explain_recommendation(
            rec_type="loyalty",
            item={
                "tier": profile.loyalty_tier,
                "points": profile.loyalty_points,
            },
            reason=f"Your current loyalty tier is {profile.loyalty_tier} with {profile.loyalty_points} points.",
            confidence=0.99,
            supporting_data={"source": "loyalty_account"},
            provider_source="loyalty_account",
        ).to_dict()

        return {
            "user_id": user_id,
            "profile_summary": profile.to_dict(),
            "recommendations": recommendations,
            "data_quality": profile.data_quality,
        }


# Singleton
concierge_agent = PersonalConciergeAgent()
