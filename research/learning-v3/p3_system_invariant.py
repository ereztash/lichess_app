#!/usr/bin/env python3
"""Execute the frozen P3 system-invariant transfer experiment.

Protocol authority: docs/learning-v3/SYSTEM_INVARIANT_P3_PREREG.md
This script performs no engine searches and reads only committed learning-v3 corpus artifacts.
"""
from __future__ import annotations

import collections
import io
import json
import sys
from pathlib import Path

import chess
import numpy as np
import pandas as pd
import zstandard
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str((ROOT / "measurement").resolve()))
import rule_classes as rc  # noqa: E402

CORPUS = ROOT / "learning-v3" / "corpus"
CLASSES = ("RC-07", "RC-08", "RC-09")
SEED = 20260902
BOOTSTRAPS = 5000
EPS = 0.01
VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0,
}

BASE = ["v_star", "n_legal_pre", "material_balance_pre", "piece_count_pre"]
LOCAL = [
    "moving_piece_type",
    "capture_flag",
    "captured_piece_value",
    "promotion_piece_type",
    "from_file",
    "from_rank",
    "to_file",
    "to_rank",
    "chebyshev_distance",
    "manhattan_distance",
    "gives_check",
    "focal_piece_moved",
]
SYSTEM_BASE_NAMES = [
    "own_attack_edges",
    "own_support_edges",
    "opp_attack_edges",
    "opp_support_edges",
    "own_attacked_piece_count",
    "opp_attacked_piece_count",
    "own_hanging_piece_count",
    "opp_hanging_piece_count",
    "own_hanging_value",
    "opp_hanging_value",
    "own_overloaded_piece_count",
    "opp_overloaded_piece_count",
    "own_redundantly_defended_count",
    "opp_redundantly_defended_count",
    "own_min_defenders_on_attacked",
    "opp_min_defenders_on_attacked",
    "own_max_defense_dependency",
    "opp_max_defense_dependency",
    "own_pinned_count",
    "opp_pinned_count",
    "own_king_ring_enemy_attacks",
    "opp_king_ring_enemy_attacks",
    "own_king_ring_own_defenses",
    "opp_king_ring_own_defenses",
]
SYSTEM = [f"post_{n}" for n in SYSTEM_BASE_NAMES] + [f"delta_{n}" for n in SYSTEM_BASE_NAMES]
SPECS = {
    "M0_position": BASE,
    "M1_local": BASE + LOCAL,
    "M2_system": BASE + LOCAL + SYSTEM,
}


def stream_zst(name: str):
    with open(CORPUS / name, "rb") as fh:
        reader = zstandard.ZstdDecompressor().stream_reader(fh)
        for line in io.TextIOWrapper(reader, encoding="utf-8"):
            yield json.loads(line)


def focal_square(board: chess.Board, rid: str):
    # Frozen scope RC-07/08/09 uses the designated-threat family.
    hit = rc._designated_threat(board)
    return None if hit is None else hit[0]


def piece_squares(board: chess.Board, color: chess.Color, include_king=True):
    for sq, piece in board.piece_map().items():
        if piece.color == color and (include_king or piece.piece_type != chess.KING):
            yield sq, piece


def attack_edges(board: chess.Board, source_color: chess.Color, target_color: chess.Color) -> int:
    target_occ = board.occupied_co[target_color]
    total = 0
    for sq, _ in piece_squares(board, source_color):
        total += chess.popcount(board.attacks_mask(sq) & target_occ)
    return total


