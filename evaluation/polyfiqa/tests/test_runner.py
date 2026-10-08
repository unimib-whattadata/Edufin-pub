import json
import tempfile
import unittest
from pathlib import Path

from polyfiqa_eval.adapters.base import AdapterResult
from polyfiqa_eval.io import write_jsonl_atomic
from polyfiqa_eval.runner import export_runs_csv, run_evaluation


class FixtureAdapter:
    name = "fixture"

    def generate(self, *, prompt: str, task_id: str, tier: str, run_id: str):
        del prompt, task_id, tier, run_id
        return AdapterResult(prediction="A valid answer", latency_ms=10.0)

    def public_config(self):
        return {"adapter": self.name}


class RunnerTest(unittest.TestCase):
    def test_multiple_runs_can_be_exported_to_one_csv(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            easy = root / "easy.jsonl"
            expert = root / "expert.jsonl"
            output = root / "combined.csv"
            write_jsonl_atomic(
                easy,
                [
                    {
                        "tier": "easy",
                        "example_id": "easy:1",
                        "question": "Easy question",
                        "prediction": "Easy answer",
                        "reference": "Easy gold",
                        "status": "ok",
                    }
                ],
            )
            write_jsonl_atomic(
                expert,
                [
                    {
                        "tier": "expert",
                        "example_id": "expert:1",
                        "question": "Expert question",
                        "prediction": "Expert answer",
                        "reference": "Expert gold",
                        "status": "ok",
                    }
                ],
            )

            result = export_runs_csv([easy, expert], output)

            self.assertEqual(result["records"], 2)
            self.assertEqual(result["successful_records"], 2)
            csv_text = output.read_text(encoding="utf-8")
            self.assertIn("Easy answer", csv_text)
            self.assertIn("Expert gold", csv_text)

    def test_successful_examples_are_resumed_without_repeating(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data_dir = root / "data"
            data_dir.mkdir()
            record = {
                "task_id": "filing",
                "example_id": "filing:abc",
                "query": "full context",
                "question": "question",
                "answer": "gold",
            }
            write_jsonl_atomic(data_dir / "polyfiqa_easy.jsonl", [record])
            (data_dir / "splits.json").write_text(
                json.dumps(
                    {
                        "easy": {
                            "development": ["filing:abc"],
                            "holdout": [],
                            "full": ["filing:abc"],
                        }
                    }
                ),
                encoding="utf-8",
            )
            output = root / "run.jsonl"
            arguments = {
                "adapter": FixtureAdapter(),
                "data_dir": data_dir,
                "output_path": output,
                "csv_output_path": root / "run.csv",
                "tiers": ["easy"],
                "partition": "development",
                "input_mode": "full-query",
                "run_id": "test-run",
                "workers": 1,
                "retries": 0,
            }

            first = run_evaluation(**arguments)
            second = run_evaluation(**arguments)

            self.assertEqual(first["successes"], 1)
            self.assertEqual(second["scheduled"], 0)
            self.assertEqual(second["already_completed"], 1)
            csv_text = (root / "run.csv").read_text(encoding="utf-8")
            self.assertIn("question", csv_text)
            self.assertIn("A valid answer", csv_text)
            self.assertIn("gold", csv_text)


if __name__ == "__main__":
    unittest.main()
