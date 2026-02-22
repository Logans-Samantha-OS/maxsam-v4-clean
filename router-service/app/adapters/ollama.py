"""
Ollama adapter — local tier.
Calls Ollama REST API at configurable base URL.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger("router.ollama")


class OllamaAdapter:
    def __init__(self) -> None:
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=120.0)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def is_reachable(self) -> bool:
        try:
            client = await self._get_client()
            r = await client.get(f"{self.base_url}/api/tags", timeout=5.0)
            return r.status_code == 200
        except Exception:
            return False

    async def generate(
        self,
        prompt: str,
        model: str = "llama3.1:8b",
        context: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Call Ollama /api/generate.
        Returns: { success, output, latency_ms, token_count, error }
        """
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
                f"{self.base_url}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.3},
                },
            )

            latency_ms = int((time.monotonic() - start) * 1000)

            if r.status_code != 200:
                return {
                    "success": False,
                    "output": None,
                    "latency_ms": latency_ms,
                    "token_count": 0,
                    "error": f"Ollama returned {r.status_code}: {r.text[:200]}",
                }

            data = r.json()
            content = data.get("message", {}).get("content", "")
            token_count = data.get("eval_count", 0) + data.get("prompt_eval_count", 0)

            # Validate JSON output
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
                "error": "Ollama request timed out",
            }
        except Exception as e:
            latency_ms = int((time.monotonic() - start) * 1000)
            logger.error(f"Ollama error: {e}")
            return {
                "success": False,
                "output": None,
                "latency_ms": latency_ms,
                "token_count": 0,
                "error": str(e),
            }


ollama = OllamaAdapter()
