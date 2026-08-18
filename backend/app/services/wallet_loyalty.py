import datetime
from decimal import Decimal
from typing import Any
from sqlalchemy.orm import Session
from app.models.core import (
    User, WalletAccount, WalletTransaction, LoyaltyAccount,
    LoyaltyTransaction, Coupon
)

class InsufficientWalletBalance(Exception):
    pass

class CouponValidationError(Exception):
    pass

class WalletService:
    @staticmethod
    def get_or_create_wallet(db: Session, user_id: int) -> WalletAccount:
        wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user_id).first()
        if not wallet:
            wallet = WalletAccount(user_id=user_id, balance=0.00, currency="INR")
            db.add(wallet)
            db.commit()
            db.refresh(wallet)
        return wallet

    @classmethod
    def top_up(
        cls, 
        db: Session, 
        user_id: int, 
        amount: Any, 
        reference: str, 
        description: str = "Wallet Recharge", 
        mode: str = "test"
    ) -> WalletAccount:
        amt_float = float(amount)
        if amt_float <= 0:
            raise ValueError("Recharge amount must be positive.")
        
        wallet = cls.get_or_create_wallet(db, user_id)
        
        # Idempotency check on reference
        if reference and reference != "test_topup":
            existing = db.query(WalletTransaction).filter(
                WalletTransaction.wallet_account_id == wallet.id,
                WalletTransaction.reference == reference,
                WalletTransaction.type == "credit"
            ).first()
            if existing:
                return wallet

        bal_before = float(wallet.balance or 0.0)
        wallet.balance = round(bal_before + amt_float, 2)
        bal_after = float(wallet.balance)

        transaction = WalletTransaction(
            wallet_account_id=wallet.id,
            amount=amt_float,
            type="credit",
            balance_before=bal_before,
            balance_after=bal_after,
            reference=reference or f"recharge_{int(datetime.datetime.utcnow().timestamp())}",
            description=description or "Wallet Recharge",
            status="COMPLETED"
        )
        db.add(transaction)
        db.commit()
        db.refresh(wallet)
        return wallet

    @classmethod
    def debit_for_booking(
        cls, 
        db: Session, 
        user_id: int, 
        amount: Any, 
        booking_ref: str, 
        description: str = "Booking Payment"
    ) -> WalletAccount:
        amt_float = float(amount)
        if amt_float <= 0:
            raise ValueError("Debit amount must be positive.")

        wallet = cls.get_or_create_wallet(db, user_id)
        bal_before = float(wallet.balance or 0.0)
        
        if bal_before < amt_float:
            raise InsufficientWalletBalance("Insufficient wallet balance")

        # Idempotency check for duplicate debit
        if booking_ref:
            existing = db.query(WalletTransaction).filter(
                WalletTransaction.wallet_account_id == wallet.id,
                WalletTransaction.reference == booking_ref,
                WalletTransaction.type == "debit"
            ).first()
            if existing:
                return wallet

        wallet.balance = round(bal_before - amt_float, 2)
        bal_after = float(wallet.balance)

        transaction = WalletTransaction(
            wallet_account_id=wallet.id,
            amount=amt_float,
            type="debit",
            balance_before=bal_before,
            balance_after=bal_after,
            reference=booking_ref,
            description=description or f"Payment for booking {booking_ref}",
            status="COMPLETED"
        )
        db.add(transaction)
        db.commit()
        db.refresh(wallet)
        return wallet

    @classmethod
    def refund_to_wallet(
        cls, 
        db: Session, 
        user_id: int, 
        amount: Any, 
        booking_ref: str, 
        description: str = "Booking Refund"
    ) -> WalletAccount:
        amt_float = float(amount)
        if amt_float <= 0:
            return cls.get_or_create_wallet(db, user_id)

        wallet = cls.get_or_create_wallet(db, user_id)
        ref_str = f"Refund: {booking_ref}" if not booking_ref.startswith("Refund:") else booking_ref

        # Idempotency check to prevent duplicate refund
        existing = db.query(WalletTransaction).filter(
            WalletTransaction.wallet_account_id == wallet.id,
            (WalletTransaction.reference == ref_str) | (WalletTransaction.reference == booking_ref),
            WalletTransaction.type == "credit"
        ).first()
        if existing:
            return wallet

        bal_before = float(wallet.balance or 0.0)
        wallet.balance = round(bal_before + amt_float, 2)
        bal_after = float(wallet.balance)

        transaction = WalletTransaction(
            wallet_account_id=wallet.id,
            amount=amt_float,
            type="credit",
            balance_before=bal_before,
            balance_after=bal_after,
            reference=ref_str,
            description=description or f"Refund for booking {booking_ref}",
            status="COMPLETED"
        )
        db.add(transaction)
        db.commit()
        db.refresh(wallet)
        return wallet


