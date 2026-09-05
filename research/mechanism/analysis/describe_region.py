"""
Describe a frozen region on a frame (default DERIVE, so nothing here touches VALIDATE/TEST until
the candidate is frozen): context mix, error-class mix inside vs outside, and example decisions from
materially different contexts (different colour, opening family, phase, clock state).

Error classes (post-move, descriptive only): what the engine's best move was versus what was played.
"""
from __future__ import annotations
import argparse, json, sys
import numpy as np
import pandas as pd
import pysubgroup as ps
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from common import load_decisions, eligible, chronological_split
from invariance import CONTEXTS
import vocab

PIECE = {0: "-", 1: "P", 2: "N", 3: "B", 4: "R", 5: "Q", 6: "K"}


def move_class(row):
    b = "capture" if row["best_capture"] == 1 else ("check" if row["best_check"] == 1 else "quiet")
    p = "capture" if row["y_played_capture"] == 1 else ("check" if row["y_played_check"] == 1 else "quiet")
    return f"best={b}/played={p}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", default="decisions.parquet")
    ap.add_argument("--region", required=True)
    ap.add_argument("--frame", default="DERIVE")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    d = vocab.DESIGN
    df = chronological_split(eligible(load_decisions(a.decisions)), d["derive_frac"], d["validate_frac"])
    fr = df[df.split == a.frame].reset_index(drop=True)
    sg = ps.Conjunction.from_str(a.region)
    inside = np.asarray(sg.covers(fr), bool)
    R = fr[inside]; O = fr[~inside]
    out = {"region": a.region, "frame": a.frame, "n_in": int(len(R)), "n_out": int(len(O)), "games_in": int(R.game_id.nunique()),
           "err_in": float(R.err.mean()), "err_out": float(O.err.mean()), "blunder10_in": float(R.blunder10.mean()), "blunder10_out": float(O.blunder10.mean()),
           "wp_loss_in": float(R.y_wp_loss.mean()), "wp_loss_out": float(O.y_wp_loss.mean()),
           "share_of_frame": float(inside.mean()), "opportunities_per_game": float(len(R) / fr.game_id.nunique())}
    out["context_mix"] = {}
    for name, fn in CONTEXTS.items():
        s_in = pd.Series(np.asarray(fn(R))).value_counts(normalize=True).round(3).to_dict()
        s_all = pd.Series(np.asarray(fn(fr))).value_counts(normalize=True).round(3).to_dict()
        out["context_mix"][name] = {"inside": s_in, "frame": s_all}
    # error classes among ERRORS inside vs outside
    Re = R[R.err == 1]; Oe = O[O.err == 1]
    out["error_class_inside"] = Re.apply(move_class, axis=1).value_counts(normalize=True).round(3).to_dict()
    out["error_class_outside"] = Oe.apply(move_class, axis=1).value_counts(normalize=True).round(3).to_dict()
    out["played_piece_inside_errors"] = Re.y_played_piece.map(PIECE).value_counts(normalize=True).round(3).to_dict()
    out["best_piece_inside_errors"] = Re.best_piece.map(PIECE).value_counts(normalize=True).round(3).to_dict()
    out["played_in_top3_inside"] = float(R.y_played_in_top3.mean()); out["played_in_top3_outside"] = float(O.y_played_in_top3.mean())
    out["seconds_median_inside"] = float(R.seconds.median()); out["seconds_median_outside"] = float(O.seconds.median())
    # examples: errors inside the region from materially different contexts
    ex = Re[Re.y_wp_loss >= 0.10].copy()
    ex["ctx"] = list(zip(ex.color, ex.eco_family, ex.phase, np.where(ex.clock_own_ms < 60000, "lowclock", "clock_ok")))
    picks = []
    seen = set()
    for _, r in ex.sort_values("y_wp_loss", ascending=False).iterrows():
        key = (r.color, r.eco_family, r.phase)
        if key in seen:
            continue
        seen.add(key)
        picks.append({"game": f"https://lichess.org/{r.game_id}#{int(r.ply)}", "color": r.color, "eco": r.eco, "opening": r.opening_name,
                      "phase": r.phase, "ply": int(r.ply), "fen": r.fen, "played": r.y_played_uci, "best_pv": None, "wp_loss": round(float(r.y_wp_loss), 3),
                      "seconds": float(r.seconds), "clock_own_s": float(r.clock_own_ms / 1000), "standing": r.standing, "material_balance": int(r.material_balance)})
        if len(picks) >= 8:
            break
    out["examples"] = picks
    json.dump(out, open(a.out, "w"), indent=1, default=str)
    print(json.dumps({k: v for k, v in out.items() if k not in ("examples", "context_mix")}, indent=1, default=str))
    for k, v in out["context_mix"].items():
        print(k, "inside:", v["inside"])
    for p in picks:
        print(p["game"], p["color"], p["eco"], p["phase"], "wp_loss", p["wp_loss"], "played", p["played"], "sec", p["seconds"])


if __name__ == "__main__":
    main()
