"""
Communication service — Twilio (SMS/OTP) + Resend/SendGrid (Email).

Loading order for credentials:
  1. RESEND_API_KEY     → Resend (primary email)
  2. SENDGRID_API_KEY  → SendGrid (email fallback)
  3. TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER → Twilio SMS
  4. MSG91_AUTH_KEY / MSG91_SENDER_ID → MSG91 (SMS fallback)

All functions log and return {"success": True/False, ...} — they never raise.
"""
import base64
import os
import random
import string
import logging
from typing import Dict, Any, List, Optional

import httpx

from app.services.resilience import CircuitBreaker, retry_with_backoff
from app.services.email_templates import (
    get_booking_confirmation_html,
    get_hotel_voucher_html,
    get_cancellation_html,
    get_otp_html,
    get_flight_reminder_html,
)

logger = logging.getLogger(__name__)

# Circuit breakers
twilio_breaker = CircuitBreaker("TwilioAPI", max_failures=3, cooldown_seconds=60)
resend_breaker = CircuitBreaker("ResendAPI", max_failures=3, cooldown_seconds=60)


# ─────────────────────────────────────────────────────────────────────────────
# OTP Utility
# ─────────────────────────────────────────────────────────────────────────────

def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically secure random numeric OTP using secrets module."""
    import secrets as _secrets
    return "".join([str(_secrets.randbelow(10)) for _ in range(length)])



# ─────────────────────────────────────────────────────────────────────────────
# Twilio SMS Client
# ─────────────────────────────────────────────────────────────────────────────

class TwilioClient:
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.phone_number = os.getenv("TWILIO_PHONE_NUMBER")

    def _is_configured(self) -> bool:
        placeholders = {None, "", "your-twilio-sid", "your-twilio-token", "your-twilio-number"}
        return (
            self.account_sid not in placeholders
            and self.auth_token not in placeholders
            and self.phone_number not in placeholders
        )

    def _send_raw(self, to_phone: str, body: str) -> Dict[str, Any]:
        """Send raw SMS via Twilio REST API."""
        if not self._is_configured():
            logger.info(f"[SMS Sandbox] → {to_phone}: {body}")
            return {"success": True, "sms_id": "sms_simulated", "gateway": "twilio_simulated"}

        def execute():
            url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
            resp = httpx.post(
                url,
                auth=(self.account_sid, self.auth_token),
                data={"To": to_phone, "From": self.phone_number, "Body": body},
                timeout=8.0,
            )
            resp.raise_for_status()
            return resp.json()

        try:
            res = twilio_breaker.call(execute)
            return {"success": True, "sms_id": res.get("sid", ""), "gateway": "twilio"}
        except Exception as e:
            logger.error(f"Twilio SMS failed to {to_phone}: {e}")
            return {"success": False, "error": str(e), "gateway": "twilio"}

    @retry_with_backoff(max_retries=2, initial_delay=0.5)
    def send_sms(self, to_phone: str, body: str) -> Dict[str, Any]:
        """Send a generic SMS."""
        return self._send_raw(to_phone, body)

    def send_otp(self, to_phone: str, otp_code: str, action: str = "login") -> Dict[str, Any]:
        """Send a formatted OTP SMS."""
        body = (
            f"Your Travel OS {action} OTP is: {otp_code}\n"
            f"Valid for 10 minutes. Do NOT share with anyone.\n"
            f"– Travel OS Security"
        )
        return self._send_raw(to_phone, body)

    def send_booking_confirmation_sms(
        self, to_phone: str, booking_ref: str, vertical: str, details: str = ""
    ) -> Dict[str, Any]:
        """Send a booking confirmation SMS."""
        body = (
            f"✅ Your {vertical.title()} booking is CONFIRMED!\n"
            f"Ref: {booking_ref}\n"
            f"{details}\n"
            f"Manage: https://make-my-trip-delta.vercel.app/bookings/{booking_ref}\n"
            f"– Travel OS"
        )
        return self._send_raw(to_phone, body)

    def send_flight_reminder(
        self,
        to_phone: str,
        booking_ref: str,
        flight_number: str,
        departure_time: str,
        origin: str,
        destination: str,
    ) -> Dict[str, Any]:
        """Send flight departure reminder SMS."""
        body = (
            f"⏰ FLIGHT REMINDER\n"
            f"Flight: {flight_number} | {origin} → {destination}\n"
            f"Departure: {departure_time}\n"
            f"Ref: {booking_ref}\n"
            f"Check-in now: https://make-my-trip-delta.vercel.app/bookings/{booking_ref}\n"
            f"– Travel OS"
        )
        return self._send_raw(to_phone, body)

    def send_cancellation_sms(
        self, to_phone: str, booking_ref: str, vertical: str, refund_amount: float
    ) -> Dict[str, Any]:
        """Send booking cancellation confirmation SMS."""
        refund_str = f"₹{refund_amount:,.0f}" if refund_amount > 0 else "no refund"
        body = (
            f"❌ {vertical.title()} booking {booking_ref} cancelled.\n"
            f"Refund: {refund_str} → Travel Wallet (24 hrs).\n"
            f"– Travel OS"
        )
        return self._send_raw(to_phone, body)


# ─────────────────────────────────────────────────────────────────────────────
# Resend / SendGrid Email Client
# ─────────────────────────────────────────────────────────────────────────────

class SendGridClient:
    def __init__(self):
        self.sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
        self.resend_api_key = os.getenv("RESEND_API_KEY")
        self.from_email = (
            os.getenv("RESEND_FROM_EMAIL")
            or os.getenv("SENDGRID_FROM_EMAIL")
            or "onboarding@resend.dev"
        )

    def _is_resend_configured(self) -> bool:
        return bool(self.resend_api_key) and self.resend_api_key not in ("", "your-resend-key")

    def _is_sendgrid_configured(self) -> bool:
        return bool(self.sendgrid_api_key) and self.sendgrid_api_key not in ("", "your-sendgrid-key")

    @retry_with_backoff(max_retries=2, initial_delay=0.5)
    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Send an email via Resend (primary) or SendGrid (fallback).

        attachments: list of {"filename": "ticket.pdf", "content": <base64_string>, "type": "application/pdf"}
        """
        if not self._is_resend_configured() and not self._is_sendgrid_configured():
            logger.info(f"[Email Sandbox] → {to_email} | Subject: {subject}")
            return {"success": True, "email_id": "email_simulated", "gateway": "simulated"}

        if self._is_resend_configured():
            return self._send_via_resend(to_email, subject, body, html_body, attachments)

        return self._send_via_sendgrid(to_email, subject, body, html_body)

    def _send_via_resend(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str],
        attachments: Optional[List[Dict[str, Any]]],
    ) -> Dict[str, Any]:
        """Send via Resend.com API."""
        # Use sandbox sender unless a real verified domain sender is set
        sender = self.from_email
        if not sender or "travelos.com" in sender or "example.com" in sender or "yourdomain.com" in sender:
            sender = "onboarding@resend.dev"

        payload: Dict[str, Any] = {
            "from": f"Travel OS <{sender}>",
            "to": [to_email],
            "subject": subject,
            "text": text_body,
        }
        if html_body:
            payload["html"] = html_body

        if attachments:
            payload["attachments"] = [
                {
                    "filename": a["filename"],
                    "content": a["content"],  # base64-encoded string
                }
                for a in attachments
                if "filename" in a and "content" in a
            ]

        def execute():
            resp = httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {self.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp.json()

        try:
            res = resend_breaker.call(execute)
            return {"success": True, "email_id": res.get("id"), "gateway": "resend"}
        except Exception as e:
            logger.error(f"Resend email failed to {to_email}: {e}")
            if self._is_sendgrid_configured():
                return self._send_via_sendgrid(to_email, subject, text_body, html_body)
            return {"success": False, "error": str(e), "gateway": "resend"}

    def _send_via_sendgrid(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str],
    ) -> Dict[str, Any]:
        """Send via SendGrid API as fallback."""
        content = []
        if text_body:
            content.append({"type": "text/plain", "value": text_body})
        if html_body:
            content.append({"type": "text/html", "value": html_body})

        payload = {
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": "noreply@travelos.com"},
            "subject": subject,
            "content": content or [{"type": "text/plain", "value": text_body or subject}],
        }

        def execute():
            resp = httpx.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {self.sendgrid_api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=10.0,
            )
            resp.raise_for_status()
            return resp

        try:
            resend_breaker.call(execute)
            return {"success": True, "gateway": "sendgrid"}
        except Exception as e:
            logger.error(f"SendGrid email failed to {to_email}: {e}")
            return {"success": False, "error": str(e), "gateway": "sendgrid"}

    # ─────────────────────────────────────────────────────────
    # High-Level Convenience Senders
    # ─────────────────────────────────────────────────────────

    def send_booking_confirmation_email(
        self,
        to_email: str,
        user_name: str,
        booking_ref: str,
        vertical: str,
        details: Dict[str, Any],
        pdf_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        """Send a rich HTML booking confirmation with optional PDF ticket attachment."""
        subject, html_body = get_booking_confirmation_html(booking_ref, user_name, vertical, details)
        attachments = []
        if pdf_bytes:
            attachments.append({
                "filename": f"ticket_{booking_ref}.pdf",
                "content": base64.b64encode(pdf_bytes).decode("utf-8"),
                "type": "application/pdf",
            })
        return self.send_email(to_email, subject, f"Your {vertical} booking {booking_ref} is confirmed!", html_body, attachments)

    def send_hotel_voucher_email(
        self,
        to_email: str,
        user_name: str,
        booking_ref: str,
        hotel_name: str,
        checkin: str,
        checkout: str,
        room_type: str = "Deluxe Room",
        guests: int = 2,
        address: str = "",
        pdf_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        """Send a hotel voucher email with optional PDF attachment."""
        subject, html_body = get_hotel_voucher_html(booking_ref, user_name, hotel_name, checkin, checkout, room_type, guests, address)
        attachments = []
        if pdf_bytes:
            attachments.append({
                "filename": f"voucher_{booking_ref}.pdf",
                "content": base64.b64encode(pdf_bytes).decode("utf-8"),
                "type": "application/pdf",
            })
        return self.send_email(to_email, subject, f"Your hotel booking at {hotel_name} is confirmed!", html_body, attachments)

    def send_cancellation_email(
        self,
        to_email: str,
        user_name: str,
        booking_ref: str,
        vertical: str,
        refund_amount: float,
        reason: str = "",
    ) -> Dict[str, Any]:
        """Send cancellation + refund confirmation email."""
        subject, html_body = get_cancellation_html(booking_ref, user_name, vertical, refund_amount, reason)
        text_body = f"Your {vertical} booking {booking_ref} has been cancelled. Refund: ₹{refund_amount:,.0f}"
        return self.send_email(to_email, subject, text_body, html_body)

    def send_otp_email(self, to_email: str, user_name: str, otp_code: str, action: str = "login") -> Dict[str, Any]:
        """Send an OTP verification email."""
        subject, html_body = get_otp_html(user_name, otp_code, action)
        text_body = f"Your Travel OS {action} OTP is: {otp_code}. Valid 10 minutes."
        return self.send_email(to_email, subject, text_body, html_body)

    def send_flight_reminder_email(
        self,
        to_email: str,
        user_name: str,
        booking_ref: str,
        flight_number: str,
        origin: str,
        destination: str,
        departure_time: str,
        gate: str = "",
        terminal: str = "",
    ) -> Dict[str, Any]:
        """Send a flight departure reminder email."""
        subject, html_body = get_flight_reminder_html(
            user_name, booking_ref, flight_number, origin, destination, departure_time, gate, terminal
        )
        text_body = f"Reminder: Flight {flight_number} departs {origin}→{destination} at {departure_time}. Ref: {booking_ref}"
        return self.send_email(to_email, subject, text_body, html_body)
