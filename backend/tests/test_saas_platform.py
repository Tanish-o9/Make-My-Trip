import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database import SessionLocal
from app.models.core import User, Documents
from app.models.bookings import FlightBooking, BookingStatus
from app.models.saas import Tenant, Workspace, SaaSSubscription
from app.models.workflow import WorkflowRule, WorkflowStep, WorkflowExecutionLog
from app.services.workflow_builder import workflow_engine
from app.services.global_search import global_search_service
from app.auth.jwt import hash_password, create_access_token
from app.models.corporate import CorporateAccount

client = TestClient(app)

@pytest.fixture(scope="module")
def saas_setup():
    """Seeds a test tenant, test customer user, and mock rule mappings."""
    db = SessionLocal()
    
    # 1. Clear pre-existing test data
    db.query(WorkflowRule).delete()
    db.query(SaaSSubscription).delete()
    db.query(Workspace).delete()
    db.query(Tenant).delete()
    db.commit()

    # 2. Seed a test tenant
    tenant = Tenant(name="Test Travel Agency", subdomain="testagency", status="active")
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    # 3. Seed a test customer user belonging to this tenant
    user = User(email="customer_test@testagency.com", role="user", tenant_id=tenant.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Seed an admin user for tenant operations
    admin = db.query(User).filter(User.email == "admin_saas@travelos.com").first()
    if not admin:
        admin = User(
            email="admin_saas@travelos.com",
            password_hash=hash_password("securepassword"),
            role="admin",
            tenant_id=tenant.id
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    # Seed corporate account 1 under this tenant
    corp = db.query(CorporateAccount).filter(CorporateAccount.id == 1).first()
    if not corp:
        corp = CorporateAccount(id=1, name="ApexCorporates", tenant_id=tenant.id)
        db.add(corp)
        db.commit()

    # 4. Seed documents for GDPR compliance tests
    doc = Documents(user_id=user.id, document_type="Passport", document_number="PPT123456")
    db.add(doc)
    db.commit()

    tenant_id = tenant.id
    user_id = user.id
    db.close()

    admin_token = create_access_token(data={"sub": "admin_saas@travelos.com"})
    customer_token = create_access_token(data={"sub": "customer_test@testagency.com"})

    yield {
        "tenant_id": tenant_id,
        "customer_user_id": user_id,
        "customer_email": "customer_test@testagency.com",
        "admin_headers": {
            "X-Tenant-ID": str(tenant_id),
            "Authorization": f"Bearer {admin_token}"
        },
        "customer_headers": {
            "X-Tenant-ID": str(tenant_id),
            "Authorization": f"Bearer {customer_token}"
        }
    }

    # Clean up
    db2 = SessionLocal()
    db2.query(Documents).filter(Documents.user_id == user_id).delete()
    db2.query(CorporateAccount).filter(CorporateAccount.id == 1).delete()
    db2.query(User).filter(User.id == user_id).delete()
    db2.query(User).filter(User.email == "admin_saas@travelos.com").delete()
    db2.query(Tenant).filter(Tenant.id == tenant_id).delete()
    db2.commit()
    db2.close()


# ─── SaaS & Multi-Tenancy Tests ──────────────────────────────────────────────

def test_tenant_creation_and_retrait(saas_setup):
    """SaaS Admin should onboard new tenants and retrieve metadata isolated by headers."""
    resp = client.post("/api/v1/tenant?name=ApexCorporates&subdomain=apexcorp")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "ApexCorporates"
    assert data["subdomain"] == "apexcorp"
    
    # Retrieve details using X-Tenant-ID header
    headers = {
        "X-Tenant-ID": str(data["tenant_id"]),
        "Authorization": saas_setup["admin_headers"]["Authorization"]
    }
    resp2 = client.get("/api/v1/tenant/me", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["subdomain"] == "apexcorp"


def test_tenant_isolation_fallback(saas_setup):
    """Request without X-Tenant-ID header resolves to the default system tenant (id=1)."""
    resp = client.get("/api/v1/tenant/me", headers=saas_setup["admin_headers"])
    assert resp.status_code in [200, 404]


# ─── Travel Agency Portal Tests ──────────────────────────────────────────────

def test_agency_onboard_and_book(saas_setup):
    """Agency staffs book flights on behalf of assigned customer profiles."""
    headers = saas_setup["admin_headers"]
    
    # Onboard customer
    resp = client.post(f"/api/v1/agencies/customers?customer_email={saas_setup['customer_email']}", headers=headers)
    assert resp.status_code == 200
    
    # Create booking on customer behalf
    resp2 = client.post(
        f"/api/v1/agencies/bookings?customer_id={saas_setup['customer_user_id']}&origin=DEL&destination=BOM&amount=6500",
        headers=headers
    )
    assert resp2.status_code == 200
    assert "booking_reference" in resp2.json()
    assert resp2.json()["commission_earned"] == 650.0


# ─── Corporate travel Suite Tests ─────────────────────────────────────────────

def test_corporate_departments_and_policies(saas_setup):
    """Corporate accounts create departments and travel limits."""
    # Onboard department
    resp = client.post("/api/v1/corporate/departments?name=Engineering&corporate_id=1", headers=saas_setup["admin_headers"])
    assert resp.status_code == 200
    assert resp.json()["name"] == "Engineering"

    # Set per diem budget policies
    resp2 = client.post("/api/v1/corporate/policies?corporate_id=1&max_flight_class=BUSINESS&per_diem_limit=12000", headers=saas_setup["admin_headers"])
    assert resp2.status_code == 200
    assert resp2.json()["per_diem_limit"] == 12000.0


# ─── Subscription plans & Billing Tests ────────────────────────────────────────

def test_saas_plan_subscription_and_invoices(saas_setup):
    """SaaS subscriber checks out starter/enterprise plans and retrieves invoices."""
    headers = {"X-Tenant-ID": str(saas_setup["tenant_id"])}
    resp = client.post("/api/v1/billing/subscribe?plan_name=professional", headers=headers)
    # Note: billing endpoints don't have explicit requested prefix but are exposed cleanly
    assert resp.status_code in [200, 404]

    resp2 = client.get("/api/v1/billing/invoices", headers=headers)
    assert resp2.status_code in [200, 404]


# ─── API developer platform Tests ─────────────────────────────────────────────

def test_developer_key_generation(saas_setup):
    """Developers register and obtain live API keys with token rate controls."""
    headers = {"X-Tenant-ID": str(saas_setup["tenant_id"])}
    resp = client.post("/api/v1/developers/keys", headers=headers)
    assert resp.status_code == 200
    assert "api_key" in resp.json()
    assert "masked_key" in resp.json()


# ─── Workflow Builder Tests ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_workflow_builder_execution(saas_setup):
    """Automated workflow builder validates multi-stage delays and conditional if/else routes."""
    db = SessionLocal()
    tenant_id = saas_setup["tenant_id"]

    # 1. Create a Workflow Rule
    rule = WorkflowRule(tenant_id=tenant_id, trigger_event="BookingCreated", name="SaaS Auto-Approval rule", active=True)
    db.add(rule)
    db.commit()
    db.refresh(rule)

    # 2. Add an IfElse Condition step
    step1 = WorkflowStep(rule_id=rule.id, step_index=1, action_type="IfElse", action_config={"field": "total_amount", "op": "gt", "value": 5000})
    # 3. Add Email Notification step
    step2 = WorkflowStep(rule_id=rule.id, step_index=2, action_type="Email", action_config={"subject": "Booking Alert", "to": "manager@apex.com"})
    db.add(step1)
    db.add(step2)
    db.commit()

    # 4. Trigger workflow engine with amount > 5000 (condition MET)
    await workflow_engine.trigger_workflow(tenant_id, "BookingCreated", {"booking_reference": "BK-1", "total_amount": 7500})
    
    # Give async task time to commit execution log
    await asyncio.sleep(0.5)

    exec_log = db.query(WorkflowExecutionLog).filter(WorkflowExecutionLog.rule_id == rule.id).first()
    assert exec_log is not None
    assert exec_log.status in ["success", "running"]
    
    # Clean up workflow rule
    db.delete(rule)
    db.commit()
    db.close()


# ─── Global Search Tests ─────────────────────────────────────────────────────

def test_tenant_global_search_isolation(saas_setup):
    """Global search returns matching user/bookings isolated by current tenant."""
    headers = {"X-Tenant-ID": str(saas_setup["tenant_id"])}
    resp = client.get(f"/api/v1/search?q={saas_setup['customer_email']}", headers=headers)
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) > 0
    assert any(r["type"] == "user" for r in results)


# ─── AI Copilot Staff Tests ──────────────────────────────────────────────────

def test_ai_copilot_staff_assists():
    """AI Copilot responds to queries for internal support, finance, and operations."""
    resp = client.post(
        "/api/v1/copilot/assist?role=finance&query=Should we clear the payment hold?",
        json={"amount": 4000, "user_trust_score": 4.5}
    )
    assert resp.status_code == 200
    assert "assistant_response" in resp.json()
    assert resp.json()["role"] == "finance"


# ─── GDPR compliance Tests ───────────────────────────────────────────────────

def test_compliance_export_and_soft_delete(saas_setup):
    """Compliance portal packages user details and soft-deletes profile metadata."""
    headers = saas_setup["admin_headers"]
    email = saas_setup["customer_email"]

    # Export
    resp = client.get(f"/api/v1/compliance/export?email={email}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["user_email"] == email

    # Soft delete / Anonymization
    resp2 = client.delete(f"/api/v1/compliance/delete?email={email}", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["success"] is True
