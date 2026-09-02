#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import itertools
import json
import os
import random
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
P3_PATH = HERE / "p3_system_invariant.py"
spec = importlib.util.spec_from_file_location("p3_system_invariant", P3_PATH)
p3 = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(p3)

SEED = 20260902
CLASSES = ("RC-07", "RC-08", "RC-09")
TARGET_COUNTS = {
    "baseline": {"RC-07": 3, "RC-08": 3, "RC-09": 2},
    "teaching": {"RC-07": 1, "RC-08": 1, "RC-09": 2},
    "test": {"RC-07": 3, "RC-08": 2, "RC-09": 3},
}
CONTROL_COUNTS = {
    "baseline": {"RC-07": 2, "RC-08": 1, "RC-09": 1},
    "test": {"RC-07": 1, "RC-08": 2, "RC-09": 1},
}
REGRET_GAP_MIN = 0.10


def stable_system_feature(df):
    y = df["regret"].to_numpy(float)
    cls = df["rule_class"].to_numpy()
    coef_by_feature = defaultdict(list)

    for held in CLASSES:
        train = np.where(cls != held)[0]
        model = p3.make_model(p3.SPECS["M2_system"])
        model.fit(df.iloc[train], y[train])
        coefs = model.named_steps["ridge"].coef_
        cols = p3.SPECS["M2_system"]
        assert len(coefs) == len(cols)
        cmap = dict(zip(cols, coefs))
        for f in p3.SYSTEM:
            coef_by_feature[f].append(float(cmap[f]))

    eligible = []
    for feature in p3.SYSTEM:
        vals = coef_by_feature[feature]
        signs = [1 if x > 0 else -1 if x < 0 else 0 for x in vals]
        if 0 in signs or len(set(signs)) != 1:
            continue
        med_abs = float(np.median(np.abs(vals)))
        eligible.append((med_abs, feature, signs[0], vals))

    if not eligible:
        raise SystemExit("P4 STOP: no SYSTEM feature has stable non-zero sign in 3/3 LOCO folds")

    eligible.sort(key=lambda x: (-x[0], x[1]))
    med_abs, feature, sign, vals = eligible[0]
    return {
        "feature": feature,
        "direction": "lower_is_better" if sign > 0 else "higher_is_better",
        "coefficients": vals,
        "median_abs_standardized_coefficient": med_abs,
        "eligible_stable_feature_count": len(eligible),
    }


def load_fens():
    preferred = {}
    for it in p3.stream_zst("item_bank.jsonl.zst"):
        if it.get("twin_of") or it.get("sham_of"):
            continue
        if it.get("trigger_state") != "positive" or it.get("rule_class") not in CLASSES:
            continue
        key = (it["rule_class"], it["position_id"])
        if key not in preferred or it.get("run_id") == "sf171-full-corpus":
            preferred[key] = it
    return {it["position_id"]: it["fen"] for it in preferred.values()}


def choose_pair_candidates(df, feature_meta):
    direction = feature_meta["direction"]
    targets = defaultdict(list)
    controls = defaultdict(list)

    for pid, g in df.groupby("position_id", sort=True):
        rid = str(g.iloc[0]["rule_class"])
        candidates_t = []
        candidates_c = []
        rows = list(g.to_dict("records"))
        for a, b in itertools.combinations(rows, 2):
            gap = abs(float(a["regret"]) - float(b["regret"]))
            if gap < REGRET_GAP_MIN:
                continue
            better, worse = (a, b) if a["regret"] < b["regret"] else (b, a)
            fv_better = float(better[feature_meta["feature"]])
            fv_worse = float(worse[feature_meta["feature"]])
            if fv_better == fv_worse:
                candidates_c.append((gap, better, worse))
                continue
            aligned = (fv_better < fv_worse) if direction == "lower_is_better" else (fv_better > fv_worse)
            if aligned:
                candidates_t.append((gap, better, worse))

        def best(cands):
            if not cands:
                return None
            cands.sort(key=lambda x: (-x[0], tuple(sorted((x[1]["move"], x[2]["move"])))))
            return cands[0]

        t = best(candidates_t)
        c = best(candidates_c)
        if t:
            targets[rid].append(t)
        if c:
            controls[rid].append(c)

    return targets, controls


def allocate(source, phase_counts, used_positions, rng):
    out = []
    for rid in CLASSES:
        pool = [x for x in source[rid] if x[1]["position_id"] not in used_positions]
        pool = sorted(pool, key=lambda x: (x[1]["position_id"], x[1]["move"], x[2]["move"]))
        rng.shuffle(pool)
        need = phase_counts.get(rid, 0)
        if len(pool) < need:
            raise SystemExit(f"P4 STOP: insufficient eligible items for {rid}: need {need}, have {len(pool)}")
        picked = pool[:need]
        for _, better, _ in picked:
            used_positions.add(better["position_id"])
        out.extend(picked)
    rng.shuffle(out)
    return out


def item_record(kind, triple, fen_map, feature_meta, rng):
    gap, better, worse = triple
    options = [better["move"], worse["move"]]
    rng.shuffle(options)
    values = {better["move"]: float(better[feature_meta["feature"]]), worse["move"]: float(worse[feature_meta["feature"]])}
    regrets = {better["move"]: float(better["regret"]), worse["move"]: float(worse["regret"])}
    return {
        "kind": kind,
        "position_id": better["position_id"],
        "rule_class": better["rule_class"],
        "fen": fen_map[better["position_id"]],
        "side_to_move": "white" if fen_map[better["position_id"]].split()[1] == "w" else "black",
        "options": options,
        "correct_move": better["move"],
        "regret_gap": float(gap),
        "feature": feature_meta["feature"],
        "feature_values": values,
        "regrets": regrets,
    }


