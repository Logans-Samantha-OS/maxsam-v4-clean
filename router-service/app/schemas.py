"""
Strict Pydantic schemas for request/response validation.
Every router decision must be explainable.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Enums ──

class Tier(str, Enum):
    LOCAL = "local"
    MARKET = "market"
    PREMIUM = "premium"


class Sensitivity(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class TaskStatus(str, Enum):
    RECEIVED = "received"
    ROUTING = "routing"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


# ── Inbound request ──

class RunRequest(BaseModel):
    """POST /run — inbound from n8n or any caller."""
    task_type: str = Field(..., min_length=1, description="Type of task: generate, classify, summarize, extract, etc.")
    prompt: str = Field(..., min_length=1)
    context: Optional[str] = Field(default=None)
    sensitivity: Sensitivity = Field(default=Sensitivity.NORMAL)
    source: str = Field(default="n8n")
    metadata: dict[str, Any] = Field(default_factory=dict)


class RouteRequest(BaseModel):
    """POST /route — routing decision only, no execution."""
    task_type: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    context: Optional[str] = Field(default=None)
    sensitivity: Sensitivity = Field(default=Sensitivity.NORMAL)


class ExecuteRequest(BaseModel):
    """POST /execute — direct execution on a specific tier."""
    tier: Tier
    model: Optional[str] = None
    prompt: str = Field(..., min_length=1)
    context: Optional[str] = Field(default=None)


# ── Router decision (strict schema — stored in router_decisions) ──

class RouterDecision(BaseModel):
    """Every decision row must contain these fields. No exceptions."""
    route: Tier
    model: str
    reason: str = Field(..., min_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)
    escalation_level: int = Field(default=0, ge=0, le=3)
    cost_estimate: float = Field(default=0.0, ge=0.0)


# ── Execution result ──

class RouterResult(BaseModel):
    """Structured JSON returned to caller."""
    task_id: str
    decision: RouterDecision
    output: Any
    success: bool
    tier_used: Tier
    model_used: str
    latency_ms: int
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ── Policy & governance (read from system_registry) ──

class EscalationRules(BaseModel):
    local_fail_count: int = 2
    invalid_json_escalate: bool = True
    context_overflow_escalate: bool = True


class RoutingPolicy(BaseModel):
    default_tier: Tier = Tier.LOCAL
    local_ratio: float = 0.80
    max_local_retries: int = 2
    context_threshold_tokens: int = 4000
    escalation_rules: EscalationRules = Field(default_factory=EscalationRules)
    premium_trigger: str = "sensitivity_high_only"
    fallback_chain: list[Tier] = Field(default_factory=lambda: [Tier.LOCAL, Tier.MARKET, Tier.PREMIUM])
    models: dict[str, str] = Field(default_factory=lambda: {
        "local": "llama3.1:8b",
        "market": "meta-llama/llama-3.1-70b-instruct",
        "premium": "claude-sonnet-4-20250514",
    })


class Governance(BaseModel):
    level: str = "standard"
    require_audit: bool = True
    require_explanation: bool = True
    max_cost_per_request: float = 0.50
    premium_approval_required: bool = False


# ── Health ──

class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "router-service"
    supabase_connected: bool
    ollama_reachable: bool
    version: str = "1.0.0"