def side_piece_metrics(board: chess.Board, color: chess.Color):
    enemy = not color
    attacked_count = 0
    hanging_count = 0
    hanging_value = 0
    overloaded_count = 0
    redundant_count = 0
    attacked_defenders = []

    for sq, piece in piece_squares(board, color, include_king=False):
        attackers = len(board.attackers(enemy, sq))
        defenders = len(board.attackers(color, sq))
        if attackers > 0:
            attacked_count += 1
            attacked_defenders.append(defenders)
            if defenders == 0:
                hanging_count += 1
                hanging_value += VALUES[piece.piece_type]
            if attackers > defenders:
                overloaded_count += 1
        if defenders >= 2:
            redundant_count += 1

    # Maximum number of own occupied squares defended by a single own non-king piece.
    own_occ = board.occupied_co[color]
    max_dependency = 0
    for sq, _ in piece_squares(board, color, include_king=False):
        defended = chess.popcount(board.attacks_mask(sq) & own_occ)
        max_dependency = max(max_dependency, defended)

    pinned_count = sum(
        1 for sq, _ in piece_squares(board, color, include_king=False) if board.is_pinned(color, sq)
    )

    king_sq = board.king(color)
    if king_sq is None:
        ring_enemy_attacks = 0
        ring_own_defenses = 0
    else:
        ring = chess.BB_KING_ATTACKS[king_sq]
        ring_enemy_attacks = 0
        ring_own_defenses = 0
        for sq in chess.scan_reversed(ring):
            if board.is_attacked_by(enemy, sq):
                ring_enemy_attacks += 1
            ring_own_defenses += len(board.attackers(color, sq))

    return {
        "attacked_piece_count": attacked_count,
        "hanging_piece_count": hanging_count,
        "hanging_value": hanging_value,
        "overloaded_piece_count": overloaded_count,
        "redundantly_defended_count": redundant_count,
        "min_defenders_on_attacked": min(attacked_defenders) if attacked_defenders else 0,
        "max_defense_dependency": max_dependency,
        "pinned_count": pinned_count,
        "king_ring_enemy_attacks": ring_enemy_attacks,
        "king_ring_own_defenses": ring_own_defenses,
    }


def system_state(board: chess.Board, actor: chess.Color):
    opp = not actor
    own = side_piece_metrics(board, actor)
    other = side_piece_metrics(board, opp)
    out = {
        "own_attack_edges": attack_edges(board, actor, opp),
        "own_support_edges": attack_edges(board, actor, actor),
        "opp_attack_edges": attack_edges(board, opp, actor),
        "opp_support_edges": attack_edges(board, opp, opp),
    }
    for name in (
        "attacked_piece_count",
        "hanging_piece_count",
        "hanging_value",
        "overloaded_piece_count",
        "redundantly_defended_count",
        "min_defenders_on_attacked",
        "max_defense_dependency",
        "pinned_count",
        "king_ring_enemy_attacks",
        "king_ring_own_defenses",
    ):
        out[f"own_{name}"] = own[name]
        out[f"opp_{name}"] = other[name]
    assert set(out) == set(SYSTEM_BASE_NAMES), (set(out) ^ set(SYSTEM_BASE_NAMES))
    return out


def captured_value(board: chess.Board, move: chess.Move) -> int:
    if not board.is_capture(move):
        return 0
    if board.is_en_passant(move):
        return 1
    piece = board.piece_at(move.to_square)
    return 0 if piece is None else VALUES[piece.piece_type]


def build_rows():
    preferred = {}
    for it in stream_zst("item_bank.jsonl.zst"):
        if it.get("twin_of") or it.get("sham_of"):
            continue
        if it.get("trigger_state") != "positive" or it.get("rule_class") not in CLASSES:
            continue
        key = (it["rule_class"], it["position_id"])
        if key not in preferred or it.get("run_id") == "sf171-full-corpus":
            preferred[key] = it

    move_eval = collections.defaultdict(dict)
    for e in stream_zst("engine_evaluations.jsonl.zst"):
        if e.get("kind") != "move" or e.get("policy") != "multipv-over-B" or e.get("xs") is None:
            continue
        uci = (e.get("moves") or [None])[0]
        if uci:
            move_eval[e["position_id"]][uci] = float(e["xs"])

    rows = []
    missing = 0
    eligible_items = collections.Counter()
    seen = set()

    for it in preferred.values():
        if it.get("v_star_xs") is None:
            continue
        rid = it["rule_class"]
        board = chess.Board(it["fen"])
        q0 = focal_square(board, rid)
        if q0 is None:
            continue

        available = []
        for move in rc.BY_ID[rid].satisfying_moves(board, rc.EMPTY_CONTEXT):
            xs = move_eval.get(it["position_id"], {}).get(move.uci())
            if xs is None:
                missing += 1
            else:
                available.append((move, xs))
        if len(available) < 2:
            continue

        eligible_items[rid] += 1
        actor = board.turn
        pre_sys = system_state(board, actor)

        for move, xs in available:
            dedupe = (it["position_id"], move.uci())
            if dedupe in seen:
                continue
            seen.add(dedupe)

            moving_piece = board.piece_at(move.from_square)
            if moving_piece is None:
                raise RuntimeError(f"no moving piece for {move.uci()} in {it['position_id']}")
            gives_check = int(board.gives_check(move))
            cap_value = captured_value(board, move)
            from_file = chess.square_file(move.from_square)
            from_rank = chess.square_rank(move.from_square)
            to_file = chess.square_file(move.to_square)
            to_rank = chess.square_rank(move.to_square)

            b2 = board.copy(stack=False)
            b2.push(move)
            post_sys = system_state(b2, actor)

            row = {
                "position_id": it["position_id"],
                "rule_class": rid,
                "move": move.uci(),
                "regret": float(it["v_star_xs"]) - float(xs),
                "v_star": float(it["v_star_xs"]),
                "n_legal_pre": float(it.get("n_legal") or len(list(board.legal_moves))),
                "material_balance_pre": it.get("material_balance"),
                "piece_count_pre": it.get("piece_count"),
                "moving_piece_type": moving_piece.piece_type,
                "capture_flag": int(board.is_capture(move)),
                "captured_piece_value": cap_value,
                "promotion_piece_type": move.promotion or 0,
                "from_file": from_file,
                "from_rank": from_rank,
                "to_file": to_file,
                "to_rank": to_rank,
                "chebyshev_distance": max(abs(to_file - from_file), abs(to_rank - from_rank)),
                "manhattan_distance": abs(to_file - from_file) + abs(to_rank - from_rank),
                "gives_check": gives_check,
                "focal_piece_moved": int(move.from_square == q0),
            }
            for name in SYSTEM_BASE_NAMES:
                row[f"post_{name}"] = post_sys[name]
                row[f"delta_{name}"] = post_sys[name] - pre_sys[name]
            rows.append(row)

    return pd.DataFrame(rows), eligible_items, missing


