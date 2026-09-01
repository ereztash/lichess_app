"""The computational pilot, and the one thing it is forbidden to do.

It measures COST and SUPPLY -- games in the window, candidate sides per rating band, eligible
decisions per side, engine throughput, disk -- and from those it sets the per-band acceptance rates
and the final N.

IT MAY NOT ESTIMATE ANY SCIENTIFIC EFFECT. It never touches `quality_loss`, never fits a model, and
never joins a feature to an outcome. A pilot that peeks at the relationship and then chooses N is
choosing N to reach a p-value.

Run:  python src/pilot.py --period development --time-control 180+0
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import BAND_LABELS  # noqa: E402
from ingest import Sampler, eligible_decisions, parse_time_control, stream_games  # noqa: E402

ALL_ONE = {band: 1.0 for band in BAND_LABELS}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--period", default="development")
    ap.add_argument("--time-control", default="180+0")
    ap.add_argument("--month", default="2026-02")
    ap.add_argument("--day", default="2026.02.01")
    ap.add_argument("--max-bytes", type=int, default=1600 * 1024 * 1024)
    ap.add_argument("--decisions-sample", type=int, default=400)
    ap.add_argument("--out", default="results/pilot.json")
    args = ap.parse_args()

    base_seconds, increment = parse_time_control(args.time_control)
    sampler = Sampler(args.time_control, ALL_ONE, games_per_player=2)
    started = time.time()
    tally: dict = {}
    for headers, movetext in stream_games(
        args.month, args.day, args.max_bytes,
        progress=lambda n: sys.stderr.write(f"  {n:,} games in window, {time.time()-started:.0f}s\n"),
        tally=tally,
    ):
        sampler.offer(headers, movetext)
    sides = sampler.finalise()
    stream = tally["stream"]
    elapsed = time.time() - started

    # Eligible decisions per side, from an evenly spaced subsample -- a supply measurement, not a
    # relationship.
    step = max(1, len(sides) // args.decisions_sample)
    per_side = []
    for record in sides[::step][: args.decisions_sample]:
        decisions, _ = eligible_decisions(record, base_seconds, increment, 60)
        per_side.append(len(decisions))
    mean_per_side = sum(per_side) / len(per_side) if per_side else 0.0

    by_band = collections.Counter(s["band"] for s in sides)
    candidates = dict(sampler.seen_candidates)

    report = {
        "period": args.period,
        "month": args.month,
        "window": args.day,
        "time_control": args.time_control,
        "ingest_seconds": round(elapsed, 1),
        "prefix_bytes_consumed": stream.bytes_read,
        "hit_max_bytes": stream.bytes_read >= args.max_bytes - 1,
        "games_in_window": sampler.games_seen,
        "game_exclusions": dict(sampler.excluded),
        "candidate_sides_by_band": candidates,
        "sides_after_player_cap_by_band": dict(by_band),
        "mean_eligible_decisions_per_side": round(mean_per_side, 2),
        "decisions_per_side_sample": len(per_side),
        "available_decisions_by_band": {
            band: int(round(by_band.get(band, 0) * mean_per_side)) for band in BAND_LABELS
        },
        "distinct_players": len(sampler.accepted),
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    json.dump(report, open(args.out, "w"), indent=1)
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
