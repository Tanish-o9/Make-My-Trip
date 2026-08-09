"""
Push Notification Service — wraps Firebase FCM client.

Provides high-level notification methods for all travel events:
  - Flight Reminder
  - Hotel Reminder
  - Boarding Reminder
  - Gate Change Alert
  - Price Drop Alert
  - Wallet Credit
  - Booking Confirmation Push
  - OTP Push
"""
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.services.fcm_client import get_fcm_client

logger = logging.getLogger(__name__)


class PushNotificationService:
    """
    High-level push notification dispatcher.
    All methods accept a device_token (FCM registration token) and booking metadata.
    If no token is supplied or FCM is unconfigured, the notification is silently logged.
    """

    @staticmethod
    def _fcm():
        return get_fcm_client()

    @classmethod
    def send_booking_confirmation(
        cls,
        device_token: Optional[str],
        booking_ref: str,
        vertical: str,
        detail: str = "",
    ) -> Dict[str, Any]:
        """Notify user that their booking has been confirmed."""
        if not device_token:
            return {"success": False, "reason": "no_token"}
        icon_map = {"flight": "✈️", "hotel": "🏨", "train": "🚆", "cab": "🚕"}
        icon = icon_map.get(vertical.lower(), "📋")
        return cls._fcm().send_to_token(
            device_token,
            title=f"{icon} Booking Confirmed!",
            body=f"Your {vertical.title()} booking {booking_ref} is confirmed. {detail}",
            data={"type": "booking_confirmation", "booking_ref": booking_ref, "vertical": vertical},
        )

    @classmethod
    def send_flight_reminder(
        cls,
        device_token: Optional[str],
        booking_ref: str,
        flight_number: str,
        origin: str,
        destination: str,
        departure_time: str,
    ) -> Dict[str, Any]:
        """Remind user about upcoming flight departure."""
        if not device_token:
            return {"success": False, "reason": "no_token"}
        return cls._fcm().send_to_token(
            device_token,
            title="✈️ Flight Reminder",
            body=f"{flight_number}: {origin} → {destination} departs at {departure_time}",
            data={
                "type": "flight_reminder",
                "booking_ref": booking_ref,
                "flight_number": flight_number,
                "departure_time": departure_time,
            },
        )

    @classmethod
    def send_hotel_reminder(
        cls,
        device_token: Optional[str],
        booking_ref: str,
        hotel_name: str,
        checkin_date: str,
    ) -> Dict[str, Any]:
        """Remind user about upcoming hotel check-in."""
        if not device_token:
            return {"success": False, "reason": "no_token"}
        return cls._fcm().send_to_token(
            device_token,
            title="🏨 Hotel Check-In Reminder",
            body=f"Check in to {hotel_name} tomorrow on {checkin_date}. Have your voucher ready!",
            data={"type": "hotel_reminder", "booking_ref": booking_ref, "hotel": hotel_name},
        )

    @classmethod
    def send_boarding_reminder(
        cls,
        device_token: Optional[str],
        booking_ref: str,
        flight_number: str,
        gate: str,
        boarding_time: str,
    ) -> Dict[str, Any]:
        """Alert user that boarding has started."""
        if not device_token:
            return {"success": False, "reason": "no_token"}
        return cls._fcm().send_to_token(
            device_token,
            title="🚪 Boarding Now",
            body=f"Flight {flight_number} is now boarding at Gate {gate}. Boarding: {boarding_time}",
            data={
                "type": "boarding_reminder",
                "booking_ref": booking_ref,
                "flight_number": flight_number,
                "gate": gate,
            },
        )

    @classmethod
    def send_gate_change(
        cls,
        device_token: Optional[str],
        booking_ref: str,
        flight_number: str,
        old_gate: str,
        new_gate: str,
    ) -> Dict[str, Any]:
        """Alert user of a gate change for their flight."""
        if not device_token:
            return {"success": False, "reason": "no_token"}
        return cls._fcm().send_to_token(
            device_token,
            title="⚠️ Gate Change Alert",
            body=f"Flight {flight_number}: Gate changed from {old_gate} to {new_gate}. Please proceed immediately.",
            data={
                "type": "gate_change",
                "booking_ref": booking_ref,
                "flight_number": flight_number,
                "new_gate": new_gate,
            },
        )

    @classmethod
    def send_price_drop(
        cls,
        device_token: Optional[str],
        route: str,
        old_price: float,
        new_price: float,
        currency: str = "INR",
    ) -> Dict[str, Any]:
        """Notify user that a saved route/hotel has dropped in price."""
        if not device_token:
            return {"success": False, "reason": "no_token"}
        drop_pct = round(((old_price - new_price) / old_price) * 100, 1) if old_price > 0 else 0
        return cls._fcm().send_to_token(
            device_token,
            title="📉 Price Drop Alert!",
            body=f"{route} dropped by {drop_pct}%! Now {currency} {new_price:,.0f} (was {old_price:,.0f}). Book now!",
            data={
                "type": "price_drop",
                "route": route,
                "new_price": str(new_price),
                "old_price": str(old_price),
            },
        )

    @classmethod
    def send_wallet_credit(
        cls,
        device_token: Optional[str],
        amount: float,
        reason: str = "refund",
        new_balance: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Notify user of a wallet credit."""
        if not device_token:
            return {"success": False, "reason": "no_token"}
        balance_str = f" | Balance: ₹{new_balance:,.0f}" if new_balance else ""
        return cls._fcm().send_to_token(
            device_token,
            title="💰 Wallet Credited",
            body=f"₹{amount:,.0f} added to your Travel Wallet ({reason}).{balance_str}",
            data={
                "type": "wallet_credit",
                "amount": str(amount),
                "reason": reason,
            },
        )

    @classmethod
    def send_otp_push(
        cls,
        device_token: Optional[str],
        otp_code: str,
        action: str = "login",
    ) -> Dict[str, Any]:
        """Send OTP via push notification (alternative to SMS)."""
        if not device_token:
            return {"success": False, "reason": "no_token"}
        return cls._fcm().send_to_token(
            device_token,
            title=f"🔐 Your OTP: {otp_code}",
            body=f"Use {otp_code} to complete your {action}. Valid 10 minutes.",
            data={"type": "otp", "otp": otp_code, "action": action},
        )
