import json
import tempfile
import unittest
from pathlib import Path

from finder_eval.adapters.base import AdapterResult
from finder_eval.io import write_jsonl_atomic
from finder_eval.runner import (
    build_gold_prompt,
    build_question_only_prompt,
    run_finder,
    run_gold,
)


class FixtureAdapter:
    name = "fixture"

    def __init__(self):
        self.calls = []

    def generate(self, *, prompt: str, task_id: str, tier: str, run_id: str):
        self.calls.append(
            {"prompt": prompt, "task_id": task_id, "tier": tier, "run_id": run_id}
        )
        return AdapterResult(prediction="Valid answer", latency_ms=10.0)

    def public_config(self):
        return {"adapter": self.name}


class RunnerTest(unittest.TestCase):
    def test_gold_prompt_contains_numbered_evidence_then_question(self) -> None:
        prompt = build_gold_prompt(
            {
                "references": ["First evidence", "Second evidence"],
                "text": "The query",
            }
        )
        self.assertEqual(
            prompt,
            "Context:\n[Evidence 1]\nFirst evidence\n\n"
            "[Evidence 2]\nSecond evidence\n\nQuestion:\nThe query",
        )

    def test_question_only_prompt_contains_no_gold_context(self) -> None:
        self.assertEqual(
            build_question_only_prompt(
                {"references": ["Secret evidence"], "text": "  The query  "}
            ),
            "The query",
        )

    def test_no_context_run_sends_only_the_question(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "data"
            data.mkdir()
            write_jsonl_atomic(
                data / "finder_gold_570.jsonl",
                [
                    {
                        "_id": "abc",
                        "text": "Question only",
                        "answer": "Gold",
                        "references": ["Evidence must not enter the prompt"],
                        "category": "Financials",
                        "normalized_type": "None",
                        "quantitative": False,
                    }
                ],
            )
            adapter = FixtureAdapter()
            output = root / "run.jsonl"
            result = run_finder(
                adapter=adapter,
                data_dir=data,
                output_path=output,
                csv_output_path=root / "run.csv",
                run_id="test-no-context",
                retries=0,
                cooldown_seconds=0,
                context_mode="none",
            )
            self.assertEqual(result["successes"], 1)
            self.assertEqual(adapter.calls[0]["prompt"], "Question only")
            self.assertEqual(adapter.calls[0]["tier"], "none")
            row = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(row["context_mode"], "none")
            self.assertEqual(row["prompt_contexts_count"], 0)
            self.assertEqual(
                row["gold_contexts"], ["Evidence must not enter the prompt"]
            )

    def test_successful_run_resumes_without_second_generation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "data"
            data.mkdir()
            write_jsonl_atomic(
                data / "finder_gold_570.jsonl",
                [
                    {
                        "_id": "abc",
                        "text": "Question",
                        "answer": "Gold",
                        "references": ["Evidence"],
                        "category": "Financials",
                        "normalized_type": "None",
                        "quantitative": False,
                    }
                ],
            )
            output = root / "run.jsonl"
            arguments = {
                "adapter": FixtureAdapter(),
                "data_dir": data,
                "output_path": output,
                "csv_output_path": root / "run.csv",
                "run_id": "test",
                "retries": 0,
                "cooldown_seconds": 0,
            }
            first = run_gold(**arguments)
            second = run_gold(**arguments)
            self.assertEqual(first["successes"], 1)
            self.assertEqual(second["scheduled"], 0)
            self.assertIn("Valid answer", (root / "run.csv").read_text())
            metadata = json.loads(
                (root / "run.jsonl.meta.json").read_text(encoding="utf-8")
            )
            self.assertEqual(len(metadata["resume_history"]), 1)


if __name__ == "__main__":
    unittest.main()
