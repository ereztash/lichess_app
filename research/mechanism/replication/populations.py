"""
PHASE 11 -- THE POPULATION BASELINE, resolved for an arbitrary focal player.

Player-specific replication is not "find a pattern in this player". It is "find a pattern, then ask
how much of it a same-rating player shows in the same pre-move situation". That second half needs a
population corpus for THIS player's band, scored under the same engine regime by the same feature
extractor.

The baseline's band, 1450-1850, is not a constant of the method: it is erez281's own band. The
contract states the rule (`contract.population_band`) and this module applies it. A focal player
whose band has no registered corpus does not get a weaker comparison and does not get a personal
finding -- the run returns POPULATION_BASELINE_INSUFFICIENT.

Peers are never chosen to maximise a residual: the band comes off the focal player's own rating
before any search result is read, and the registry is a fixed list of corpora built before the run.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contract

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
REGISTRY = os.path.join(HERE, "registry", "populations.json")


def registry() -> list[dict]:
    with open(REGISTRY) as f:
        return json.load(f)["populations"]


def focal_blitz_median_rating(decisions_parquet: str) -> float | None:
    """The band centre input: median own_rating over the focal player's admissible BLITZ games.

    One rating per GAME (not per decision), so a long game cannot pull the centre.
    """
    import pandas as pd
    df = pd.read_parquet(decisions_parquet, columns=["game_id", "speed", "own_rating"])
    blitz = df[df["speed"] == "blitz"]
    if not len(blitz):
        return None
    per_game = blitz.groupby("game_id")["own_rating"].first().dropna()
    return float(per_game.median()) if len(per_game) else None


def resolve(decisions_parquet: str) -> dict:
    """Which registered population corpus, if any, is the baseline for this focal player."""
    median = focal_blitz_median_rating(decisions_parquet)
    if median is None:
        return {"status": "POPULATION_BASELINE_INSUFFICIENT",
                "reason": "the focal corpus holds no blitz games, so no band can be derived",
                "band": None, "population": None}
    band = contract.population_band(median)
    for pop in registry():
        if tuple(pop["band"]) == band and set(pop["time_controls"]) == set(contract.POPULATION_CONTRACT["time_controls"]):
            resolved = dict(pop)
            resolved["decisions_parquet_abs"] = os.path.join(REPO_ROOT, pop["decisions_parquet"])
            return {"status": "OK", "focal_blitz_median_rating": median, "band": list(band),
                    "population": resolved}
    return {
        "status": "POPULATION_BASELINE_INSUFFICIENT",
        "reason": (f"no registered population corpus covers band {band[0]}-{band[1]} "
                   f"(focal blitz median {median:.0f}); registered bands: "
                   f"{[p['band'] for p in registry()]}"),
        "focal_blitz_median_rating": median,
        "band": list(band),
        "population": None,
        "remedy": ("build one with build_population.py for this band and register it in "
                   "registry/populations.json before re-running"),
    }


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", required=True)
    a = ap.parse_args()
    print(json.dumps(resolve(a.decisions), indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
