"""Loading the research artifacts, and nothing else.

Every file this reads is produced by a TypeScript script in `scripts/`, because the semantics --
what a think time is, which clock the player faced, what phase a position is in -- belong to the
modules the product itself uses. Python's job here is statistics, not definitions. Re-deriving any
of those here would create a second definition that could drift from the product's.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"


def read_jsonl(path: Path) -> list[dict]:
    with path.open() as handle:
        return [json.loads(line) for line in handle if line.strip()]


def read_json(path: Path) -> dict:
    with path.open() as handle:
        return json.load(handle)


@dataclass(frozen=True)
class Artifacts:
    """Everything a run produced, with the manifests that say how."""

    events: list[dict]
    event_manifest: dict
    saturation: list[dict]
    saturation_summary: dict
    saturation_extended: list[dict] | None
    saturation_extended_summary: dict | None
    budgeted: list[dict] | None
    budgeted_manifest: dict | None

    @property
    def games(self) -> int:
        return len({e["gameId"] for e in self.events})

    @property
    def players(self) -> int:
        return len({e["playerId"] for e in self.events})


def load(data: Path = DATA) -> Artifacts:
    optional_ext = data / "saturation_extended.jsonl"
    optional_budget = data / "budgeted_search.jsonl"
    return Artifacts(
        events=read_jsonl(data / "decision_events.jsonl"),
        event_manifest=read_json(data / "dataset_manifest.json"),
        saturation=read_jsonl(data / "saturation.jsonl"),
        saturation_summary=read_json(data / "saturation_summary.json"),
        saturation_extended=read_jsonl(optional_ext) if optional_ext.exists() else None,
        saturation_extended_summary=(
            read_json(data / "saturation_extended_summary.json")
            if (data / "saturation_extended_summary.json").exists()
            else None
        ),
        budgeted=read_jsonl(optional_budget) if optional_budget.exists() else None,
        budgeted_manifest=(
            read_json(data / "budgeted_search_manifest.json")
            if (data / "budgeted_search_manifest.json").exists()
            else None
        ),
    )
