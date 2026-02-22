"""
OpenRouter adapter — market tier.
Uses OpenAI-compatible chat completions API.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger("router.openrouter")


class OpenRouterAdapter:
    def __init__(self) -> None:
        self.base_url = settings.OPENROUTER_BASE_URL.rstrip("/")
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    def is_configured(self) -> bool:
        return bool(settings.OPENROUTER_API_KEY)

    async def generate(
        self,
        prompt: str,
        model: str = "meta-llama/llama-3.1-70b-instruct",
        context: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Call OpenRouter chat completions.
        Returns: { success, output, latency_ms, token_count, error }
        """
        if not self.is_configured():
            return {
                "success": False,
                "output": None,
                "latency_ms": 0,
                "token_count": 0,
                "error": "OPENROUTER_API_KEY not configured",
            }

        start = time.monotonic()

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if context:
            messages.append({"role": "user", "content": f"Context:\n{context}\n\nTask:\n{prompt}"})
        else:
            messages.append({"role": "user", "content": prompt})

        try:
            client = await self._get_client()
            r = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://maxsam.app",
                    "X-Title": "MaxSam Router",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.3,
                    "response_format": {"type": "json_object"},
                },
            )

            latency_ms = int((time.monotonic() - start) * 1000)

            if r.status_code != 200:
                return {
                    "success": False,
                    "output": None,
                    "latency_ms": latency_ms,
                    "token_count": 0,
                    "error": f"OpenRouter returned {r.status_code}: {r.text[:200]}",
                }

            data = r.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})
            token_count = usage.get("total_tokens", 0)

            try:
                parsed = json.loads(content)
                output = parsed
            except json.JSONDecodeError:
                output = content

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
                "error": "OpenRouter request timed out",
            }
        except Exception as e:
            latency_ms = int((time.monotonic() - start) * 1000)
            logger.error(f"OpenRouter error: {e}")
            return {
                "success": False,
                "output": None,
                "latency_ms": latency_ms,
                "token_count": 0,
                "error": str(e),
            }


openrouter = OpenRouterAdapter()
