"""Ingest a period, score every eligible decision with the engine, write `decisions.jsonl.zst`.

TWO SEARCHES PER DECISION, both at the same budget with the same MultiPV and a cleared hash: the
position the player faced, and the position their move produced. Everything the study reads comes
out of those two searches and the pre-move board.

The work splits by SIDE (one analysed player in one game), because a side is the unit whose game
must be replayed in order; splitting by decision would replay each game once per decision.

Run:
  python src/score.py --period development --time-control 180+0 --out data/development
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

import account_status  # noqa: E402
from common import rating_band  # noqa: E402
from engine import Engine  # noqa: E402
from ingest import Sampler, eligible_decisions, parse_time_control, stream_games  # noqa: E402
from position_features import (  # noqa: E402
    MULTIPV, board_features, clock_features, engine_features, search_trace,
)
from quality import quality_from  # noqa: E402
from value_of_computation import voc_features  # noqa: E402

PERIODS = {
    "development": ("2026-02", "2026.02.01"),
    "validation": ("2026-04", "2026.04.01"),
    "final": ("2026-06", "2026.06.01"),
}

_ENGINE: Engine | None = None
_NODES = 60000
_BINARY = "/opt/b3/stockfish-17.1-avx2"


def _init_worker(binary: str, nodes: int) -> None:
    global _ENGINE, _NODES, _BINARY
    _BINARY, _NODES = binary, nodes
    _ENGINE = Engine(binary, multipv=MULTIPV)


def _score_side(job) -> tuple[list[dict], dict]:
    side_record, base_seconds, increment, max_decisions, period = job
    decisions, counts = eligible_decisions(side_record, base_seconds, increment, max_decisions)
    rows = []
    board = chess.Board()
    ply_index = {d["ply"]: d for d in decisions}
    for ply, san in enumerate(side_record["moves"]):
        decision = ply_index.get(ply)
        if decision is not None:
            row = _score_decision(board, ply, decision, side_record, base_seconds, period)
            if row is not None:
                rows.append(row)
            else:
                counts["unscoreable position"] = counts.get("unscoreable position", 0) + 1
        try:
            board.push_san(san)
        except ValueError:
            break
    return rows, dict(counts)


def _score_decision(board, ply, decision, side_record, base_seconds, period) -> dict | None:
    expected_k = min(MULTIPV, decision["legal_moves"])
    before = _ENGINE.search(board.fen(), _NODES)
    complete = before.complete(expected_k)
    if not complete:
        return None
    final = complete[-1]

    after_board = board.copy()
    after_board.push(chess.Move.from_uci(decision["move_uci"]))
    after = _ENGINE.search(after_board.fen(), _NODES)
    features = engine_features(final, complete)
    scored = quality_from(after, after_board, features["wp1"])
    if scored is None:
        return None

    row = {
        "period": period,
        "player": side_record["player"],
        "game_id": side_record["game_id"],
        "side": side_record["side"],
        "rating": side_record["rating"],
        "rating_band": side_record["band"],
        "opponent_rating": side_record["opponent_rating"],
        "rating_diff": side_record["rating"] - side_record["opponent_rating"],
        "termination": side_record["termination"],
        "seconds_taken": decision["seconds_taken"],
        # Kept so the corpus can be re-scored at another engine budget (control C9) without
        # re-streaming and re-sampling. `move_uci` is POST_MOVE and no model may read it.
        "fen_before": decision["fen_before"],
        "move_uci": decision["move_uci"],
        **board_features(board, ply, decision),
        **features,
        **voc_features(complete),
        **clock_features(decision, base_seconds),
        "quality_loss": scored["quality_loss"],
        "accurate": scored["accurate"],
        "wp_after": scored["wp_after"],
        # Kept, not used: see position_features.search_trace. No model reads it.
        "trace": search_trace(complete),
    }
    row["side_num"] = 1 if side_record["side"] == "w" else 0
    return row


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--period", required=True)
    ap.add_argument("--time-control", default="180+0")
    ap.add_argument("--out", required=True)
    ap.add_argument("--rates", required=True, help="JSON file of band -> acceptance rate")
    ap.add_argument("--max-bytes", type=int, default=1200 * 1024 * 1024)
    ap.add_argument("--games-per-player", type=int, default=2)
    ap.add_argument("--max-decisions", type=int, default=60)
    ap.add_argument("--nodes", type=int, default=60000)
    ap.add_argument("--binary", default=_BINARY)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--limit-sides", type=int, default=0, help="pilot only")
    ap.add_argument("--skip-account-check", action="store_true",
                    help="implementation smoke tests only; never for a scored period")
    args = ap.parse_args()

    month, day = PERIODS[args.period]
    base_seconds, increment = parse_time_control(args.time_control)
    rates = json.load(open(args.rates))
    os.makedirs(args.out, exist_ok=True)

    sampler = Sampler(args.time_control, rates, args.games_per_player)
    tally: dict = {}
    started = time.time()
    for headers, movetext in stream_games(
        month, day, args.max_bytes,
        progress=lambda n: sys.stderr.write(f"  streamed {n:,} games in the window\n"),
        tally=tally,
    ):
        sampler.offer(headers, movetext)
    sides = sampler.finalise()

    # R10: drop sides whose account Lichess has since closed, before any engine work is spent.
    account_lookup_date = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    status = {}
    account_exclusions = {"closed_or_tos": 0, "unknown_to_endpoint": 0}
    if not args.skip_account_check and sides:
        status = account_status.lookup([s["username"] for s in sides])
        kept = []
        for side in sides:
            if account_status.excluded(status, side["username"]):
                account_exclusions["closed_or_tos"] += 1
                sampler.excluded["account closed or tosViolation at the lookup date"] += 1
                continue
            if side["username"].lower() not in status:
                account_exclusions["unknown_to_endpoint"] += 1
            kept.append(side)
        sides = kept
    for side in sides:
        side.pop("username", None)  # the plaintext never leaves this process

    if args.limit_sides:
        sides = sides[: args.limit_sides]
    stream = tally.get("stream")
    ingest_seconds = time.time() - started
    sys.stderr.write(
        f"window {day}: {sampler.games_seen:,} games, {len(sides):,} sampled sides, "
        f"{ingest_seconds:.0f}s, {stream.bytes_read/1e6:.0f} MB compressed\n"
    )

    jobs = [(s, base_seconds, increment, args.max_decisions, args.period) for s in sides]
    rows: list[dict] = []
    counts: dict[str, int] = {}
    scored_started = time.time()
    with mp.Pool(args.workers, initializer=_init_worker, initargs=(args.binary, args.nodes)) as pool:
        for i, (side_rows, side_counts) in enumerate(pool.imap_unordered(_score_side, jobs, chunksize=4), 1):
            rows.extend(side_rows)
            for key, value in side_counts.items():
                counts[key] = counts.get(key, 0) + value
            if i % 200 == 0:
                elapsed = time.time() - scored_started
                sys.stderr.write(
                    f"  scored {i:,}/{len(jobs):,} sides, {len(rows):,} decisions, "
                    f"{len(rows)/max(elapsed,1e-9):.1f} dec/s\n"
                )

    rows.sort(key=lambda r: (r["player"], r["game_id"], r["ply"]))
    path = os.path.join(args.out, "decisions.jsonl.zst")
    cctx = zstandard.ZstdCompressor(level=10)
    with open(path, "wb") as fh, cctx.stream_writer(fh) as writer:
        for row in rows:
            writer.write((json.dumps(row, sort_keys=True) + "\n").encode())

    manifest = {
        "period": args.period,
        "month": month,
        "window_utc_date": day,
        "time_control": args.time_control,
        "source_url": f"https://database.lichess.org/standard/lichess_db_standard_rated_{month}.pgn.zst",
        "prefix_bytes_consumed": stream.bytes_read,
        "prefix_sha256": stream.digest.hexdigest(),
        "max_bytes_requested": args.max_bytes,
        "seed": 20260901,
        "account_status_lookup_date": account_lookup_date,
        "account_status_checked": not args.skip_account_check,
        "account_exclusions": account_exclusions,
        "acceptance_rates": rates,
        "games_per_player_cap": args.games_per_player,
        "max_decisions_per_side": args.max_decisions,
        "engine": {"binary": os.path.basename(args.binary), "nodes": args.nodes,
                   "multipv": MULTIPV, "threads": 1, "hash_mb": 32,
                   "clear_hash_between_positions": True},
        "games_in_window": sampler.games_seen,
        "candidate_sides_by_band": dict(sampler.seen_candidates),
        "game_exclusions": dict(sampler.excluded),
        "decision_exclusions": counts,
        "sampled_sides": len(sides),
        "players": len({r["player"] for r in rows}),
        "games": len({r["game_id"] for r in rows}),
        "decisions": len(rows),
        "decisions_by_band": {b: sum(1 for r in rows if r["rating_band"] == b)
                              for b in sorted({r["rating_band"] for r in rows})},
        "players_by_band": {b: len({r["player"] for r in rows if r["rating_band"] == b})
                            for b in sorted({r["rating_band"] for r in rows})},
        "ingest_seconds": round(ingest_seconds, 1),
        "scoring_seconds": round(time.time() - scored_started, 1),
    }
    json.dump(manifest, open(os.path.join(args.out, "manifest.json"), "w"), indent=1)
    sys.stderr.write(json.dumps({k: manifest[k] for k in
                                 ("decisions", "players", "games", "scoring_seconds")}) + "\n")


if __name__ == "__main__":
    main()
