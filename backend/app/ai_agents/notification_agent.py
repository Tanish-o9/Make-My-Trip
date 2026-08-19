import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.services.communication import TwilioClient, SendGridClient
from app.models.core import User
from app.models.audit import Notification

logger = logging.getLogger(__name__)

class NotificationAgent:
    _twilio = TwilioClient()
    _sendgrid = SendGridClient()

    @classmethod
    def dispatch_in_app(
        cls, 
        db: Session, 
        user_id: int, 
        title: str, 
        message: str, 
        notification_type: str = "GENERAL", 
        booking_ref: Optional[str] = None, 
        vertical: Optional[str] = None, 
        action_url: Optional[str] = None
    ):
        notification = Notification(
            user_id=user_id,
            channel="in_app",
            title=title,
            message=message,
            notification_type=notification_type,
            booking_reference=booking_ref,
            vertical=vertical,
            action_url=action_url,
            is_read=False,
            delivery_status="DELIVERED",
            status="sent"
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        logger.info(f"Dispatched in-app notification to user {user_id}: {title}")

    @classmethod
    def dispatch_booking_confirmation(cls, db: Session, user_id: int, booking_type: str, booking_ref: str, details: str):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        subject = f"Booking Confirmed: {booking_ref}"
        body = f"Hello! Your {booking_type} booking ({booking_ref}) has been successfully confirmed. Details: {details}."

        # Log notification in DB
        notification_log = Notification(
            user_id=user_id,
            channel="email_and_sms",
            payload={"subject": subject, "body": body},
            status="sent"
        )
        db.add(notification_log)
        db.commit()

        # Send Email
        cls._sendgrid.send_email(user.email, subject, body)
        
        # Send SMS if phone is available
        if user.phone:
            cls._twilio.send_sms(user.phone, body)
            
        logger.info(f"Dispatched booking notifications for {booking_ref} to user {user_id}")

    @classmethod
    def dispatch_cancellation_refund(cls, db: Session, user_id: int, booking_ref: str, refund_amount: float):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        subject = f"Booking Cancelled: {booking_ref}"
        body = f"Hello! Your booking {booking_ref} has been cancelled. A refund of ₹{refund_amount:,} has been credited to your Travel Wallet."

        # Log in-app notification
        cls.dispatch_in_app(
            db=db,
            user_id=user_id,
            title="Booking Cancelled & Refunded",
            message=body,
            notification_type="BOOKING_CANCELLED",
            booking_ref=booking_ref,
            action_url="/wallet"
        )

        notification_log = Notification(
            user_id=user_id,
            channel="email_and_sms",
            payload={"subject": subject, "body": body},
            status="sent"
        )
        db.add(notification_log)
        db.commit()

        # Send Email & SMS
        cls._sendgrid.send_email(user.email, subject, body)
        if user.phone:
            cls._twilio.send_sms(user.phone, body)
            
        logger.info(f"Dispatched cancellation notifications for {booking_ref} to user {user_id}")

    @classmethod
    def dispatch_booking_under_review(cls, db: Session, user_id: int, booking_type: str, booking_ref: str, expected_time_min: int):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        subject = f"Booking Under Review: {booking_ref}"
        body = f"Hello! Your {booking_type} booking ({booking_ref}) is currently under review. We expect to confirm it within {expected_time_min} minutes. Thank you for your patience."

        notification_log = Notification(
            user_id=user_id,
            channel="email_and_sms",
            payload={"subject": subject, "body": body},
            status="sent"
        )
        db.add(notification_log)
        db.commit()

        cls._sendgrid.send_email(user.email, subject, body)
        if user.phone:
            cls._twilio.send_sms(user.phone, body)
            
        logger.info(f"Dispatched review notifications for {booking_ref} to user {user_id}")

    @classmethod
    def dispatch_booking_rejection(cls, db: Session, user_id: int, booking_type: str, booking_ref: str, reason: str):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        subject = f"Booking Declined: {booking_ref}"
        body = f"Hello. Unfortunately, your {booking_type} booking ({booking_ref}) could not be confirmed. Reason: {reason}. Any authorized payment hold has been voided."

        notification_log = Notification(
            user_id=user_id,
            channel="email_and_sms",
            payload={"subject": subject, "body": body},
            status="sent"
        )
        db.add(notification_log)
        db.commit()

        cls._sendgrid.send_email(user.email, subject, body)
        if user.phone:
            cls._twilio.send_sms(user.phone, body)
            
        logger.info(f"Dispatched rejection notifications for {booking_ref} to user {user_id}")
