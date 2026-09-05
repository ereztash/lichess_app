"""
NODE I: what exactly is omitted inside R*? For tactical errors inside the region on DERIVE:
  * was the piece lost to the reply the overloaded piece itself (the threat was ignored), or another
    piece (the move dealt with one thing and hung another)?
  * did the played move leave the overloaded piece overloaded (unresolved), resolve it, or move it?
  * what did the best move do with the overloaded piece?
Descriptive, DERIVE only; used to phrase the operation, never to select the region.
"""
from __future__ import annotations
import argparse, glob, json, sys, collections
import numpy as np, pandas as pd, chess
sys.path.insert(0, __file__.rsplit("/", 1)[0])
sys.path.insert(0, __file__.rsplit("/", 2)[0] + "/pipeline")
from common import load_decisions, eligible, chronological_split
import vocab
from features import VALUES


def overloaded_squares(board, color):
    out = []
    for sq, p in board.piece_map().items():
        if p.color == color and p.piece_type != chess.KING:
            a = len(board.attackers(not color, sq)); d = len(board.attackers(color, sq))
            if a > 0 and a > d:
                out.append(sq)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", default="decisions_v2.parquet")
    ap.add_argument("--scored", default="scored")
    ap.add_argument("--region", default="material_balance>=-2 AND own_overloaded_piece_count>=1")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    import pysubgroup as ps
    D = vocab.DESIGN
    df = chronological_split(eligible(load_decisions(a.decisions)), D["derive_frac"], D["validate_frac"])
    dv = df[df.split == "DERIVE"]
    sg = ps.Conjunction.from_str(a.region)
    ins = np.asarray(sg.covers(dv), bool)
    R = dv[ins]
    want = {(g, int(p)) for g, p in zip(R.game_id, R.ply)}
    rows = {}
    for f in sorted(glob.glob(a.scored + "/*.jsonl")):
        for line in open(f):
            rec = json.loads(line)
            plies = rec["plies"]
            for i, p in enumerate(plies):
                if (rec["id"], p["ply"]) not in want:
                    continue
                b = chess.Board(p["fen"]); color = b.turn
                ov = overloaded_squares(b, color)
                mv = chess.Move.from_uci(p["uci"])
                after = b.copy(); after.push(mv)
                ov_after = overloaded_squares(after, color)
                reply = plies[i + 1]["lines"][0]["pv"][0] if (i + 1 < len(plies) and plies[i + 1]["lines"] and plies[i + 1]["lines"][0]["pv"]) else None
                reply_mv = chess.Move.from_uci(reply) if reply else None
                reply_target = reply_mv.to_square if reply_mv is not None else None
                best = p["lines"][0]["pv"][0] if p["lines"] and p["lines"][0]["pv"] else None
                best_mv = chess.Move.from_uci(best) if best else None
                moved_overloaded = mv.from_square in ov
                # where did the overloaded piece(s) end up: still overloaded after the move?
                still = [s for s in ov if s in ov_after]
                lost_overloaded = reply_target in ov or (moved_overloaded and reply_target == mv.to_square)
                rows[(rec["id"], p["ply"])] = {
                    "n_overloaded": len(ov), "moved_overloaded": int(moved_overloaded), "still_overloaded_after": int(len(still) > 0),
                    "played_capture": int(b.is_capture(mv)), "played_check": int(b.gives_check(mv)),
                    "best_moves_overloaded": int(best_mv is not None and best_mv.from_square in ov),
                    "best_capture": int(best_mv is not None and b.is_capture(best_mv)),
                    "reply_captures_overloaded": int(bool(lost_overloaded)) if reply_target is not None else None,
                    "reply_is_capture": int(after.is_capture(reply_mv)) if reply_mv is not None and reply_mv in after.legal_moves else None,
                    "overloaded_values": [VALUES[b.piece_at(s).piece_type] for s in ov],
                }
    R = R.copy(); R["key"] = list(zip(R.game_id, R.ply.astype(int)))
    feats = pd.DataFrame([dict(key=k, **v) for k, v in rows.items()])
    M = R.merge(feats, on="key")
    out = {"region": a.region, "n": int(len(M))}
    for label, sub in (("tactical_errors", M[M.cls_tactical == 1]), ("hung_material_errors", M[M.y_error_class == "hung_material"]), ("accurate", M[M.err == 0]), ("all", M)):
        out[label] = {"n": int(len(sub)),
                      "moved_overloaded": float(sub.moved_overloaded.mean()), "still_overloaded_after": float(sub.still_overloaded_after.mean()),
                      "played_capture": float(sub.played_capture.mean()), "best_moves_overloaded": float(sub.best_moves_overloaded.mean()),
                      "best_capture": float(sub.best_capture.mean()),
                      "reply_captures_overloaded": float(sub.reply_captures_overloaded.dropna().mean()) if sub.reply_captures_overloaded.notna().any() else None,
                      "reply_is_capture": float(sub.reply_is_capture.dropna().mean()) if sub.reply_is_capture.notna().any() else None,
                      "max_overloaded_value_mean": float(sub.overloaded_values.map(lambda v: max(v) if v else 0).mean())}
    # conditional: tactical error rate by what the played move did with the overloaded piece
    out["tactical_rate_by_action"] = {
        "moved_it": float(M[M.moved_overloaded == 1].cls_tactical.mean()), "n_moved": int((M.moved_overloaded == 1).sum()),
        "left_it_still_overloaded": float(M[(M.moved_overloaded == 0) & (M.still_overloaded_after == 1)].cls_tactical.mean()), "n_left": int(((M.moved_overloaded == 0) & (M.still_overloaded_after == 1)).sum()),
        "resolved_without_moving": float(M[(M.moved_overloaded == 0) & (M.still_overloaded_after == 0)].cls_tactical.mean()), "n_resolved": int(((M.moved_overloaded == 0) & (M.still_overloaded_after == 0)).sum()),
    }
    out["error_class_inside_region"] = M[M.err == 1].y_error_class.value_counts(normalize=True).round(3).to_dict()
    json.dump(out, open(a.out, "w"), indent=1, default=str)
    print(json.dumps(out, indent=1, default=str))


if __name__ == "__main__":
    main()
