from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from datetime import UTC, datetime
from fractions import Fraction
from pathlib import Path
from typing import Any

from .io import file_sha256, text_sha256, write_json_atomic, write_jsonl_atomic
from .specs import FINDER, REQUIRED_FIELDS


def normalize_type(value: str) -> str:
    return "Subtraction" if value in {"Subtract", "Subtraction"} else value


def stratum_key(record: dict[str, Any]) -> str:
    return f"{record['category']}::{normalize_type(str(record['type']))}"


def validate_source(records: list[dict[str, Any]]) -> None:
    if len(records) != FINDER.expected_records:
        raise ValueError(
            f"Attesi {FINDER.expected_records} record, trovati {len(records)}"
        )
    seen: set[str] = set()
    for index, record in enumerate(records):
        missing = [
            field
            for field in REQUIRED_FIELDS
            if field != "answer" and not record.get(field)
        ]
        if missing:
            raise ValueError(f"Record {index}: campi mancanti o vuoti: {missing}")
        record_id = str(record["_id"])
        if record_id in seen:
            raise ValueError(f"_id duplicato: {record_id}")
        seen.add(record_id)
        references = record["references"]
        if not isinstance(references, list) or not all(
            isinstance(item, str) and item.strip() for item in references
        ):
            raise ValueError(f"Record {record_id}: references non valide")


def proportional_quotas(
    strata_counts: dict[str, int], *, total_records: int, subset_size: int
) -> dict[str, int]:
    if subset_size < 1 or subset_size > total_records:
        raise ValueError("subset_size fuori intervallo")
    quotas = {
        key: count * subset_size // total_records
        for key, count in strata_counts.items()
    }
    remaining = subset_size - sum(quotas.values())
    ranking = sorted(
        strata_counts,
        key=lambda key: (
            -(strata_counts[key] * subset_size % total_records),
            key,
        ),
    )
    for key in ranking[:remaining]:
        quotas[key] += 1
    return quotas


def select_stratified_subset(
    records: list[dict[str, Any]], *, subset_size: int, seed: int
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        groups[stratum_key(record)].append(record)
    counts = {key: len(rows) for key, rows in groups.items()}
    quotas = proportional_quotas(
        counts, total_records=len(records), subset_size=subset_size
    )

    selected: list[dict[str, Any]] = []
    for key in sorted(groups):
        ranked = sorted(
            groups[key],
            key=lambda row: (
                hashlib.sha256(f"{seed}:{row['_id']}".encode()).hexdigest(),
                str(row["_id"]),
            ),
        )
        for record in ranked[: quotas[key]]:
            prepared = dict(record)
            prepared["normalized_type"] = normalize_type(str(record["type"]))
            prepared["quantitative"] = prepared["normalized_type"] != "None"
            prepared["stratum"] = key
            prepared["source_row_sha256"] = text_sha256(
                repr(
                    (
                        record["_id"],
                        record["text"],
                        record["answer"],
                        record["references"],
                    )
                )
            )
            selected.append(prepared)

    selected.sort(key=lambda row: str(row["_id"]))
    if len(selected) != subset_size:
        raise AssertionError(f"Subset inatteso: {len(selected)} != {subset_size}")

    allocation = {
        key: {
            "source": counts[key],
            "selected": quotas[key],
            "ideal": float(Fraction(counts[key] * subset_size, len(records))),
        }
        for key in sorted(groups)
    }
    return selected, allocation


def _distribution(records: list[dict[str, Any]], field: str) -> dict[str, int]:
    return dict(sorted(Counter(str(row[field]) for row in records).items()))


def download_and_sample(output_dir: Path) -> dict[str, Any]:
    try:
        from datasets import load_dataset
    except ImportError as exc:
        raise RuntimeError(
            "Installare le dipendenze con `pip install -e '.[all]'`"
        ) from exc

    dataset = load_dataset(
        FINDER.repository,
        revision=FINDER.revision,
        split=FINDER.split,
    )
    records = [dict(record) for record in dataset]
    validate_source(records)
    records.sort(key=lambda row: str(row["_id"]))

    output_dir.mkdir(parents=True, exist_ok=True)
    full_path = output_dir / "finder_full.jsonl"
    subset_path = output_dir / "finder_gold_570.jsonl"
    ids_path = output_dir / "finder_gold_570_ids.json"
    write_jsonl_atomic(full_path, records)

    eligible = [record for record in records if str(record["answer"]).strip()]
    excluded = [record for record in records if not str(record["answer"]).strip()]
    subset, allocation = select_stratified_subset(
        eligible,
        subset_size=FINDER.subset_size,
        seed=FINDER.subset_seed,
    )
    write_jsonl_atomic(subset_path, subset)
    write_json_atomic(ids_path, [str(row["_id"]) for row in subset])

    manifest = {
        "created_at": datetime.now(UTC).isoformat(),
        "dataset": {
            "repository": FINDER.repository,
            "revision": FINDER.revision,
            "split": FINDER.split,
            "records": len(records),
            "sha256": file_sha256(full_path),
            "eligible_records": len(eligible),
            "excluded_records": len(excluded),
            "exclusion_rule": "blank gold answer",
            "excluded_ids": sorted(str(row["_id"]) for row in excluded),
        },
        "subset": {
            "name": "FinDER-Gold-570",
            "size": len(subset),
            "seed": FINDER.subset_seed,
            "method": (
                "proportional largest-remainder over category × normalized type; "
                "sha256(seed:_id) rank within stratum"
            ),
            "sha256": file_sha256(subset_path),
            "ids_sha256": file_sha256(ids_path),
            "category_distribution": _distribution(subset, "category"),
            "type_distribution": _distribution(subset, "normalized_type"),
            "strata": allocation,
        },
    }
    write_json_atomic(output_dir / "manifest.json", manifest)
    return manifest
