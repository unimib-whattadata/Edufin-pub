from __future__ import annotations

import time
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx

from .base import AdapterResult


class GeminiDirectAdapter:
    name = "gemini-direct"

    def __init__(
        self,
        endpoint_url: str,
        *,
        temperature: float = 0.0,
        max_output_tokens: int = 512,
        timeout_seconds: float = 240.0,
    ) -> None:
        if not endpoint_url:
            raise ValueError("GEMINI_ENDPOINT_URL non configurato")
        self.endpoint_url = endpoint_url
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens
        self.timeout_seconds = timeout_seconds

    def generate(
        self,
        *,
        prompt: str,
        task_id: str,
        tier: str,
        run_id: str,
    ) -> AdapterResult:
        del task_id, tier, run_id
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": self.temperature,
                "maxOutputTokens": self.max_output_tokens,
            },
        }
        started = time.perf_counter()
        response = httpx.post(
            self.endpoint_url,
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=self.timeout_seconds,
        )
        latency_ms = (time.perf_counter() - started) * 1000
        response.raise_for_status()
        payload = response.json()
        candidates = payload.get("candidates") or []
        if not candidates:
            raise RuntimeError(f"Gemini non ha restituito candidati: {payload}")
        parts = candidates[0].get("content", {}).get("parts") or []
        prediction = "".join(str(part.get("text") or "") for part in parts)
        if not prediction:
            raise RuntimeError("Gemini ha restituito una risposta vuota")

        metadata: dict[str, Any] = {
            "finish_reason": candidates[0].get("finishReason"),
            "usage": payload.get("usageMetadata") or {},
        }
        return AdapterResult(
            prediction=prediction,
            latency_ms=latency_ms,
            metadata=metadata,
        )

    def public_config(self) -> dict[str, Any]:
        parsed = urlsplit(self.endpoint_url)
        safe_endpoint = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
        return {
            "adapter": self.name,
            "endpoint": safe_endpoint,
            "temperature": self.temperature,
            "max_output_tokens": self.max_output_tokens,
            "timeout_seconds": self.timeout_seconds,
        }
