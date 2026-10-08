import json
import tempfile
import unittest
from pathlib import Path

from polyfiqa_eval.io import select_partition


class IoTest(unittest.TestCase):
    def test_select_partition_uses_task_ids(self) -> None:
        records = [
            {"task_id": "same", "example_id": "a"},
            {"task_id": "same", "example_id": "b"},
            {"task_id": "other", "example_id": "c"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            (data_dir / "splits.json").write_text(
                json.dumps(
                    {
                        "easy": {
                            "development": ["a"],
                            "holdout": ["b", "c"],
                            "full": ["a", "b", "c"],
                        }
                    }
                ),
                encoding="utf-8",
            )
            self.assertEqual(
                select_partition(records, data_dir, "easy", "holdout"),
                [
                    {"task_id": "same", "example_id": "b"},
                    {"task_id": "other", "example_id": "c"},
                ],
            )


if __name__ == "__main__":
    unittest.main()
