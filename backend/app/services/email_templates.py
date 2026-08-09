"""
HTML email templates for Travel OS.
All templates return (subject, html_body) tuples.
"""
from typing import Dict, Any, List


def _base_template(content: str) -> str:
    """Wraps content in a responsive HTML email shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Travel OS</title>
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fb; margin: 0; padding: 0; }}
    .container {{ max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
    .header {{ background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); padding: 32px 40px; text-align: center; }}
    .header h1 {{ color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 0.5px; }}
    .header p {{ color: #90caf9; margin: 8px 0 0; font-size: 14px; }}
    .body {{ padding: 32px 40px; }}
    .card {{ background: #f8faff; border: 1px solid #e3eaf7; border-radius: 8px; padding: 20px 24px; margin: 20px 0; }}
    .label {{ font-size: 11px; text-transform: uppercase; color: #7986cb; letter-spacing: 1px; font-weight: 600; margin-bottom: 4px; }}
    .value {{ font-size: 16px; color: #1a237e; font-weight: 600; }}
    .value-sm {{ font-size: 14px; color: #37474f; }}
    .badge {{ display: inline-block; background: #e8f5e9; color: #2e7d32; border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: 600; }}
    .badge-blue {{ background: #e3f2fd; color: #0d47a1; }}
    .divider {{ border: none; border-top: 1px solid #e8eaf6; margin: 24px 0; }}
    .cta {{ text-align: center; margin: 32px 0 16px; }}
    .cta a {{ background: linear-gradient(135deg, #1565c0, #0d47a1); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block; }}
    .footer {{ background: #f4f6fb; padding: 20px 40px; text-align: center; font-size: 12px; color: #90a4ae; }}
    .grid {{ display: flex; gap: 16px; flex-wrap: wrap; }}
    .grid-item {{ flex: 1; min-width: 140px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th {{ font-size: 11px; text-transform: uppercase; color: #7986cb; padding: 8px 12px; background: #f0f4ff; border-bottom: 2px solid #e3eaf7; text-align: left; }}
    td {{ padding: 10px 12px; font-size: 14px; color: #37474f; border-bottom: 1px solid #f0f4ff; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✈ Travel OS</h1>
      <p>Your AI-Powered Travel Companion</p>
    </div>
    <div class="body">
      {content}
    </div>
    <div class="footer">
      <p>© 2026 Travel OS · All rights reserved</p>
      <p>You received this email because you booked with Travel OS.</p>
    </div>
  </div>
</body>
</html>"""


def get_booking_confirmation_html(
    booking_ref: str,
    user_name: str,
    vertical: str,
    details: Dict[str, Any],
) -> tuple:
    """Flight / Hotel / Other booking confirmation email."""
    subject = f"✅ Booking Confirmed: {booking_ref}"
    icon = {"flight": "✈️", "hotel": "🏨", "train": "🚆", "cab": "🚕", "cruise": "🚢", "villa": "🏡"}.get(vertical.lower(), "📋")

    rows = "".join(
        f"<tr><td><strong>{k.replace('_', ' ').title()}</strong></td><td>{v}</td></tr>"
        for k, v in details.items()
        if v and k not in ("id", "user_id")
    )

    content = f"""
      <h2 style="color:#1a237e; margin-bottom:4px;">{icon} Booking Confirmed!</h2>
      <p style="color:#546e7a;">Hi {user_name}, your {vertical.title()} booking has been confirmed.</p>

      <div class="card">
        <div class="label">Booking Reference</div>
        <div class="value" style="font-size:22px; letter-spacing:2px;">{booking_ref}</div>
        <div style="margin-top:8px;"><span class="badge">✓ Confirmed</span></div>
      </div>

      <table>
        <thead><tr><th>Field</th><th>Details</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>

      <hr class="divider" />
      <p style="color:#546e7a; font-size:13px;">Your ticket/voucher is attached to this email as a PDF. Please carry a copy (digital or printed) at the time of travel.</p>

      <div class="cta">
        <a href="https://make-my-trip-delta.vercel.app/bookings/{booking_ref}">View Booking →</a>
      </div>
    """
    return subject, _base_template(content)


