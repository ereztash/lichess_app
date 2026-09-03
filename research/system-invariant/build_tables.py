#!/usr/bin/env python3
"""Join the natural sample to its engine scores and compute the frozen board features.

Protocol authority: docs/system-invariant/RESEARCH_QUESTION_FREEZE.md sections 5 and 6.

Two tables come out, because the freeze asks two different questions:

  TABLE A -- one row per natural decision, carrying the features of the move the human ACTUALLY
             played plus every control in freeze section 5. This is the observational test.
  TABLE B -- one row per (position, candidate move) over the preserved `MultiPV 8` list, carrying
             `regret` within the position. This is the within-position test, and it is the decisive
             one, because position-level confounding cannot survive a comparison inside a position.

No engine runs here. Every value is either read from the preserved scores or computed at the board
by `features.py`, which calls P3's own `system_state`.
"""
from __future__ import annotations

import argparse
import io
import json
import math
import multiprocessing as mp
import sys
from pathlib import Path

import chess
import zstandard

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "research" / "b3_population_expertise" / "src"))

import common  # noqa: E402
import features as F  # noqa: E402

BASE_SECONDS = 180

#: `standing` is B3's frozen three-way split at +/-100 cp. The scores here are already win
#: probabilities, so the same cut is expressed in win-probability units rather than converted back.
WP_PLUS_100 = common.win_probability(100)
WP_MINUS_100 = common.win_probability(-100)


def standing_from_wp(wp1: float) -> str:
    if wp1 >= WP_PLUS_100:
        return "winning"
    if wp1 <= WP_MINUS_100:
        return "losing"
    return "level"


def read_zst(path: Path):
    with open(path, "rb") as fh:
        reader = zstandard.ZstdDecompressor().stream_reader(fh)
        for line in io.TextIOWrapper(reader, encoding="utf-8"):
            yield json.loads(line)


def build_chunk(payload):
    pairs, = payload
    a_rows, b_rows = [], []
    for dec, sc in pairs:
        board = chess.Board(dec["fen_before"])
        actor = board.turn
        pre_state = F.system_state(board, actor)
        played = chess.Move.from_uci(dec["move_uci"])

        clock_frac = dec["clock_ms_self"] / (1000.0 * BASE_SECONDS)
        context = {
            "player": dec["player"], "game_id": dec["game_id"], "ply": dec["ply"],
            "rating": dec["rating"], "band": dec["band"], "rating_diff": dec["rating_diff"],
            "phase": dec["phase"], "non_pawn_material": dec["non_pawn_material"],
            "legal_moves": dec["legal_moves"], "in_check": int(dec["in_check"]),
            "clock_frac": clock_frac,
            "clock_pressure": -math.log(max(clock_frac, 0.0) + 0.01),
            "log_time": math.log(1.0 + dec["seconds_taken"]),
            "opp_prev_think_s": dec["opp_prev_think_s"],
            "wp1": sc["wp1"], "edge": sc["edge"], "gap12": sc["gap12"],
            "n_near": sc["n_near"], "n_candidates": sc["n_candidates"],
            "ambiguity_entropy": sc["ambiguity_entropy"],
            "is_mate_line": int(sc["is_mate_line"]),
            "standing": standing_from_wp(sc["wp1"]),
        }

        try:
            feats = F.move_features(board, played, pre_state)
        except ValueError:
            continue
        cand_wp = {c["uci"]: c["wp"] for c in sc["candidates"]}
        a_rows.append({
            **context, **feats,
            "move_uci": dec["move_uci"],
            "quality_loss": sc["quality_loss"],
            "post_terminal": int(sc["post_terminal"]),
            "played_is_best": int(sc["candidates"][0]["uci"] == dec["move_uci"]),
            "played_in_candidates": int(dec["move_uci"] in cand_wp),
            "played_wp": cand_wp.get(dec["move_uci"]),
        })

        for c in sc["candidates"]:
            mv = chess.Move.from_uci(c["uci"])
            if mv not in board.legal_moves:
                continue
            cf = F.move_features(board, mv, pre_state)
            b_rows.append({
                **context, **cf,
                "move_uci": c["uci"],
                "cand_wp": c["wp"],
                "regret": sc["wp1"] - c["wp"],
                "is_played": int(c["uci"] == dec["move_uci"]),
            })
    return a_rows, b_rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", required=True)
    ap.add_argument("--scored", required=True)
    ap.add_argument("--out-a", required=True)
    ap.add_argument("--out-b", required=True)
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    decs = {}
    for line in open(args.decisions):
        d = json.loads(line)
        decs[(d["game_id"], d["ply"])] = d

    pairs = []
    for sc in read_zst(Path(args.scored)):
        key = (sc["game_id"], sc["ply"])
        if key in decs:
            pairs.append((decs[key], sc))
    print(f"joined {len(pairs)} decisions to scores", flush=True)

    per = math.ceil(len(pairs) / args.workers)
    chunks = [(pairs[i * per : (i + 1) * per],) for i in range(args.workers)]
    chunks = [c for c in chunks if c[0]]
    with mp.Pool(len(chunks)) as pool:
        results = pool.map(build_chunk, chunks)

    a_rows = [r for res in results for r in res[0]]
    b_rows = [r for res in results for r in res[1]]

    for path, rows in ((args.out_a, a_rows), (args.out_b, b_rows)):
        cctx = zstandard.ZstdCompressor(level=10)
        with open(path, "wb") as fh, cctx.stream_writer(fh) as w:
            for r in rows:
                w.write((json.dumps(r, sort_keys=True) + "\n").encode())

    print(json.dumps({
        "table_a_rows": len(a_rows),
        "table_b_rows": len(b_rows),
        "positions_in_b": len({(r["game_id"], r["ply"]) for r in b_rows}),
        "players": len({r["player"] for r in a_rows}),
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
