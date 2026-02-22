"""
Supabase logging module.
All reads/writes go through here. Database is the source of truth.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.config import settings
from app.schemas import (
    Governance,
    RouterDecision,
    RoutingPolicy,
    Sensitivity,
)

logger = logging.getLogger("router.supabase")

# ── Fallback policies (only used if DB read fails) ──

_FALLBACK_POLICY = RoutingPolicy()
_FALLBACK_GOVERNANCE = Governance()


class SupabaseClient:
    """Thin REST client for Supabase PostgREST API."""

    def __init__(self) -> None:
        self.base_url = settings.SUPABASE_URL.rstrip("/")
        self.headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ── Health check ──

    async def is_connected(self) -> bool:
        try:
            client = await self._get_client()
            r = await client.get(
                f"{self.base_url}/rest/v1/system_registry?key=eq.governance&select=key",
                headers=self.headers,
            )
            return r.status_code == 200
        except Exception:
            return False

    # ── Read routing policy from system_registry ──

    async def get_routing_policy(self) -> RoutingPolicy:
        try:
            client = await self._get_client()
            r = await client.get(
                f"{self.base_url}/rest/v1/system_registry?key=eq.router_policy&select=value",
                headers=self.headers,
            )
            if r.status_code == 200:
                rows = r.json()
                if rows and len(rows) > 0:
                    return RoutingPolicy(**rows[0]["value"])
            logger.warning("router_policy not found in system_registry, using fallback")
        except Exception as e:
            logger.error(f"Failed to read router_policy: {e}")
        return _FALLBACK_POLICY

    # ── Read governance level from system_registry ──

    async def get_governance(self) -> Governance:
        try:
            client = await self._get_client()
            r = await client.get(
                f"{self.base_url}/rest/v1/system_registry?key=eq.governance&select=value",
                headers=self.headers,
            )
            if r.status_code == 200:
                rows = r.json()
                if rows and len(rows) > 0:
                    return Governance(**rows[0]["value"])
            logger.warning("governance not found in system_registry, using fallback")
        except Exception as e:
            logger.error(f"Failed to read governance: {e}")
        return _FALLBACK_GOVERNANCE

    # ── Log task ──

    async def log_task(
        self,
        task_type: str,
        payload: dict[str, Any],
        source: str = "n8n",
        sensitivity: Sensitivity = Sensitivity.NORMAL,
    ) -> Optional[str]:
        """Insert into router_tasks. Returns task_id or None."""
        try:
            client = await self._get_client()
            r = await client.post(
                f"{self.base_url}/rest/v1/router_tasks",
                headers=self.headers,
                json={
                    "task_type": task_type,
                    "payload": payload,
                    "source": source,
                    "sensitivity": sensitivity.value,
                    "status": "received",
                },
            )
            if r.status_code in (200, 201):
                rows = r.json()
                if rows and len(rows) > 0:
                    return rows[0]["id"]
            logger.error(f"log_task failed: {r.status_code} {r.text}")
        except Exception as e:
            logger.error(f"log_task error: {e}")
        return None

    # ── Update task status ──

    async def update_task_status(self, task_id: str, status: str) -> None:
        try:
            client = await self._get_client()
            await client.patch(
                f"{self.base_url}/rest/v1/router_tasks?id=eq.{task_id}",
                headers=self.headers,
                json={"status": status},
            )
        except Exception as e:
            logger.error(f"update_task_status error: {e}")

    # ── Log routing decision ──

    async def log_decision(
        self,
        task_id: str,
        decision: RouterDecision,
        policy_snapshot: dict[str, Any],
        governance_level: str,
    ) -> Optional[str]:
        """Insert into router_decisions. Returns decision_id or None."""
        try:
            client = await self._get_client()
            r = await client.post(
                f"{self.base_url}/rest/v1/router_decisions",
                headers=self.headers,
                json={
                    "task_id": task_id,
                    "route": decision.route.value,
                    "model": decision.model,
                    "reason": decision.reason,
                    "confidence": float(decision.confidence),
                    "escalation_level": decision.escalation_level,
                    "cost_estimate": float(decision.cost_estimate),
                    "policy_snapshot": policy_snapshot,
                    "governance_level": governance_level,
                },
            )
            if r.status_code in (200, 201):
                rows = r.json()
                if rows and len(rows) > 0:
                    return rows[0]["id"]
            logger.error(f"log_decision failed: {r.status_code} {r.text}")
        except Exception as e:
            logger.error(f"log_decision error: {e}")
        return None

    # ── Log execution event ──

    async def log_event(
        self,
        task_id: str,
        decision_id: Optional[str],
        event_type: str,
        tier: str,
        model: str,
        success: bool,
        latency_ms: int = 0,
        token_count: int = 0,
        error_message: Optional[str] = None,
        response_preview: Optional[str] = None,
    ) -> None:
        try:
            client = await self._get_client()
            await client.post(
                f"{self.base_url}/rest/v1/router_events",
                headers=self.headers,
                json={
                    "task_id": task_id,
                    "decision_id": decision_id,
                    "event_type": event_type,
                    "tier": tier,
                    "model": model,
                    "success": success,
                    "latency_ms": latency_ms,
                    "token_count": token_count,
                    "error_message": error_message,
                    "response_preview": (response_preview or "")[:500],
                },
            )
        except Exception as e:
            logger.error(f"log_event error: {e}")


# Singleton
db = SupabaseClient()