def get_hotel_voucher_html(
    booking_ref: str,
    user_name: str,
    hotel_name: str,
    checkin: str,
    checkout: str,
    room_type: str = "Deluxe Room",
    guests: int = 2,
    address: str = "",
) -> tuple:
    """Hotel voucher email."""
    subject = f"🏨 Hotel Voucher: {booking_ref}"
    content = f"""
      <h2 style="color:#1a237e; margin-bottom:4px;">🏨 Hotel Voucher</h2>
      <p style="color:#546e7a;">Hi {user_name}, here is your hotel voucher for your upcoming stay.</p>

      <div class="card">
        <div class="label">Voucher / Booking Reference</div>
        <div class="value" style="font-size:22px; letter-spacing:2px;">{booking_ref}</div>
        <div style="margin-top:8px;"><span class="badge badge-blue">Hotel Confirmed</span></div>
      </div>

      <div class="grid" style="margin:20px 0;">
        <div class="grid-item card">
          <div class="label">Hotel</div>
          <div class="value">{hotel_name}</div>
          <div class="value-sm">{address}</div>
        </div>
        <div class="grid-item card">
          <div class="label">Room Type</div>
          <div class="value">{room_type}</div>
          <div class="value-sm">{guests} Guest(s)</div>
        </div>
      </div>

      <div class="grid" style="margin:20px 0;">
        <div class="grid-item card">
          <div class="label">Check-In</div>
          <div class="value">{checkin}</div>
          <div class="value-sm">After 2:00 PM</div>
        </div>
        <div class="grid-item card">
          <div class="label">Check-Out</div>
          <div class="value">{checkout}</div>
          <div class="value-sm">Before 12:00 PM</div>
        </div>
      </div>

      <hr class="divider" />
      <p style="color:#546e7a; font-size:13px;">Please present this voucher (or the attached PDF) at check-in. The hotel has been informed of your reservation.</p>

      <div class="cta">
        <a href="https://make-my-trip-delta.vercel.app/bookings/{booking_ref}">Manage Booking →</a>
      </div>
    """
    return subject, _base_template(content)


def get_cancellation_html(
    booking_ref: str,
    user_name: str,
    vertical: str,
    refund_amount: float,
    reason: str = "",
) -> tuple:
    """Booking cancellation and refund email."""
    subject = f"❌ Booking Cancelled: {booking_ref}"
    refund_str = f"₹{refund_amount:,.0f}" if refund_amount > 0 else "No refund applicable"
    reason_block = f"<p style='color:#546e7a; font-size:13px;'>Reason: {reason}</p>" if reason else ""

    content = f"""
      <h2 style="color:#c62828; margin-bottom:4px;">❌ Booking Cancelled</h2>
      <p style="color:#546e7a;">Hi {user_name}, your {vertical.title()} booking has been cancelled.</p>

      <div class="card">
        <div class="label">Cancelled Booking Reference</div>
        <div class="value" style="font-size:22px; letter-spacing:2px;">{booking_ref}</div>
        <div style="margin-top:8px;"><span style="background:#ffebee; color:#c62828; border-radius:20px; padding:4px 14px; font-size:13px; font-weight:600;">Cancelled</span></div>
      </div>

      {reason_block}

      <div class="card">
        <div class="label">Refund Amount</div>
        <div class="value" style="color:#2e7d32;">{refund_str}</div>
        <div class="value-sm" style="margin-top:4px;">Credited to your Travel Wallet within 24 hours.</div>
      </div>

      <hr class="divider" />
      <p style="color:#546e7a; font-size:13px;">If you have any questions, contact our support team.</p>

      <div class="cta">
        <a href="https://make-my-trip-delta.vercel.app/wallet" style="background: linear-gradient(135deg, #2e7d32, #388e3c);">View Wallet Balance →</a>
      </div>
    """
    return subject, _base_template(content)


def get_otp_html(user_name: str, otp_code: str, action: str = "login") -> tuple:
    """OTP verification email."""
    subject = f"🔐 Your Travel OS OTP: {otp_code}"
    content = f"""
      <h2 style="color:#1a237e; margin-bottom:4px;">🔐 Verification Code</h2>
      <p style="color:#546e7a;">Hi {user_name}, use the following OTP to complete your {action}.</p>

      <div class="card" style="text-align:center; padding:32px;">
        <div class="label">One-Time Password</div>
        <div style="font-size:48px; font-weight:800; color:#1a237e; letter-spacing:8px; margin:16px 0;">{otp_code}</div>
        <div class="value-sm">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</div>
      </div>

      <hr class="divider" />
      <p style="color:#546e7a; font-size:12px;">If you didn't request this, please ignore this email or contact support immediately.</p>
    """
    return subject, _base_template(content)


def get_flight_reminder_html(
    user_name: str,
    booking_ref: str,
    flight_number: str,
    origin: str,
    destination: str,
    departure_time: str,
    gate: str = "",
    terminal: str = "",
) -> tuple:
    """Flight reminder email."""
    subject = f"⏰ Flight Reminder: {flight_number} departs soon"
    gate_block = f"""
      <div class="grid-item card">
        <div class="label">Gate / Terminal</div>
        <div class="value">{gate or 'TBA'}</div>
        <div class="value-sm">{terminal}</div>
      </div>
    """ if gate or terminal else ""

    content = f"""
      <h2 style="color:#1a237e; margin-bottom:4px;">⏰ Your Flight is Coming Up!</h2>
      <p style="color:#546e7a;">Hi {user_name}, this is a reminder for your upcoming flight.</p>

      <div class="card">
        <div class="label">Flight</div>
        <div class="value">{flight_number} · {origin} → {destination}</div>
        <div class="value-sm">Booking: {booking_ref}</div>
      </div>

      <div class="grid" style="margin:20px 0;">
        <div class="grid-item card">
          <div class="label">Departure Time</div>
          <div class="value">{departure_time}</div>
        </div>
        {gate_block}
      </div>

      <hr class="divider" />
      <p style="color:#546e7a; font-size:13px;">Please arrive at the airport at least 2 hours before departure for domestic flights and 3 hours for international flights.</p>

      <div class="cta">
        <a href="https://make-my-trip-delta.vercel.app/bookings/{booking_ref}">View Boarding Pass →</a>
      </div>
    """
    return subject, _base_template(content)


