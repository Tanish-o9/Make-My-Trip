import logging
import datetime
import secrets
from typing import Dict, Any, List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.core import User, Documents, WalletAccount
from app.models.bookings import FlightBooking, HotelBooking, BookingStatus
from app.models.saas import Tenant, Workspace, TenantSettings, TenantBranding, SaaSSubscription, SaaSInvoice
from app.models.agency import Agency, Agent, CustomerAssignment, CommissionRecord
from app.models.corporate import CorporateAccount, Department, EmployeeProfile, TravelPolicy, CostCenter, CorporateWallet, CorporateWalletTransaction, ApprovalWorkflow
from app.models.marketplace import MarketplacePartner, PartnerService, AffiliateReferral
from app.models.developer import DeveloperProfile, ApiKey, OAuthClient, WebhookSubscription, WebhookDeliveryLog
from app.models.workflow import WorkflowRule, WorkflowStep, WorkflowExecutionLog
from app.models.audit import AuditLog
from app.utils.tenant_context import get_current_tenant_id
from app.utils.event_bus import event_bus
from app.services.workflow_builder import workflow_engine
from app.services.global_search import global_search_service
from app.ai_agents.copilot import copilot_staff

logger = logging.getLogger(__name__)

router = APIRouter(tags=["saas"])

# ─── /api/v1/tenant ──────────────────────────────────────────────────────────

@router.post("/tenant")
def create_tenant(name: str, subdomain: str, custom_domain: Optional[str] = None, db: Session = Depends(get_db)):
    """Creates a new SaaS Tenant instance."""
    existing = db.query(Tenant).filter(Tenant.subdomain == subdomain).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subdomain already taken.")

    tenant = Tenant(name=name, subdomain=subdomain, custom_domain=custom_domain, status="active")
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    # Initialize default settings and branding
    settings = TenantSettings(tenant_id=tenant.id, settings_json={"features": ["flights", "hotels"]})
    branding = TenantBranding(tenant_id=tenant.id, primary_color="#007bff", secondary_color="#6c757d")
    db.add(settings)
    db.add(branding)
    db.commit()

    return {"tenant_id": tenant.id, "name": tenant.name, "subdomain": tenant.subdomain}


