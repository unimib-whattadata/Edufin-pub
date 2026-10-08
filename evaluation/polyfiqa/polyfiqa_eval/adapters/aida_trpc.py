from __future__ import annotations

import hashlib
import json
import time
import uuid
from typing import Any

import httpx

from .base import AdapterResult


def unwrap_trpc_response(payload: Any) -> Any:
    """Extract SuperJSON data from single-call or one-element batch tRPC responses."""
    if isinstance(payload, list):
        if len(payload) != 1:
            raise ValueError(f"Risposta batch tRPC inattesa: {len(payload)} elementi")
        payload = payload[0]
    if not isinstance(payload, dict):
        raise TypeError("Risposta tRPC non valida")
    if "error" in payload:
        error = payload["error"]
        raise RuntimeError(f"Errore tRPC: {json.dumps(error, ensure_ascii=False)}")

    value = payload
    for key in ("result", "data", "json"):
        if isinstance(value, dict) and key in value:
            value = value[key]
    return value


class AidaTrpcAdapter:
    name = "aida-trpc"

    def __init__(
        self,
        base_url: str,
        *,
        headers: dict[str, str] | None = None,
        timeout_seconds: float = 240.0,
    ) -> None:
        if not base_url:
            raise ValueError("AIDA_BASE_URL non configurato")
        self.base_url = base_url.rstrip("/")
        self.headers = headers or {}
        self.timeout_seconds = timeout_seconds

    def _procedure_url(self, procedure: str) -> str:
        return f"{self.base_url}/api/trpc/{procedure}"

    def _query(self, procedure: str, value: dict[str, Any]) -> Any:
        response = httpx.get(
            self._procedure_url(procedure),
            params={"input": json.dumps({"json": value}, ensure_ascii=False)},
            headers=self.headers,
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        return unwrap_trpc_response(response.json())

    def _mutation(self, procedure: str, value: dict[str, Any]) -> Any:
        response = httpx.post(
            self._procedure_url(procedure),
            json={"json": value},
            headers=self.headers,
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        return unwrap_trpc_response(response.json())

    @staticmethod
    def _latest_bot_message(chat: dict[str, Any]) -> dict[str, Any]:
        messages = chat.get("messages") or []
        bot_messages = [
            message for message in messages if message.get("sender") == "bot"
        ]
        if len(bot_messages) < 2:
            raise RuntimeError("AIDA non ha restituito un nuovo messaggio bot")
        return max(
            bot_messages,
            key=lambda message: (
                message.get("time") or "",
                message.get("messageId") or 0,
            ),
        )

    def generate(
        self,
        *,
        prompt: str,
        task_id: str,
        tier: str,
        run_id: str,
    ) -> AdapterResult:
        suffix = uuid.uuid4().hex[:10]
        anon_id = f"polyfiqa-{run_id}-{tier}-{task_id}-{suffix}"

        setup_started = time.perf_counter()
        chat = self._query(
            "chat.getOrCreateChat",
            {"anonymId": anon_id, "newChat": True},
        )
        setup_ms = (time.perf_counter() - setup_started) * 1000
        if not isinstance(chat, dict) or not chat.get("chatId"):
            raise RuntimeError("Creazione della chat AIDA non riuscita")

        generation_started = time.perf_counter()
        mutation_result = self._mutation(
            "chat.sendMessage",
            {"text": prompt, "anonId": anon_id},
        )
        generation_ms = (time.perf_counter() - generation_started) * 1000

        fetch_started = time.perf_counter()
        completed_chat = self._query(
            "chat.getOrCreateChat",
            {"anonymId": anon_id, "newChat": False},
        )
        fetch_ms = (time.perf_counter() - fetch_started) * 1000
        if not isinstance(completed_chat, dict):
            raise TypeError("Impossibile rileggere la chat AIDA")
        bot_message = self._latest_bot_message(completed_chat)

        metadata: dict[str, Any] = {
            "chat_id": completed_chat.get("chatId"),
            "message_id": bot_message.get("messageId"),
            "setup_latency_ms": round(setup_ms, 3),
            "generation_latency_ms": round(generation_ms, 3),
            "fetch_latency_ms": round(fetch_ms, 3),
        }
        if isinstance(mutation_result, dict):
            knowledge_context = str(mutation_result.get("knowledgeContext") or "")
            metadata["knowledge_context_chars"] = len(knowledge_context)
            metadata["knowledge_context_sha256"] = hashlib.sha256(
                knowledge_context.encode("utf-8")
            ).hexdigest()

        return AdapterResult(
            prediction=str(bot_message.get("text") or ""),
            latency_ms=setup_ms + generation_ms + fetch_ms,
            metadata=metadata,
        )

    def public_config(self) -> dict[str, Any]:
        return {
            "adapter": self.name,
            "base_url": self.base_url,
            "timeout_seconds": self.timeout_seconds,
            "header_names": sorted(self.headers),
            "fresh_chat_per_example": True,
        }
