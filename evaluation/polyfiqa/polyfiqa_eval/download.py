from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .io import file_sha256, write_json_atomic, write_jsonl_atomic
from .specs import DATASETS, REQUIRED_FIELDS, DatasetSpec


def _load_huggingface_dataset(repository: str, revision: str) -> list[dict[str, Any]]:
    try:
        from datasets import load_dataset
    except ImportError as exc:
        raise RuntimeError(
            "Dipendenza `datasets` mancante. Installare il progetto con `pip install -e '.[all]'`."
        ) from exc

    dataset = load_dataset(repository, revision=revision, split="test")
    return [dict(record) for record in dataset]


def add_example_ids(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prepared: list[dict[str, Any]] = []
    for record in records:
        value = dict(record)
        fingerprint = hashlib.sha256(
            str(value.get("query", "")).encode("utf-8")
        ).hexdigest()
        value["example_id"] = f"{value.get('task_id', 'unknown')}:{fingerprint[:16]}"
        prepared.append(value)
    return prepared


def validate_records(records: list[dict[str, Any]], spec: DatasetSpec) -> None:
    if len(records) != spec.expected_records:
        raise ValueError(
            f"{spec.repository}: attesi {spec.expected_records} record, trovati {len(records)}"
        )

    seen: set[str] = set()
    for index, record in enumerate(records):
        missing = [field for field in REQUIRED_FIELDS if not record.get(field)]
        if missing:
            raise ValueError(
                f"{spec.repository} record {index}: campi mancanti o vuoti: {missing}"
            )
        example_id = str(record["example_id"])
        if example_id in seen:
            raise ValueError(f"{spec.repository}: example_id duplicato: {example_id}")
        seen.add(example_id)


def download_all(output_dir: Path) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, Any] = {
        "downloaded_at": datetime.now(UTC).isoformat(),
        "split": "test",
        "datasets": {},
    }
    split_assignments: dict[str, dict[str, list[str]]] = {}

    for tier, spec in DATASETS.items():
        records = add_example_ids(
            _load_huggingface_dataset(spec.repository, spec.revision)
        )
        validate_records(records, spec)

        legacy_records = add_example_ids(
            _load_huggingface_dataset(spec.legacy_repository, spec.legacy_revision)
        )
        legacy_ids = {str(record["example_id"]) for record in legacy_records}
        full_ids = {str(record["example_id"]) for record in records}
        if len(legacy_ids) != spec.expected_development_records:
            raise ValueError(
                f"{spec.legacy_repository}: attesi {spec.expected_development_records} ID, "
                f"trovati {len(legacy_ids)}"
            )
        if not legacy_ids.issubset(full_ids):
            missing = sorted(legacy_ids - full_ids)
            raise ValueError(
                f"La release legacy non è un sottoinsieme di July: {missing[:5]}"
            )

        data_path = output_dir / f"polyfiqa_{tier}.jsonl"
        write_jsonl_atomic(data_path, records)
        ordered_ids = [str(record["example_id"]) for record in records]
        split_assignments[tier] = {
            "development": [
                task_id for task_id in ordered_ids if task_id in legacy_ids
            ],
            "holdout": [
                task_id for task_id in ordered_ids if task_id not in legacy_ids
            ],
            "full": ordered_ids,
        }
        manifest["datasets"][tier] = {
            "repository": spec.repository,
            "revision": spec.revision,
            "records": len(records),
            "sha256": file_sha256(data_path),
            "legacy_repository": spec.legacy_repository,
            "legacy_revision": spec.legacy_revision,
            "development_records": len(split_assignments[tier]["development"]),
            "holdout_records": len(split_assignments[tier]["holdout"]),
        }

    write_json_atomic(output_dir / "splits.json", split_assignments)
    write_json_atomic(output_dir / "manifest.json", manifest)
    return manifest
