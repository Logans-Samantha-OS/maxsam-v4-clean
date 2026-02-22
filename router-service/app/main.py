"""
MaxSam Router Service — FastAPI Application

Endpoints:
  GET  /health   — Service health check
  POST /route    — Compute routing decision only (no execution)
  POST /execute  — Direct execution on a specific tier
  POST /run      — Full pipeline: route → execute → log → return

All model access goes through this service.
No direct calls from n8n to OpenAI or Claude are allowed.
"""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.claude import claude
from app.adapters.ollama import ollama
from app.adapters.openrouter import openrouter
from app.config import settings
from app.router_engine import (
    compute_decision,
    execute_on_tier,
    handle_run,
)
from app.schemas import (
    ExecuteRequest,
    HealthResponse,
    RouteRequest,
    RouterResult,
    RunRequest,
    Sensitivity,
    Tier,
)
from app.supabase_logger import db

# ── Logging ──
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("router.main")


# ── Lifespan ──
@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logger.info("Router service starting...")
    yield
    logger.info("Router service shutting down...")
    await db.close()
    await ollama.close()
    await openrouter.close()
    await claude.close()


# ── App ──
app = FastAPI(
    title="MaxSam Router Service",
    version="1.0.0",
    description="Database-first model routing with full audit logging",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════
# GET /health
# ══════════════════════════════════════════
@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    supabase_ok = await db.is_connected()
    ollama_ok = await ollama.is_reachable()
    return HealthResponse(
        supabase_connected=supabase_ok,
        ollama_reachable=ollama_ok,
    )


# ══════════════════════════════════════════
# POST /route — routing decision only
# ══════════════════════════════════════════
@app.post("/route")
async def route(request: RouteRequest) -> dict:
    """Compute routing decision without executing. Returns the decision only."""
    policy = await db.get_routing_policy()
    governance = await db.get_governance()

    # Build a minimal RunRequest for the decision engine
    run_req = RunRequest(
        task_type=request.task_type,
        prompt=request.prompt,
        context=request.context,
        sensitivity=request.sensitivity,
    )

    decision = compute_decision(run_req, policy, governance)

    return {
        "decision": decision.model_dump(),
        "policy_used": policy.model_dump(),
        "governance": governance.model_dump(),
    }


# ══════════════════════════════════════════
# POST /execute — direct execution on a tier
# ══════════════════════════════════════════
@app.post("/execute")
async def execute(request: ExecuteRequest) -> dict:
    """Execute directly on a specific tier. Bypasses routing logic."""
    model = request.model
    if not model:
        policy = await db.get_routing_policy()
        model = policy.models.get(request.tier.value, "llama3.1:8b")

    # Log as a task
    task_id = await db.log_task(
        task_type="direct_execute",
        payload={
            "tier": request.tier.value,
            "model": model,
            "prompt": request.prompt[:500],
        },
        source="api",
        sensitivity=Sensitivity.NORMAL,
    )
    if not task_id:
        task_id = str(uuid.uuid4())

    result = await execute_on_tier(
        tier=request.tier,
        model=model,
        prompt=request.prompt,
        context=request.context,
    )

    # Log event
    await db.log_event(
        task_id=task_id,
        decision_id=None,
        event_type="direct_execution",
        tier=request.tier.value,
        model=model,
        success=result["success"],
        latency_ms=result["latency_ms"],
        token_count=result.get("token_count", 0),
        error_message=result.get("error"),
        response_preview=str(result.get("output", ""))[:500] if result.get("output") else None,
    )

    status = "completed" if result["success"] else "failed"
    await db.update_task_status(task_id, status)

    return {
        "task_id": task_id,
        "tier": request.tier.value,
        "model": model,
        "success": result["success"],
        "output": result["output"],
        "latency_ms": result["latency_ms"],
        "token_count": result.get("token_count", 0),
        "error": result.get("error"),
    }


# ══════════════════════════════════════════
# POST /run — full pipeline (n8n calls this)
# ══════════════════════════════════════════
@app.post("/run", response_model=RouterResult)
async def run(request: RunRequest) -> RouterResult:
    """
    Full pipeline:
    1. Read routing policy from system_registry
    2. Read governance level from system_registry
    3. Log incoming request to router_tasks
    4. Compute routing decision
    5. Insert into router_decisions
    6. Execute model call (local → market → premium fallback)
    7. Log execution result to router_events
    8. Return structured JSON only
    """
    try:
        result = await handle_run(request)
        return result
    except Exception as e:
        logger.error(f"/run failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════
# Entrypoint
# ══════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=False)
