import io
import csv
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.mybiz import Organization, EmployeeLink
from app.models.bookings import BookingStatus, TrainBooking, CabBooking, HolidayPackageBooking, VisaApplication
from app.services.booking_core import BookingStateMachine

router = APIRouter(prefix="/mybiz", tags=["mybiz"])

@router.post("/orgs")
def onboard_organization(
    name: str,
    per_diem_limit: float = 5000.0,
    db: Session = Depends(get_db)
):
    """Onboards a corporate organization and locks travel policy thresholds"""
    existing = db.query(Organization).filter(Organization.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Organization name already registered.")
        
    org = Organization(
        name=name,
        per_diem_limit=per_diem_limit,
        max_fare_class="ECONOMY",
        max_hotel_rating=4
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    
    return {
        "org_id": org.id,
        "name": org.name,
        "per_diem_limit": float(org.per_diem_limit)
    }


@router.post("/employees/link")
def link_employee_to_org(
    org_id: int,
    user_id: int,
    role: str = "traveler", # admin, approver, traveler
    db: Session = Depends(get_db)
):
    """Links employee profile to corporate organization with permissions"""
    existing = db.query(EmployeeLink).filter(
        EmployeeLink.user_id == user_id,
        EmployeeLink.org_id == org_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee link already exists.")
        
    link = EmployeeLink(
        user_id=user_id,
        org_id=org_id,
        role=role
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    
    return {
        "link_id": link.id,
        "org_id": link.org_id,
        "user_id": link.user_id,
        "role": link.role
    }


@router.post("/approvals/verdict")
def submit_approval_verdict(
    booking_reference: str,
    vertical: str,
    verdict: str, # approve, reject
    db: Session = Depends(get_db)
):
    """Corporate approver releases or rejects travel bookings held in PENDING_APPROVAL status"""
    booking = None
    if vertical == "trains":
        booking = db.query(TrainBooking).filter(TrainBooking.booking_reference == booking_reference).first()
    elif vertical == "cabs":
        booking = db.query(CabBooking).filter(CabBooking.booking_reference == booking_reference).first()
    elif vertical == "visa":
        booking = db.query(VisaApplication).filter(VisaApplication.booking_reference == booking_reference).first()
    elif vertical == "holidays":
        booking = db.query(HolidayPackageBooking).filter(HolidayPackageBooking.booking_reference == booking_reference).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking reference not found.")

    if booking.status != BookingStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="Booking status is not pending manager approval.")

    if verdict.lower() == "approve":
        BookingStateMachine.transition_to(booking, BookingStatus.CONFIRMED)
    else:
        BookingStateMachine.transition_to(booking, BookingStatus.CANCELLED)

    db.commit()
    return {
        "booking_reference": booking.booking_reference,
        "status": booking.status,
        "verdict": verdict
    }


@router.get("/expenses")
def export_expense_reporting(
    org_id: int,
    db: Session = Depends(get_db)
):
    """Aggregates all bookings under an organization and outputs a CSV stream"""
    # Fetch all employees linked to org
    employees = db.query(EmployeeLink).filter(EmployeeLink.org_id == org_id).all()
    user_ids = [emp.user_id for emp in employees]

    if not user_ids:
        raise HTTPException(status_code=404, detail="No employees found for this organization.")

    # Collect bookings from multiple verticals
    all_expenses = []

    # Helper to push item
    def push_booking(b, vertical_name):
        all_expenses.append({
            "User ID": b.user_id,
            "Booking Ref": b.booking_reference,
            "Vertical": vertical_name,
            "Amount (INR)": float(b.total_amount),
            "Status": b.status.value,
            "Created At": b.created_at.strftime("%Y-%m-%d")
        })

    # Train bookings
    trains = db.query(TrainBooking).filter(TrainBooking.user_id.in_(user_ids)).all()
    for t in trains:
        push_booking(t, "trains")

    # Cab bookings
    cabs = db.query(CabBooking).filter(CabBooking.user_id.in_(user_ids)).all()
    for c in cabs:
        push_booking(c, "cabs")

    # Holidays
    holidays = db.query(HolidayPackageBooking).filter(HolidayPackageBooking.user_id.in_(user_ids)).all()
    for h in holidays:
        push_booking(h, "holidays")

    # Visa
    visas = db.query(VisaApplication).filter(VisaApplication.user_id.in_(user_ids)).all()
    for v in visas:
        push_booking(v, "visa")

    # Generate CSV stream
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["User ID", "Booking Ref", "Vertical", "Amount (INR)", "Status", "Created At"])
    writer.writeheader()
    writer.writerows(all_expenses)
    
    # Reset stream pointer
    output.seek(0)
    
    response = StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = f"attachment; filename=org_{org_id}_expenses.csv"
    return response
