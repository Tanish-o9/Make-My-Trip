import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class AgentExecutionLog(Base):
    __tablename__ = "agent_execution_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trace_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    agent_name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    input_data: Mapped[str] = mapped_column(Text, nullable=True) # Serialized input
    output_data: Mapped[str] = mapped_column(Text, nullable=True) # Serialized output
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    llm_provider_used: Mapped[str] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="success") # success, failure
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class ConversationSession(Base):
    __tablename__ = "conversation_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    messages_json: Mapped[dict] = mapped_column(JSON, default=list) # List of chat messages
    active_agent_context: Mapped[dict] = mapped_column(JSON, default=dict) # Active state of graph variables
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )


class UserPreferenceEmbedding(Base):
    __tablename__ = "user_preference_embeddings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    chromadb_collection: Mapped[str] = mapped_column(String(100), default="user_preferences")
    chromadb_doc_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False) # doc ID in Chroma
    preference_category: Mapped[str] = mapped_column(String(50), nullable=False) # dietary, airline, price_sensitivity
    summary_text: Mapped[str] = mapped_column(Text, nullable=False) # Clear human-readable summary of embedded text
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )


class LLMRouterDecisionLog(Base):
    __tablename__ = "llm_router_decision_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trace_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    request_type: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # simple, reasoning, agentic
    chosen_provider: Mapped[str] = mapped_column(String(50), nullable=False) # openai, ollama, etc.
    cost_ceiling: Mapped[float] = mapped_column(String(50), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=True)
    reason: Mapped[str] = mapped_column(String(255), nullable=True)
    fallback_used: Mapped[bool] = mapped_column(Boolean, default=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)


class DestinationCostBaseline(Base):
    __tablename__ = "destination_cost_baselines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    destination: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    daily_food_cost: Mapped[float] = mapped_column(Integer, default=1500)
    daily_transport_cost: Mapped[float] = mapped_column(Integer, default=800)
    daily_activities_cost: Mapped[float] = mapped_column(Integer, default=1200)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

