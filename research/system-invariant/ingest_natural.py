#!/usr/bin/env python3
"""Sample natural blitz decisions for the OwnExposure natural-generalization test.

Protocol authority: docs/system-invariant/RESEARCH_QUESTION_FREEZE.md section 4.2.

THIS DRIVES B3's SAMPLER RATHER THAN REIMPLEMENTING IT. `research/b3_population_expertise/src/
ingest.py` already encodes the header qualification, the structural rated check, the bot and
termination exclusions, the one-analysed-side-per-game rule (Gate 1 R6), the per-player game cap by
reservoir and the per-side decision cap by even ply spacing. A second sampler would be a second
authority for the same question, and the two would drift.

THE ACCEPTANCE RATES ARE B3's, UNMODIFIED. `src/rates_primary.json` is used as it stands, so the
rating-band composition of this sample is B3's composition and not a parameter of this mission. The
sample size is set by the byte prefix instead, which is the one knob B3 itself exposes
(`max_bytes_requested` in its own manifests).

WHAT IS DIFFERENT FROM B3, stated rather than buried: this reads a prefix of one day rather than the
whole day, so it covers the earlier UTC hours of 2026-07-01 and inherits whatever time-of-day
composition those hours have. B3's periods reached the end of their day. This is recorded in the
manifest as `covers_full_day: false` and is a real limit on population representativeness.

No engine is run here. Output is positions and moves only.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
B3 = ROOT / "research" / "b3_population_expertise" / "src"
sys.path.insert(0, str(B3))

import chess  # noqa: E402
import common  # noqa: E402  (B3's)
import ingest as b3  # noqa: E402  (B3's)

MONTH = "2026-07"
DAY = "2026.07.01"
TIME_CONTROL = "180+0"
GAMES_PER_PLAYER = 2
MAX_DECISIONS_PER_SIDE = 60


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-bytes", type=int, default=520_000_000)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    rates = json.loads((B3 / "rates_primary.json").read_text())
    sampler = b3.Sampler(TIME_CONTROL, rates, games_per_player=GAMES_PER_PLAYER)
    tally: dict = {}

    t0 = time.time()
    seen = 0

    def progress(n):
        rate = n / max(time.time() - t0, 1e-9)
        print(f"  {n:,} games scanned, {rate:,.0f}/s, {len(sampler.accepted)} players accepted",
              flush=True)

    for headers, movetext in b3.stream_games(MONTH, DAY, args.max_bytes, progress=progress,
                                             tally=tally):
        seen += 1
        sampler.offer(headers, movetext)

    sides = sampler.finalise()
    stream = tally.get("stream")
    consumed = stream.bytes_read if stream else None
    prefix_sha = stream.digest.hexdigest() if stream else None
    print(f"scanned {seen:,} games in {time.time() - t0:.0f}s; {len(sides)} sides accepted",
          flush=True)

    base, inc = b3.parse_time_control(TIME_CONTROL)
    rows = []
    excl: collections.Counter = collections.Counter()
    for side in sides:
        decisions, counts = b3.eligible_decisions(side, base, inc, MAX_DECISIONS_PER_SIDE)
        excl.update(counts)
        for d in decisions:
            board = chess.Board(d["fen_before"])
            rows.append({
                "player": side["player"],
                "game_id": side["game_id"],
                "side": side["side"],
                "rating": side["rating"],
                "band": side["band"],
                "rating_diff": side["rating"] - side["opponent_rating"],
                "ply": d["ply"],
                "fen_before": d["fen_before"],
                "move_uci": d["move_uci"],
                "legal_moves": d["legal_moves"],
                "in_check": bool(d["in_check"]),
                "seconds_taken": d["seconds_taken"],
                "clock_ms_self": d["clock_ms_self"],
                "clock_ms_opp": d["clock_ms_opp"],
                "opp_prev_think_s": d["opp_prev_think_s"],
                "own_prev_think_s": d["own_prev_think_s"],
                "phase": common.classify_phase(board, d["ply"]),
                "non_pawn_material": common.non_pawn_material(board),
                "move_number": board.fullmove_number,
            })

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w") as fh:
        for r in rows:
            fh.write(json.dumps(r, sort_keys=True) + "\n")

    manifest = {
        "protocol": "docs/system-invariant/RESEARCH_QUESTION_FREEZE.md",
        "month": MONTH,
        "window_utc_date": DAY,
        "time_control": TIME_CONTROL,
        "source_url": b3.BASE_URL.format(month=MONTH),
        "max_bytes_requested": args.max_bytes,
        "prefix_bytes_consumed": consumed,
        "prefix_sha256": prefix_sha,
        "covers_full_day": False,
        "acceptance_rates": rates,
        "acceptance_rates_source": "research/b3_population_expertise/src/rates_primary.json, unmodified",
        "seed": b3.SEED,
        "games_per_player_cap": GAMES_PER_PLAYER,
        "max_decisions_per_side": MAX_DECISIONS_PER_SIDE,
        "games_seen": sampler.games_seen,
        "game_exclusions": dict(sampler.excluded),
        "decision_exclusions": dict(excl),
        "sides": len(sides),
        "players": len({s["player"] for s in sides}),
        "decisions": len(rows),
        "decisions_by_band": dict(collections.Counter(r["band"] for r in rows)),
        "players_by_band": {
            b: len({r["player"] for r in rows if r["band"] == b})
            for b in sorted({r["band"] for r in rows})
        },
        "ingest_seconds": round(time.time() - t0, 1),
        "engine_searches_run": 0,
    }
    print("===INGEST_MANIFEST_BEGIN===")
    print(json.dumps(manifest, indent=2, sort_keys=True))
    print("===INGEST_MANIFEST_END===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
