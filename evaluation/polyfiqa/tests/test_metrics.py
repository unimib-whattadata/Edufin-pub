import unittest

from polyfiqa_eval.metrics import extract_numbers, numeric_consistency, percentile


class MetricsTest(unittest.TestCase):
    def test_extract_numbers_matches_multifinben_conventions(self) -> None:
        self.assertEqual(
            extract_numbers("Revenue: 1,234.5; margin: 15%"), [1234.5, 0.15]
        )

    def test_numeric_consistency_uses_two_percent_tolerance(self) -> None:
        context = "Revenue was 1,000 and margin was 15%."
        answer = "Revenue was 1,020 and margin was 15%."
        self.assertEqual(numeric_consistency(context, answer), 1.0)

    def test_numeric_consistency_without_answer_numbers_is_one(self) -> None:
        self.assertEqual(
            numeric_consistency("Revenue was 100.", "Revenue increased."), 1.0
        )

    def test_percentile_interpolates(self) -> None:
        self.assertEqual(percentile([0.0, 10.0], 0.5), 5.0)
        self.assertIsNone(percentile([], 0.5))


if __name__ == "__main__":
    unittest.main()
