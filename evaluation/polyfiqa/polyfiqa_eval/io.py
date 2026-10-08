from __future__ import annotations

import hashlib
import json
import os
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Any


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)


def write_jsonl_atomic(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    os.replace(temporary, path)


def append_jsonl(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def read_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"JSON non valido in {path}:{line_number}") from exc
            if not isinstance(value, dict):
                raise TypeError(f"Record non-oggetto in {path}:{line_number}")
            yield value


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def text_sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def load_dataset_records(data_dir: Path, tier: str) -> list[dict[str, Any]]:
    path = data_dir / f"polyfiqa_{tier}.jsonl"
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset mancante: {path}. Eseguire prima `polyfiqa-eval download`."
        )
    return list(read_jsonl(path))


def select_partition(
    records: list[dict[str, Any]],
    data_dir: Path,
    tier: str,
    partition: str,
) -> list[dict[str, Any]]:
    if partition == "full":
        return records

    splits_path = data_dir / "splits.json"
    if not splits_path.exists():
        raise FileNotFoundError(
            f"Assegnazioni delle partizioni mancanti: {splits_path}"
        )
    splits = json.loads(splits_path.read_text(encoding="utf-8"))
    selected_ids = set(splits[tier][partition])
    return [record for record in records if record["example_id"] in selected_ids]
