import json
import math
import tempfile
import unittest
from pathlib import Path

from finder_eval.io import write_jsonl_atomic
from finder_eval.ragas_metrics import (
    export_ragas_csv,
    export_ragas_summary_csv,
    parse_gemini_endpoint,
    summarize_ragas,
)


class RagasMetricsTest(unittest.TestCase):
    def test_parses_model_and_key_without_persisting_url(self) -> None:
        model, key = parse_gemini_endpoint(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash:generateContent?key=secret"
        )
        self.assertEqual(model, "gemini-2.5-flash")
        self.assertEqual(key, "secret")

    def test_summary_reports_paper_scale_and_breakdowns(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scores = root / "scores.jsonl"
            summary = root / "summary.json"
            write_jsonl_atomic(
                scores,
                [
                    {
                        "_id": "a",
                        "category": "Financials",
                        "normalized_type": "Addition",
                        "quantitative": True,
                        "answer_correctness": 0.5,
                        "faithfulness": 1.0,
                        "status": "ok",
                    },
                    {
                        "_id": "b",
                        "category": "Legal",
                        "normalized_type": "None",
                        "quantitative": False,
                        "answer_correctness": 1.0,
                        "faithfulness": 0.5,
                        "status": "ok",
                    },
                ],
            )
            result = summarize_ragas(scores, summary)
            self.assertEqual(result["overall"]["answer_correctness_100"], 75.0)
            self.assertEqual(result["overall"]["faithfulness_100"], 75.0)
            self.assertEqual(result["overall"]["answer_correctness_valid_records"], 2)
            self.assertEqual(result["overall"]["faithfulness_valid_records"], 2)
            self.assertEqual(result["by_reasoning"]["quantitative"]["records"], 1)
            self.assertEqual(json.loads(summary.read_text()), result)

            runs = root / "runs.jsonl"
            write_jsonl_atomic(
                runs,
                [
                    {
                        "_id": "a",
                        "category": "Financials",
                        "normalized_type": "Addition",
                        "quantitative": True,
                        "question": "Question?",
                        "prediction": "Prediction",
                        "reference": "Gold",
                        "gold_contexts": ["Evidence"],
                    },
                    {
                        "_id": "b",
                        "category": "Legal",
                        "normalized_type": "None",
                        "quantitative": False,
                        "question": "Question 2?",
                        "prediction": "Prediction 2",
                        "reference": "Gold 2",
                        "gold_contexts": ["Evidence 2"],
                    },
                ],
            )
            score_rows = list(
                json.loads(line) for line in scores.read_text().splitlines()
            )
            score_rows[1]["faithfulness"] = math.nan
            write_jsonl_atomic(scores, score_rows)
            score_csv = root / "scores.csv"
            summary_csv = root / "summary.csv"
            export_ragas_csv(runs, scores, score_csv)
            export_ragas_summary_csv(result, summary_csv)
            self.assertIn("Question?", score_csv.read_text())
            self.assertIn(",False,", score_csv.read_text())
            self.assertIn("overall,all,2", summary_csv.read_text())


if __name__ == "__main__":
    unittest.main()
