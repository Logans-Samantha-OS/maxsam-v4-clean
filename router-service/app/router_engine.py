"""
Core routing engine.
Reads policy from DB, computes routing decision, executes with fallback chain,
logs everything.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.adapters.claude import claude
from app.adapters.ollama import ollama
from app.adapters.openrouter import openrouter
from app.schemas import (
    Governance,
    RouterDecision,
    RouterResult,
    RoutingPolicy,
    RunRequest,
    Sensitivity,
    Tier,
)
from app.supabase_logger import db

logger = logging.getLogger("router.engine")

# Cost estimates per 1K tokens (rough)
COST_PER_1K: dict[str, float] = {
    "local": 0.0,
    "market": 0.0008,
    "premium": 0.003,
}

SYSTEM_PROMPT = (
    "You are a MaxSam AI worker. Respond ONLY with valid JSON. "
    "No markdown, no explanation, no preamble. Just a JSON object."
)


def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return max(1, len(text) // 4)


def estimate_cost(tier: str, token_count: int) -> float:
    rate = COST_PER_1K.get(tier, 0.0)
    return round(rate * (token_count / 1000), 6)


# ── Routing Decision ──

def compute_decision(
    request: RunRequest,
    policy: RoutingPolicy,
    governance: Governance,
) -> RouterDecision:
    """
    Pure function: given request + policy + governance → RouterDecision.
    All decisions must be explainable.
    """
    prompt_tokens = estimate_tokens(request.prompt)
    context_tokens = estimate_tokens(request.context or "")
    total_tokens = prompt_tokens + context_tokens
    reasons: list[str] = []

    # Rule 1: premium only if sensitivity = high
    if request.sensitivity == Sensitivity.HIGH:
        if policy.premium_trigger == "sensitivity_high_only":
            model = policy.models.get("premium", "claude-sonnet-4-20250514")
            reasons.append("Sensitivity=high triggers premium tier per policy")
            return RouterDecision(
                route=Tier.PREMIUM,
                model=model,
                reason="; ".join(reasons),
                confidence=0.95,
                escalation_level=2,
                cost_estimate=estimate_cost("premium", total_tokens * 2),
            )

    # Rule 2: context overflow → escalate
    if total_tokens > policy.context_threshold_tokens:
        if policy.escalation_rules.context_overflow_escalate:
            model = policy.models.get("market", "meta-llama/llama-3.1-70b-instruct")
            reasons.append(
                f"Context size ({total_tokens} tokens) exceeds threshold "
                f"({policy.context_threshold_tokens}), escalating to market tier"
            )
            return RouterDecision(
                route=Tier.MARKET,
                model=model,
                reason="; ".join(reasons),
                confidence=0.85,
                escalation_level=1,
                cost_estimate=estimate_cost("market", total_tokens * 2),
            )

    # Rule 3: default to local
    model = policy.models.get("local", "llama3.1:8b")
    reasons.append(
        f"Default routing to local tier ({int(policy.local_ratio * 100)}% local policy)"
    )
    return RouterDecision(
        route=Tier.LOCAL,
        model=model,
        reason="; ".join(reasons),
        confidence=0.90,
        escalation_level=0,
        cost_estimate=0.0,
    )


# ── Execution with fallback ──

async def execute_on_tier(
    tier: Tier,
    model: str,
    prompt: str,
    context: Optional[str] = None,
) -> dict[str, Any]:
    """Execute prompt on the given tier. Returns adapter result dict."""
    if tier == Tier.LOCAL:
        return await ollama.generate(prompt, model=model, context=context, system_prompt=SYSTEM_PROMPT)
    elif tier == Tier.MARKET:
        return await openrouter.generate(prompt, model=model, context=context, system_prompt=SYSTEM_PROMPT)
    elif tier == Tier.PREMIUM:
        return await claude.generate(prompt, model=model, context=context, system_prompt=SYSTEM_PROMPT)
    else:
        return {"success": False, "output": None, "latency_ms": 0, "token_count": 0, "error": f"Unknown tier: {tier}"}


def _is_valid_json_output(output: Any) -> bool:
    """Check if the output is valid JSON (dict or list)."""
    if isinstance(output, (dict, list)):
        return True
    if isinstance(output, str):
        try:
            json.loads(output)
            return True
        except (json.JSONDecodeError, TypeError):
            return False
    return False


async def run_with_fallback(
    request: RunRequest,
    policy: RoutingPolicy,
    governance: Governance,
    decision: RouterDecision,
    task_id: str,
    decision_id: Optional[str],
) -> RouterResult:
    """
    Execute with the fallback chain: local → market → premium.
    Escalates if local fails twice or returns invalid JSON.
    """
    chain = list(policy.fallback_chain)
    # Start from the decided tier
    start_idx = 0
    for i, t in enumerate(chain):
        if t == decision.route:
            start_idx = i
            break

    local_fail_count = 0
    last_error: Optional[str] = None
    total_latency = 0

    for tier_idx in range(start_idx, len(chain)):
        tier = chain[tier_idx]
        model = policy.models.get(tier.value, decision.model)
        escalation = tier_idx - start_idx

        # Attempt up to max_local_retries for local tier
        max_attempts = policy.max_local_retries if tier == Tier.LOCAL else 1

        for attempt in range(max_attempts):
            logger.info(f"Executing on {tier.value}/{model} (attempt {attempt + 1})")

            result = await execute_on_tier(tier, model, request.prompt, request.context)
            total_latency += result["latency_ms"]

            # Log event
            await db.log_event(
                task_id=task_id,
                decision_id=decision_id,
                event_type="execution",
                tier=tier.value,
                model=model,
                success=result["success"],
                latency_ms=result["latency_ms"],
                token_count=result.get("token_count", 0),
                error_message=result.get("error"),
                response_preview=str(result.get("output", ""))[:500] if result.get("output") else None,
            )

            if result["success"]:
                # Check JSON validity
                if not _is_valid_json_output(result["output"]):
                    if policy.escalation_rules.invalid_json_escalate:
                        logger.warning(f"{tier.value} returned non-JSON output, escalating")
                        await db.log_event(
                            task_id=task_id,
                            decision_id=decision_id,
                            event_type="invalid_json_escalation",
                            tier=tier.value,
                            model=model,
                            success=False,
                            latency_ms=0,
                            error_message="Output is not valid JSON",
                        )
                        last_error = "Invalid JSON output"
                        break  # Escalate to next tier
                    # If not escalating on invalid JSON, return as-is
                    pass

                # Success
                final_decision = RouterDecision(
                    route=tier,
                    model=model,
                    reason=decision.reason + (f"; escalated {escalation}x" if escalation > 0 else ""),
                    confidence=max(0.5, decision.confidence - (escalation * 0.15)),
                    escalation_level=escalation,
                    cost_estimate=estimate_cost(tier.value, result.get("token_count", 0)),
                )

                await db.update_task_status(task_id, "completed")

                return RouterResult(
                    task_id=task_id,
                    decision=final_decision,
                    output=result["output"],
                    success=True,
                    tier_used=tier,
                    model_used=model,
                    latency_ms=total_latency,
                )

            # Failed
            last_error = result.get("error", "Unknown error")
            if tier == Tier.LOCAL:
                local_fail_count += 1
                logger.warning(f"Local attempt {attempt + 1} failed: {last_error}")

        # Check if we should escalate after local failures
        if tier == Tier.LOCAL and local_fail_count >= policy.escalation_rules.local_fail_count:
            logger.warning(f"Local failed {local_fail_count} times, escalating")
            await db.log_event(
                task_id=task_id,
                decision_id=decision_id,
                event_type="escalation",
                tier=tier.value,
                model=model,
                success=False,
                error_message=f"Local failed {local_fail_count} times",
            )

    # All tiers exhausted
    await db.update_task_status(task_id, "failed")

    return RouterResult(
        task_id=task_id,
        decision=decision,
        output=None,
        success=False,
        tier_used=decision.route,
        model_used=decision.model,
        latency_ms=total_latency,
        error=f"All tiers exhausted. Last error: {last_error}",
    )


# ── Main entry point ──

async def handle_run(request: RunRequest) -> RouterResult:
    """
    Full /run pipeline:
    1. Read policy + governance from DB
    2. Log task
    3. Compute routing decision
    4. Log decision
    5. Execute with fallback chain
    6. Log result
    7. Return structured JSON
    """
    # Step 1: read from DB (source of truth)
    policy = await db.get_routing_policy()
    governance = await db.get_governance()

    # Step 2: log incoming task
    task_id = await db.log_task(
        task_type=request.task_type,
        payload={
            "prompt": request.prompt[:500],
            "context_length": len(request.context or ""),
            "sensitivity": request.sensitivity.value,
            "source": request.source,
            "metadata": request.metadata,
        },
        source=request.source,
        sensitivity=request.sensitivity,
    )

    if not task_id:
        # DB logging failed — generate a local ID and continue
        import uuid
        task_id = str(uuid.uuid4())
        logger.error("Failed to log task to DB, using local UUID")

    # Step 3: compute routing decision
    await db.update_task_status(task_id, "routing")
    decision = compute_decision(request, policy, governance)

    # Step 4: log decision
    decision_id = await db.log_decision(
        task_id=task_id,
        decision=decision,
        policy_snapshot=policy.model_dump(),
        governance_level=governance.level,
    )

    # Step 5: execute with fallback
    await db.update_task_status(task_id, "executing")
    result = await run_with_fallback(
        request=request,
        policy=policy,
        governance=governance,
        decision=decision,
        task_id=task_id,
        decision_id=decision_id,
    )

    # Step 6: log final result
    await db.log_event(
        task_id=task_id,
        decision_id=decision_id,
        event_type="final_result",
        tier=result.tier_used.value,
        model=result.model_used,
        success=result.success,
        latency_ms=result.latency_ms,
        error_message=result.error,
        response_preview=str(result.output)[:500] if result.output else None,
    )

    return result
