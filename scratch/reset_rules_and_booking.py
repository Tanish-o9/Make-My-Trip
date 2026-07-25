import datetime
from app.database import SessionLocal
from app.models.core import User
from app.models.payments import AutoApprovalRule, ApprovalRequest
from app.models.bookings import HolidayPackageBooking, BookingStatus

db = SessionLocal()

# 1. Deactivate all auto-approval rules in dev db
rules = db.query(AutoApprovalRule).all()
for rule in rules:
    rule.active = False
print(f"Deactivated {len(rules)} auto-approval rules in the database.")

# 2. Reset booking BK-05DED608 back to PENDING_ADMIN_APPROVAL
booking_ref = "BK-05DED608"
booking = db.query(HolidayPackageBooking).filter(HolidayPackageBooking.booking_reference == booking_ref).first()

if booking:
    booking.status = BookingStatus.PENDING_ADMIN_APPROVAL
    print(f"Reverted booking {booking_ref} status to PENDING_ADMIN_APPROVAL.")
    
    # 3. Create ApprovalRequest ticket if not exists
    existing = db.query(ApprovalRequest).filter(ApprovalRequest.reference_id == booking_ref).first()
    if not existing:
        approval = ApprovalRequest(
            request_type="new_booking",
            reference_id=booking_ref,
            requested_by=f"user_{booking.user_id}",
            amount=float(booking.total_amount),
            reason="New booking review for holidays vertical.",
            status="PENDING",
            payment_gateway=None,
            payment_charge_id=None,
            sla_expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=60),
            is_sla_breached=False,
            timeout_behavior="auto_reject",
            assigned_role="Booking Approver"
        )
        db.add(approval)
        print(f"Created pending approval request ticket for booking {booking_ref}.")
    else:
        existing.status = "PENDING"
        existing.reviewed_by = None
        existing.review_notes = None
        print(f"Updated existing approval request ticket to PENDING for {booking_ref}.")
else:
    print(f"Booking {booking_ref} not found in database.")

db.commit()
db.close()
print("Reset script run completed successfully!")