def get_welcome_email_html(user_name: str, user_email: str) -> tuple:
    """Welcome email template."""
    subject = "👋 Welcome to Travel OS!"
    content = f"""
      <h2 style="color:#1a237e; margin-bottom:4px;">👋 Welcome to the Future of Travel!</h2>
      <p style="color:#546e7a;">Hi {user_name}, thank you for registering with Travel OS.</p>
      
      <div class="card">
        <div class="label">Registered Email</div>
        <div class="value">{user_email}</div>
      </div>
      
      <p style="color:#546e7a;">Travel OS is your AI-first travel companion. Use our natural language AI Concierge to search and book flights, hotels, and vacation packages, manage your travel wallet, and receive real-time updates.</p>
      
      <div class="cta">
        <a href="https://make-my-trip-delta.vercel.app/">Explore Dashboard →</a>
      </div>
    """
    return subject, _base_template(content)


def get_invoice_html(user_name: str, booking_ref: str, amount: float, items: List[Dict[str, Any]]) -> tuple:
    """Purchase invoice email."""
    subject = f"🧾 Invoice for Booking {booking_ref}"
    item_rows = "".join(
        f"<tr><td>{i.get('description', 'Item')}</td><td style='text-align: right;'>₹{i.get('amount', 0):,.2f}</td></tr>"
        for i in items
    )
    content = f"""
      <h2 style="color:#1a237e; margin-bottom:4px;">🧾 Payment Invoice</h2>
      <p style="color:#546e7a;">Hi {user_name}, here is the invoice for booking reference {booking_ref}.</p>
      
      <div class="card">
        <div class="label">Total Paid</div>
        <div class="value" style="font-size:24px; color:#2e7d32;">₹{amount:,.2f}</div>
      </div>
      
      <table style="margin-top:16px;">
        <thead>
          <tr>
            <th style="text-align: left;">Description</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          {item_rows}
        </tbody>
      </table>
      
      <hr class="divider" />
      <p style="color:#90a4ae; font-size:12px;">This is an electronically generated invoice. No physical signature is required.</p>
    """
    return subject, _base_template(content)


def get_password_reset_html(user_name: str, reset_link: str) -> tuple:
    """Password reset instructions email."""
    subject = "🔑 Reset Your Travel OS Password"
    content = f"""
      <h2 style="color:#1a237e; margin-bottom:4px;">🔑 Password Reset Request</h2>
      <p style="color:#546e7a;">Hi {user_name}, we received a request to reset your password. Click the button below to choose a new password.</p>
      
      <div class="cta">
        <a href="{reset_link}">Reset Password →</a>
      </div>
      
      <p style="color:#90a4ae; font-size:12px; margin-top:24px;">If you did not request a password reset, please ignore this email or contact support. This link will expire in 1 hour.</p>
    """
    return subject, _base_template(content)


def get_flight_delay_html(user_name: str, flight_number: str, delay_minutes: int) -> tuple:
    """Flight delay advisory email."""
    subject = f"⚠️ Flight Delay Advisory: {flight_number}"
    content = f"""
      <h2 style="color:#c62828; margin-bottom:4px;">⚠️ Flight Delay Alert</h2>
      <p style="color:#546e7a;">Hi {user_name}, flight <strong>{flight_number}</strong> is delayed.</p>
      
      <div class="card" style="background:#fffde7; border-color:#fff59d;">
        <div class="label" style="color:#f57f17;">Delay Duration</div>
        <div class="value" style="font-size:24px; color:#e65100;">{delay_minutes} Minutes</div>
      </div>
      
      <p style="color:#546e7a;">Please monitor your flight status dashboard for gates and terminal assignments before heading to the airport.</p>
      
      <div class="cta">
        <a href="https://make-my-trip-delta.vercel.app/" style="background: linear-gradient(135deg, #e65100, #f57c00);">Check Live Status →</a>
      </div>
    """
    return subject, _base_template(content)


def get_trip_completed_html(user_name: str, destination: str) -> tuple:
    """Post-trip welcome back and review email."""
    subject = f"✈️ Welcome back from {destination}!"
    content = f"""
      <h2 style="color:#1a237e; margin-bottom:4px;">✨ Welcome Back!</h2>
      <p style="color:#546e7a;">Hi {user_name}, we hope you had an amazing trip to {destination}.</p>
      
      <p style="color:#546e7a;">We would love to know how your booking and travel experience was. Please take a moment to provide your feedback widget reviews.</p>
      
      <div class="cta">
        <a href="https://make-my-trip-delta.vercel.app/feedback">Leave Feedback →</a>
      </div>
      
      <p style="color:#546e7a; font-size:13px; text-align:center; margin-top:20px;">Thank you for choosing Travel OS as your travel companion!</p>
    """
    return subject, _base_template(content)

