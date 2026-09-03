#!/usr/bin/env python3
"""Score the natural decision sample with Stockfish, and preserve every value bought.

Protocol authority: docs/system-invariant/RESEARCH_QUESTION_FREEZE.md sections 4.3 and 4.4.

TWO SEARCHES PER DECISION, AND SIX ANSWERS OUT OF THEM. The pre-move search at `MultiPV 8` supplies
the position-difficulty controls (`wp1`, `edge`, `gap12`, `gap1k`, `n_near`, `ambiguity_entropy`,
`is_mate_line`) AND the within-position candidate set that Test B, the functional-invariance test
and the opportunity-density measurement all read. The post-move search supplies `wp1_after`, hence
`quality_loss`. Nothing here is bought twice.

HOW THE PRESERVED CORPUS IS SHAPED, AND WHY IT IS NOT ONE ROW PER EVALUATION. Written per
evaluation this would be 45,296 x 9 rows, each repeating a 70-character FEN, for a file large enough
that committing it would be its own argument. Written per decision the FEN appears once and the
candidate list rides with it. The standing rule is that no future run may repeat a search that
already exists, and that rule needs the value to be FINDABLE, not to be stored one-per-line:
`lookup_move` below computes `cache.key_for` over the stored rows and answers the same question.

THE SEARCH POLICY IS NEW, SO NOTHING HERE COLLIDES WITH THE PRESERVED LEARNING-V3 CORPUS. That
corpus is `multipv-over-B` and `full-width` at 200,000 nodes; these are `multipv-8-full-width` and
`post-move-best` at 60,000. Different nodes and different policy are different measurements and get
different keys, which is exactly what `cache.key_for` exists to keep apart.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import multiprocessing as mp
import os
import sys
import time
from pathlib import Path

import chess
import chess.engine
import zstandard

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research" / "b3_population_expertise" / "src"))
import common  # noqa: E402  (B3's win_probability and comparable_cp, ported nowhere)

_spec = importlib.util.spec_from_file_location(
    "lv3_cache", ROOT / "research" / "learning-v3" / "cache.py")
_cache = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_cache)
key_for = _cache.key_for

BUILD = "Stockfish 17.1"
NODES = 60000
MULTIPV = 8
PRE_POLICY = "multipv-8-full-width"
POST_POLICY = "post-move-best"
HASH_MB = 32
THREADS = 1

#: what 30 cp costs at a level position; the repository's own derived constant
ACCURATE_WIN_PROBABILITY_LOSS = 0.02761
TAU = ACCURATE_WIN_PROBABILITY_LOSS

_ENGINE = None


def engine_for(path: str) -> chess.engine.SimpleEngine:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = chess.engine.SimpleEngine.popen_uci(path)
        _ENGINE.configure({"Threads": THREADS, "Hash": HASH_MB})
    return _ENGINE


def wp_of(score: chess.engine.PovScore, pov: chess.Color) -> float:
    """Win probability for `pov`, through B3's own conversion rather than a second one."""
    s = score.pov(pov)
    if s.is_mate():
        return common.win_probability(common.comparable_cp("mate", s.mate()))
    return common.win_probability(common.comparable_cp("cp", s.score()))


def analyse(eng, board: chess.Board, multipv: int):
    """One search with the hash cleared first.

    python-chess emits `ucinewgame` whenever the `game` object differs from the previous call, so a
    fresh object per search is the documented way to get B3's mandatory hash reset. Without it,
    results depend on what the engine looked at last, which is the same defect this repository's
    import harness was built to catch.
    """
    return eng.analyse(board, chess.engine.Limit(nodes=NODES), multipv=multipv, game=object())


def score_one(row: dict, eng) -> dict | None:
    board = chess.Board(row["fen_before"])
    actor = board.turn
    move = chess.Move.from_uci(row["move_uci"])
    if move not in board.legal_moves:
        return {"skip": "illegal move in record", **{k: row[k] for k in ("game_id", "ply")}}

    infos = analyse(eng, board, MULTIPV)
    if isinstance(infos, dict):
        infos = [infos]
    cands = []
    for info in infos:
        pv = info.get("pv")
        if not pv:
            continue
        cands.append({"uci": pv[0].uci(), "wp": wp_of(info["score"], actor)})
    if not cands:
        return {"skip": "no candidate lines", **{k: row[k] for k in ("game_id", "ply")}}

    wps = [c["wp"] for c in cands]
    wp1 = wps[0]
    best_is_mate = infos[0]["score"].pov(actor).is_mate()

    after = board.copy(stack=False)
    after.push(move)
    if after.is_game_over(claim_draw=False):
        # A terminal position has no search. `wp1_after` is the mover's realised result, read from
        # the board rather than invented: mate delivered is a win, stalemate and the material draws
        # are a half. Recorded so these decisions are identifiable and can be excluded.
        outcome = after.outcome(claim_draw=False)
        mover_wp = 1.0 if outcome.winner == actor else (0.5 if outcome.winner is None else 0.0)
        wp1_after = 1.0 - mover_wp
        terminal = True
    else:
        post = analyse(eng, after, 1)
        if isinstance(post, list):
            post = post[0]
        wp1_after = wp_of(post["score"], after.turn)
        terminal = False

    quality_loss = max(0.0, wp1 - (1.0 - wp1_after))
    softmax_d = [math.exp((w - wp1) / TAU) for w in wps]
    total = sum(softmax_d)
    entropy = -sum((p / total) * math.log(p / total) for p in softmax_d if p > 0)

    return {
        "player": row["player"], "game_id": row["game_id"], "side": row["side"],
        "ply": row["ply"], "fen_before": row["fen_before"], "move_uci": row["move_uci"],
        "candidates": cands,
        "wp1": wp1,
        "edge": abs(wp1 - 0.5),
        "gap12": (wps[0] - wps[1]) if len(wps) > 1 else None,
        "gap1k": (wps[0] - wps[-1]) if len(wps) > 1 else None,
        "n_near": sum(1 for w in wps if wp1 - w <= ACCURATE_WIN_PROBABILITY_LOSS),
        "n_candidates": len(wps),
        "ambiguity_entropy": entropy,
        "is_mate_line": bool(best_is_mate),
        "wp1_after": wp1_after,
        "quality_loss": quality_loss,
        "post_terminal": terminal,
    }


