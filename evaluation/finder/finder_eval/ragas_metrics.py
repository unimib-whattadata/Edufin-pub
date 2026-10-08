from __future__ import annotations

import asyncio
import csv
import math
import os
import statistics
import time
from collections import defaultdict
from importlib.metadata import version
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from .io import append_jsonl, read_jsonl, write_json_atomic


def parse_gemini_endpoint(endpoint: str) -> tuple[str, str]:
    if not endpoint:
        raise ValueError("GEMINI_ENDPOINT_URL non configurato")
    parsed = urlparse(endpoint)
    query = parse_qs(parsed.query)
    key_values = query.get("key") or []
    if not key_values or not key_values[0]:
        raise ValueError("L'endpoint Gemini non contiene il parametro `key`")
    marker = "/models/"
    if marker not in parsed.path or ":generateContent" not in parsed.path:
        raise ValueError("Formato GEMINI_ENDPOINT_URL non riconosciuto")
    model = parsed.path.split(marker, 1)[1].split(":generateContent", 1)[0]
    return model, key_values[0]


def _build_metrics(
    endpoint: str,
    embedding_model: str,
    request_timeout_seconds: float,
    max_tokens: int,
    reasoning_effort: str,
):
    try:
        from google import genai
        from openai import AsyncOpenAI
        from ragas.embeddings.google_provider import GoogleEmbeddings
        from ragas.llms import llm_factory
        from ragas.metrics.collections import AnswerCorrectness, Faithfulness
    except ImportError as exc:
        raise RuntimeError(
            "Installare le dipendenze con `pip install -e '.[all]'`"
        ) from exc

    judge_model, api_key = parse_gemini_endpoint(endpoint)
    client = genai.Client(
        api_key=api_key,
        http_options={"timeout": int(request_timeout_seconds * 1000)},
    )
    openai_client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        timeout=request_timeout_seconds,
        # Item-level retries below remain visible in the experiment output.
        max_retries=0,
    )
    llm = llm_factory(
        judge_model,
        provider="openai",
        client=openai_client,
        adapter="instructor",
        temperature=0.0,
        max_tokens=max_tokens,
        reasoning_effort=reasoning_effort,
        max_retries=1,
    )
    embeddings = GoogleEmbeddings(
        client=client,
        model=embedding_model,
    )
    return (
        judge_model,
        AnswerCorrectness(llm=llm, embeddings=embeddings),
        Faithfulness(llm=llm),
        openai_client,
    )


