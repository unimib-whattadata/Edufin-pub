from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from .adapters import AidaTrpcAdapter
from .download import download_and_sample
from .ragas_metrics import score_ragas
from .runner import CONTEXT_MODES, export_run_csv, run_finder


def _headers(raw: str) -> dict[str, str]:
    value = json.loads(raw or "{}")
    if not isinstance(value, dict) or not all(
        isinstance(key, str) and isinstance(item, str) for key, item in value.items()
    ):
        raise ValueError("AIDA_HEADERS_JSON deve essere un oggetto stringa→stringa")
    return value


def _run_id(output: Path, requested: str | None, context_mode: str) -> str:
    metadata_path = output.with_suffix(output.suffix + ".meta.json")
    if metadata_path.exists():
        existing = json.loads(metadata_path.read_text(encoding="utf-8")).get("run_id")
        if requested and requested != existing:
            raise ValueError(f"Il run esistente usa run_id={existing}")
        if existing:
            return str(existing)
    suffix = "gold" if context_mode == "gold" else "no-context"
    return requested or datetime.now(UTC).strftime(
        f"%Y%m%dT%H%M%SZ-aida-finder-{suffix}"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="finder-eval",
        description="Valutazione riproducibile AIDA su FinDER-Gold-570",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    download = commands.add_parser("download", help="Scarica FinDER e crea il subset")
    download.add_argument("--output-dir", type=Path, default=Path("data"))

    run = commands.add_parser("run", help="Esegue FinDER una domanda alla volta")
    run.add_argument("--data-dir", type=Path, default=Path("data"))
    run.add_argument("--output", type=Path, required=True)
    run.add_argument("--csv-output", type=Path)
    run.add_argument("--run-id")
    run.add_argument("--retries", type=int, default=4)
    run.add_argument("--cooldown-seconds", type=float, default=2.0)
    run.add_argument("--max-examples", type=int)
    run.add_argument("--timeout", type=float, default=240.0)
    run.add_argument("--aida-base-url")
    run.add_argument("--aida-headers-json")
    run.add_argument("--context-mode", choices=CONTEXT_MODES, default="gold")

    export = commands.add_parser("export-csv", help="Rigenera il CSV dal JSONL")
    export.add_argument("--run", type=Path, required=True)
    export.add_argument("--output", type=Path, required=True)

    ragas = commands.add_parser(
        "score-ragas", help="Calcola Answer Correctness e Faithfulness del paper"
    )
    ragas.add_argument("--run", type=Path, required=True)
    ragas.add_argument("--output-dir", type=Path, required=True)
    ragas.add_argument("--gemini-endpoint-url")
    ragas.add_argument("--embedding-model", default="gemini-embedding-001")
    ragas.add_argument("--retries", type=int, default=4)
    ragas.add_argument("--cooldown-seconds", type=float, default=1.0)
    ragas.add_argument("--request-timeout-seconds", type=float, default=120.0)
    ragas.add_argument("--max-tokens", type=int, default=16384)
    ragas.add_argument(
        "--reasoning-effort",
        choices=("none", "low", "medium", "high"),
        default="low",
    )
    ragas.add_argument("--max-examples", type=int)
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "download":
            result = download_and_sample(args.output_dir)
        elif args.command == "run":
            base_url = args.aida_base_url or os.getenv("AIDA_BASE_URL", "")
            headers_raw = args.aida_headers_json or os.getenv("AIDA_HEADERS_JSON", "{}")
            headers = _headers(headers_raw)
            adapter = AidaTrpcAdapter(
                base_url, headers=headers, timeout_seconds=args.timeout
            )
            result = run_finder(
                adapter=adapter,
                data_dir=args.data_dir,
                output_path=args.output,
                csv_output_path=args.csv_output or args.output.with_suffix(".csv"),
                run_id=_run_id(args.output, args.run_id, args.context_mode),
                retries=args.retries,
                cooldown_seconds=args.cooldown_seconds,
                max_examples=args.max_examples,
                secrets=[headers_raw, *headers.values()],
                context_mode=args.context_mode,
            )
        elif args.command == "export-csv":
            result = export_run_csv(args.run, args.output)
        elif args.command == "score-ragas":
            endpoint = args.gemini_endpoint_url or os.getenv("GEMINI_ENDPOINT_URL", "")
            result = score_ragas(
                run_path=args.run,
                score_path=args.output_dir / "ragas_per_item.jsonl",
                summary_path=args.output_dir / "ragas_summary.json",
                endpoint=endpoint,
                embedding_model=args.embedding_model,
                retries=args.retries,
                cooldown_seconds=args.cooldown_seconds,
                request_timeout_seconds=args.request_timeout_seconds,
                max_tokens=args.max_tokens,
                reasoning_effort=args.reasoning_effort,
                max_examples=args.max_examples,
            )
        else:  # pragma: no cover
            parser.error(f"Comando non riconosciuto: {args.command}")
            return
    except (FileNotFoundError, RuntimeError, ValueError, json.JSONDecodeError) as exc:
        print(f"Errore: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
