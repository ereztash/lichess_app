#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("p3_system_invariant", HERE / "p3_system_invariant.py")
p3 = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(p3)

EPS = 0.01


def summarize(df, value_col, prefer_higher: bool):
    groups = defaultdict(list)
    for i, r in df.iterrows():
        groups[r["position_id"]].append((i, r))
    out = {k: {"correct": 0, "n": 0} for k in ("all", "both_noncapture", "any_capture")}
    for rows in groups.values():
        for a in range(len(rows)):
            for b in range(a + 1, len(rows)):
                _, ra = rows[a]; _, rb = rows[b]
                dreg = float(ra["regret"]) - float(rb["regret"])
                if abs(dreg) < EPS:
                    continue
                va, vb = float(ra[value_col]), float(rb[value_col])
                if va == vb:
                    continue
                better_is_a = dreg < 0
                heuristic_a = va > vb if prefer_higher else va < vb
                correct = int(better_is_a == heuristic_a)
                bucket = "both_noncapture" if int(ra["capture_flag"]) == 0 and int(rb["capture_flag"]) == 0 else "any_capture"
                for k in ("all", bucket):
                    out[k]["correct"] += correct
                    out[k]["n"] += 1
    for k, v in out.items():
        v["accuracy"] = v["correct"] / v["n"] if v["n"] else None
    return out


def main():
    df, _, _ = p3.build_rows()
    result = {
        "status": "EXPLORATORY_DIAGNOSTIC_DOES_NOT_CHANGE_FROZEN_VERDICT",
        "opponent_pressure_post_higher_is_better": summarize(df, "post_opp_overloaded_piece_count", True),
        "opponent_pressure_delta_higher_is_better": summarize(df, "delta_opp_overloaded_piece_count", True),
        "own_exposure_post_lower_is_better": summarize(df, "post_own_overloaded_piece_count", False),
        "own_exposure_delta_lower_is_better": summarize(df, "delta_own_overloaded_piece_count", False),
    }
    print("===PE_DIAGNOSTIC_BEGIN===")
    print(json.dumps(result, indent=2, sort_keys=True))
    print("===PE_DIAGNOSTIC_END===")


if __name__ == "__main__":
    main()