def _latest(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    return {str(row["_id"]): row for row in read_jsonl(path)}


def _mean(values: list[float]) -> float | None:
    valid = [value for value in values if not math.isnan(value)]
    return statistics.fmean(valid) if valid else None


def summarize_ragas(score_path: Path, output_path: Path) -> dict[str, Any]:
    rows = [row for row in _latest(score_path).values() if row.get("status") == "ok"]

    def aggregate(group: list[dict[str, Any]]) -> dict[str, Any]:
        correctness = [float(row["answer_correctness"]) for row in group]
        faithfulness = [float(row["faithfulness"]) for row in group]
        valid_correctness = [value for value in correctness if not math.isnan(value)]
        valid_faithfulness = [value for value in faithfulness if not math.isnan(value)]
        correctness_mean = _mean(correctness)
        faithfulness_mean = _mean(faithfulness)
        return {
            "records": len(group),
            "answer_correctness_valid_records": len(valid_correctness),
            "faithfulness_valid_records": len(valid_faithfulness),
            "answer_correctness": correctness_mean,
            "answer_correctness_100": (
                correctness_mean * 100 if correctness_mean is not None else None
            ),
            "faithfulness": faithfulness_mean,
            "faithfulness_100": (
                faithfulness_mean * 100 if faithfulness_mean is not None else None
            ),
        }

    categories: dict[str, list[dict[str, Any]]] = defaultdict(list)
    types: dict[str, list[dict[str, Any]]] = defaultdict(list)
    reasoning: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        categories[str(row["category"])].append(row)
        types[str(row["normalized_type"])].append(row)
        reasoning["quantitative" if row["quantitative"] else "qualitative"].append(row)

    summary = {
        "score_file": str(score_path),
        "successful_records": len(rows),
        "overall": aggregate(rows) if rows else aggregate([]),
        "by_category": {
            key: aggregate(value) for key, value in sorted(categories.items())
        },
        "by_reasoning": {
            key: aggregate(value) for key, value in sorted(reasoning.items())
        },
        "by_type": {key: aggregate(value) for key, value in sorted(types.items())},
    }
    write_json_atomic(output_path, summary)
    return summary


def _csv_metric(value: Any, *, scale: float = 1.0) -> float | str:
    number = float(value)
    return "" if math.isnan(number) else number * scale


def export_ragas_csv(run_path: Path, score_path: Path, output_path: Path) -> None:
    runs = _latest(run_path)
    scores = _latest(score_path)
    fields = (
        "_id",
        "category",
        "normalized_type",
        "quantitative",
        "question",
        "aida_answer",
        "gold_answer",
        "gold_context",
        "answer_correctness",
        "answer_correctness_100",
        "faithfulness",
        "faithfulness_100",
        "faithfulness_defined",
        "ragas_attempt",
        "ragas_latency_ms",
        "ragas_status",
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_suffix(output_path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for record_id in sorted(scores):
            score = scores[record_id]
            run = runs[record_id]
            correctness = score.get("answer_correctness", math.nan)
            faithfulness = score.get("faithfulness", math.nan)
            writer.writerow(
                {
                    "_id": record_id,
                    "category": run["category"],
                    "normalized_type": run["normalized_type"],
                    "quantitative": run["quantitative"],
                    "question": run["question"],
                    "aida_answer": run["prediction"],
                    "gold_answer": run["reference"],
                    "gold_context": "\n\n".join(run["gold_contexts"]),
                    "answer_correctness": _csv_metric(correctness),
                    "answer_correctness_100": _csv_metric(correctness, scale=100),
                    "faithfulness": _csv_metric(faithfulness),
                    "faithfulness_100": _csv_metric(faithfulness, scale=100),
                    "faithfulness_defined": not math.isnan(float(faithfulness)),
                    "ragas_attempt": score.get("attempt", ""),
                    "ragas_latency_ms": score.get("latency_ms", ""),
                    "ragas_status": score["status"],
                }
            )
    os.replace(temporary, output_path)


def export_ragas_summary_csv(summary: dict[str, Any], output_path: Path) -> None:
    fields = (
        "scope",
        "group",
        "records",
        "answer_correctness_valid_records",
        "answer_correctness_100",
        "faithfulness_valid_records",
        "faithfulness_100",
    )
    groups = [("overall", "all", summary["overall"])]
    for scope in ("by_category", "by_reasoning", "by_type"):
        groups.extend((scope, name, values) for name, values in summary[scope].items())
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_suffix(output_path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for scope, name, values in groups:
            writer.writerow({"scope": scope, "group": name, **values})
    os.replace(temporary, output_path)


def score_ragas(
    *,
    run_path: Path,
    score_path: Path,
    summary_path: Path,
    endpoint: str,
    embedding_model: str,
    retries: int,
    cooldown_seconds: float,
    request_timeout_seconds: float = 120.0,
    max_tokens: int = 16384,
    reasoning_effort: str = "low",
    max_examples: int | None = None,
) -> dict[str, Any]:
    if retries < 0:
        raise ValueError("retries non può essere negativo")
    if cooldown_seconds < 0:
        raise ValueError("cooldown_seconds non può essere negativo")
    if request_timeout_seconds <= 0:
        raise ValueError("request_timeout_seconds deve essere positivo")
    if max_tokens <= 0:
        raise ValueError("max_tokens deve essere positivo")
    if reasoning_effort not in {"none", "low", "medium", "high"}:
        raise ValueError("reasoning_effort non valido")
    judge_model, correctness_metric, faithfulness_metric, openai_client = (
        _build_metrics(
            endpoint,
            embedding_model,
            request_timeout_seconds,
            max_tokens,
            reasoning_effort,
        )
    )
    run_rows = [row for row in _latest(run_path).values() if row.get("status") == "ok"]
    run_rows.sort(key=lambda row: str(row["_id"]))
    completed = {
        record_id
        for record_id, row in _latest(score_path).items()
        if row.get("status") == "ok"
    }
    pending = [row for row in run_rows if str(row["_id"]) not in completed]
    if max_examples is not None:
        pending = pending[:max_examples]

    metadata_path = score_path.with_suffix(score_path.suffix + ".meta.json")
    metadata = {
        "metric_framework": "RAGAS",
        "ragas_version": version("ragas"),
        "answer_correctness_weights": [0.75, 0.25],
        "judge_model": judge_model,
        "embedding_model": embedding_model,
        "temperature": 0.0,
        "max_tokens": max_tokens,
        "reasoning_effort": reasoning_effort,
        "request_timeout_seconds": request_timeout_seconds,
        "sdk_retries": 0,
        "instructor_retries": 1,
        "async_event_loop": "single_per_run",
        "run": str(run_path),
        "score_output": str(score_path),
        "credentials_persisted": False,
    }
    write_json_atomic(metadata_path, metadata)

    async def score_pending() -> tuple[int, int]:
        successes = 0
        failures = 0
        try:
            for index, row in enumerate(pending, start=1):
                started = time.perf_counter()
                last_error = ""
                result: dict[str, Any] | None = None
                for attempt in range(1, retries + 2):
                    try:
                        correctness = await correctness_metric.ascore(
                            user_input=str(row["question"]),
                            response=str(row["prediction"]),
                            reference=str(row["reference"]),
                        )
                        faithfulness = await faithfulness_metric.ascore(
                            user_input=str(row["question"]),
                            response=str(row["prediction"]),
                            retrieved_contexts=list(row["gold_contexts"]),
                        )
                        result = {
                            "_id": str(row["_id"]),
                            "category": str(row["category"]),
                            "normalized_type": str(row["normalized_type"]),
                            "quantitative": bool(row["quantitative"]),
                            "answer_correctness": float(correctness.value),
                            "faithfulness": float(faithfulness.value),
                            "attempt": attempt,
                            "status": "ok",
                            "latency_ms": round(
                                (time.perf_counter() - started) * 1000, 3
                            ),
                        }
                        break
                    except Exception as exc:  # noqa: BLE001 - recorded judge error
                        last_error = f"{type(exc).__name__}: {exc}"[:2000]
                        if attempt <= retries:
                            await asyncio.sleep(min(2 ** (attempt - 1), 30))

                if result is None:
                    result = {
                        "_id": str(row["_id"]),
                        "category": str(row["category"]),
                        "normalized_type": str(row["normalized_type"]),
                        "quantitative": bool(row["quantitative"]),
                        "attempt": retries + 1,
                        "status": "error",
                        "error": last_error,
                        "latency_ms": round((time.perf_counter() - started) * 1000, 3),
                    }
                append_jsonl(score_path, result)
                successes += result["status"] == "ok"
                failures += result["status"] != "ok"
                summarize_ragas(score_path, summary_path)
                print(
                    f"[{index}/{len(pending)}] ragas/{row['_id']}: {result['status']}",
                    flush=True,
                )
                if cooldown_seconds:
                    await asyncio.sleep(cooldown_seconds)
        finally:
            await openai_client.close()
        return successes, failures

    successes, failures = asyncio.run(score_pending())

    summary = summarize_ragas(score_path, summary_path)
    score_csv_path = score_path.with_suffix(".csv")
    summary_csv_path = summary_path.with_suffix(".csv")
    export_ragas_csv(run_path, score_path, score_csv_path)
    export_ragas_summary_csv(summary, summary_csv_path)
    return {
        "scheduled": len(pending),
        "successes": successes,
        "failures": failures,
        "already_completed": len(completed),
        "score_output": str(score_path),
        "score_csv_output": str(score_csv_path),
        "summary_output": str(summary_path),
        "summary_csv_output": str(summary_csv_path),
        "summary": summary,
    }
