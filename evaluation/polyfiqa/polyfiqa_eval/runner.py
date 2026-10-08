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
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .adapters.base import Adapter
from .io import (
    append_jsonl,
    load_dataset_records,
    read_jsonl,
    select_partition,
    text_sha256,
    write_json_atomic,
)
from .specs import DATASETS


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def count_words(text: str) -> int:
    return len(re.findall(r"\S+", text.strip()))


CSV_FIELDS = (
    "run_id",
    "tier",
    "partition",
    "example_id",
    "task_id",
    "question",
    "aida_answer",
    "gold_answer",
    "status",
    "error",
    "latency_ms",
    "word_count",
    "within_100_words",
    "attempt",
    "dataset_revision",
    "input_sha256",
    "started_at",
    "completed_at",
)


def export_runs_csv(run_paths: list[Path], csv_path: Path) -> dict[str, Any]:
    """Combine runs and write the latest row per example as a crash-safe CSV."""
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for run_path in run_paths:
        if not run_path.exists():
            raise FileNotFoundError(f"Run mancante: {run_path}")
        for row in read_jsonl(run_path):
            latest[(str(row.get("tier")), str(row.get("example_id")))] = row

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = csv_path.with_suffix(csv_path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for key in sorted(latest):
            row = latest[key]
            csv_row = dict(row)
            csv_row["aida_answer"] = row.get("prediction", "")
            csv_row["gold_answer"] = row.get("reference", "")
            writer.writerow(csv_row)
    os.replace(temporary, csv_path)
    return {
        "runs": [str(path) for path in run_paths],
        "output": str(csv_path),
        "records": len(latest),
        "successful_records": sum(row.get("status") == "ok" for row in latest.values()),
    }


def export_run_csv(run_path: Path, csv_path: Path) -> None:
    """Write one run as CSV during incremental benchmark execution."""
    export_runs_csv([run_path], csv_path)


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


def _successful_keys(output_path: Path) -> set[tuple[str, str]]:
    if not output_path.exists():
        return set()
    return {
        (str(row.get("tier")), str(row.get("example_id")))
        for row in read_jsonl(output_path)
        if row.get("status") == "ok"
    }


def _validate_existing_run(
    output_path: Path,
    *,
    adapter_name: str,
    input_mode: str,
    partition: str,
    run_id: str,
) -> None:
    if not output_path.exists():
        return
    for row in read_jsonl(output_path):
        if (
            row.get("adapter") != adapter_name
            or row.get("input_mode") != input_mode
            or row.get("partition") != partition
            or row.get("run_id") != run_id
        ):
            raise ValueError(
                f"{output_path} contiene un run con configurazione differente. "
                "Usare un nuovo file di output."
            )
        return


def _safe_error_message(exc: Exception, secrets: list[str]) -> str:
    message = f"{type(exc).__name__}: {exc}"
    for secret in secrets:
        if secret:
            message = message.replace(secret, "[REDACTED]")
    message = re.sub(r"([?&](?:key|api_key|token)=)[^&\s]+", r"\1[REDACTED]", message)
    return message[:2000]


def _run_one(
    adapter: Adapter,
    record: dict[str, Any],
    *,
    tier: str,
    input_mode: str,
    run_id: str,
    partition: str,
    retries: int,
    cooldown_seconds: float,
    secret_values: list[str],
) -> dict[str, Any]:
    prompt_field = "query" if input_mode == "full-query" else "question"
    prompt = str(record[prompt_field])
    task_id = str(record["task_id"])
    example_id = str(record["example_id"])
    started_at = utc_now()
    last_error = ""

    for attempt in range(1, retries + 2):
        try:
            result = adapter.generate(
                prompt=prompt,
                task_id=example_id,
                tier=tier,
                run_id=run_id,
            )
            prediction = result.prediction.strip()
            if not prediction:
                raise RuntimeError("Risposta vuota")
            row = {
                "run_id": run_id,
                "task_id": task_id,
                "example_id": example_id,
                "tier": tier,
                "adapter": adapter.name,
                "input_mode": input_mode,
                "partition": partition,
                "dataset_revision": DATASETS[tier].revision,
                "input_sha256": text_sha256(prompt),
                "question": str(record["question"]),
                "reference": str(record["answer"]),
                "prediction": prediction,
                "word_count": count_words(prediction),
                "within_100_words": count_words(prediction) <= 100,
                "latency_ms": round(result.latency_ms, 3),
                "attempt": attempt,
                "status": "ok",
                "started_at": started_at,
                "completed_at": utc_now(),
                "metadata": result.metadata,
            }
            if cooldown_seconds > 0:
                time.sleep(cooldown_seconds)
            return row
        except Exception as exc:  # noqa: BLE001 - failures are benchmark outputs
            last_error = _safe_error_message(exc, secret_values)
            if attempt <= retries:
                delay = min(2 ** (attempt - 1) + random.random(), 30.0)
                time.sleep(delay)

    row = {
        "run_id": run_id,
        "task_id": task_id,
        "example_id": example_id,
        "tier": tier,
        "adapter": adapter.name,
        "input_mode": input_mode,
        "partition": partition,
        "dataset_revision": DATASETS[tier].revision,
        "input_sha256": text_sha256(prompt),
        "question": str(record["question"]),
        "reference": str(record["answer"]),
        "attempt": retries + 1,
        "status": "error",
        "error": last_error,
        "started_at": started_at,
        "completed_at": utc_now(),
    }
    if cooldown_seconds > 0:
        time.sleep(cooldown_seconds)
    return row


def run_evaluation(
    *,
    adapter: Adapter,
    data_dir: Path,
    output_path: Path,
    csv_output_path: Path,
    tiers: list[str],
    partition: str,
    input_mode: str,
    run_id: str,
    workers: int,
    retries: int,
    cooldown_seconds: float = 0.0,
    max_examples: int | None = None,
    shuffle_seed: int | None = None,
    secret_values: list[str] | None = None,
) -> dict[str, Any]:
    if workers < 1:
        raise ValueError("workers deve essere almeno 1")
    if cooldown_seconds < 0:
        raise ValueError("cooldown_seconds non può essere negativo")
    _validate_existing_run(
        output_path,
        adapter_name=adapter.name,
        input_mode=input_mode,
        partition=partition,
        run_id=run_id,
    )
    completed = _successful_keys(output_path)
    pending: list[tuple[str, dict[str, Any]]] = []

    for tier in tiers:
        records = load_dataset_records(data_dir, tier)
        records = select_partition(records, data_dir, tier, partition)
        pending.extend(
            (tier, record)
            for record in records
            if (tier, str(record["example_id"])) not in completed
        )

    if shuffle_seed is not None:
        random.Random(shuffle_seed).shuffle(pending)
    if max_examples is not None:
        pending = pending[:max_examples]

    config = {
        "run_id": run_id,
        "created_at": utc_now(),
        "adapter": adapter.public_config(),
        "tiers": tiers,
        "partition": partition,
        "input_mode": input_mode,
        "workers": workers,
        "retries": retries,
        "cooldown_seconds": cooldown_seconds,
        "shuffle_seed": shuffle_seed,
        "max_examples": max_examples,
        "output": str(output_path),
        "csv_output": str(csv_output_path),
        "runtime": {
            "python": sys.version,
            "platform": platform.platform(),
            "git": _git_metadata(),
        },
    }
    config["config_sha256"] = text_sha256(json.dumps(config, sort_keys=True))
    write_json_atomic(
        output_path.with_suffix(output_path.suffix + ".meta.json"), config
    )

    successes = 0
    failures = 0
    secrets = secret_values or []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures: dict[Future[dict[str, Any]], tuple[str, str]] = {}
        for tier, record in pending:
            future = executor.submit(
                _run_one,
                adapter,
                record,
                tier=tier,
                input_mode=input_mode,
                run_id=run_id,
                partition=partition,
                retries=retries,
                cooldown_seconds=cooldown_seconds,
                secret_values=secrets,
            )
            futures[future] = (tier, str(record["example_id"]))

        total = len(futures)
        for index, future in enumerate(as_completed(futures), start=1):
            row = future.result()
            append_jsonl(output_path, row)
            export_run_csv(output_path, csv_output_path)
            if row["status"] == "ok":
                successes += 1
            else:
                failures += 1
            tier, example_id = futures[future]
            print(f"[{index}/{total}] {tier}/{example_id}: {row['status']}", flush=True)

    if not pending:
        export_run_csv(output_path, csv_output_path)

    return {
        "scheduled": len(pending),
        "successes": successes,
        "failures": failures,
        "already_completed": len(completed),
        "output": str(output_path),
        "csv_output": str(csv_output_path),
    }
