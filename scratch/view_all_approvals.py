from app.database import SessionLocal
from app.models.payments import ApprovalRequest

db = SessionLocal()
approvals = db.query(ApprovalRequest).all()

print(f"Total approval tickets found: {len(approvals)}")
for a in approvals:
    reason_safe = str(a.reason).encode('ascii', 'ignore').decode('ascii')
    print(f"ID: {a.id} | Reference: {a.reference_id} | Type: {a.request_type} | Status: {a.status} | Reason: {reason_safe}")

db.close()
