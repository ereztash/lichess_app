"""Think time from a PGN clock trace, and the two things that reading gets wrong.

FIRST: THE CLOCK IS WRITTEN AFTER THE MOVE. `[%clk ...]` on ply i is the mover's remaining time
once ply i has been played, so a think time needs the SAME player's previous reading:

    T(i) = clk[i-2] - clk[i] + increment

A player's first move has no clk[i-2] and is excluded -- not defaulted to zero. B2's import path
carried exactly this defect: `seconds ?? 0` invented a "0 seconds" decision for the first move of
every imported game with clocks, and 0 is below every fast-bucket boundary there is.

SECOND: THE GRANULARITY IS ONE SECOND. The Lichess dumps write `0:02:58`, so T is a whole number
and roughly a floor of the true interval. In 3+0 the median decision is a couple of seconds, so a
large share of decisions read as T = 0, meaning "under a second" rather than "instant". That is a
measurement limit of the public data, not a modelling choice, and control C17 repeats the analysis
with those decisions removed.
"""
from __future__ import annotations

import re

CLK = re.compile(r"\[%clk\s+(\d+):(\d+):(\d+)(?:\.(\d+))?\]")


def clock_seconds(movetext: str) -> list[float]:
    """One reading per ply, in seconds, in ply order. Empty when the game carries no clocks."""
    out: list[float] = []
    for h, m, s, frac in CLK.findall(movetext):
        value = int(h) * 3600 + int(m) * 60 + int(s)
        if frac:
            value += float("0." + frac)
        out.append(float(value))
    return out


def think_time(clocks: list[float], ply: int, increment: int) -> float | None:
    """Seconds the mover spent on `ply` (0-based), or None when it is not derivable."""
    if ply < 2 or ply >= len(clocks):
        return None
    return clocks[ply - 2] - clocks[ply] + increment


def opponent_previous_think(clocks: list[float], ply: int, increment: int) -> float | None:
    """Seconds the OPPONENT spent on the move immediately before this decision.

    R9 FROM GATE 1, and it is a mechanical route to a false positive for H1, not a nicety. Blitz
    players think on the opponent's clock. Part of the deliberation behind decision `i` happened
    while the opponent was moving at `i-1`, so a decision that follows a long opponent think tends
    to show a SHORT own think time (the move was already chosen) and BETTER quality (real
    deliberation went into it). That pairs negative unexpected time with low quality loss, which
    adds to beta for a reason that has nothing to do with unusually long deliberation predicting a
    worse move. It is observable before the human moved, from clocks already parsed, so leaving it
    out was not a limit of the data.
    """
    if ply < 3 or ply - 1 >= len(clocks):
        return None
    return clocks[ply - 3] - clocks[ply - 1] + increment


def own_previous_think(clocks: list[float], ply: int, increment: int) -> float | None:
    """Seconds the player spent on their OWN previous move. Pace, and partly policy.

    Recorded but kept out of every primary model: it absorbs the player's tempo, and tempo is part
    of the allocation policy Metric B is trying to measure. Control C19 adds it and re-estimates.
    """
    if ply < 4:
        return None
    return think_time(clocks, ply - 2, increment)


def berserked(clocks: list[float], base_seconds: int) -> bool:
    """Whether either side started on a clock that is not this time control's.

    A berserked arena game keeps the `180+0` header and starts at 90 seconds. Left in, it would
    enter the sample as a 3+0 game whose players are under twice the pressure, and clock_frac --
    remaining over base -- would be wrong for every one of its decisions.
    """
    if len(clocks) < 2:
        return True
    return not (clocks[0] <= base_seconds and clocks[1] <= base_seconds
                and clocks[0] > base_seconds / 2 and clocks[1] > base_seconds / 2)
