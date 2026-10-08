import unittest

from polyfiqa_eval.download import add_example_ids, validate_records
from polyfiqa_eval.specs import DatasetSpec


class DownloadTest(unittest.TestCase):
    def setUp(self) -> None:
        self.spec = DatasetSpec(
            tier="easy",
            repository="fixture",
            revision="revision",
            expected_records=2,
            legacy_repository="legacy",
            legacy_revision="legacy-revision",
        )

    def test_repeated_task_id_gets_distinct_example_ids(self) -> None:
        records = add_example_ids(
            [
                {"task_id": "filing", "query": "q1", "question": "one", "answer": "a"},
                {"task_id": "filing", "query": "q2", "question": "two", "answer": "b"},
            ]
        )
        validate_records(records, self.spec)
        self.assertNotEqual(records[0]["example_id"], records[1]["example_id"])

    def test_identical_examples_are_rejected(self) -> None:
        records = add_example_ids(
            [
                {
                    "task_id": "filing",
                    "query": "same",
                    "question": "one",
                    "answer": "a",
                },
                {
                    "task_id": "filing",
                    "query": "same",
                    "question": "two",
                    "answer": "b",
                },
            ]
        )
        with self.assertRaises(ValueError):
            validate_records(records, self.spec)


if __name__ == "__main__":
    unittest.main()
