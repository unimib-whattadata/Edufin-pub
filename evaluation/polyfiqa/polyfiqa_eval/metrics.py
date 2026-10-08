from __future__ import annotations

import math
import re
import statistics
from pathlib import Path
from typing import Any

from .io import (
    load_dataset_records,
    read_jsonl,
    write_json_atomic,
    write_jsonl_atomic,
)

_NUM_REGEX = re.compile(
    r"(?<![\w.])(?P<num>\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?P<pct>%?)"
)


def extract_numbers(text: str) -> list[float]:
    values: list[float] = []
    for match in _NUM_REGEX.finditer(text):
        value = float(match.group("num").replace(",", ""))
        if match.group("pct") == "%":
            value /= 100.0
        values.append(value)
    return values


def numeric_consistency(
    context: str,
    answer: str,
    *,
    relative_tolerance: float = 0.02,
    absolute_tolerance: float = 1e-6,
) -> float:
    context_numbers = extract_numbers(context)
    answer_numbers = extract_numbers(answer)
    if not answer_numbers:
        return 1.0
    if not context_numbers:
        return 0.0

    matched = 0
    for answer_number in answer_numbers:
        best_relative_error = min(
            abs(answer_number - context_number)
            / max(abs(answer_number), abs(context_number), absolute_tolerance)
            for context_number in context_numbers
        )
        if (
            best_relative_error <= relative_tolerance
            or abs(answer_number) <= absolute_tolerance
        ):
            matched += 1
    return matched / len(answer_numbers)


def percentile(values: list[float], probability: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return float(ordered[lower])
    fraction = position - lower
    return float(ordered[lower] * (1 - fraction) + ordered[upper] * fraction)


def _latest_run_records(run_path: Path) -> dict[tuple[str, str], dict[str, Any]]:
    records: dict[tuple[str, str], dict[str, Any]] = {}
    for row in read_jsonl(run_path):
        records[(str(row["tier"]), str(row["example_id"]))] = row
    return records


def _load_rouge_metric():
    try:
        import evaluate

        return evaluate.load("rouge")
    except (ImportError, ModuleNotFoundError) as exc:
        raise RuntimeError(
            "Dipendenze metriche mancanti. Installare con `pip install -e '.[all]'`."
        ) from exc


def score_run(
    *,
    data_dir: Path,
    run_path: Path,
    output_dir: Path,
    bertscore_model: str | None = None,
    bertscore_lang: str = "en",
    bertscore_batch_size: int = 8,
) -> dict[str, Any]:
    if bertscore_batch_size < 1:
        raise ValueError("bertscore_batch_size deve essere almeno 1")
    latest_records = _latest_run_records(run_path)
    predictions_by_key = {
        key: row for key, row in latest_records.items() if row.get("status") == "ok"
    }
    rouge_metric = _load_rouge_metric() if predictions_by_key else None
    output_dir.mkdir(parents=True, exist_ok=True)
    all_per_item: list[dict[str, Any]] = []
    summaries: dict[str, Any] = {}

    tiers = sorted({key[0] for key in latest_records})
    for tier in tiers:
        dataset_records = load_dataset_records(data_dir, tier)
        dataset_by_id = {
            str(record["example_id"]): record for record in dataset_records
        }
        tier_rows = [
            row for (row_tier, _), row in predictions_by_key.items() if row_tier == tier
        ]
        tier_rows.sort(key=lambda row: str(row["example_id"]))
        observed_records = sum(key[0] == tier for key in latest_records)
        failed_records = sum(
            key[0] == tier and row.get("status") != "ok"
            for key, row in latest_records.items()
        )

        if not tier_rows:
            summaries[tier] = {
                "observed_records": observed_records,
                "scored_records": 0,
                "failed_records": failed_records,
                "success_rate": 0.0,
            }
            continue

        references: list[str] = []
        predictions: list[str] = []
        contexts: list[str] = []
        valid_rows: list[dict[str, Any]] = []
        for row in tier_rows:
            example_id = str(row["example_id"])
            dataset_record = dataset_by_id.get(example_id)
            if dataset_record is None:
                raise ValueError(
                    f"{tier}/{example_id} non esiste nel dataset scaricato"
                )
            references.append(str(dataset_record["answer"]))
            predictions.append(str(row["prediction"]))
            contexts.append(str(dataset_record["query"]))
            valid_rows.append(row)

        assert rouge_metric is not None
        aggregate_rouge = float(
            rouge_metric.compute(predictions=predictions, references=references)[
                "rouge1"
            ]
        )
        per_item_rouge = rouge_metric.compute(
            predictions=predictions,
            references=references,
            use_aggregator=False,
        )["rouge1"]

        bert_scores: list[float] | None = None
        if bertscore_model:
            try:
                bert_metric = __import__("evaluate").load("bertscore")
                bert_result = bert_metric.compute(
                    predictions=predictions,
                    references=references,
                    model_type=bertscore_model,
                    lang=bertscore_lang,
                    batch_size=bertscore_batch_size,
                )
                bert_scores = [float(value) for value in bert_result["f1"]]
            except Exception as exc:
                raise RuntimeError(f"Calcolo BERTScore non riuscito: {exc}") from exc

        numeric_scores = [
            numeric_consistency(context, prediction)
            for context, prediction in zip(contexts, predictions, strict=True)
        ]
        latencies = [float(row["latency_ms"]) for row in valid_rows]

        for index, row in enumerate(valid_rows):
            item = {
                "tier": tier,
                "task_id": str(row["task_id"]),
                "example_id": str(row["example_id"]),
                "rouge1": float(per_item_rouge[index]),
                "numeric_consistency": float(numeric_scores[index]),
                "latency_ms": latencies[index],
                "word_count": int(row["word_count"]),
                "within_100_words": bool(row["within_100_words"]),
            }
            if bert_scores is not None:
                item["bertscore_f1"] = bert_scores[index]
            all_per_item.append(item)

        summaries[tier] = {
            "observed_records": observed_records,
            "scored_records": len(valid_rows),
            "failed_records": failed_records,
            "success_rate": len(valid_rows) / observed_records,
            "rouge1": aggregate_rouge,
            "numeric_consistency": statistics.fmean(numeric_scores),
            "within_100_words_rate": statistics.fmean(
                1.0 if row["within_100_words"] else 0.0 for row in valid_rows
            ),
            "latency_ms_p50": percentile(latencies, 0.50),
            "latency_ms_p95": percentile(latencies, 0.95),
        }
        if bert_scores is not None:
            summaries[tier]["bertscore_f1"] = statistics.fmean(bert_scores)

    summary = {
        "run": str(run_path),
        "bertscore_model": bertscore_model,
        "bertscore_lang": bertscore_lang if bertscore_model else None,
        "bertscore_batch_size": bertscore_batch_size if bertscore_model else None,
        "tiers": summaries,
    }
    write_json_atomic(output_dir / "summary.json", summary)
    write_jsonl_atomic(output_dir / "per_item.jsonl", all_per_item)
    return summary
