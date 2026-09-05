"""
Pre-move THREAT measure (Node F-lite representation): what happens if the player passes.

Missing quantity stated first: the OBS vocabulary carries static attack/defence counts but no
measure of the opponent's dynamic threat (the tactic they are about to execute). The classic
decision-process step "what does the opponent threaten?" has no feature. A null-move search gives
it exactly: evaluate the SAME position with the opponent to move.

    threat_wp = wp(eval_before, mover) - wp(-eval_nullmove_opp)      # loss from passing, 0..1
    threat_kind = the opponent's best move after the pass (capture / check / quiet, SEE of a capture)

Engine: Stockfish 17.1 native, depth 12, MultiPV 1, hash cleared per position. Only the player's
eligible decisions are searched. Positions where the player is in check have no null move; the
threat is then "in check" and threat_wp is null.

Usage: threat.py --decisions decisions_v2.parquet --scored scored --out threat.jsonl --worker K --workers N
"""
from __future__ import annotations
import argparse, glob, json, os, sys, time
import chess, chess.engine
sys.path.insert(0, os.path.dirname(__file__))
from features import comparable_cp, win_probability, see_capture_gain, move_kind, VALUES

SF = os.environ.get("SF_BIN", "/tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad/bin/stockfish/stockfish-ubuntu-x86-64-avx2")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", required=True)
    ap.add_argument("--scored", default="scored")
    ap.add_argument("--out", required=True)
    ap.add_argument("--worker", type=int, default=0)
    ap.add_argument("--workers", type=int, default=1)
    a = ap.parse_args()
    import pandas as pd
    d = pd.read_parquet(a.decisions, columns=["game_id", "ply", "forced", "book", "eval_before_cp"])
    d = d[(d.forced == 0) & (d.book == 0)]
    want = {}
    for i, (g, p, e) in enumerate(zip(d.game_id, d.ply, d.eval_before_cp)):
        if i % a.workers == a.worker:
            want.setdefault(g, {})[int(p)] = int(e)
    done = set()
    if os.path.exists(a.out):
        for line in open(a.out):
            try:
                r = json.loads(line); done.add((r["game_id"], r["ply"]))
            except Exception:
                pass
    eng = chess.engine.SimpleEngine.popen_uci(SF, timeout=180)
    eng.configure({"Threads": 1, "Hash": 16})
    lim = chess.engine.Limit(depth=12)
    out = open(a.out, "a"); n = 0; t0 = time.time()
    for f in sorted(glob.glob(os.path.join(a.scored, "*.jsonl"))):
        for line in open(f):
            rec = json.loads(line)
            if rec["id"] not in want:
                continue
            for p in rec["plies"]:
                if p["ply"] not in want[rec["id"]] or (rec["id"], p["ply"]) in done:
                    continue
                b = chess.Board(p["fen"])
                eval_before = want[rec["id"]][p["ply"]]
                row = {"game_id": rec["id"], "ply": p["ply"]}
                if b.is_check():
                    row.update({"threat_wp": None, "threat_cp": None, "threat_kind": "in_check", "threat_see": None, "threat_move": None})
                else:
                    nb = b.copy(); nb.push(chess.Move.null())
                    info = eng.analyse(nb, lim, game=object())
                    s = info["score"].relative
                    opp_cp = comparable_cp(None if s.is_mate() else s.score(), s.mate() if s.is_mate() else None)
                    mover_after_pass = -opp_cp
                    tw = max(0.0, win_probability(eval_before) - win_probability(mover_after_pass))
                    pv = info.get("pv", [])
                    tm = pv[0] if pv else None
                    if tm is not None and tm in nb.legal_moves:
                        mk = move_kind(nb, tm)
                        kind = "capture" if mk["capture"] else ("check" if mk["check"] else "quiet")
                        tsee = see_capture_gain(nb, tm) if mk["capture"] else 0
                        row.update({"threat_wp": tw, "threat_cp": eval_before - mover_after_pass, "threat_kind": kind, "threat_see": tsee,
                                    "threat_move": tm.uci(), "threat_mate": int(s.is_mate() and s.mate() > 0)})
                    else:
                        row.update({"threat_wp": tw, "threat_cp": eval_before - mover_after_pass, "threat_kind": "none", "threat_see": 0, "threat_move": None, "threat_mate": 0})
                out.write(json.dumps(row) + "\n"); out.flush(); n += 1
                if n % 500 == 0:
                    sys.stderr.write(f"worker {a.worker}: {n} decisions, {(time.time()-t0)/n:.3f} s each\n")
    eng.quit(); out.close()
    sys.stderr.write(f"worker {a.worker} done: {n} in {(time.time()-t0)/60:.1f} min\n")


if __name__ == "__main__":
    main()