def cue_text(feature_meta):
    feature = feature_meta["feature"]
    direction = feature_meta["direction"]
    base = feature
    temporal = "אחרי המהלך" if feature.startswith("post_") else "בשינוי שהמהלך יוצר"
    base = base.removeprefix("post_").removeprefix("delta_")
    labels = {
        "own_attack_edges": "מספר קשרי התקיפה שלך על כלי היריב",
        "own_support_edges": "מספר קשרי התמיכה בין הכלים שלך",
        "opp_attack_edges": "מספר קשרי התקיפה של היריב על הכלים שלך",
        "opp_support_edges": "מספר קשרי התמיכה בין כלי היריב",
        "own_attacked_piece_count": "מספר הכלים שלך שנשארים תחת התקפה",
        "opp_attacked_piece_count": "מספר כלי היריב שנמצאים תחת התקפה",
        "own_hanging_piece_count": "מספר הכלים שלך שנשארים מותקפים בלי הגנה",
        "opp_hanging_piece_count": "מספר כלי היריב שנשארים מותקפים בלי הגנה",
        "own_hanging_value": "הערך הכולל של הכלים שלך שנשארים מותקפים בלי הגנה",
        "opp_hanging_value": "הערך הכולל של כלי היריב שנשארים מותקפים בלי הגנה",
        "own_overloaded_piece_count": "מספר הכלים שלך שעליהם יותר תוקפים ממגינים",
        "opp_overloaded_piece_count": "מספר כלי היריב שעליהם יותר תוקפים ממגינים",
        "own_redundantly_defended_count": "מספר הכלים שלך עם לפחות שני מגינים",
        "opp_redundantly_defended_count": "מספר כלי היריב עם לפחות שני מגינים",
        "own_min_defenders_on_attacked": "מספר המגינים המינימלי על כלי שלך שנמצא תחת התקפה",
        "opp_min_defenders_on_attacked": "מספר המגינים המינימלי על כלי יריב שנמצא תחת התקפה",
        "own_max_defense_dependency": "התלות המרבית של מערך ההגנה שלך בכלי יחיד",
        "opp_max_defense_dependency": "התלות המרבית של מערך ההגנה של היריב בכלי יחיד",
        "own_pinned_count": "מספר הכלים שלך שמרותקים",
        "opp_pinned_count": "מספר כלי היריב שמרותקים",
        "own_king_ring_enemy_attacks": "מספר משבצות טבעת המלך שלך שבשליטת היריב",
        "opp_king_ring_enemy_attacks": "מספר משבצות טבעת מלך היריב שבשליטתך",
        "own_king_ring_own_defenses": "עוצמת ההגנה שלך סביב המלך",
        "opp_king_ring_own_defenses": "עוצמת ההגנה של היריב סביב המלך",
    }
    label = labels.get(base, base)
    verb = "הקטן" if direction == "lower_is_better" else "הגדל"
    return f"אחרי שפתרת את האיום, {verb} את {label} {temporal}."


def public_item(x):
    return {
        "kind": x["kind"],
        "position_id": x["position_id"],
        "fen": x["fen"],
        "side_to_move": x["side_to_move"],
        "options": x["options"],
    }


def main():
    rng = random.Random(SEED)
    df, eligible_items, missing = p3.build_rows()
    if missing:
        raise SystemExit(f"P4 STOP: {missing} preserved move evaluations missing")

    feature_meta = stable_system_feature(df)
    targets, controls = choose_pair_candidates(df, feature_meta)
    target_total = sum(len(v) for v in targets.values())
    control_total = sum(len(v) for v in controls.values())
    if target_total < 20:
        raise SystemExit(f"P4 STOP: only {target_total} eligible TARGET positions")
    specificity_identified = control_total >= 8

    fen_map = load_fens()
    used = set()
    bank = {"baseline": [], "teaching": [], "test": []}
    for phase in ("baseline", "teaching", "test"):
        picked = allocate(targets, TARGET_COUNTS[phase], used, rng)
        bank[phase].extend(item_record("TARGET", x, fen_map, feature_meta, rng) for x in picked)
        if phase in CONTROL_COUNTS and specificity_identified:
            cpicked = allocate(controls, CONTROL_COUNTS[phase], used, rng)
            bank[phase].extend(item_record("CONTROL", x, fen_map, feature_meta, rng) for x in cpicked)
        rng.shuffle(bank[phase])

    payload = {
        "protocol": "docs/learning-v3/HUMAN_CUE_N1_PREREG.md",
        "seed": SEED,
        "engine_searches_run": 0,
        "feature_meta": feature_meta,
        "cue_hebrew": cue_text(feature_meta),
        "eligible_target_positions": {k: len(v) for k, v in targets.items()},
        "eligible_control_positions": {k: len(v) for k, v in controls.items()},
        "specificity_identified": specificity_identified,
        "bank": bank,
    }
    out = HERE / "p4_n1_bank.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    test_digest = hashlib.sha256(json.dumps(bank["test"], sort_keys=True).encode()).hexdigest()

    print("===P4_PREP_BEGIN===")
    print(json.dumps({
        "cue_feature": feature_meta,
        "cue_hebrew": payload["cue_hebrew"],
        "eligible_target_positions": payload["eligible_target_positions"],
        "eligible_control_positions": payload["eligible_control_positions"],
        "specificity_identified": specificity_identified,
        "bank_sha256": digest,
        "hidden_test_sha256": test_digest,
        "baseline_public": [public_item(x) for x in bank["baseline"]],
        "teaching_count": len(bank["teaching"]),
        "test_count": len(bank["test"]),
        "engine_searches_run": 0,
    }, ensure_ascii=False, indent=2, sort_keys=True))
    print("===P4_PREP_END===")


if __name__ == "__main__":
    main()
