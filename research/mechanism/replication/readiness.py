"""
PLAYER READINESS, machine-readable.

The claim "ready for a lichess blitz player with median rating in 1450-1850" was wrong, and wrong in
a way that matters: it confused

    the player's rating lying INSIDE an existing band
with
    the player's DERIVED band being one the registry actually holds.

The population rule is `round(median blitz rating / 50) * 50 +- 200`, so the band is centred on the
player, not on the registry. A player whose blitz median is 1500 derives the band 1300-1700, which
no registered corpus covers, even though 1500 lies comfortably inside 1450-1850. The derived band is
the authority, and there is no "near enough": a mismatched band would silently change what "a
same-rating player" means.

With the registry holding only `population_2026-06` (1450-1850), the admissible window is therefore
narrow: `round(median/50)*50` must equal 1650, i.e. an integer median of **1626-1674**. Note the
endpoints: 1625 rounds DOWN to 1600 (Python's round() is banker's rounding, so 32.5 -> 32) and gives
the band 1400-1800, while 1625.5 rounds to 1650 and gives 1450-1850.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contract
import populations

# The predicate, as a rule rather than a sentence.
PLAYER_READY_RULE = (
    "platform in contract.SUPPORTED_PLATFORMS",
    "the corpus carries blitz games (the population reference is blitz-only, so no blitz means no band)",
    "corpus sufficient under contract.MIN_CORPUS on DERIVE / VALIDATE / TEST",
    "derived_population_band(median blitz rating) is present in registry/populations.json",
    "game enumeration available for this account (a token, or a frozen id list)",
    "GATE-GENERIC-PIPELINE-EQUIVALENCE is GREEN on the head being run",
)


def registry_bands() -> list[tuple[int, int]]:
    return [tuple(p["band"]) for p in populations.registry()]


def band_in_registry(band) -> bool:
    return tuple(band) in registry_bands()


def admissible_median_window(band=(1450, 1850)) -> dict:
    """Which blitz medians derive `band`, stated as the interval the rule actually produces."""
    lo = hi = None
    for m in range(0, 4000):
        if tuple(contract.population_band(m)) == tuple(band):
            lo = m if lo is None else lo
            hi = m
    return {"band": list(band), "integer_median_min": lo, "integer_median_max": hi,
            "rule": "round(median / 50) * 50 == %d" % (band[0] + contract.POPULATION_CONTRACT["band_halfwidth"]),
            "note": "Python's round() is banker's rounding, so a median of exactly "
                    f"{(lo or 0) - 1} rounds down and lands outside this band."}


def evaluate(*, platform: str, blitz_median_rating: float | None, counts: dict | None,
             blitz_counts: dict | None, enumeration_available: bool, gate_green: bool) -> dict:
    """The readiness predicate. Every failing condition is named; none is silently softened."""
    import classify
    checks, blockers = {}, []

    ok = platform in contract.SUPPORTED_PLATFORMS
    checks["platform_supported"] = ok
    if not ok:
        blockers.append(f"PLATFORM_UNSUPPORTED: {platform!r}")

    has_blitz = blitz_median_rating is not None
    checks["has_blitz_games"] = has_blitz
    if not has_blitz:
        blockers.append("POPULATION_BASELINE_INSUFFICIENT: no blitz games, so no band can be derived")

    band = list(contract.population_band(blitz_median_rating)) if has_blitz else None
    checks["blitz_median_rating"] = blitz_median_rating
    checks["derived_population_band"] = band
    hit = bool(band) and band_in_registry(band)
    checks["derived_band_in_registry"] = hit
    checks["registry_bands"] = [list(b) for b in registry_bands()]
    if has_blitz and not hit:
        blockers.append(f"POPULATION_BASELINE_INSUFFICIENT: derived band {band} is not registered; "
                        f"registered bands are {[list(b) for b in registry_bands()]}")

    if counts is not None:
        enough, missing = classify.corpus_sufficient(counts)
        checks["corpus_sufficient"] = enough
        if not enough:
            blockers.append("INSUFFICIENT_CORPUS: " + "; ".join(missing))
    else:
        checks["corpus_sufficient"] = None
    if blitz_counts is not None:
        enough_b, missing_b = classify.corpus_sufficient(blitz_counts)
        checks["blitz_frame_sufficient"] = enough_b
        if not enough_b:
            blockers.append("POPULATION_BASELINE_INSUFFICIENT (blitz frame): " + "; ".join(missing_b))
    else:
        checks["blitz_frame_sufficient"] = None

    checks["enumeration_available"] = enumeration_available
    if not enumeration_available:
        blockers.append("FETCH_FAILED: no game enumeration (set LICHESS_API_TOKEN or supply an id list)")
    checks["equivalence_gate_green"] = gate_green
    if not gate_green:
        blockers.append("PIPELINE_EQUIVALENCE_FAILED: the gate is not green on this head")

    return {"rule": list(PLAYER_READY_RULE), "checks": checks,
            "ready": not blockers, "blockers": blockers}


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser(description="is this player ready for the frozen pipeline?")
    ap.add_argument("--platform", default="lichess")
    ap.add_argument("--blitz-median", type=float, default=None)
    ap.add_argument("--decisions", default=None, help="derive the median from a decision table")
    ap.add_argument("--enumeration", type=int, default=1)
    ap.add_argument("--gate-green", type=int, default=1)
    ap.add_argument("--window", action="store_true", help="print the admissible median window")
    a = ap.parse_args()
    if a.window:
        print(json.dumps(admissible_median_window(), indent=1))
        return 0
    median = a.blitz_median
    if median is None and a.decisions:
        median = populations.focal_blitz_median_rating(a.decisions)
    print(json.dumps(evaluate(platform=a.platform, blitz_median_rating=median, counts=None,
                              blitz_counts=None, enumeration_available=bool(a.enumeration),
                              gate_green=bool(a.gate_green)), indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
