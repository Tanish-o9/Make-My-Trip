import datetime
from app.database import SessionLocal
from app.models.core import User
from app.models.payments import ApprovalRequest
from app.models.bookings import VillaBooking

db = SessionLocal()

booking_ref = "BK-3ABF9951"
booking = db.query(VillaBooking).filter(VillaBooking.booking_reference == booking_ref).first()

if booking:
    # Check if approval request already exists
    existing = db.query(ApprovalRequest).filter(ApprovalRequest.reference_id == booking_ref).first()
    if not existing:
        approval = ApprovalRequest(
            request_type="new_booking",
            reference_id=booking_ref,
            requested_by=f"user_{booking.user_id}",
            amount=float(booking.total_amount),
            reason="Villa booking requires host confirmation.",
            status="PENDING",
            payment_gateway=None,
            payment_charge_id=None,
            sla_expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=120),
            is_sla_breached=False,
            timeout_behavior="auto_reject",
            assigned_role="Booking Approver"
        )
        db.add(approval)
        db.commit()
        print(f"Successfully inserted approval request for booking {booking_ref}.")
    else:
        print(f"Approval request for booking {booking_ref} already exists.")
else:
    print(f"Booking {booking_ref} not found in database.")

db.close()
