"""
R** mechanism decomposition: where did the under-defended liability come from?

This is a descriptive/falsification probe over the already-frozen R** finding. It does NOT change
R**, the field intervention, product thresholds, or detector semantics.

For every eligible decision we reconstruct the current mover's under-defended pieces from preserved
pre-move FENs and classify each current liability by its history:

  OPPONENT_CREATED      - not under-defended before the opponent's immediately preceding move;
                          that opponent move created the current liability.
  SELF_CREATED_PREVIOUS - already under-defended before the opponent moved, but not before the
                          mover's own previous move; the mover's previous move created it.
  PERSISTENT            - already under-defended before the mover's previous move as well.
  MIXED                 - multiple current under-defended pieces have different provenances.
  UNKNOWN               - insufficient preceding plies to classify safely.
  NONE                  - no current under-defended piece.

The current move is analysed separately. CURRENT_MOVE_UNRESOLVED means an already-present current
liability is still under-defended after the move (tracking a moved piece to its destination). This is
post-move description and is never used as a pre-move trigger.

Primary question:
  Does the owner's R** population-residual hung-material contrast concentrate in one provenance
  family, and does adding provenance to the population model materially reduce that residual?

The original population model is reproduced first. An augmented population model adds only the
pre-move provenance_profile categorical feature. Both are fit on the same population decisions;
the owner VALIDATE window is never used for fitting.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from collections import Counter
from pathlib import Path

import chess
import numpy as np
import pandas as pd
import zstandard as zstd

HERE = Path(__file__).resolve().parent
PIPE = HERE.parent / "pipeline"
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(PIPE))

from common import (  # noqa: E402
    chronological_split,
    clustered_rate_se,
    eligible,
    load_decisions,
    within_game_contrast,
)
from search import fit_population_model, population_feature_columns  # noqa: E402
import vocab  # noqa: E402

RSTARSTAR = "material_balance in [0,3) AND own_overloaded_piece_count>=1"
TARGET = "cls_hung_material"
SEED = 20260905


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--owner", required=True)
    p.add_argument("--population", required=True)
    p.add_argument("--owner-scored", required=True)
    p.add_argument("--population-scored", required=True)
    p.add_argument("--out", required=True)
    return p.parse_args()


def iter_zst_jsonl(path: str):
    with open(path, "rb") as raw:
        with zstd.ZstdDecompressor().stream_reader(raw) as reader:
            text = io.TextIOWrapper(reader, encoding="utf-8")
            for line in text:
                if line.strip():
                    yield json.loads(line)


def is_overloaded(board: chess.Board, sq: chess.Square, color: chess.Color) -> bool:
    piece = board.piece_at(sq)
    if piece is None or piece.color != color or piece.piece_type == chess.KING:
        return False
    attackers = len(board.attackers(not color, sq))
    defenders = len(board.attackers(color, sq))
    return attackers > 0 and attackers > defenders


def overloaded_squares(board: chess.Board, color: chess.Color) -> list[chess.Square]:
    return [sq for sq, piece in board.piece_map().items()
            if piece.color == color and piece.piece_type != chess.KING and is_overloaded(board, sq, color)]


def tracked_square_before_own_move(
    current_sq: chess.Square,
    before_prev_own: chess.Board,
    prev_own_uci: str | None,
    color: chess.Color,
) -> chess.Square | None:
    """Track a current piece one own move backwards.

    The opponent cannot move this piece. If the mover's previous move ended on current_sq, the same
    piece was at that move's from-square before the move. Otherwise it stayed on current_sq.
    """
    if not prev_own_uci:
        return current_sq if before_prev_own.piece_at(current_sq) else None
    try:
        mv = chess.Move.from_uci(prev_own_uci)
    except ValueError:
        return None
    if mv.to_square == current_sq:
        p = before_prev_own.piece_at(mv.from_square)
        if p is not None and p.color == color:
            return mv.from_square
    p = before_prev_own.piece_at(current_sq)
    if p is not None and p.color == color:
        return current_sq
    return None


def piece_provenance(plies: list[dict], i: int, sq: chess.Square, color: chess.Color) -> str:
    if i < 1:
        return "UNKNOWN"
    before_opp = chess.Board(plies[i - 1]["fen"])  # after mover's previous move, before opponent moved
    same = before_opp.piece_at(sq)
    if same is None or same.color != color:
        return "UNKNOWN"
    if not is_overloaded(before_opp, sq, color):
        return "OPPONENT_CREATED"
    if i < 2:
        return "UNKNOWN"
    before_prev_own = chess.Board(plies[i - 2]["fen"])
    prev_sq = tracked_square_before_own_move(sq, before_prev_own, plies[i - 2].get("uci"), color)
    if prev_sq is None:
        return "UNKNOWN"
    return "PERSISTENT" if is_overloaded(before_prev_own, prev_sq, color) else "SELF_CREATED_PREVIOUS"


def actual_last_move_flags(plies: list[dict], i: int) -> tuple[int | None, int | None]:
    if i < 1:
        return None, None
    board = chess.Board(plies[i - 1]["fen"])
    try:
        mv = chess.Move.from_uci(plies[i - 1]["uci"])
    except (ValueError, KeyError):
        return None, None
    if mv not in board.legal_moves:
        return None, None
    return int(board.is_capture(mv)), int(board.gives_check(mv))


def classify_decision(rec: dict, i: int) -> dict:
    plies = rec["plies"]
    p = plies[i]
    board = chess.Board(p["fen"])
    color = board.turn
    current = overloaded_squares(board, color)
    prov = [piece_provenance(plies, i, sq, color) for sq in current]
    non_unknown = sorted(set(x for x in prov if x != "UNKNOWN"))
    if not current:
        profile = "NONE"
    elif not non_unknown:
        profile = "UNKNOWN"
    elif len(non_unknown) == 1 and all(x in (non_unknown[0], "UNKNOWN") for x in prov):
        profile = non_unknown[0]
    else:
        profile = "MIXED"

    # What did the CURRENT move do with liabilities that existed before it?
    try:
        mv = chess.Move.from_uci(p["uci"])
        legal = mv in board.legal_moves
    except (ValueError, KeyError):
        mv = None
        legal = False
    after = board.copy()
    moved_liability = 0
    current_unresolved = 0
    any_after = None
    played_capture = None
    played_check = None
    if legal and mv is not None:
        played_capture = int(board.is_capture(mv))
        played_check = int(board.gives_check(mv))
        after.push(mv)
        for sq in current:
            after_sq = mv.to_square if mv.from_square == sq else sq
            if mv.from_square == sq:
                moved_liability += 1
            if is_overloaded(after, after_sq, color):
                current_unresolved += 1
        any_after = int(bool(overloaded_squares(after, color)))

    opp_cap, opp_check = actual_last_move_flags(plies, i)

    # Engine-best reply at the opponent's next decision: which CURRENT liability would it capture?
    # This mirrors omitted_check.py and is descriptive only.
    reply_captured_prov = None
    if legal and mv is not None and i + 1 < len(plies):
        nxt = plies[i + 1]
        try:
            reply = nxt["lines"][0]["pv"][0] if nxt.get("lines") and nxt["lines"][0].get("pv") else None
            rmv = chess.Move.from_uci(reply) if reply else None
        except (ValueError, KeyError, IndexError):
            rmv = None
        if rmv is not None and rmv in after.legal_moves:
            targets = []
            for sq, pv in zip(current, prov):
                after_sq = mv.to_square if mv.from_square == sq else sq
                if rmv.to_square == after_sq:
                    targets.append(pv)
            if targets:
                reply_captured_prov = targets[0] if len(set(targets)) == 1 else "MIXED"

    c = Counter(prov)
    return {
        "game_id": rec["id"],
        "ply": int(p["ply"]),
        "provenance_profile": profile,
        "prov_opponent_created_n": int(c["OPPONENT_CREATED"]),
        "prov_self_created_previous_n": int(c["SELF_CREATED_PREVIOUS"]),
        "prov_persistent_n": int(c["PERSISTENT"]),
        "prov_unknown_n": int(c["UNKNOWN"]),
        "current_overloaded_n_rebuilt": int(len(current)),
        "current_liability_unresolved_n": int(current_unresolved),
        "current_move_unresolved": int(current_unresolved > 0) if any_after is not None else None,
        "any_overloaded_after": any_after,
        "moved_current_liability_n": int(moved_liability),
        "played_capture_probe": played_capture,
        "played_check_probe": played_check,
        "opponent_last_capture_probe": opp_cap,
        "opponent_last_check_probe": opp_check,
        "reply_captured_provenance": reply_captured_prov,
    }


def reconstruct(scored_path: str, wanted: set[tuple[str, int]]) -> pd.DataFrame:
    rows = []
    seen = set()
    for rec in iter_zst_jsonl(scored_path):
        gid = rec["id"]
        for i, p in enumerate(rec["plies"]):
            key = (gid, int(p["ply"]))
            if key in wanted:
                rows.append(classify_decision(rec, i))
                seen.add(key)
    missing = wanted - seen
    if missing:
        sample = sorted(missing)[:10]
        raise RuntimeError(f"scored stream missing {len(missing)} wanted decision keys; sample={sample}")
    return pd.DataFrame(rows)


def add_probe(df: pd.DataFrame, feats: pd.DataFrame) -> pd.DataFrame:
    out = df.merge(feats, on=["game_id", "ply"], how="left", validate="one_to_one")
    if out["provenance_profile"].isna().any():
        raise RuntimeError("provenance merge produced missing rows")
    return out


def fit_augmented_population(pop: pd.DataFrame, target: str):
    """Same model family/hyperparameters as search.fit_population_model, plus one pre-move category."""
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import roc_auc_score
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder

    num, cat = population_feature_columns()
    num = [c for c in num if c in pop.columns and pop[c].nunique(dropna=True) > 1]
    cat = [c for c in cat if c in pop.columns]
    if "provenance_profile" not in cat:
        cat = cat + ["provenance_profile"]
    pop = pop.copy()
    for c in num:
        pop[c] = pd.to_numeric(pop[c], errors="coerce").astype(float)
    cols = num + cat
    pre = ColumnTransformer(
        [("num", "passthrough", num), ("cat", OneHotEncoder(handle_unknown="ignore"), cat)],
        sparse_threshold=0,
    )
    model = Pipeline([
        ("pre", pre),
        ("gb", HistGradientBoostingClassifier(
            max_iter=400,
            learning_rate=0.05,
            max_leaf_nodes=31,
            min_samples_leaf=60,
            l2_regularization=1.0,
            random_state=SEED,
        )),
    ])
    games = np.array(list(pop.game_id.unique()), dtype=object)
    rng = np.random.default_rng(SEED)
    rng.shuffle(games)
    fold = {g: i % 5 for i, g in enumerate(games)}
    f = pop.game_id.map(fold).values
    aucs = []
    for k in range(5):
        tr = pop[f != k]
        ho = pop[f == k]
        model.fit(tr[cols], tr[target])
        if ho[target].nunique() > 1:
            aucs.append(roc_auc_score(ho[target], model.predict_proba(ho[cols])[:, 1]))
    model.fit(pop[cols], pop[target])
    return model, float(np.mean(aucs)), cols


def predict(model, cols: list[str], frame: pd.DataFrame) -> np.ndarray:
    X = frame[cols].copy()
    # The original model's last four columns are categorical, but do not rely on positional magic.
    cat = {"phase", "standing", "color", "ply_bin", "provenance_profile"}
    for c in cols:
        if c not in cat:
            X[c] = pd.to_numeric(X[c], errors="coerce").astype(float)
    return model.predict_proba(X)[:, 1]


def rstarstar_mask(df: pd.DataFrame) -> np.ndarray:
    return ((df["material_balance"] >= 0) & (df["material_balance"] < 3) &
            (df["own_overloaded_piece_count"] >= 1)).to_numpy(bool)


def mean_clustered(df: pd.DataFrame, col: str) -> dict:
    if len(df) == 0:
        return {"n": 0, "mean": None, "se": None, "z": None, "games": 0}
    mean, se = clustered_rate_se(df[col].to_numpy(float), df["game_id"].to_numpy())
    return {
        "n": int(len(df)),
        "games": int(df.game_id.nunique()),
        "mean": float(mean),
        "se": float(se),
        "z": float(mean / se) if se and np.isfinite(se) and se > 0 else None,
    }


def profile_summary(df: pd.DataFrame, residual_cols: list[str]) -> dict:
    out = {}
    for name, d in df.groupby("provenance_profile", dropna=False):
        row = {
            "n": int(len(d)),
            "games": int(d.game_id.nunique()),
            "share": float(len(d) / len(df)) if len(df) else None,
            "hung_material_rate": float(d[TARGET].mean()),
            "tactical_rate": float(d["cls_tactical"].mean()),
            "current_move_unresolved_rate": float(d["current_move_unresolved"].dropna().mean()) if d["current_move_unresolved"].notna().any() else None,
            "any_overloaded_after_rate": float(d["any_overloaded_after"].dropna().mean()) if d["any_overloaded_after"].notna().any() else None,
            "played_forcing_rate": float(((d["played_capture_probe"].fillna(0) == 1) | (d["played_check_probe"].fillna(0) == 1)).mean()),
            "opponent_last_forcing_rate": float(((d["opponent_last_capture_probe"].fillna(0) == 1) | (d["opponent_last_check_probe"].fillna(0) == 1)).mean()),
            "seconds_median": float(d["seconds"].median()),
            "clock_frac_median": float(d["clock_frac"].median()),
        }
        for col in residual_cols:
            row[col] = mean_clustered(d, col)
        out[str(name)] = row
    return out


def action_by_outcome(df: pd.DataFrame) -> dict:
    groups = {
        "hung_material": df[df[TARGET] == 1],
        "tactical": df[df["cls_tactical"] == 1],
        "accurate": df[df["err"] == 0],
    }
    out = {}
    for k, d in groups.items():
        out[k] = {
            "n": int(len(d)),
            "current_move_unresolved_rate": float(d["current_move_unresolved"].dropna().mean()) if d["current_move_unresolved"].notna().any() else None,
            "any_overloaded_after_rate": float(d["any_overloaded_after"].dropna().mean()) if d["any_overloaded_after"].notna().any() else None,
            "played_forcing_rate": float(((d["played_capture_probe"].fillna(0) == 1) | (d["played_check_probe"].fillna(0) == 1)).mean()),
            "seconds_median": float(d["seconds"].median()) if len(d) else None,
        }
    return out


def main():
    a = parse_args()
    design = vocab.DESIGN

    pop = eligible(load_decisions(a.population, corpus=None))
    pop = pop[pop["corpus"] != "erez281"].reset_index(drop=True)
    owner_all = chronological_split(
        eligible(load_decisions(a.owner)), design["derive_frac"], design["validate_frac"]
    )
    owner = owner_all[owner_all["split"] == "VALIDATE"].reset_index(drop=True)

    pop_wanted = set(zip(pop.game_id.astype(str), pop.ply.astype(int)))
    owner_wanted = set(zip(owner.game_id.astype(str), owner.ply.astype(int)))
    pop_probe = reconstruct(a.population_scored, pop_wanted)
    owner_probe = reconstruct(a.owner_scored, owner_wanted)
    pop = add_probe(pop, pop_probe)
    owner = add_probe(owner, owner_probe)

    # Sanity: rebuilt current count should agree exactly with the committed decision feature.
    pop_agree = float((pop.current_overloaded_n_rebuilt == pop.own_overloaded_piece_count).mean())
    owner_agree = float((owner.current_overloaded_n_rebuilt == owner.own_overloaded_piece_count).mean())
    if pop_agree < 0.999 or owner_agree < 0.999:
        raise RuntimeError(f"overload rebuild mismatch: population={pop_agree:.6f}, owner={owner_agree:.6f}")

    # Original population model, unchanged.
    base_model, base_auc, base_cols = fit_population_model(pop, TARGET, seed=SEED)
    # New challenger: same model + provenance profile.
    aug_model, aug_auc, aug_cols = fit_augmented_population(pop, TARGET)

    owner = owner.copy()
    owner["base_hat"] = predict(base_model, base_cols, owner)
    owner["base_resid"] = owner[TARGET] - owner["base_hat"]
    owner["aug_hat"] = predict(aug_model, aug_cols, owner)
    owner["aug_resid"] = owner[TARGET] - owner["aug_hat"]

    rmask_owner = rstarstar_mask(owner)
    rmask_pop = rstarstar_mask(pop)
    ro = owner[rmask_owner].copy()
    rp = pop[rmask_pop].copy()

    # Reproduce the mission's population-residual within-game R** contrast, then ask what provenance buys.
    base_wg = within_game_contrast(owner, rmask_owner, "base_resid")
    aug_wg = within_game_contrast(owner, rmask_owner, "aug_resid")
    reduction = None
    if np.isfinite(base_wg["est"]) and abs(base_wg["est"]) > 1e-12 and np.isfinite(aug_wg["est"]):
        reduction = float(1 - aug_wg["est"] / base_wg["est"])

    # Contribution of each provenance profile to the owner's positive R** residual under augmented model.
    contributions = {}
    total_n = len(ro)
    for name, d in ro.groupby("provenance_profile"):
        contributions[str(name)] = {
            "n": int(len(d)),
            "aug_resid_sum_per_rstarstar_decision": float(d["aug_resid"].sum() / total_n) if total_n else None,
            "base_resid_sum_per_rstarstar_decision": float(d["base_resid"].sum() / total_n) if total_n else None,
        }

    captured = ro.loc[ro[TARGET] == 1, "reply_captured_provenance"].dropna().value_counts().to_dict()

    out = {
        "status": "EXECUTED_RETROSPECTIVE_MECHANISM_DECOMPOSITION",
        "claim_boundary": {
            "permits": "pre-move liability provenance and post-move action signatures",
            "forbids": ["attention failure", "tunnel vision", "calculation depth", "rush", "causal intervention effect"],
        },
        "design": {
            "target": TARGET,
            "owner_frame": "VALIDATE only",
            "region": RSTARSTAR,
            "population_model": "same HistGradientBoosting family and features as v1.8",
            "challenger": "add pre-move provenance_profile only",
            "seed": SEED,
        },
        "integrity": {
            "population_decisions": int(len(pop)),
            "owner_validate_decisions": int(len(owner)),
            "overload_rebuild_agreement_population": pop_agree,
            "overload_rebuild_agreement_owner": owner_agree,
            "base_population_cv_auc": float(base_auc),
            "augmented_population_cv_auc": float(aug_auc),
        },
        "rstarstar": {
            "owner_n": int(len(ro)),
            "population_n": int(len(rp)),
            "owner_hung_material_rate": float(ro[TARGET].mean()),
            "population_hung_material_rate": float(rp[TARGET].mean()),
            "base_population_residual_within_game": base_wg,
            "augmented_population_residual_within_game": aug_wg,
            "provenance_explained_fraction_of_base_contrast": reduction,
        },
        "owner_profiles": profile_summary(ro, ["base_resid", "aug_resid"]),
        "population_profiles": profile_summary(rp, []),
        "owner_action_signature_by_outcome": action_by_outcome(ro),
        "owner_hung_material_engine_reply_captured_provenance": captured,
        "owner_augmented_residual_contribution": contributions,
    }

    Path(a.out).write_text(json.dumps(out, indent=2, default=float) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=2, default=float))


if __name__ == "__main__":
    main()
