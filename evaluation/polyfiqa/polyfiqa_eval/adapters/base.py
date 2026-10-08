from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class AdapterResult:
    prediction: str
    latency_ms: float
    metadata: dict[str, Any] = field(default_factory=dict)


class Adapter(Protocol):
    name: str

    def generate(
        self,
        *,
        prompt: str,
        task_id: str,
        tier: str,
        run_id: str,
    ) -> AdapterResult: ...

    def public_config(self) -> dict[str, Any]: ...
