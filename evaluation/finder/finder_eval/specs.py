from dataclasses import dataclass


@dataclass(frozen=True)
class FinderSpec:
    repository: str
    revision: str
    split: str
    expected_records: int
    subset_size: int
    subset_seed: int


FINDER = FinderSpec(
    repository="Linq-AI-Research/FinDER",
    revision="c4c1b6454aef7f0bb1c37235c7f52ce644642da0",
    split="train",
    expected_records=5703,
    subset_size=570,
    subset_seed=20260804,
)

REQUIRED_FIELDS = ("_id", "text", "category", "references", "answer", "type")
