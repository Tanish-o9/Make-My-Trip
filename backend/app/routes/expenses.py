import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.core import User, Trip, TripExpense, TripMember, TripExpenseSplit
from app.auth.dependencies import get_current_user

router = APIRouter(tags=["expenses"])

# Expense category validation list
ALLOWED_CATEGORIES = ["Transport", "Hotel", "Food", "Activities", "Shopping", "Other"]

class ExpenseSplitPayload(BaseModel):
    user_id: int
    amount: float

class ExpenseCreate(BaseModel):
    amount: float
    currency: str = "INR"
    category: str # Transport, Hotel, Food, Activities, Shopping, Other
    description: Optional[str] = None
    expense_date: Optional[str] = None # YYYY-MM-DD
    payer_id: Optional[int] = None
    split_type: Optional[str] = "equal" # equal, custom
    splits: Optional[List[ExpenseSplitPayload]] = None

class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    expense_date: Optional[str] = None # YYYY-MM-DD
    payer_id: Optional[int] = None
    split_type: Optional[str] = None
    splits: Optional[List[ExpenseSplitPayload]] = None

class BudgetUpdate(BaseModel):
    budget: float

@router.get("/trips/{trip_id}/expenses")
def list_trip_expenses(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all expenses for a specific trip, calculating total, remaining budget, and split debt details"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    # Check owner or member access
    is_owner = (trip.user_id == current_user.id)
    is_member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id
    ).first() is not None
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    expenses = db.query(TripExpense).filter(TripExpense.trip_id == trip_id).all()
    
    total = sum(float(e.amount) for e in expenses)
    budget = float(trip.budget or 0.0)
    remaining = budget - total
    
    # Calculate user_owes and user_is_owed balance sheet details
    user_owes = 0.0
    user_is_owed = 0.0
    
    expense_list = []
    for e in expenses:
        splits = db.query(TripExpenseSplit).filter(TripExpenseSplit.expense_id == e.id).all()
        splits_list = []
        for s in splits:
            splits_list.append({
                "user_id": s.user_id,
                "amount": float(s.amount)
            })
            # If user is a target of the split and not the payer: they owe the payer
            if s.user_id == current_user.id and e.payer_id != current_user.id:
                user_owes += float(s.amount)
            # If user paid, others owe them (excluding their own share)
            elif e.payer_id == current_user.id and s.user_id != current_user.id:
                user_is_owed += float(s.amount)
                
        expense_list.append({
            "id": e.id,
            "trip_id": e.trip_id,
            "amount": float(e.amount),
            "currency": e.currency,
            "category": e.category,
            "description": e.description,
            "expense_date": e.expense_date.isoformat() if e.expense_date else None,
            "payer_id": e.payer_id or trip.user_id,
            "split_type": e.split_type,
            "splits": splits_list,
            "created_at": e.created_at.isoformat() if e.created_at else None
        })
        
    return {
        "trip_id": trip_id,
        "trip_name": trip.name,
        "budget": budget,
        "total_expenses": total,
        "remaining_budget": remaining,
        "user_owes": user_owes,
        "user_is_owed": user_is_owed,
        "expenses": expense_list
    }


