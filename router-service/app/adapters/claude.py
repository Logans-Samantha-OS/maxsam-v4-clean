"""
Claude / Anthropic adapter — premium tier.
Direct Anthropic Messages API.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger("router.claude")

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


class ClaudeAdapter:
    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=120.0)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    def is_configured(self) -> bool:
        return bool(settings.ANTHROPIC_API_KEY)

    async def generate(
        self,
        prompt: str,
        model: str = "claude-sonnet-4-20250514",
        context: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Call Anthropic Messages API.
        Returns: { success, output, latency_ms, token_count, error }
        """
        if not self.is_configured():
            return {
                "success": False,
                "output": None,
                "latency_ms": 0,
                "token_count": 0,
                "error": "ANTHROPIC_API_KEY not configured",
            }

        start = time.monotonic()

        user_content = prompt
        if context:
            user_content = f"Context:\n{context}\n\nTask:\n{prompt}"

        try:
            client = await self._get_client()
            payload: dict[str, Any] = {
                "model": model,
                "max_tokens": 4096,
                "messages": [{"role": "user", "content": user_content}],
                "temperature": 0.3,
            }
            if system_prompt:
                payload["system"] = system_prompt

            r = await client.post(
                ANTHROPIC_API_URL,
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": ANTHROPIC_VERSION,
                    "Content-Type": "application/json",
                },
                json=payload,
            )

            latency_ms = int((time.monotonic() - start) * 1000)

            if r.status_code != 200:
                return {
                    "success": False,
                    "output": None,
                    "latency_ms": latency_ms,
                    "token_count": 0,
                    "error": f"Claude returned {r.status_code}: {r.text[:200]}",
                }

            data = r.json()
            content_blocks = data.get("content", [])
            text = "".join(
                block.get("text", "") for block in content_blocks if block.get("type") == "text"
            )
            usage = data.get("usage", {})
            token_count = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)

            try:
                parsed = json.loads(text)
                output = parsed
            except json.JSONDecodeError:
                output = text

            return {
                "success": True,
                "output": output,
                "latency_ms": latency_ms,
                "token_count": token_count,
                "error": None,
            }

        except httpx.TimeoutException:
            latency_ms = int((time.monotonic() - start) * 1000)
            return {
                "success": False,
                "output": None,
                "latency_ms": latency_ms,
                "token_count": 0,
                "error": "Claude request timed out",
            }
        except Exception as e:
            latency_ms = int((time.monotonic() - start) * 1000)
            logger.error(f"Claude error: {e}")
            return {
                "success": False,
                "output": None,
                "latency_ms": latency_ms,
                "token_count": 0,
                "error": str(e),
            }


claude = ClaudeAdapter()
