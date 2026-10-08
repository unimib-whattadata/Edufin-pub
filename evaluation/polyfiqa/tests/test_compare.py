import unittest

from polyfiqa_eval.compare import bootstrap_paired_delta


class CompareTest(unittest.TestCase):
    def test_bootstrap_delta_is_candidate_minus_baseline(self) -> None:
        delta, lower, upper = bootstrap_paired_delta(
            [0.1, 0.2, 0.3],
            [0.2, 0.3, 0.4],
            samples=500,
            seed=7,
        )
        self.assertAlmostEqual(delta, 0.1)
        self.assertAlmostEqual(lower, 0.1)
        self.assertAlmostEqual(upper, 0.1)


if __name__ == "__main__":
    unittest.main()