class LoyaltyService:
    EARN_RATE = Decimal("0.05")  # Earn points equal to 5% of booking value (1 point per ₹20)

    @staticmethod
    def get_or_create_loyalty(db: Session, user_id: int) -> LoyaltyAccount:
        loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == user_id).first()
        if not loyalty:
            loyalty = LoyaltyAccount(user_id=user_id, points_balance=0, tier="Bronze")
            db.add(loyalty)
            db.commit()
            db.refresh(loyalty)
        return loyalty

    @classmethod
    def award_points(cls, db: Session, user_id: int, booking_value: Decimal, booking_ref: str) -> LoyaltyAccount:
        loyalty = cls.get_or_create_loyalty(db, user_id)
        points_to_award = int(booking_value * cls.EARN_RATE)
        if points_to_award > 0:
            # Check idempotency to prevent duplicate reward
            existing = db.query(LoyaltyTransaction).filter(
                LoyaltyTransaction.booking_ref == booking_ref,
                LoyaltyTransaction.points_delta > 0
            ).first()
            if existing:
                return loyalty
            loyalty.points_balance += points_to_award
            transaction = LoyaltyTransaction(
                loyalty_account_id=loyalty.id,
                points_delta=points_to_award,
                reason="Booking Reward",
                booking_ref=booking_ref
            )
            db.add(transaction)
            db.commit()
            db.refresh(loyalty)
            cls.recalculate_tier(db, user_id)
        return loyalty

    @classmethod
    def award_booking_points(cls, db: Session, user_id: int, vertical: str, booking_ref: str) -> LoyaltyAccount:
        # Check idempotency to prevent duplicate point awarding
        existing = db.query(LoyaltyTransaction).filter(
            LoyaltyTransaction.booking_ref == booking_ref,
            LoyaltyTransaction.points_delta > 0
        ).first()
        if existing:
            return cls.get_or_create_loyalty(db, user_id)

        # Determine points to award based on vertical
        v = vertical.lower()
        if "flight" in v:
            points_to_award = 500
            desc = "Flight Booking"
        elif "bus" in v:
            points_to_award = 100
            desc = "Bus Booking"
        elif "hotel" in v:
            points_to_award = 400
            desc = "Hotel Booking"
        elif "activity" in v or "tour" in v:
            points_to_award = 200
            desc = "Activity Booking"
        elif "train" in v:
            points_to_award = 150
            desc = "Train Booking"
        else:
            points_to_award = 100
            desc = f"{vertical.capitalize()} Booking"

        loyalty = cls.get_or_create_loyalty(db, user_id)
        if points_to_award > 0:
            loyalty.points_balance += points_to_award
            transaction = LoyaltyTransaction(
                loyalty_account_id=loyalty.id,
                points_delta=points_to_award,
                reason=f"+{points_to_award} {desc}",
                booking_ref=booking_ref
            )
            db.add(transaction)
            db.commit()
            db.refresh(loyalty)
            cls.recalculate_tier(db, user_id)
        return loyalty


    @classmethod
    def redeem_points(cls, db: Session, user_id: int, points: int, booking_ref: str) -> LoyaltyAccount:
        if points <= 0:
            raise ValueError("Redemption points must be positive")
        loyalty = cls.get_or_create_loyalty(db, user_id)
        if loyalty.points_balance < points:
            raise ValueError("Insufficient loyalty points")
        loyalty.points_balance -= points
        transaction = LoyaltyTransaction(
            loyalty_account_id=loyalty.id,
            points_delta=-points,
            reason="Points Redeemed",
            booking_ref=booking_ref
        )
        db.add(transaction)
        db.commit()
        db.refresh(loyalty)
        return loyalty

    @classmethod
    def recalculate_tier(cls, db: Session, user_id: int) -> str:
        # Sum of all credit loyalty transactions represent historical spend proxy or we can check total wallet recharges
        loyalty = cls.get_or_create_loyalty(db, user_id)
        # Fetch positive points sum (points earned)
        total_points_earned = db.query(
            sa_sum := sa_sum_func(LoyaltyTransaction.points_delta)
        ).filter(
            LoyaltyTransaction.loyalty_account_id == loyalty.id,
            LoyaltyTransaction.points_delta > 0
        ).scalar() or 0

        # Tier bands based on lifetime earned points
        if total_points_earned >= 10000:
            tier = "Platinum"
        elif total_points_earned >= 5000:
            tier = "Gold"
        elif total_points_earned >= 1500:
            tier = "Silver"
        else:
            tier = "Bronze"

        if loyalty.tier != tier:
            loyalty.tier = tier
            db.commit()
            db.refresh(loyalty)
        return tier

# Helper import inside function or use standard sqlalchemy function
def sa_sum_func(col):
    from sqlalchemy import func
    return func.sum(col)


class CouponService:
    @staticmethod
    def validate_coupon(db: Session, code: str, user_id: int, order_value: Decimal) -> Coupon:
        coupon = db.query(Coupon).filter(Coupon.code == code).first()
        if not coupon:
            raise CouponValidationError("Coupon not found")
        
        now = datetime.datetime.utcnow()
        if now < coupon.valid_from or now > coupon.valid_to:
            raise CouponValidationError("Coupon is expired or not active yet")
            
        if coupon.times_used >= coupon.usage_limit:
            raise CouponValidationError("Coupon usage limit exceeded")
            
        if order_value < Decimal(str(coupon.min_order_value)):
            raise CouponValidationError(f"Minimum order value of {coupon.min_order_value} not met")
            
        return coupon

    @classmethod
    def apply_coupon(cls, db: Session, code: str, user_id: int, order_value: Decimal) -> Decimal:
        coupon = cls.validate_coupon(db, code, user_id, order_value)
        coupon.times_used += 1
        db.commit()
        
        # Calculate discount
        discount_val = Decimal(str(coupon.value))
        if coupon.discount_type == "percentage":
            discount = (order_value * discount_val) / Decimal("100.00")
        else:
            discount = discount_val
            
        # Ensure discount does not exceed order value
        if discount > order_value:
            discount = order_value
            
        return discount
