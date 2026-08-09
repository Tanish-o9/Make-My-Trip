import re
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.bookings import FlightBooking, SpecialFareConfig, BookingStatus

class StudentVerificationService:
    @staticmethod
    def verify_student(student_data: dict, passenger_name: str, passenger_age: int, db: Session, all_passengers: list = None) -> dict:
        """
        Independent student verification system checking eligibility rules.
        Returns verification status or raises HTTPException if validation fails.
        """
        # NEVER log raw DOB, student ID, or uploaded document details!
        student_id = str(student_data.get("studentId", "")).strip()
        student_name = str(student_data.get("studentName", "")).strip()
        institution_name = str(student_data.get("institutionName", "")).strip()
        institution_city = str(student_data.get("institutionCity", "")).strip()
        student_course = str(student_data.get("studentCourse", "")).strip()
        student_dob = str(student_data.get("studentDateOfBirth", "")).strip()
        student_email = str(student_data.get("studentEmail", "")).strip()

        # 1. Required fields checks
        if not all([student_id, student_name, institution_name, institution_city, student_course, student_dob, student_email]):
            raise HTTPException(status_code=400, detail="All student verification fields are required.")

        # 2. Minimum length check for Student ID
        if len(student_id) < 3:
            raise HTTPException(status_code=400, detail="Student ID must be at least 3 characters long.")

        # 3. Reject placeholder values
        placeholders = ["test", "fake", "placeholder", "12345", "abcd", "none", "null", "student"]
        lower_id = student_id.lower()
        lower_name = student_name.lower()
        lower_inst = institution_name.lower()
        
        if any(pl == lower_id or pl == lower_name or pl in lower_inst for pl in placeholders):
            raise HTTPException(status_code=400, detail="Please enter real student details (avoid placeholder/test text).")

        # 4. DOB Validation
        try:
            # support formats like YYYY-MM-DD or standard parse
            datetime.fromisoformat(student_dob)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Student Date of Birth format.")

        # 5. Age check from db config
        student_config = db.query(SpecialFareConfig).filter(SpecialFareConfig.fare_type == "student").first()
        min_age = student_config.minimum_age if student_config else 5
        max_age = student_config.maximum_age if student_config else 30
        
        if passenger_age < min_age or passenger_age > max_age:
            raise HTTPException(status_code=400, detail=f"Age ({passenger_age}) must be between {min_age} and {max_age} for student fare.")

        # 6. Student name corresponds reasonably with passenger full name
        # Normalize: case, whitespace, common punctuation
        def normalize_name(n: str) -> str:
            return re.sub(r"[^a-zA-Z0-9]", "", n.lower())

        p_name = normalize_name(passenger_name)
        s_name = normalize_name(student_name)
        if s_name not in p_name and p_name not in s_name:
            raise HTTPException(status_code=400, detail="Student verification name does not match passenger name.")

        # 7. Email validation
        if not re.match(r"^\S+@\S+\.\S+$", student_email):
            raise HTTPException(status_code=400, detail="Invalid student email address.")

        # 8. Abuse Checks (Duplicate student ID check)
        status = "pending"
        
        # A. Check duplicates in the same booking payload
        if all_passengers:
            student_ids_in_payload = []
            for other_p in all_passengers:
                if other_p.get("specialFareType") == "student":
                    other_id = str(other_p.get("studentId", "")).strip()
                    if other_id:
                        student_ids_in_payload.append(other_id)
            # Count occurrences of the current student_id in the payload
            if student_ids_in_payload.count(student_id) > 1:
                # Same student ID is reused inside one booking
                status = "pending_review"

        # B. Check same Student ID reused suspiciously across multiple active bookings
        if status != "pending_review":
            active_bookings = db.query(FlightBooking).filter(
                FlightBooking.status.notin_([BookingStatus.CANCELLED, BookingStatus.EXPIRED])
            ).all()
            
            reuse_count = 0
            for ab in active_bookings:
                p_details = ab.passenger_details or []
                for ap in p_details:
                    if str(ap.get("studentId", "")).strip() == student_id:
                        reuse_count += 1
                        
            if reuse_count >= 1: # suspicious reuse count threshold
                status = "pending_review"

        return {
            "status": status,
            "reason": "External student verification provider not configured" if status == "pending" else "Suspicious reuse or duplicate detected"
        }