def make_model(cols):
    pre = ColumnTransformer(
        [("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), cols)],
        remainder="drop",
    )
    return Pipeline([("pre", pre), ("ridge", Ridge(alpha=1.0))])


def loco_predict(df: pd.DataFrame):
    preds = {name: np.full(len(df), np.nan) for name in SPECS}
    y = df["regret"].to_numpy(float)
    cls = df["rule_class"].to_numpy()
    for held in CLASSES:
        train = np.where(cls != held)[0]
        test = np.where(cls == held)[0]
        if not len(train) or not len(test):
            raise RuntimeError(f"empty LOCO fold for {held}")
        for name, cols in SPECS.items():
            m = make_model(cols)
            m.fit(df.iloc[train], y[train])
            preds[name][test] = m.predict(df.iloc[test])
    for name, p in preds.items():
        if np.isnan(p).any():
            raise RuntimeError(f"missing predictions in {name}")
    return y, preds


def pair_stats(df, y, pred, class_filter=None):
    by = collections.defaultdict(list)
    for i, row in df.iterrows():
        if class_filter is None or row["rule_class"] in class_filter:
            by[row["position_id"]].append(i)
    per_position = []
    for pid, ids in by.items():
        correct = 0.0
        total = 0
        for a in range(len(ids)):
            for b in range(a + 1, len(ids)):
                i, j = ids[a], ids[b]
                delta_true = y[i] - y[j]
                if abs(delta_true) < EPS:
                    continue
                delta_pred = pred[i] - pred[j]
                total += 1
                if abs(delta_pred) < 1e-12:
                    correct += 0.5
                elif (delta_true > 0) == (delta_pred > 0):
                    correct += 1.0
        if total:
            per_position.append((pid, correct, total))
    c = sum(x[1] for x in per_position)
    n = sum(x[2] for x in per_position)
    return {
        "accuracy": c / n if n else None,
        "pairs": int(n),
        "positions": len(per_position),
        "by_position": per_position,
    }


def bootstrap_diff(a, b, rng, reps=BOOTSTRAPS):
    amap = {p: (c, n) for p, c, n in a["by_position"]}
    bmap = {p: (c, n) for p, c, n in b["by_position"]}
    ids = np.array(sorted(set(amap) & set(bmap)))
    if len(ids) == 0:
        return [None, None]
    vals = np.empty(reps, dtype=float)
    for r in range(reps):
        sample = rng.choice(ids, size=len(ids), replace=True)
        ca = na = cb = nb = 0.0
        for pid in sample:
            c, n = amap[pid]
            ca += c
            na += n
            c, n = bmap[pid]
            cb += c
            nb += n
        vals[r] = ca / na - cb / nb
    lo, hi = np.quantile(vals, [0.025, 0.975])
    return [float(lo), float(hi)]


def clean(stat):
    return {k: v for k, v in stat.items() if k != "by_position"}


def evaluate_block(df, y, preds, class_filter, rng):
    stats = {name: pair_stats(df, y, pred, class_filter) for name, pred in preds.items()}
    out = {name: clean(stat) for name, stat in stats.items()}
    for a, b in (("M2_system", "M0_position"), ("M2_system", "M1_local"), ("M1_local", "M0_position")):
        key = f"{a}_minus_{b}"
        out[key] = {
            "gain": out[a]["accuracy"] - out[b]["accuracy"],
            "ci95_cluster_position": bootstrap_diff(stats[a], stats[b], rng),
        }
    return out


def main():
    df, eligible_items, missing = build_rows()
    if df.empty:
        raise SystemExit("P3 INVALID: no rows")
    if df.duplicated(["position_id", "move"]).any():
        raise SystemExit("P3 INVALID: duplicate (position_id, move)")

    y, preds = loco_predict(df)
    rng = np.random.default_rng(SEED)
    overall = evaluate_block(df, y, preds, set(CLASSES), rng)
    per_class = {rid: evaluate_block(df, y, preds, {rid}, rng) for rid in CLASSES}

    diagnostics = {}
    for name, pred in preds.items():
        diagnostics[name] = {
            "mae": float(mean_absolute_error(y, pred)),
            "r2": float(r2_score(y, pred)),
        }

    m2 = overall["M2_system"]["accuracy"]
    ci21 = overall["M2_system_minus_M1_local"]["ci95_cluster_position"]
    ci20 = overall["M2_system_minus_M0_position"]["ci95_cluster_position"]
    all_classes_above_chance = all(per_class[r]["M2_system"]["accuracy"] > 0.5 for r in CLASSES)
    class_specific_wins = sum(
        per_class[r]["M2_system_minus_M1_local"]["ci95_cluster_position"][0] > 0 for r in CLASSES
    )

    if m2 > 0.5 and ci21[0] > 0 and ci20[0] > 0 and all_classes_above_chance and class_specific_wins >= 2:
        verdict = "P3-PASS"
        authority = "transferable system invariant supported"
    elif ci21[0] > 0:
        verdict = "P3-PARTIAL"
        authority = "system signal without transferable invariant"
    else:
        verdict = "P3-FAIL"
        authority = "transferable system invariant not supported"

    result = {
        "test": "P3-CROSS-RULE-SYSTEM-INVARIANT-TRANSFER",
        "protocol": "docs/learning-v3/SYSTEM_INVARIANT_P3_PREREG.md",
        "engine_searches_run": 0,
        "seed": SEED,
        "bootstrap_replicates": BOOTSTRAPS,
        "pair_regret_epsilon": EPS,
        "classes": list(CLASSES),
        "eligible_item_counts": dict(eligible_items),
        "n_rows_moves": int(len(df)),
        "n_unique_positions": int(df["position_id"].nunique()),
        "missing_move_evaluations": int(missing),
        "duplicate_position_move_rows": int(df.duplicated(["position_id", "move"]).sum()),
        "transfer": "leave-one-rule-class-out; no rule_class feature",
        "overall": overall,
        "per_held_out_class": per_class,
        "secondary_diagnostics": diagnostics,
        "decision_inputs": {
            "m2_pooled_accuracy_gt_0_5": bool(m2 > 0.5),
            "m2_minus_m1_pooled_ci_lower_gt_0": bool(ci21[0] > 0),
            "m2_minus_m0_pooled_ci_lower_gt_0": bool(ci20[0] > 0),
            "m2_all_three_classes_gt_0_5": bool(all_classes_above_chance),
            "classes_with_m2_minus_m1_ci_lower_gt_0": int(class_specific_wins),
        },
        "verdict": verdict,
        "authority": authority,
        "does_not_establish": [
            "causality",
            "human recognizability",
            "homeostasis",
            "controllability",
            "superiority to Stockfish",
            "selection among all legal moves",
        ],
    }
    print("===P3_RESULT_BEGIN===")
    print(json.dumps(result, indent=2, sort_keys=True))
    print("===P3_RESULT_END===")


if __name__ == "__main__":
    main()
