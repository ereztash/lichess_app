"""
The focal player: who the pipeline is studying, expressed without naming anybody.

Before generalisation the analysis layer answered "which side am I studying?" with the literal
`erez281` in four different places (a colour test in the scorer, a default corpus label in the
loader, a `!= "erez281"` filter on the population frame, and report copy). All four asked one
question. This module is that question, asked once.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, field

import pandas as pd


@dataclass(frozen=True)
class FocalPlayer:
    """Identity of the player under study. Nothing downstream needs more than this."""

    platform: str
    username: str          # as the user typed it
    player_id: str         # canonical platform id (lichess: lowercase username)
    corpus: str            # corpus label written on every decision row of this player

    @property
    def player_key(self) -> str:
        """The `player_key` column written by pipeline/features.py for this player."""
        return self.player_id

    def to_dict(self) -> dict:
        return asdict(self)


def exclude_focal(pop: pd.DataFrame, focal_corpus: str | None, focal_keys) -> pd.DataFrame:
    """Remove the focal player from a population frame.

    GENERALISED (infrastructure) from `pop[pop["corpus"] != "erez281"]`. Two guards instead of one:
    the corpus label AND the player key, because a focal player can legitimately appear inside a
    population corpus sampled from the same platform, carrying a different corpus label. The
    population baseline must never be fit on the player it is the baseline FOR.
    """
    out = pop
    if focal_corpus is not None and "corpus" in out.columns:
        out = out[out["corpus"] != focal_corpus]
    keys = {str(k).lower() for k in (focal_keys or []) if k is not None}
    if keys and "player_key" in out.columns:
        out = out[~out["player_key"].astype(str).str.lower().isin(keys)]
    return out


def leakage_report(pop: pd.DataFrame, focal_corpus: str | None, focal_keys) -> dict:
    """How many population rows the focal guard removed, so a run can prove it ran."""
    before = len(pop)
    after = len(exclude_focal(pop, focal_corpus, focal_keys))
    return {"population_rows_before": int(before), "population_rows_after": int(after),
            "focal_rows_removed": int(before - after), "focal_corpus": focal_corpus,
            "focal_keys": sorted({str(k) for k in (focal_keys or []) if k is not None})}