def worker(chunk_path: str) -> str:
    eng = engine_for(os.environ["SF_PATH"])
    out_path = chunk_path + ".scored"
    n = 0
    with open(chunk_path) as fin, open(out_path, "w") as fout:
        for line in fin:
            rec = score_one(json.loads(line), eng)
            if rec is not None:
                fout.write(json.dumps(rec, sort_keys=True) + "\n")
                n += 1
    return f"{out_path}\t{n}"


def lookup_move(fen: str, uci: str, corpus_rows) -> float | None:
    """Answer the standing rule's question over the per-decision rows.

    Returns the preserved win probability for (fen, uci) under this mission's pre-move policy, or
    None. The key is `cache.key_for`'s, so a future run asking the same question the same way finds
    the same answer and does not buy the search again.
    """
    want = key_for(fen, [uci], BUILD, str(NODES), PRE_POLICY, root=None)
    for row in corpus_rows:
        for c in row.get("candidates", ()):
            if key_for(row["fen_before"], [c["uci"]], BUILD, str(NODES), PRE_POLICY,
                       root=None) == want:
                return c["wp"]
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--sf", default="/tmp/sf/stockfish/stockfish-ubuntu-x86-64-avx2")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    os.environ["SF_PATH"] = args.sf

    rows = [json.loads(l) for l in open(args.decisions)]
    if args.limit:
        rows = rows[: args.limit]

    tmp = Path(args.out).parent / "chunks"
    tmp.mkdir(parents=True, exist_ok=True)
    chunks = []
    per = math.ceil(len(rows) / args.workers)
    for i in range(args.workers):
        part = rows[i * per : (i + 1) * per]
        if not part:
            continue
        p = tmp / f"chunk{i}.jsonl"
        with open(p, "w") as fh:
            for r in part:
                fh.write(json.dumps(r, sort_keys=True) + "\n")
        chunks.append(str(p))

    t0 = time.time()
    with mp.Pool(len(chunks)) as pool:
        results = pool.map(worker, chunks)
    dt = time.time() - t0

    scored = []
    for line in results:
        path, _ = line.split("\t")
        with open(path) as fh:
            scored.extend(json.loads(l) for l in fh)

    kept = [r for r in scored if "skip" not in r]
    skipped = [r for r in scored if "skip" in r]

    cctx = zstandard.ZstdCompressor(level=10)
    with open(args.out, "wb") as fh, cctx.stream_writer(fh) as w:
        for r in sorted(kept, key=lambda r: (r["game_id"], r["ply"])):
            w.write((json.dumps(r, sort_keys=True) + "\n").encode())

    searches = sum(1 for r in kept) + sum(1 for r in kept if not r["post_terminal"])
    summary = {
        "protocol": "docs/system-invariant/RESEARCH_QUESTION_FREEZE.md",
        "engine": {"build": BUILD, "nodes": NODES, "multipv_pre": MULTIPV, "multipv_post": 1,
                   "threads": THREADS, "hash_mb": HASH_MB,
                   "hash_cleared_between_searches": True,
                   "pre_policy": PRE_POLICY, "post_policy": POST_POLICY},
        "decisions_in": len(rows),
        "decisions_scored": len(kept),
        "decisions_skipped": len(skipped),
        "skip_reasons": {s["skip"]: sum(1 for x in skipped if x["skip"] == s["skip"])
                         for s in skipped},
        "terminal_after_move": sum(1 for r in kept if r["post_terminal"]),
        "engine_searches_run": searches,
        "wall_seconds": round(dt, 1),
        "searches_per_second": round(searches / dt, 1) if dt else None,
        "out": args.out,
        "out_bytes": os.path.getsize(args.out),
    }
    print("===SCORE_SUMMARY_BEGIN===")
    print(json.dumps(summary, indent=2, sort_keys=True))
    print("===SCORE_SUMMARY_END===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
