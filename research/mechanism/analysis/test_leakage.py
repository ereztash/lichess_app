"""
Leakage test in the B3 style (research/b3_population_expertise/tests/test_leakage.py):

  1. PLAYED-MOVE SWAP: replace the player's played move at one decision by a different legal move
     (and stop the game there); every pre-move column of that decision must be bit-identical.
  2. GAME-SUFFIX REPLACEMENT: truncate the game right after the decision; every pre-move column
     of that decision must be bit-identical (nothing reads later plies).

Post-move columns (prefixed y_) are allowed, and expected, to change.
"""
from __future__ import annotations
import glob, json, sys, copy, random
import chess
sys.path.insert(0, "/tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad/pipeline")
import features as F


def rows_for(rec, sessions):
    return {r["ply"]: r for r in F.extract_game(rec, sessions)}


def main(parts_glob="scored/part00.jsonl", n_games=40, seed=0):
    rng = random.Random(seed)
    recs = []
    for f in sorted(glob.glob(parts_glob)):
        for line in open(f):
            recs.append(json.loads(line))
            if len(recs) >= n_games:
                break
        if len(recs) >= n_games:
            break
    sessions = F.build_sessions(recs)
    checked = 0; bad = []
    for rec in recs:
        base = rows_for(rec, sessions)
        own = [p for p in rec["plies"] if (p["stm"] == rec["erez_color"])]
        if len(own) < 6:
            continue
        for p in rng.sample(own[2:], min(3, len(own) - 2)):
            i = p["ply"]
            # 1. swap the played move for another legal move and truncate the game there
            b = chess.Board(p["fen"])
            legal = [m for m in b.legal_moves if m.uci() != p["uci"]]
            if not legal:
                continue
            alt = rng.choice(legal)
            rec2 = copy.deepcopy(rec)
            rec2["plies"] = rec2["plies"][: i + 1]
            rec2["plies"][i]["uci"] = alt.uci(); rec2["plies"][i]["san"] = b.san(alt)
            b2 = b.copy(); b2.push(alt)
            rec2["terminal"] = {"fen": b2.fen(), "stm": "w" if b2.turn else "b", "game_over": b2.is_game_over(), "checkmate": b2.is_checkmate(),
                                "stalemate": b2.is_stalemate(), "insufficient": b2.is_insufficient_material(), "repetition": False, "cp": 0, "mate": None}
            r2 = rows_for(rec2, sessions)[i]
            # 2. suffix replacement only (played move kept, game truncated after it)
            rec3 = copy.deepcopy(rec); rec3["plies"] = rec3["plies"][: i + 1]
            b3 = b.copy(); b3.push(chess.Move.from_uci(p["uci"]))
            rec3["terminal"] = {"fen": b3.fen(), "stm": "w" if b3.turn else "b", "game_over": b3.is_game_over(), "checkmate": b3.is_checkmate(),
                                "stalemate": b3.is_stalemate(), "insufficient": b3.is_insufficient_material(), "repetition": False, "cp": 0, "mate": None}
            r3 = rows_for(rec3, sessions)[i]
            r1 = base[i]
            for k, v in r1.items():
                if k.startswith("y_"):
                    continue
                for tag, r in (("swap", r2), ("suffix", r3)):
                    v2 = r.get(k, "<missing>")
                    same = (v == v2) or (isinstance(v, float) and isinstance(v2, float) and (v != v) and (v2 != v2))
                    if not same:
                        bad.append((rec["id"], i, k, tag, v, v2))
            checked += 1
    print(f"checked {checked} decisions in {len(recs)} games; violations: {len(bad)}")
    for x in bad[:20]:
        print("  LEAK", x)
    return len(bad) == 0


if __name__ == "__main__":
    ok = main(*(sys.argv[1:2] or ["scored/part00.jsonl"]))
    sys.exit(0 if ok else 1)
