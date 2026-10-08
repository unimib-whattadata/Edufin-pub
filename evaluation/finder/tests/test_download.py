import unittest

from finder_eval.download import (
    normalize_type,
    proportional_quotas,
    select_stratified_subset,
)


class DownloadTest(unittest.TestCase):
    def test_normalizes_subtraction_alias(self) -> None:
        self.assertEqual(normalize_type("Subtract"), "Subtraction")
        self.assertEqual(normalize_type("Subtraction"), "Subtraction")
        self.assertEqual(normalize_type("Division"), "Division")

    def test_largest_remainder_has_exact_size(self) -> None:
        quotas = proportional_quotas(
            {"a": 5, "b": 3, "c": 2}, total_records=10, subset_size=3
        )
        self.assertEqual(sum(quotas.values()), 3)
        self.assertEqual(quotas, {"a": 1, "b": 1, "c": 1})

    def test_subset_is_independent_of_source_order(self) -> None:
        records = [
            {
                "_id": str(index),
                "text": f"Question {index}",
                "answer": f"Answer {index}",
                "references": [f"Evidence {index}"],
                "category": "Financials" if index % 2 else "Legal",
                "type": "Addition" if index % 2 else "None",
            }
            for index in range(20)
        ]
        first, _ = select_stratified_subset(records, subset_size=6, seed=7)
        second, _ = select_stratified_subset(
            list(reversed(records)), subset_size=6, seed=7
        )
        self.assertEqual([row["_id"] for row in first], [row["_id"] for row in second])


if __name__ == "__main__":
    unittest.main()
