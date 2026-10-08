from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .adapters import AidaTrpcAdapter, GeminiDirectAdapter
from .compare import compare_score_files
from .download import download_all
from .metrics import score_run
from .runner import export_runs_csv, run_evaluation


def _default_run_id(adapter: str) -> str:
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    return f"{timestamp}-{adapter}"


def _parse_headers(raw: str) -> dict[str, str]:
    if not raw.strip():
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict) or not all(
        isinstance(key, str) and isinstance(item, str) for key, item in value.items()
    ):
        raise ValueError(
            "AIDA_HEADERS_JSON deve essere un oggetto JSON stringa→stringa"
        )
    return value


def _build_adapter(args: argparse.Namespace):
    if args.adapter == "aida":
        base_url = args.aida_base_url or os.getenv("AIDA_BASE_URL", "")
        headers_raw = args.aida_headers_json or os.getenv("AIDA_HEADERS_JSON", "{}")
        headers = _parse_headers(headers_raw)
        return AidaTrpcAdapter(
            base_url,
            headers=headers,
            timeout_seconds=args.timeout,
        ), [headers_raw, *headers.values()]

    endpoint = args.gemini_endpoint_url or os.getenv("GEMINI_ENDPOINT_URL", "")
    return GeminiDirectAdapter(
        endpoint,
        temperature=args.temperature,
        max_output_tokens=args.max_output_tokens,
        timeout_seconds=args.timeout,
    ), [endpoint]


def _resolve_run_id(output_path: Path, requested: str | None, adapter: str) -> str:
    metadata_path = output_path.with_suffix(output_path.suffix + ".meta.json")
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        existing = str(metadata.get("run_id") or "")
        if requested and existing and requested != existing:
            raise ValueError(
                f"Il run esistente usa run_id={existing}; richiesto run_id={requested}"
            )
        if existing:
            return existing
    return requested or _default_run_id(adapter)


def _add_run_parser(subparsers: Any) -> None:
    parser = subparsers.add_parser("run", help="Esegue un esperimento e salva JSONL")
    parser.add_argument("--adapter", choices=("aida", "gemini"), required=True)
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--csv-output",
        type=Path,
        help="Default: stesso nome di --output con estensione .csv",
    )
    parser.add_argument("--tier", choices=("easy", "expert", "all"), default="all")
    parser.add_argument(
        "--partition",
        choices=("development", "holdout", "full"),
        default="development",
    )
    parser.add_argument(
        "--input-mode", choices=("full-query", "question-only"), default="full-query"
    )
    parser.add_argument("--run-id")
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument(
        "--cooldown-seconds",
        type=float,
        default=0.0,
        help="Pausa dopo ogni risposta; usare con --workers 1 per proteggere il rate limit",
    )
    parser.add_argument("--max-examples", type=int)
    parser.add_argument("--shuffle-seed", type=int, default=42)
    parser.add_argument("--timeout", type=float, default=240.0)
    parser.add_argument("--aida-base-url")
    parser.add_argument("--aida-headers-json")
    parser.add_argument("--gemini-endpoint-url")
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--max-output-tokens", type=int, default=512)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="polyfiqa-eval",
        description="Valutazione oracle-context riproducibile di AIDA su PolyFiQA",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    download_parser = subparsers.add_parser(
        "download", help="Scarica le release PolyFiQA bloccate per commit"
    )
    download_parser.add_argument("--output-dir", type=Path, default=Path("data"))

    _add_run_parser(subparsers)

    export_parser = subparsers.add_parser(
        "export-csv", help="Unisce uno o più run in un CSV senza chiamare il modello"
    )
    export_parser.add_argument(
        "--run", type=Path, action="append", required=True, dest="runs"
    )
    export_parser.add_argument("--output", type=Path, required=True)

    score_parser = subparsers.add_parser("score", help="Calcola le metriche del run")
    score_parser.add_argument("--data-dir", type=Path, default=Path("data"))
    score_parser.add_argument("--run", type=Path, required=True)
    score_parser.add_argument("--output-dir", type=Path, required=True)
    score_parser.add_argument(
        "--bertscore-model",
        help="Ad esempio roberta-large (MultiFinBen) o xlm-roberta-large (diagnostica multilingua)",
    )
    score_parser.add_argument("--bertscore-lang", default="en")
    score_parser.add_argument(
        "--bertscore-batch-size",
        type=int,
        default=8,
        help="Batch esplicito per limitare la memoria e rendere lo scoring riproducibile",
    )

    compare_parser = subparsers.add_parser(
        "compare", help="Confronta due score per item con bootstrap paired"
    )
    compare_parser.add_argument("--baseline", type=Path, required=True)
    compare_parser.add_argument("--candidate", type=Path, required=True)
    compare_parser.add_argument("--output-dir", type=Path, required=True)
    compare_parser.add_argument(
        "--metrics",
        default="rouge1,numeric_consistency,bertscore_f1",
        help="Elenco separato da virgole",
    )
    compare_parser.add_argument("--bootstrap-samples", type=int, default=10_000)
    compare_parser.add_argument("--seed", type=int, default=42)
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "download":
            result = download_all(args.output_dir)
        elif args.command == "run":
            adapter, secrets = _build_adapter(args)
            tiers = ["easy", "expert"] if args.tier == "all" else [args.tier]
            run_id = _resolve_run_id(args.output, args.run_id, args.adapter)
            csv_output = args.csv_output or args.output.with_suffix(".csv")
            result = run_evaluation(
                adapter=adapter,
                data_dir=args.data_dir,
                output_path=args.output,
                csv_output_path=csv_output,
                tiers=tiers,
                partition=args.partition,
                input_mode=args.input_mode,
                run_id=run_id,
                workers=args.workers,
                retries=args.retries,
                cooldown_seconds=args.cooldown_seconds,
                max_examples=args.max_examples,
                shuffle_seed=args.shuffle_seed,
                secret_values=secrets,
            )
        elif args.command == "export-csv":
            result = export_runs_csv(args.runs, args.output)
        elif args.command == "score":
            result = score_run(
                data_dir=args.data_dir,
                run_path=args.run,
                output_dir=args.output_dir,
                bertscore_model=args.bertscore_model,
                bertscore_lang=args.bertscore_lang,
                bertscore_batch_size=args.bertscore_batch_size,
            )
        elif args.command == "compare":
            metrics = [
                metric.strip() for metric in args.metrics.split(",") if metric.strip()
            ]
            result = compare_score_files(
                baseline_path=args.baseline,
                candidate_path=args.candidate,
                output_dir=args.output_dir,
                metrics=metrics,
                bootstrap_samples=args.bootstrap_samples,
                seed=args.seed,
            )
        else:  # pragma: no cover - argparse enforces commands
            parser.error(f"Comando sconosciuto: {args.command}")
            return
    except (FileNotFoundError, RuntimeError, ValueError, json.JSONDecodeError) as exc:
        print(f"Errore: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc

    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
