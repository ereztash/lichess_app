"""
Deeper re-evaluation control (Node G, engine-evaluation artifact).

For chosen decisions (game_id, ply), re-evaluate the position BEFORE and AFTER the move at a deeper
fixed depth (default 20) with Stockfish 17.1 native, MultiPV 1, hash cleared per position, and
recompute cpLoss / win-probability loss / accurate. A region whose excess error is an artifact of
depth-12 evaluation noise shrinks here; a real one keeps its sign and most of its size.

Usage: reeval_deep.py --targets targets.parquet --scored scored --out deep.jsonl --depth 20 --worker K --workers N
"""
from __future__ import annotations
import argparse, glob, json, os, sys, time
import chess, chess.engine
sys.path.insert(0, os.path.dirname(__file__))
from features import comparable_cp, win_probability_loss, ACCURATE_WIN_PROBABILITY_LOSS, MATE_SCORE

SF = os.environ.get("SF_BIN", "/tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad/bin/stockfish/stockfish-ubuntu-x86-64-avx2")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", required=True)
    ap.add_argument("--scored", default="scored")
    ap.add_argument("--out", required=True)
    ap.add_argument("--depth", type=int, default=20)
    ap.add_argument("--worker", type=int, default=0)
    ap.add_argument("--workers", type=int, default=1)
    a = ap.parse_args()
    import pandas as pd
    tg = pd.read_parquet(a.targets)[["game_id", "ply"]].drop_duplicates()
    want = {}
    for i, (g, p) in enumerate(zip(tg.game_id, tg.ply)):
        if i % a.workers == a.worker:
            want.setdefault(g, set()).add(int(p))
    done = set()
    if os.path.exists(a.out):
        for line in open(a.out):
            try:
                r = json.loads(line); done.add((r["game_id"], r["ply"]))
            except Exception:
                pass
    eng = chess.engine.SimpleEngine.popen_uci(SF, timeout=180)
    eng.configure({"Threads": 1, "Hash": 64})
    lim = chess.engine.Limit(depth=a.depth)
    def stm_cp(board):
        if board.is_checkmate():
            return -MATE_SCORE, None
        if board.is_stalemate() or board.is_insufficient_material():
            return 0, None
        info = eng.analyse(board, lim, game=object())
        s = info["score"].relative
        return comparable_cp(None if s.is_mate() else s.score(), s.mate() if s.is_mate() else None), info.get("nodes")
    out = open(a.out, "a"); n = 0; t0 = time.time()
    for f in sorted(glob.glob(os.path.join(a.scored, "*.jsonl"))):
        for line in open(f):
            if '"id": "' not in line[:40]:
                pass
            rec = json.loads(line)
            if rec["id"] not in want:
                continue
            for p in rec["plies"]:
                if p["ply"] not in want[rec["id"]] or (rec["id"], p["ply"]) in done:
                    continue
                b = chess.Board(p["fen"])
                before, nb = stm_cp(b)
                b2 = b.copy(); b2.push(chess.Move.from_uci(p["uci"]))
                after_opp, na = stm_cp(b2)
                after = -after_opp
                cl = max(0, before - after); wl = win_probability_loss(before, cl)
                out.write(json.dumps({"game_id": rec["id"], "ply": p["ply"], "depth": a.depth, "deep_before": before, "deep_after": after,
                                      "deep_cp_loss": cl, "deep_wp_loss": wl, "deep_accurate": int(wl <= ACCURATE_WIN_PROBABILITY_LOSS),
                                      "nodes_before": nb, "nodes_after": na}) + "\n")
                out.flush(); n += 1
                if n % 50 == 0:
                    sys.stderr.write(f"worker {a.worker}: {n} decisions, {(time.time()-t0)/n:.2f} s/decision\n")
    eng.quit(); out.close()
    sys.stderr.write(f"worker {a.worker} done: {n} in {(time.time()-t0)/60:.1f} min\n")


if __name__ == "__main__":
    main()
