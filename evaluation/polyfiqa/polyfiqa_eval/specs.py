from dataclasses import dataclass


@dataclass(frozen=True)
class DatasetSpec:
    tier: str
    repository: str
    revision: str
    expected_records: int
    legacy_repository: str
    legacy_revision: str
    expected_development_records: int = 76


DATASETS: dict[str, DatasetSpec] = {
    "easy": DatasetSpec(
        tier="easy",
        repository="TheFinAI/PolyFiQA-Easy-July",
        revision="1d9e77122d3176c05d14076c095ff6fc2c632d31",
        expected_records=172,
        legacy_repository="TheFinAI/PolyFiQA-Easy",
        legacy_revision="bd540356d14f5298b905b0a83aea5f500ba13828",
    ),
    "expert": DatasetSpec(
        tier="expert",
        repository="TheFinAI/PolyFiQA-Expert-July",
        revision="ab00ac3cb6f622710e13e9dab839b3d35e94cfee",
        expected_records=172,
        legacy_repository="TheFinAI/PolyFiQA-Expert",
        legacy_revision="18f57f7c3b2fd4bf93c6ebce7b68b196230fac46",
    ),
}

REQUIRED_FIELDS = ("task_id", "query", "question", "answer")