@router.post("/trips/{trip_id}/expenses", status_code=status.HTTP_201_CREATED)
def add_trip_expense(
    trip_id: int,
    payload: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Adds a new expense to the trip and registers splits among group members"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    # Check owner or member access
    is_owner = (trip.user_id == current_user.id)
    is_member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id
    ).first() is not None
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    category_normalized = payload.category.strip().capitalize()
    matched_cat = None
    for cat in ALLOWED_CATEGORIES:
        if cat.lower() == category_normalized.lower():
            matched_cat = cat
            break
            
    if not matched_cat:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(ALLOWED_CATEGORIES)}"
        )
        
    exp_date = None
    if payload.expense_date:
        try:
            exp_date = datetime.datetime.strptime(payload.expense_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    else:
        exp_date = datetime.date.today()
        
    payer_id = payload.payer_id or current_user.id
    split_type = payload.split_type or "equal"
    
    expense = TripExpense(
        trip_id=trip_id,
        amount=payload.amount,
        currency=payload.currency,
        category=matched_cat,
        description=payload.description,
        expense_date=exp_date,
        payer_id=payer_id,
        split_type=split_type
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    
    # Process Splits
    if split_type == "equal":
        # Get all members of the trip
        members = db.query(TripMember).filter(TripMember.trip_id == trip_id).all()
        member_ids = [m.user_id for m in members]
        if trip.user_id not in member_ids:
            member_ids.append(trip.user_id)
            
        if payload.splits:
            member_ids = [s.user_id for s in payload.splits]
            
        if not member_ids:
            member_ids = [current_user.id]
            
        split_amount = payload.amount / len(member_ids)
        for m_id in member_ids:
            split_record = TripExpenseSplit(
                expense_id=expense.id,
                user_id=m_id,
                amount=split_amount
            )
            db.add(split_record)
        db.commit()
        
    elif split_type == "custom":
        if not payload.splits:
            raise HTTPException(status_code=400, detail="Custom splits require split shares payload.")
        total_splits = sum(s.amount for s in payload.splits)
        if abs(total_splits - payload.amount) > 0.01:
            raise HTTPException(status_code=400, detail="Sum of splits must equal the total expense amount.")
            
        for s in payload.splits:
            split_record = TripExpenseSplit(
                expense_id=expense.id,
                user_id=s.user_id,
                amount=s.amount
            )
            db.add(split_record)
        db.commit()
        
    return {"message": "Expense added successfully.", "id": expense.id}


@router.patch("/expenses/{id}")
def update_trip_expense(
    id: int,
    payload: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Edits an existing trip expense and recalculates splits if modified"""
    expense = db.query(TripExpense).filter(TripExpense.id == id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")
        
    trip = db.query(Trip).filter(Trip.id == expense.trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip associated with this expense not found.")
        
    is_owner = (trip.user_id == current_user.id)
    is_member = db.query(TripMember).filter(
        TripMember.trip_id == trip.id,
        TripMember.user_id == current_user.id
    ).first() is not None
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    if payload.amount is not None:
        expense.amount = payload.amount
    if payload.currency is not None:
        expense.currency = payload.currency
    if payload.payer_id is not None:
        expense.payer_id = payload.payer_id
    if payload.split_type is not None:
        expense.split_type = payload.split_type
        
    if payload.category is not None:
        category_normalized = payload.category.strip().capitalize()
        matched_cat = None
        for cat in ALLOWED_CATEGORIES:
            if cat.lower() == category_normalized.lower():
                matched_cat = cat
                break
        if not matched_cat:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid category. Must be one of: {', '.join(ALLOWED_CATEGORIES)}"
            )
        expense.category = matched_cat
    if payload.description is not None:
        expense.description = payload.description
    if payload.expense_date is not None:
        try:
            expense.expense_date = datetime.datetime.strptime(payload.expense_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
            
    db.commit()
    
    # Recalculate splits if splits or amount were updated
    if payload.splits is not None or payload.amount is not None:
        # Clear existing splits
        db.query(TripExpenseSplit).filter(TripExpenseSplit.expense_id == expense.id).delete()
        db.commit()
        
        split_type = expense.split_type
        if split_type == "equal":
            members = db.query(TripMember).filter(TripMember.trip_id == expense.trip_id).all()
            member_ids = [m.user_id for m in members]
            if trip.user_id not in member_ids:
                member_ids.append(trip.user_id)
                
            if payload.splits:
                member_ids = [s.user_id for s in payload.splits]
                
            split_amount = float(expense.amount) / len(member_ids)
            for m_id in member_ids:
                split_record = TripExpenseSplit(
                    expense_id=expense.id,
                    user_id=m_id,
                    amount=split_amount
                )
                db.add(split_record)
            db.commit()
            
        elif split_type == "custom":
            splits_data = payload.splits if payload.splits is not None else []
            if not splits_data:
                raise HTTPException(status_code=400, detail="Custom splits require split shares payload.")
            total_splits = sum(s.amount for s in splits_data)
            if abs(total_splits - float(expense.amount)) > 0.01:
                raise HTTPException(status_code=400, detail="Sum of splits must equal the total expense amount.")
                
            for s in splits_data:
                split_record = TripExpenseSplit(
                    expense_id=expense.id,
                    user_id=s.user_id,
                    amount=s.amount
                )
                db.add(split_record)
            db.commit()
            
    return {"message": "Expense updated successfully."}


@router.delete("/expenses/{id}")
def delete_trip_expense(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes an expense item from a trip"""
    expense = db.query(TripExpense).filter(TripExpense.id == id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found.")
        
    trip = db.query(Trip).filter(Trip.id == expense.trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip associated with this expense not found.")
        
    is_owner = (trip.user_id == current_user.id)
    is_member = db.query(TripMember).filter(
        TripMember.trip_id == trip.id,
        TripMember.user_id == current_user.id
    ).first() is not None
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted successfully."}


@router.put("/trips/{trip_id}/budget")
def set_trip_budget(
    trip_id: int,
    payload: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sets/updates the overall budget for the trip"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")
        
    is_owner = (trip.user_id == current_user.id)
    is_member = db.query(TripMember).filter(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id
    ).first() is not None
    
    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Access denied: You do not belong to this trip group.")
        
    trip.budget = payload.budget
    db.commit()
    return {"message": "Trip budget updated successfully.", "budget": payload.budget}
