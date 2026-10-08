from __future__ import annotations

import csv
import json
import os
import platform
import random
import re
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .adapters.base import Adapter
from .io import append_jsonl, load_subset, read_jsonl, text_sha256, write_json_atomic
from .specs import FINDER

CONTEXT_MODES = ("gold", "none")
PROMPT_VERSIONS = {
    "gold": "finder-gold-context-v1",
    "none": "finder-question-only-v1",
}
DATASET_NAMES = {
    "gold": "FinDER-Gold-570",
    "none": "FinDER-NoContext-570",
}

CSV_FIELDS = (
    "run_id",
    "dataset",
    "context_mode",
    "_id",
    "category",
    "normalized_type",
    "quantitative",
    "question",
    "aida_answer",
    "gold_answer",
    "gold_context",
    "references_count",
    "prompt_contexts_count",
    "status",
    "error",
    "latency_ms",
    "attempt",
    "dataset_revision",
    "prompt_version",
    "prompt_sha256",
    "started_at",
    "completed_at",
)


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def build_gold_prompt(record: dict[str, Any]) -> str:
    evidence = "\n\n".join(
        f"[Evidence {index}]\n{reference.strip()}"
        for index, reference in enumerate(record["references"], start=1)
    )
    return f"Context:\n{evidence}\n\nQuestion:\n{str(record['text']).strip()}"


def build_question_only_prompt(record: dict[str, Any]) -> str:
    return str(record["text"]).strip()


def build_prompt(record: dict[str, Any], context_mode: str) -> str:
    if context_mode == "gold":
        return build_gold_prompt(record)
    if context_mode == "none":
        return build_question_only_prompt(record)
    raise ValueError(f"context_mode non valido: {context_mode}")


def export_run_csv(run_path: Path, csv_path: Path) -> dict[str, Any]:
    latest: dict[str, dict[str, Any]] = {}
    if not run_path.exists():
        raise FileNotFoundError(f"Run mancante: {run_path}")
    for row in read_jsonl(run_path):
        latest[str(row["_id"])] = row

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = csv_path.with_suffix(csv_path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for record_id in sorted(latest):
            row = dict(latest[record_id])
            row["aida_answer"] = row.get("prediction", "")
            row["gold_answer"] = row.get("reference", "")
            row["gold_context"] = "\n\n".join(row.get("gold_contexts") or [])
            writer.writerow(row)
    os.replace(temporary, csv_path)
    return {
        "records": len(latest),
        "successful_records": sum(row.get("status") == "ok" for row in latest.values()),
        "output": str(csv_path),
    }


def _git_metadata() -> dict[str, Any]:
    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL
        ).strip()
        status = subprocess.check_output(
            ["git", "status", "--porcelain"], text=True, stderr=subprocess.DEVNULL
        )
        return {"commit": commit, "dirty": bool(status.strip())}
    except (OSError, subprocess.CalledProcessError):
        return {"commit": None, "dirty": None}


def _safe_error(exc: Exception, secrets: list[str]) -> str:
    message = f"{type(exc).__name__}: {exc}"
    for secret in secrets:
        if secret:
            message = message.replace(secret, "[REDACTED]")
    message = re.sub(r"([?&](?:key|api_key|token)=)[^&\s]+", r"\1[REDACTED]", message)
    return message[:2000]


