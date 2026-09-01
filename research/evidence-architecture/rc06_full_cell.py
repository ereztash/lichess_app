"""
THE T- PRESCRIPTION SIZE ON THE WHOLE CELL, SO THERE IS NO SAMPLING ERROR TO ARGUE ABOUT.

Two sampled estimates of "share of T- items where EVERY legal move satisfies the rule as stated"
disagreed by 1.9 points -- .922 from one draw of 2,000, .941 from another. Both are correct
samples; neither is the number. The cell is 80,332 items and the predicate needs no engine, so the
exact value is computable and is what the documents should carry.
"""
import json, sys, time
from pathlib import Path
import chess
sys.path.insert(0, "measurement")
from rule_classes import _opponent_has_mate_in_one, _threat_satisfies, Context

def sym(b, m):
    b.push(m)
    try: return not _opponent_has_mate_in_one(b)
    finally: b.pop()

out = {}
for state in ("positive", "negative"):
    n = full_sym = full_br = empty_sym = 0
    ssym = sbr = 0.0
    t0 = time.time()
    for line in open("rc.jsonl"):
        r = json.loads(line)
        if r["rule_class"] != "RC-06" or r["in_check"] or r["trigger_state"] != state:
            continue
        b = chess.Board(r["fen"])
        ctx = Context(prev_move=chess.Move.from_uci(r["prev_move"]) if r.get("prev_move") else None,
                      prev_was_capture=bool(r.get("prev_was_capture", 0)))
        legal = list(b.legal_moves)
        if not legal: continue
        k = sum(1 for m in legal if sym(b, m))
        j = sum(1 for m in legal if _threat_satisfies(b, m, ctx))
        n += 1; ssym += k/len(legal); sbr += j/len(legal)
        full_sym += k == len(legal); full_br += j == len(legal); empty_sym += k == 0
    out[state] = {"n": n,
                  "prescription_size_as_stated": ssym/n,
                  "prescription_size_shipped": sbr/n,
                  "every_legal_move_satisfies_as_stated": full_sym/n,
                  "every_legal_move_satisfies_shipped": full_br/n,
                  "no_legal_move_satisfies_as_stated": empty_sym/n,
                  "seconds": round(time.time()-t0, 1)}
    print(state, json.dumps(out[state]), flush=True)
Path("evidence-architecture/rc06_full_cell.json").write_text(json.dumps(
    {"version":"1.0.0","what":"the whole RC-06 cell, no sampling","cells":out}, indent=2)+"\n")
