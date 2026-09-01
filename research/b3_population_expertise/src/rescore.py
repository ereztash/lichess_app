"""Control C9: re-score a fixed subset at a different engine budget, and measure the attenuation.

R12 FROM GATE 1. The first draft's pass condition was "same sign under both budgets", and that
cannot detect the alternative C9 exists for. Under A2 -- unexpected time is a proxy for difficulty
the engine features missed -- `beta` is positive at every budget and shrinks toward zero as the
difficulty measurement improves. "Same sign" passes while the study's own central limitation goes
unfalsified.

So this control reports a RATIO, with a threshold fixed before FINAL is opened:

    r_beta = beta(150k nodes) / beta(60k nodes)
    r_TAE  = TAE gradient(150k) / TAE gradient(60k)

If the upper bound of `r_beta`'s player-bootstrap interval is below 0.5 -- the effect at least
halves when the difficulty measurement improves 2.5-fold -- the report must state that the evidence
favours the difficulty-proxy explanation over H1, and level 3 and higher language is withheld.

The subset is drawn from VALIDATION: never the fitting period, never FINAL. Every nuisance model is
refitted on the subset at each budget with the frozen recipe, because the feature SCALES move with
the budget (`final_depth`, `eval_volatility`, `nodes_to_depth10`, and the shallow-to-deep gap that
`voc_regret` is built from), so applying 60k coefficients to 150k features would compare a model to
a mis-scaled version of itself rather than comparing two budgets.

Run:
  python src/rescore.py --from data/validation --out data/validation_150k --nodes 150000 --sample 5000
"""
from __future__ import annotations

import argparse
import json
import multiprocessing as mp
import os
import sys
import time

import chess
import zstandard

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import dataset  # noqa: E402
from common import unit_hash  # noqa: E402
from engine import Engine  # noqa: E402
from position_features import (  # noqa: E402
    MULTIPV, board_features, clock_features, engine_features, search_trace,
)
from quality import quality_from  # noqa: E402
from value_of_computation import voc_features  # noqa: E402

SEED = 20260901
_ENGINE: Engine | None = None
_NODES = 150000


def _init(binary, nodes):
    global _ENGINE, _NODES
    _NODES = nodes
    _ENGINE = Engine(binary, multipv=MULTIPV)


def _one(row: dict) -> dict | None:
    board = chess.Board(row["fen_before"])
    decision = {
        "ply": row["ply"], "legal_moves": row["legal_moves"], "in_check": bool(row["in_check"]),
        "clock_ms_self": row["clock_ms_self"], "clock_ms_opp": row["clock_ms_opp"],
        "opp_prev_think_s": row.get("opp_prev_think_s"),
        "own_prev_think_s": row.get("own_prev_think_s"),
        "move_uci": row["move_uci"],
    }
    before = _ENGINE.search(board.fen(), _NODES)
    complete = before.complete(min(MULTIPV, decision["legal_moves"]))
    if not complete:
        return None
    after_board = board.copy()
    after_board.push(chess.Move.from_uci(row["move_uci"]))
    after = _ENGINE.search(after_board.fen(), _NODES)
    features = engine_features(complete[-1], complete)
    scored = quality_from(after, after_board, features["wp1"])
    if scored is None:
        return None
    base_seconds = 180 if row.get("period") != "secondary" else 300
    keep = {k: row[k] for k in ("period", "player", "game_id", "side", "rating", "rating_band",
                                "opponent_rating", "rating_diff", "termination", "seconds_taken",
                                "fen_before", "move_uci")}
    out = {
        **keep,
        **board_features(board, row["ply"], decision),
        **features,
        **voc_features(complete),
        **clock_features(decision, base_seconds),
        "quality_loss": scored["quality_loss"],
        "accurate": scored["accurate"],
        "wp_after": scored["wp_after"],
        "trace": search_trace(complete),
    }
    out["side_num"] = 1 if row["side"] == "w" else 0
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="source", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--nodes", type=int, default=150000)
    ap.add_argument("--sample", type=int, default=5000)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--binary", default="/opt/b3/stockfish-17.1-avx2")
    args = ap.parse_args()

    frame = dataset.load(args.source)
    rows = frame.to_dict("records")
    # A seeded draw, not the first N: which decisions are re-scored must not depend on file order.
    rows.sort(key=lambda r: unit_hash(SEED, "c9", str(r["game_id"]), str(r["ply"])))
    rows = rows[: args.sample]
    os.makedirs(args.out, exist_ok=True)

    started = time.time()
    out_rows = []
    with mp.Pool(args.workers, initializer=_init, initargs=(args.binary, args.nodes)) as pool:
        for i, scored in enumerate(pool.imap_unordered(_one, rows, chunksize=16), 1):
            if scored is not None:
                out_rows.append(scored)
            if i % 500 == 0:
                sys.stderr.write(f"  re-scored {i:,}/{len(rows):,} at {args.nodes:,} nodes, "
                                 f"{i / max(time.time() - started, 1e-9):.1f}/s\n")

    out_rows.sort(key=lambda r: (r["player"], r["game_id"], r["ply"]))
    path = os.path.join(args.out, "decisions.jsonl.zst")
    with open(path, "wb") as fh, zstandard.ZstdCompressor(level=10).stream_writer(fh) as writer:
        for row in out_rows:
            writer.write((json.dumps(row, sort_keys=True) + "\n").encode())
    json.dump(
        {"source": args.source, "nodes": args.nodes, "requested": args.sample,
         "scored": len(out_rows), "seed": SEED, "seconds": round(time.time() - started, 1)},
        open(os.path.join(args.out, "manifest.json"), "w"), indent=1,
    )
    sys.stderr.write(f"wrote {len(out_rows):,} re-scored decisions to {path}\n")


if __name__ == "__main__":
    main()
