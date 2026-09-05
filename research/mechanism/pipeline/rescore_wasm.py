"""
Engine-artifact control: re-score chosen decisions with the SHIPPED engine (Stockfish 18 Lite WASM,
depth 12, hash cleared per position, via scripts/sf-wasm.sh), exactly the product's regime.

Input: a CSV/parquet with columns game_id, ply; the scored jsonl parts for FENs.
Output: jsonl rows {game_id, ply, wasm_eval_before_stm, wasm_eval_after_stm, wasm_cp_loss,
wasm_wp_loss, wasm_accurate} computed from single-PV searches of the position before and after
the move, like the import pipeline (eval curve, mover-relative, max(0, before - after)).
"""
from __future__ import annotations
import argparse, glob, json, math, os, sys
import chess, chess.engine
sys.path.insert(0, os.path.dirname(__file__))
from features import comparable_cp, win_probability_loss, ACCURATE_WIN_PROBABILITY_LOSS, MATE_SCORE

REPO = "/home/user/lichess_app"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", required=True, help="parquet with game_id, ply")
    ap.add_argument("--scored", default="scored")
    ap.add_argument("--out", required=True)
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
    eng = chess.engine.SimpleEngine.popen_uci(["sh", os.path.join(REPO, "scripts/sf-wasm.sh")], cwd=REPO, timeout=180)
    eng.configure({"Threads": 1, "Hash": 16})
    lim = chess.engine.Limit(depth=12)
    out = open(a.out, "a"); n = 0
    def stm_cp(board):
        if board.is_checkmate():
            return -MATE_SCORE
        if board.is_stalemate() or board.is_insufficient_material():
            return 0
        info = eng.analyse(board, lim, game=object())
        s = info["score"].relative
        return comparable_cp(None if s.is_mate() else s.score(), s.mate() if s.is_mate() else None)
    for f in sorted(glob.glob(os.path.join(a.scored, "*.jsonl"))):
        for line in open(f):
            rec = json.loads(line)
            if rec["id"] not in want:
                continue
            plies = rec["plies"]
            for p in plies:
                if p["ply"] not in want[rec["id"]] or (rec["id"], p["ply"]) in done:
                    continue
                b = chess.Board(p["fen"])
                before = stm_cp(b)
                b2 = b.copy(); b2.push(chess.Move.from_uci(p["uci"]))
                after_opp = stm_cp(b2)  # from the opponent's perspective
                after = -after_opp
                cl = max(0, before - after)
                wl = win_probability_loss(before, cl)
                out.write(json.dumps({"game_id": rec["id"], "ply": p["ply"], "wasm_before": before, "wasm_after": after,
                                      "wasm_cp_loss": cl, "wasm_wp_loss": wl, "wasm_accurate": int(wl <= ACCURATE_WIN_PROBABILITY_LOSS)}) + "\n")
                out.flush(); n += 1
                if n % 200 == 0:
                    sys.stderr.write(f"worker {a.worker}: {n} decisions\n")
    eng.quit(); out.close()
    sys.stderr.write(f"worker {a.worker} done: {n}\n")


if __name__ == "__main__":
    main()
