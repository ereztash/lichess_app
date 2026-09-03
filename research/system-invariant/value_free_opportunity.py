#!/usr/bin/env python3
"""The value-free opportunity rate that freeze section 10.1 requires be reported beside the primary.

The primary opportunity definition uses the engine to decide which candidates are "reasonable",
which means the player at the board cannot evaluate it. That is a real limitation and the freeze
says so, so this measures the other end of the range: how often do at least two LEGAL moves differ
in OwnExposure at all, with no value filter of any kind?

The gap between the two numbers is the size of the thing the player has to supply themselves,
namely a candidate set. It is part of the result, not a footnote.

No engine. Board only. Sampled rather than exhaustive because 45,296 positions times ~32 legal moves
is 1.4 million system-state computations for a rate that a sample pins down to well inside a tenth
of a percentage point.
"""
from __future__ import annotations

import argparse
import json
import math
import multiprocessing as mp
import sys
from pathlib import Path

import chess
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import features as F  # noqa: E402

SEED = 20260902


def one_chunk(rows):
    out = []
    for r in rows:
        board = chess.Board(r["fen_before"])
        actor = board.turn
        pre = F.system_state(board, actor)
        exps = []
        for mv in board.legal_moves:
            after = board.copy(stack=False)
            after.push(mv)
            exps.append(F.system_state(after, actor)[F.EXPOSURE_KEY])
        if not exps:
            continue
        out.append({
            "legal": len(exps),
            "distinct_exposure": len(set(exps)),
            "min": min(exps),
            "max": max(exps),
            "pre": pre[F.EXPOSURE_KEY],
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", required=True)
    ap.add_argument("--sample", type=int, default=10000)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    rows = [json.loads(l) for l in open(args.decisions)]
    rng = np.random.default_rng(SEED)
    idx = rng.choice(len(rows), size=min(args.sample, len(rows)), replace=False)
    sample = [rows[i] for i in idx]

    per = math.ceil(len(sample) / args.workers)
    chunks = [sample[i * per : (i + 1) * per] for i in range(args.workers)]
    chunks = [c for c in chunks if c]
    with mp.Pool(len(chunks)) as pool:
        results = pool.map(one_chunk, chunks)
    flat = [x for res in results for x in res]

    n = len(flat)
    differ = sum(1 for x in flat if x["distinct_exposure"] >= 2)
    spread = np.array([x["max"] - x["min"] for x in flat], dtype=float)
    out = {
        "what": "at least two LEGAL moves differ in OwnExposure_post; no engine, no value filter",
        "sampled_positions": n,
        "sample_of": len(rows),
        "seed": SEED,
        "value_free_opportunity_rate": differ / n if n else None,
        "mean_legal_moves": float(np.mean([x["legal"] for x in flat])) if n else None,
        "mean_distinct_exposure_values": float(np.mean([x["distinct_exposure"] for x in flat])) if n else None,
        "exposure_spread_mean": float(spread.mean()) if n else None,
        "exposure_spread_p90": float(np.quantile(spread, 0.9)) if n else None,
        "engine_searches_run": 0,
    }
    print(json.dumps(out, indent=2, sort_keys=True))
    Path(args.out).write_text(json.dumps(out, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
