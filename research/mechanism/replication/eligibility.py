"""
PHASE 5 -- THE FROZEN ELIGIBILITY CONTRACT.

    RAW IMMUTABLE CORPUS  ->  ADMISSIBLE CORPUS  (+ every exclusion, by reason, with its game ids)

Not one rule here is new. `is_admissible` is the Python transcription of `admissible()` in
scripts/build_import_corpus.ts -- the same function `scripts/build_account_corpus.ts` imports
rather than restates, and therefore the function that produced the frozen 2,209-game window whose
rejection tally lives in research/mechanism/data/frozen_window_manifest.json:

    termination:Abandoned 124, termination:Time forfeit 724, under-20-plies 134, no-clocks 4

The reason PRECEDENCE is the baseline's own (`build_account_corpus.ts`): a non-Normal termination is
reported as `termination:<tag>` even when clocks are also missing; only then no-clocks; only then
under-20-plies. Changing the precedence would change the tally without changing the corpus, so it
is preserved.

TWO STAGES, kept apart because the baseline kept them apart:

  * ADMISSIBLE      the product's rule above (2,209 games for erez281);
  * SCORABLE        admissible AND standard variant -- the scorer's own `variant != "standard"`
                    skip, which removed the same 48 games (47 fromPosition, 1 atomic) the product
                    drops (2,161 games for erez281).

Berserk is NOT an exclusion (design v1.1 handles it in the clock model). Duplicate game ids are
removed, keeping the first occurrence, so a re-fetch that overlaps cannot double-count.
"""
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contract

MIN_PLIES = contract.GAME_ELIGIBILITY["min_plies_with_clock"]


def tag(pgn: str, name: str) -> str:
    m = re.search(r'\[' + name + r' "(.*?)"\]', pgn or "")
    return m.group(1) if m else ""


def rejection_reason(rec: dict) -> str | None:
    """None when the game is admissible; otherwise the baseline's own reason string."""
    pgn = rec.get("pgn")
    if not pgn:
        return "no-pgn"
    if contract.GAME_ELIGIBILITY["rated_only"] and rec.get("rated") is False:
        return "unrated"
    # --- admissible() in build_import_corpus.ts, with build_account_corpus.ts's reason precedence --
    termination = tag(pgn, "Termination")
    if termination != contract.GAME_ELIGIBILITY["termination"]:
        return f"termination:{termination or 'none'}"
    if "%clk" not in pgn:
        return "no-clocks"
    if not tag(pgn, "White") or not tag(pgn, "Black"):
        return "malformed-moves"
    blank = pgn.find("\n\n")
    if blank < 0:
        return "malformed-moves"
    if len(re.findall(r"%clk", pgn[blank:])) < MIN_PLIES:
        return "under-20-plies"
    return None


def is_scorable(rec: dict) -> bool:
    """The scorer's own filter, kept as a second, separately counted stage."""
    return rec.get("variant") == contract.GAME_ELIGIBILITY["variant"]


def apply(raw_path: str, out_dir: str, *, focal_player_id: str, corpus: str,
          window: int | None = None) -> dict:
    """Split the raw corpus into ADMISSIBLE / excluded, and stamp the focal player on each record."""
    os.makedirs(out_dir, exist_ok=True)
    seen: set[str] = set()
    admitted, excluded = [], []
    counts: Counter[str] = Counter()
    order = 0
    with open(raw_path) as f:
        for line in f:
            line = line.strip()
            if not line.startswith("{"):
                continue
            rec = json.loads(line)
            gid = rec.get("id")
            order += 1
            if gid in seen:
                counts["duplicate-game-id"] += 1
                excluded.append({"id": gid, "reason": "duplicate-game-id"})
                continue
            seen.add(gid)
            reason = rejection_reason(rec)
            if reason is not None:
                counts[reason] += 1
                excluded.append({"id": gid, "reason": reason})
                continue
            rec["fetch_order"] = order
            admitted.append(rec)

    # WINDOW RULE: "the N most recent admissible games, in the API's own dateDesc order" -- the fetch
    # order IS that order, so the window is a prefix of the admitted list and never a re-sort.
    if window is not None and len(admitted) > window:
        for rec in admitted[window:]:
            counts["outside-window"] += 1
            excluded.append({"id": rec["id"], "reason": "outside-window"})
        admitted = admitted[:window]

    scorable, non_standard = [], []
    for rec in admitted:
        (scorable if is_scorable(rec) else non_standard).append(rec)
    for rec in non_standard:
        counts["non-standard-variant"] += 1
        excluded.append({"id": rec["id"], "reason": "non-standard-variant",
                         "variant": rec.get("variant")})

    for rec in scorable:
        rec["corpus"] = corpus
        rec["focal_player_id"] = focal_player_id

    adm_path = os.path.join(out_dir, "games.ndjson")
    with open(adm_path, "w") as f:
        for rec in scorable:
            f.write(json.dumps(rec) + "\n")
    with open(os.path.join(out_dir, "exclusions.json"), "w") as f:
        json.dump({"counts": dict(sorted(counts.items())), "games": excluded}, f, indent=1)

    speeds = Counter(r.get("speed") for r in scorable)
    return {
        "raw_records": order,
        "admissible": len(admitted),        # the product's rule, before the variant filter
        "scorable": len(scorable),          # admissible AND standard variant
        "excluded_by_reason": dict(sorted(counts.items())),
        "speeds": dict(sorted(speeds.items())),
        "admissible_path": adm_path,
        "window": window,
        "rule": {
            "game": contract.GAME_ELIGIBILITY,
            "berserk": contract.BERSERK_HANDLING,
            "window_rule": contract.WINDOW_RULE,
            "decision": contract.DECISION_ELIGIBILITY,
        },
    }


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser(description="apply the frozen eligibility contract to a raw corpus")
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--focal-player-id", required=True)
    ap.add_argument("--corpus", required=True)
    ap.add_argument("--window", type=int, default=None)
    a = ap.parse_args()
    print(json.dumps(apply(a.raw, a.out, focal_player_id=a.focal_player_id, corpus=a.corpus,
                           window=a.window), indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