def _latest_records(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    return {str(row["_id"]): row for row in read_jsonl(path)}


def _prepare_metadata(
    output_path: Path,
    *,
    adapter: Adapter,
    run_id: str,
    retries: int,
    cooldown_seconds: float,
    context_mode: str,
) -> None:
    prompt_version = PROMPT_VERSIONS[context_mode]
    metadata_path = output_path.with_suffix(output_path.suffix + ".meta.json")
    operation = {
        "timestamp": utc_now(),
        "retries": retries,
        "cooldown_seconds": cooldown_seconds,
    }
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if (
            metadata.get("run_id") != run_id
            or metadata.get("prompt_version") != prompt_version
            or metadata.get("context_mode") != context_mode
        ):
            raise ValueError("Il file esistente appartiene a un esperimento differente")
        metadata.setdefault("resume_history", []).append(operation)
        write_json_atomic(metadata_path, metadata)
        return

    metadata = {
        "run_id": run_id,
        "created_at": operation["timestamp"],
        "dataset": FINDER.repository,
        "dataset_revision": FINDER.revision,
        "subset_size": FINDER.subset_size,
        "subset_seed": FINDER.subset_seed,
        "context_mode": context_mode,
        "prompt_version": prompt_version,
        "adapter": adapter.public_config(),
        "workers": 1,
        "initial_operation": operation,
        "resume_history": [],
        "runtime": {
            "python": sys.version,
            "platform": platform.platform(),
            "git": _git_metadata(),
        },
    }
    metadata["config_sha256"] = text_sha256(json.dumps(metadata, sort_keys=True))
    write_json_atomic(metadata_path, metadata)


def _run_one(
    adapter: Adapter,
    record: dict[str, Any],
    *,
    run_id: str,
    retries: int,
    cooldown_seconds: float,
    secrets: list[str],
    context_mode: str,
) -> dict[str, Any]:
    prompt = build_prompt(record, context_mode)
    prompt_version = PROMPT_VERSIONS[context_mode]
    dataset_name = DATASET_NAMES[context_mode]
    started_at = utc_now()
    last_error = ""
    for attempt in range(1, retries + 2):
        try:
            result = adapter.generate(
                prompt=prompt,
                task_id=str(record["_id"]),
                tier=context_mode,
                run_id=run_id,
            )
            prediction = result.prediction.strip()
            if not prediction:
                raise RuntimeError("Risposta vuota")
            row = {
                "run_id": run_id,
                "dataset": dataset_name,
                "dataset_revision": FINDER.revision,
                "context_mode": context_mode,
                "prompt_version": prompt_version,
                "prompt_sha256": text_sha256(prompt),
                "_id": str(record["_id"]),
                "category": str(record["category"]),
                "normalized_type": str(record["normalized_type"]),
                "quantitative": bool(record["quantitative"]),
                "question": str(record["text"]),
                "reference": str(record["answer"]),
                "gold_contexts": list(record["references"]),
                "references_count": len(record["references"]),
                "prompt_contexts_count": (
                    len(record["references"]) if context_mode == "gold" else 0
                ),
                "prediction": prediction,
                "latency_ms": round(result.latency_ms, 3),
                "attempt": attempt,
                "status": "ok",
                "started_at": started_at,
                "completed_at": utc_now(),
                "metadata": result.metadata,
            }
            if cooldown_seconds:
                time.sleep(cooldown_seconds)
            return row
        except Exception as exc:  # noqa: BLE001 - errors are benchmark data
            last_error = _safe_error(exc, secrets)
            if attempt <= retries:
                print(
                    f"[retry {attempt}/{retries + 1}] {context_mode}/"
                    f"{record['_id']}: {last_error}",
                    flush=True,
                )
                time.sleep(min(2 ** (attempt - 1) + random.random(), 30.0))

    if cooldown_seconds:
        time.sleep(cooldown_seconds)
    return {
        "run_id": run_id,
        "dataset": dataset_name,
        "dataset_revision": FINDER.revision,
        "context_mode": context_mode,
        "prompt_version": prompt_version,
        "prompt_sha256": text_sha256(prompt),
        "_id": str(record["_id"]),
        "category": str(record["category"]),
        "normalized_type": str(record["normalized_type"]),
        "quantitative": bool(record["quantitative"]),
        "question": str(record["text"]),
        "reference": str(record["answer"]),
        "gold_contexts": list(record["references"]),
        "references_count": len(record["references"]),
        "prompt_contexts_count": (
            len(record["references"]) if context_mode == "gold" else 0
        ),
        "attempt": retries + 1,
        "status": "error",
        "error": last_error,
        "started_at": started_at,
        "completed_at": utc_now(),
    }


def run_finder(
    *,
    adapter: Adapter,
    data_dir: Path,
    output_path: Path,
    csv_output_path: Path,
    run_id: str,
    retries: int,
    cooldown_seconds: float,
    max_examples: int | None = None,
    secrets: list[str] | None = None,
    context_mode: str = "gold",
) -> dict[str, Any]:
    if retries < 0:
        raise ValueError("retries non può essere negativo")
    if cooldown_seconds < 0:
        raise ValueError("cooldown_seconds non può essere negativo")
    if context_mode not in CONTEXT_MODES:
        raise ValueError(
            f"context_mode deve essere uno tra: {', '.join(CONTEXT_MODES)}"
        )
    _prepare_metadata(
        output_path,
        adapter=adapter,
        run_id=run_id,
        retries=retries,
        cooldown_seconds=cooldown_seconds,
        context_mode=context_mode,
    )
    latest = _latest_records(output_path)
    completed = {key for key, row in latest.items() if row.get("status") == "ok"}
    pending = [row for row in load_subset(data_dir) if str(row["_id"]) not in completed]
    if max_examples is not None:
        pending = pending[:max_examples]

    successes = 0
    failures = 0
    for index, record in enumerate(pending, start=1):
        row = _run_one(
            adapter,
            record,
            run_id=run_id,
            retries=retries,
            cooldown_seconds=cooldown_seconds,
            secrets=secrets or [],
            context_mode=context_mode,
        )
        append_jsonl(output_path, row)
        export_run_csv(output_path, csv_output_path)
        successes += row["status"] == "ok"
        failures += row["status"] != "ok"
        print(
            f"[{index}/{len(pending)}] {context_mode}/{row['_id']}: {row['status']}",
            flush=True,
        )

    if not pending and output_path.exists():
        export_run_csv(output_path, csv_output_path)
    return {
        "scheduled": len(pending),
        "successes": successes,
        "failures": failures,
        "already_completed": len(completed),
        "output": str(output_path),
        "csv_output": str(csv_output_path),
        "context_mode": context_mode,
    }


def run_gold(**kwargs: Any) -> dict[str, Any]:
    """Compatibilità con l'API originaria del solo esperimento Gold."""
    return run_finder(**kwargs, context_mode="gold")
