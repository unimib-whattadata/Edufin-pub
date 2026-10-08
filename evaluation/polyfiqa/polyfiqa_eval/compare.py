from __future__ import annotations

import random
import statistics
from pathlib import Path
from typing import Any

from .io import read_jsonl, write_json_atomic


def bootstrap_paired_delta(
    baseline: list[float],
    candidate: list[float],
    *,
    samples: int = 10_000,
    seed: int = 42,
) -> tuple[float, float, float]:
    if samples < 1:
        raise ValueError("samples deve essere almeno 1")
    if len(baseline) != len(candidate) or not baseline:
        raise ValueError(
            "Il bootstrap richiede vettori paired non vuoti e della stessa lunghezza"
        )
    deltas = [right - left for left, right in zip(baseline, candidate, strict=True)]
    observed = statistics.fmean(deltas)
    generator = random.Random(seed)
    bootstrapped = []
    for _ in range(samples):
        bootstrapped.append(
            statistics.fmean(deltas[generator.randrange(len(deltas))] for _ in deltas)
        )
    bootstrapped.sort()
    lower = bootstrapped[int(0.025 * (samples - 1))]
    upper = bootstrapped[int(0.975 * (samples - 1))]
    return observed, lower, upper


def _load_scores(path: Path) -> dict[tuple[str, str], dict[str, Any]]:
    return {(str(row["tier"]), str(row["example_id"])): row for row in read_jsonl(path)}


def _markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Confronto PolyFiQA",
        "",
        f"Esempi paired: {report['paired_records']}",
        "",
        "| Tier | Metrica | Baseline | Candidate | Delta | IC 95% | Win/Tie/Loss |",
        "|---|---|---:|---:|---:|---:|---:|",
    ]
    for result in report["results"]:
        lines.append(
            "| {tier} | {metric} | {baseline:.6f} | {candidate:.6f} | "
            "{delta:+.6f} | [{ci_low:+.6f}, {ci_high:+.6f}] | {wins}/{ties}/{losses} |".format(
                **result
            )
        )
    return "\n".join(lines) + "\n"


def compare_score_files(
    *,
    baseline_path: Path,
    candidate_path: Path,
    output_dir: Path,
    metrics: list[str],
    bootstrap_samples: int = 10_000,
    seed: int = 42,
) -> dict[str, Any]:
    baseline = _load_scores(baseline_path)
    candidate = _load_scores(candidate_path)
    paired_keys = sorted(set(baseline) & set(candidate))
    if not paired_keys:
        raise ValueError("I due file non hanno esempi paired in comune")

    results: list[dict[str, Any]] = []
    tiers = sorted({tier for tier, _ in paired_keys})
    for tier in tiers:
        tier_keys = [key for key in paired_keys if key[0] == tier]
        for metric in metrics:
            metric_keys = [
                key
                for key in tier_keys
                if metric in baseline[key] and metric in candidate[key]
            ]
            if not metric_keys:
                continue
            baseline_values = [float(baseline[key][metric]) for key in metric_keys]
            candidate_values = [float(candidate[key][metric]) for key in metric_keys]
            delta, ci_low, ci_high = bootstrap_paired_delta(
                baseline_values,
                candidate_values,
                samples=bootstrap_samples,
                seed=seed,
            )
            differences = [
                right - left
                for left, right in zip(baseline_values, candidate_values, strict=True)
            ]
            tolerance = 1e-12
            results.append(
                {
                    "tier": tier,
                    "metric": metric,
                    "records": len(metric_keys),
                    "baseline": statistics.fmean(baseline_values),
                    "candidate": statistics.fmean(candidate_values),
                    "delta": delta,
                    "ci_low": ci_low,
                    "ci_high": ci_high,
                    "wins": sum(value > tolerance for value in differences),
                    "ties": sum(abs(value) <= tolerance for value in differences),
                    "losses": sum(value < -tolerance for value in differences),
                }
            )

    report = {
        "baseline": str(baseline_path),
        "candidate": str(candidate_path),
        "paired_records": len(paired_keys),
        "bootstrap_samples": bootstrap_samples,
        "seed": seed,
        "results": results,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    write_json_atomic(output_dir / "comparison.json", report)
    (output_dir / "comparison.md").write_text(
        _markdown_report(report), encoding="utf-8"
    )
    return report