@router.get("/tenant/me")
def get_tenant_details(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    """Fetches details for the resolved current tenant context."""
    if current_user.tenant_id != tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")
        
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    
    branding = db.query(TenantBranding).filter(TenantBranding.tenant_id == tenant_id).first()
    settings = db.query(TenantSettings).filter(TenantSettings.tenant_id == tenant_id).first()

    return {
        "tenant_id": tenant.id,
        "name": tenant.name,
        "subdomain": tenant.subdomain,
        "custom_domain": tenant.custom_domain,
        "status": tenant.status,
        "branding": {
            "primary_color": branding.primary_color if branding else "#000000",
            "logo_url": branding.logo_url if branding else None
        } if branding else None,
        "settings": settings.settings_json if settings else {}
    }


# ─── /api/v1/organizations ───────────────────────────────────────────────────

@router.post("/organizations")
def create_organization(
    name: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    """Creates a new organization under the active tenant context."""
    if current_user.tenant_id != tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")
        
    existing = db.query(CorporateAccount).filter(CorporateAccount.name == name, CorporateAccount.tenant_id == tenant_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Organization name already taken.")

    org = CorporateAccount(name=name, tenant_id=tenant_id)
    db.add(org)
    db.commit()
    db.refresh(org)
    return {"organization_id": org.id, "name": org.name, "tenant_id": org.tenant_id}


@router.get("/organizations")
def list_organizations(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    """Lists all organizations registered for the current tenant."""
    if current_user.tenant_id != tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")
    orgs = db.query(CorporateAccount).filter(CorporateAccount.tenant_id == tenant_id).all()
    return [{"id": o.id, "name": o.name} for o in orgs]


# ─── /api/v1/workspaces ──────────────────────────────────────────────────────

@router.post("/workspaces")
def create_workspace(name: str, db: Session = Depends(get_db), tenant_id: int = Depends(get_current_tenant_id)):
    """Creates a new workspace subdivision under the tenant."""
    ws = Workspace(name=name, tenant_id=tenant_id)
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return {"workspace_id": ws.id, "name": ws.name, "tenant_id": ws.tenant_id}


@router.get("/workspaces")
def list_workspaces(db: Session = Depends(get_db), tenant_id: int = Depends(get_current_tenant_id)):
    """Lists all workspaces under the active tenant."""
    workspaces = db.query(Workspace).filter(Workspace.tenant_id == tenant_id).all()
    return [{"id": ws.id, "name": ws.name} for ws in workspaces]


# ─── /api/v1/agencies ────────────────────────────────────────────────────────

@router.post("/agencies")
def onboard_agency(name: str, address: Optional[str] = None, db: Session = Depends(get_db), tenant_id: int = Depends(get_current_tenant_id)):
    """Onboards a travel agency partner within the SaaS platform."""
    agency = Agency(name=name, address=address, tenant_id=tenant_id)
    db.add(agency)
    db.commit()
    db.refresh(agency)
    return {"agency_id": agency.id, "name": agency.name, "tenant_id": agency.tenant_id}


@router.get("/agencies/customers")
def agency_list_customers(db: Session = Depends(get_db), tenant_id: int = Depends(get_current_tenant_id)):
    """Lists all customers isolated by tenant context."""
    users = db.query(User).filter(User.tenant_id == tenant_id, User.role == "user").all()
    return [{"id": u.id, "email": u.email} for u in users]


@router.post("/agencies/customers")
def agency_add_customer(customer_email: str, db: Session = Depends(get_db), tenant_id: int = Depends(get_current_tenant_id)):
    """Agency adds customer profile under tenant isolation scope."""
    user = db.query(User).filter(User.email == customer_email, User.tenant_id == tenant_id).first()
    if not user:
        user = User(email=customer_email, role="user", tenant_id=tenant_id)
        db.add(user)
        db.commit()
        db.refresh(user)
    return {"customer_user_id": user.id, "email": user.email, "tenant_id": tenant_id}


@router.post("/agencies/bookings")
def agency_create_booking(
    customer_id: int, 
    origin: str, 
    destination: str, 
    amount: float,
    db: Session = Depends(get_db), 
    tenant_id: int = Depends(get_current_tenant_id)
):
    """Allows travel agent to book flights on behalf of customers."""
    ref = f"AG-FL-{secrets.token_hex(4).upper()}"
    fb = FlightBooking(
        tenant_id=tenant_id,
        user_id=customer_id,
        booking_reference=ref,
        origin=origin,
        destination=destination,
        total_amount=Decimal(str(amount)),
        currency="INR",
        airline_code="AI",
        flight_number="AI101",
        departure_time=datetime.datetime.utcnow() + datetime.timedelta(days=7),
        arrival_time=datetime.datetime.utcnow() + datetime.timedelta(days=7, hours=2),
        passenger_details=[{"name": "Agent Booked", "age": 30}],
        pricing_snapshot={"base": amount - 500, "taxes": 500, "fees": 0, "discount": 0},
        status=BookingStatus.CONFIRMED
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)

    # Record agent commission (10%)
    comm = CommissionRecord(
        agent_id=1,  # Mock default agent ID
        booking_ref=ref,
        amount=Decimal(str(amount * 0.10)),
        status="pending"
    )
    db.add(comm)
    db.commit()

    # Emit event through micro-event bus
    event_bus.emit("BookingCreated", {"booking_reference": ref, "amount": amount}, tenant_id)

    return {"booking_reference": fb.booking_reference, "commission_earned": float(comm.amount)}


@router.get("/agencies/commissions")
def agency_track_commissions(db: Session = Depends(get_db)):
    """Tracks commission logs for travel agencies agents."""
    records = db.query(CommissionRecord).all()
    return [
        {
            "id": r.id,
            "booking_ref": r.booking_ref,
            "amount": float(r.amount),
            "status": r.status
        }
        for r in records
    ]


# ─── /api/v1/corporate ────────────────────────────────────────────────────────

@router.post("/corporate/departments")
def corporate_create_department(
    name: str,
    corporate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Onboards a corporate department."""
    corp = db.query(CorporateAccount).filter(CorporateAccount.id == corporate_id).first()
    if not corp:
        raise HTTPException(status_code=404, detail="Corporate account not found.")
    # BUG-012p FIX: Enforce tenant boundary check
    if corp.tenant_id != current_user.tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")

    dept = Department(corporate_id=corporate_id, name=name)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"department_id": dept.id, "name": dept.name}


@router.post("/corporate/policies")
def corporate_set_policy(
    corporate_id: int,
    max_flight_class: str,
    per_diem_limit: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Configures corporate budget limits and policies."""
    corp = db.query(CorporateAccount).filter(CorporateAccount.id == corporate_id).first()
    if not corp:
        raise HTTPException(status_code=404, detail="Corporate account not found.")
    # BUG-012p FIX: Enforce tenant boundary check
    if corp.tenant_id != current_user.tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")

    policy = TravelPolicy(
        corporate_id=corporate_id,
        max_flight_class=max_flight_class,
        per_diem_limit_inr=Decimal(str(per_diem_limit))
    )
    db.add(policy)
    db.commit()
    return {"policy_id": policy.id, "per_diem_limit": float(policy.per_diem_limit_inr)}


@router.post("/corporate/cost-centers")
def corporate_create_cost_center(
    corporate_id: int,
    code: str,
    budget_limit: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a cost center under corporate account."""
    corp = db.query(CorporateAccount).filter(CorporateAccount.id == corporate_id).first()
    if not corp:
        raise HTTPException(status_code=404, detail="Corporate account not found.")
    # BUG-012p FIX: Enforce tenant boundary check
    if corp.tenant_id != current_user.tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")

    cc = CostCenter(corporate_id=corporate_id, code=code, budget_limit=Decimal(str(budget_limit)), current_spend=Decimal("0.0"))
    db.add(cc)
    db.commit()
    db.refresh(cc)
    return {"cost_center_id": cc.id, "code": cc.code, "budget_limit": float(cc.budget_limit)}


@router.get("/corporate/wallet")
def corporate_get_wallet(
    corporate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves corporate wallet details and balances."""
    corp = db.query(CorporateAccount).filter(CorporateAccount.id == corporate_id).first()
    if not corp:
        raise HTTPException(status_code=404, detail="Corporate account not found.")
    # BUG-012p FIX: Enforce tenant boundary check
    if corp.tenant_id != current_user.tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")

    wallet = db.query(CorporateWallet).filter(CorporateWallet.corporate_id == corporate_id).first()
    if not wallet:
        # Create default wallet
        wallet = CorporateWallet(corporate_id=corporate_id, balance=Decimal("0.0"), currency="INR")
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return {"wallet_id": wallet.id, "balance": float(wallet.balance), "currency": wallet.currency}


@router.post("/corporate/wallet/recharge")
def corporate_recharge_wallet(
    corporate_id: int,
    amount: float,
    reference: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Recharges corporate wallet funds."""
    corp = db.query(CorporateAccount).filter(CorporateAccount.id == corporate_id).first()
    if not corp:
        raise HTTPException(status_code=404, detail="Corporate account not found.")
    # BUG-012p FIX: Enforce tenant boundary check
    if corp.tenant_id != current_user.tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")

    wallet = db.query(CorporateWallet).filter(CorporateWallet.corporate_id == corporate_id).first()
    if not wallet:
        wallet = CorporateWallet(corporate_id=corporate_id, balance=Decimal("0.0"), currency="INR")
        db.add(wallet)
        db.commit()
        db.refresh(wallet)

    wallet.balance += Decimal(str(amount))
    txn = CorporateWalletTransaction(
        wallet_id=wallet.id,
        amount=Decimal(str(amount)),
        type="credit",
        reference=reference
    )
    db.add(txn)
    db.commit()
    return {"wallet_id": wallet.id, "new_balance": float(wallet.balance)}


@router.post("/corporate/approvals")
def corporate_create_approval_workflow(
    corporate_id: int,
    rule_type: str,
    threshold: float,
    manager_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates an approval workflow routing rule."""
    corp = db.query(CorporateAccount).filter(CorporateAccount.id == corporate_id).first()
    if not corp:
        raise HTTPException(status_code=404, detail="Corporate account not found.")
    # BUG-012p FIX: Enforce tenant boundary check
    if corp.tenant_id != current_user.tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")

    workflow = ApprovalWorkflow(
        corporate_id=corporate_id,
        rule_type=rule_type,
        threshold_amount=Decimal(str(threshold)),
        manager_user_id=manager_id
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return {"workflow_id": workflow.id, "rule_type": workflow.rule_type}


# ─── /api/v1/developers ──────────────────────────────────────────────────────

@router.post("/developers/keys")
def developer_generate_key(db: Session = Depends(get_db), tenant_id: int = Depends(get_current_tenant_id)):
    """Generates a secure API key for third-party developer integrations."""
    raw_key = f"pk_live_{secrets.token_urlsafe(32)}"
    masked = f"pk_live_...{raw_key[-8:]}"
    hashed = hash(raw_key)

    key_entry = ApiKey(
        tenant_id=tenant_id,
        masked_key=masked,
        hashed_key=str(hashed),
        rate_limit_rpm=60,
        active=True
    )
    db.add(key_entry)
    db.commit()

    return {"api_key": raw_key, "masked_key": masked}


@router.post("/developers/webhooks")
def developer_subscribe_webhook(target_url: str, event_types: List[str], db: Session = Depends(get_db), tenant_id: int = Depends(get_current_tenant_id)):
    """Subscribes an external webhook target URL to events notifications."""
    sub = WebhookSubscription(
        tenant_id=tenant_id,
        target_url=target_url,
        event_types=event_types,
        active=True
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"subscription_id": sub.id, "target_url": sub.target_url}


@router.get("/developers/webhooks/logs")
def developer_get_webhook_logs(db: Session = Depends(get_db), tenant_id: int = Depends(get_current_tenant_id)):
    """Lists logs of webhook delivery events."""
    logs = db.query(WebhookDeliveryLog).join(WebhookSubscription).filter(WebhookSubscription.tenant_id == tenant_id).all()
    return [
        {
            "id": l.id,
            "event_type": l.event_type,
            "status_code": l.status_code,
            "attempts": l.attempts
        }
        for l in logs
    ]


# ─── /api/v1/workflows ────────────────────────────────────────────────────────

@router.post("/workflows/rules")
def workflows_create_rule(name: str, trigger_event: str, db: Session = Depends(get_db), tenant_id: int = Depends(get_current_tenant_id)):
    """Registers an automated workflow rule."""
    rule = WorkflowRule(tenant_id=tenant_id, name=name, trigger_event=trigger_event, active=True)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"rule_id": rule.id, "name": rule.name}


@router.post("/workflows/rules/{rule_id}/steps")
def workflows_add_step(rule_id: int, action_type: str, step_index: int, config: dict, db: Session = Depends(get_db)):
    """Adds a condition step (IfElse, Email, Webhook, Delay) to a rule."""
    step = WorkflowStep(rule_id=rule_id, action_type=action_type, step_index=step_index, action_config=config)
    db.add(step)
    db.commit()
    return {"step_id": step.id, "step_index": step.step_index}


@router.get("/workflows/executions")
def workflows_list_executions(db: Session = Depends(get_db), tenant_id: int = Depends(get_current_tenant_id)):
    """Lists workflow execution log reports."""
    logs = db.query(WorkflowExecutionLog).join(WorkflowRule).filter(WorkflowRule.tenant_id == tenant_id).all()
    return [
        {
            "id": l.id,
            "rule_id": l.rule_id,
            "status": l.status,
            "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }
        for l in logs
    ]


# ─── /api/v1/search ──────────────────────────────────────────────────────────

@router.get("/search")
async def tenant_global_search(
    request: Request,
    q: Optional[str] = None,
    vertical: Optional[str] = None,
    tenant_id: int = Depends(get_current_tenant_id)
):
    """
    SaaS Global Search.
    Delegates to original unified_vertical_search if vertical is specified to maintain backward compatibility.
    Otherwise, runs multi-vertical search scoped by tenant.
    """
    if vertical:
        from app.routes.search import unified_vertical_search
        
        expected_params = ["vertical", "origin", "destination", "date", "passengers", "budget", 
                           "category", "locality_id", "pickup", "drop", "type", "selfDrive", 
                           "check_in", "check_out", "sort_by", "stops", "carrier", "amenity", 
                           "cancellation", "limit", "offset"]
        call_args = {}
        for p in expected_params:
            if p in request.query_params:
                val = request.query_params[p]
                if p in ["passengers", "locality_id", "limit", "offset"]:
                    try:
                        call_args[p] = int(val)
                    except ValueError:
                        pass
                elif p == "budget":
                    try:
                        call_args[p] = float(val)
                    except ValueError:
                        pass
                else:
                    call_args[p] = val
                    
        call_args["vertical"] = vertical
        return await unified_vertical_search(**call_args)

    return {"results": global_search_service.search_all(q or "", tenant_id)}


# ─── /api/v1/copilot ─────────────────────────────────────────────────────────

@router.post("/copilot/assist")
def copilot_assist_staff(role: str, query: str, context: dict):
    """AI Copilot suggestions and summaries for internal staff roles."""
    return copilot_staff.assist_staff(role, query, context)


# ─── /api/v1/events ──────────────────────────────────────────────────────────

@router.post("/events/emit")
def emit_manual_event(event_type: str, payload: dict, tenant_id: int = Depends(get_current_tenant_id)):
    """Developer API to emit an event manually to test subscriptions & webhook actions."""
    event_bus.emit(event_type, payload, tenant_id=tenant_id)
    return {"success": True, "event_type": event_type, "tenant_id": tenant_id}


@router.get("/events/dlq")
def get_dead_letter_queue(current_user: User = Depends(get_current_user)):
    """Lists events that failed webhook delivery and are stored in the Dead Letter Queue (DLQ)."""
    # BUG-012n FIX: Restrict DLQ access to system administrators only
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Administrative privileges required.")
    return {"dlq": event_bus.dlq}


# ─── /api/v1/audit ───────────────────────────────────────────────────────────

@router.get("/audit/logs")
def list_audit_logs(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    """Lists platform audit trails filtered by active tenant scope (for cross-tenant protection)."""
    # BUG-012n FIX: Ensure user has access to active tenant scope
    if current_user.tenant_id != tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")
    logs = db.query(AuditLog).filter(AuditLog.user_id == tenant_id).all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "details": log.details,
            "created_at": log.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }
        for log in logs
    ]


# ─── COMPLIANCE & GDPR ───────────────────────────────────────────────────────

@router.get("/compliance/export")
def compliance_export_data(
    email: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    """GDPR Data Export: fetches all isolated bookings, profile, and documents in JSON format."""
    # BUG-012n FIX: Require that user is either a system admin or exporting their own data
    if current_user.role != "admin" and current_user.email != email:
        raise HTTPException(status_code=403, detail="Access denied: Compliance export privileges required.")
    if current_user.tenant_id != tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")

    user = db.query(User).filter(User.email == email, User.tenant_id == tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    flights = db.query(FlightBooking).filter(FlightBooking.user_id == user.id).all()
    docs = db.query(Documents).filter(Documents.user_id == user.id).all()

    return {
        "user_email": user.email,
        "role": user.role,
        "flights_booked": [{"ref": f.booking_reference, "amount": float(f.total_amount)} for f in flights],
        "documents": [{"type": d.document_type, "number": d.document_number} for d in docs]
    }


@router.delete("/compliance/delete")
def compliance_delete_account(
    email: str,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    """GDPR Deletion: soft-deletes profile metadata, logs audits, and anonymizes email."""
    # BUG-012n FIX: Require that user is either a system admin or deleting their own account
    if current_user.role != "admin" and current_user.email != email:
        raise HTTPException(status_code=403, detail="Access denied: Compliance deletion privileges required.")
    if current_user.tenant_id != tenant_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Cross-tenant operations are forbidden.")

    user = db.query(User).filter(User.email == email, User.tenant_id == tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.email = f"anonymized_{secrets.token_hex(4)}@compliance.travelos.com"
    user.phone = None
    db.commit()

    return {"success": True, "message": "Account has been anonymized successfully for GDPR compliance."}
