import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class WorkflowRule(Base):
    __tablename__ = "workflow_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    trigger_event: Mapped[str] = mapped_column(String(100), index=True, nullable=False)  # e.g., BookingCreated
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    steps = relationship("WorkflowStep", back_populates="rule", cascade="all, delete-orphan")
    executions = relationship("WorkflowExecutionLog", back_populates="rule", cascade="all, delete-orphan")


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    rule_id: Mapped[int] = mapped_column(Integer, ForeignKey("workflow_rules.id", ondelete="CASCADE"), nullable=False)
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)  # IfElse, Email, Webhook, Delay, Approve
    action_config: Mapped[dict] = mapped_column(JSON, default=dict)

    rule = relationship("WorkflowRule", back_populates="steps")


class WorkflowExecutionLog(Base):
    __tablename__ = "workflow_execution_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    rule_id: Mapped[int] = mapped_column(Integer, ForeignKey("workflow_rules.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="running")  # success, failed, running, paused
    logs_json: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    rule = relationship("WorkflowRule", back_populates="executions")
