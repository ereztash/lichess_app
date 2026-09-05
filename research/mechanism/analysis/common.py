"""
Shared analysis utilities. Design-independent pieces only:

  * eligibility (the product's own rule: not forced, not book, seconds and clock present),
  * chronological game ordering and split assignment by GAME (never by decision),
  * game-clustered bootstrap,
  * the shuffle null (permute targets WITHIN game, so game structure is untouched),
  * the region judge: error-rate contrast inside vs outside a region with a clustered SE.

Every split ratio, threshold and rule that bears on an outcome is passed in explicitly and must be
frozen in research/mechanism/MISSION_LEDGER.md before the outcome-bearing run.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

ACCURATE_WIN_PROBABILITY_LOSS = None  # filled from features module at import


def _acc_threshold():
    global ACCURATE_WIN_PROBABILITY_LOSS
    if ACCURATE_WIN_PROBABILITY_LOSS is None:
        import math
        k = 0.00368208
        wp = lambda cp: 1 / (1 + math.exp(-k * cp))
        ACCURATE_WIN_PROBABILITY_LOSS = wp(15) - wp(-15)
    return ACCURATE_WIN_PROBABILITY_LOSS


def load_decisions(path: str, corpus: str | None = "erez281") -> pd.DataFrame:
    df = pd.read_parquet(path)
    if corpus is not None and "corpus" in df.columns:
        df = df[df["corpus"] == corpus].copy()
    df["err"] = 1 - df["y_accurate"]
    df["blunder10"] = (df["y_wp_loss"] >= 0.10).astype(int)
    df["blunder20"] = (df["y_wp_loss"] >= 0.20).astype(int)
    # error-class targets (v1.7): one indicator per omitted act; all zero on accurate decisions
    if "y_error_class" in df.columns:
        for cls in ERROR_CLASSES:
            df[f"cls_{cls}"] = ((df["err"] == 1) & (df["y_error_class"] == cls)).astype(int)
        df["cls_tactical"] = ((df["err"] == 1) & df["y_error_class"].isin(["hung_material", "missed_material", "missed_mate", "missed_check", "allowed_check_tactic", "bad_capture"])).astype(int)
    # the product clamps think time at zero (Lichess lag compensation can make a clock rise)
    df["seconds"] = df["seconds"].clip(lower=0)
    df["log_seconds"] = np.log1p(df["seconds"].astype(float))
    df["clock_under_60s"] = (df["clock_own_ms"] < 60000).astype(float)
    # observable history: material change since the player's previous decision (same game, previous own ply)
    df = df.sort_values(["game_id", "ply"])
    prev_mat = df.groupby("game_id")["material_balance"].shift(1)
    prev_ply = df.groupby("game_id")["ply"].shift(1)
    df["material_change_2ply"] = np.where(prev_ply == df["ply"] - 2, df["material_balance"] - prev_mat, np.nan)
    df["own_lost_material"] = (df["material_change_2ply"] < 0).astype(float).where(df["material_change_2ply"].notna())
    df["own_won_material"] = (df["material_change_2ply"] > 0).astype(float).where(df["material_change_2ply"].notna())
    df = df.sort_index()
    df["ply_bin"] = pd.cut(df["ply"], [-1, 20, 40, 60, 80, 1000], labels=["<=20", "21-40", "41-60", "61-80", ">80"]).astype(str)
    # v1.4 ease indicators for the baseline (engine-free)
    df["free_capture"] = (df["n_good_captures"] >= 1).astype(float)
    df["opp_hanging_any"] = (df["opp_hanging_piece_count"] >= 1).astype(float)
    df["recapture_available"] = df["recapture_available"].fillna(0).astype(float)
    return df


def eligible(df: pd.DataFrame) -> pd.DataFrame:
    """The product's eligibility: forced and book positions are not decisions; a decision needs a
    think time and a clock reading (`import-diagnostic.ts`). History features are then recomputed on
    the eligible frame (v1.5) so real and null frames are built identically."""
    m = (df["forced"] == 0) & (df["book"] == 0) & df["seconds"].notna() & df["clock_own_ms"].notna()
    return recompute_history(df[m].copy())


def game_order(df: pd.DataFrame) -> pd.DataFrame:
    """Chronological index per game (0 = oldest)."""
    g = df.groupby("game_id")["createdAt"].first().sort_values()
    order = {gid: i for i, gid in enumerate(g.index)}
    df = df.copy()
    df["game_order"] = df["game_id"].map(order)
    df["n_games"] = len(order)
    return df


def chronological_split(df: pd.DataFrame, derive_frac: float, validate_frac: float) -> pd.DataFrame:
    """Assign DERIVE / VALIDATE / TEST by game order. Frozen fractions must be recorded in the ledger."""
    df = game_order(df)
    n = df["n_games"].iloc[0]
    d_end = int(round(n * derive_frac)); v_end = int(round(n * (derive_frac + validate_frac)))
    df["split"] = np.where(df["game_order"] < d_end, "DERIVE", np.where(df["game_order"] < v_end, "VALIDATE", "TEST"))
    return df


def game_bootstrap_indices(games: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Resample games with replacement; return a game-id array."""
    u = np.unique(games)
    return rng.choice(u, size=len(u), replace=True)


def resample_by_game(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    picked = game_bootstrap_indices(df["game_id"].values, rng)
    parts = [df[df["game_id"] == g] for g in picked]
    return pd.concat(parts, ignore_index=True)


OUTCOME_COLS = ["err", "y_wp_loss", "y_accurate", "blunder10", "blunder20", "y_cp_loss"]
ERROR_CLASSES = ["hung_material", "missed_material", "missed_mate", "missed_check", "allowed_check_tactic", "bad_capture", "quiet_error"]
HISTORY_COLS = ["own_decisions_so_far", "own_errors_so_far", "own_error_rate_so_far", "plies_since_own_error", "own_prev_wp_loss"]


def recompute_history(df: pd.DataFrame) -> pd.DataFrame:
    """v1.5: recompute the label-derived history features from the frame's OWN outcome columns, in
    ply order inside each game. Used identically on the real frame and on every shuffled/planted
    frame, so a history feature always faces a null in which it is a function of independent outcomes.
    Only decisions present in the frame count (eligible decisions), for both real and null."""
    df = df.sort_values(["game_id", "ply"]).copy()
    thr = _acc_threshold()
    g = df.groupby("game_id", sort=False)
    err_prev = g["err"].shift(1)
    df["own_prev_wp_loss"] = g["y_wp_loss"].shift(1)
    df["own_decisions_so_far"] = g.cumcount()
    df["own_errors_so_far"] = g["err"].cumsum() - df["err"]
    df["own_error_rate_so_far"] = (df["own_errors_so_far"] / df["own_decisions_so_far"]).where(df["own_decisions_so_far"] > 0)
    # plies since the player's last error (own decisions only; ply difference)
    last_err_ply = df["ply"].where(df["err"] == 1)
    last_err_ply = g[last_err_ply.name].transform(lambda s: s.shift(1).ffill()) if False else last_err_ply.groupby(df["game_id"]).transform(lambda s: s.shift(1).ffill())
    df["plies_since_own_error"] = df["ply"] - last_err_ply
    return df.sort_index()


def shuffle_within_game(df: pd.DataFrame, target: str, rng: np.random.Generator) -> pd.DataFrame:
    """The null (v1.6): inside each game draw the outcome i.i.d. Bernoulli at the game's OWN error
    rate (with replacement), give each drawn label a loss sampled from that label class, then
    recompute the label-derived history features. Game composition and the search are untouched.

    Why not a permutation: permuting labels within a game without replacement makes the remaining
    "error quota" denser after a run of accurate decisions, so sequence features such as
    plies_since_own_error validate on pure noise (64/100 under v1.5). Independence is the null a
    sequence feature must beat."""
    df = df.copy()
    p_g = df.groupby("game_id")[target].transform("mean").values
    new = (rng.random(len(df)) < p_g).astype(int)
    if target != "err":
        # a class target: draw the class indicator i.i.d. at the game's class rate; the generic error
        # column and the history features are left as they are (they are covariates, not the target)
        df[target] = new
        return df
    err_losses = df.loc[df[target] == 1, "y_wp_loss"].values; ok_losses = df.loc[df[target] == 0, "y_wp_loss"].values
    if len(err_losses) and len(ok_losses):
        df["y_wp_loss"] = np.where(new == 1, rng.choice(err_losses, len(df)), rng.choice(ok_losses, len(df)))
    df[target] = new
    if "y_accurate" in df.columns:
        df["y_accurate"] = 1 - new
    if "blunder10" in df.columns:
        df["blunder10"] = (df["y_wp_loss"] >= 0.10).astype(int)
    return recompute_history(df)


def clustered_rate_se(y: np.ndarray, groups: np.ndarray) -> tuple[float, float]:
    """Mean and cluster-robust SE of a binary rate with clusters = games."""
    y = np.asarray(y, float)
    if len(y) == 0:
        return np.nan, np.nan
    p = y.mean()
    df = pd.DataFrame({"y": y, "g": groups})
    agg = df.groupby("g")["y"].agg(["sum", "count"])
    # linearised score: sum over clusters of (sum_i (y_i - p))^2 / n^2
    resid = agg["sum"] - p * agg["count"]
    G = len(agg)
    var = (resid ** 2).sum() / (len(y) ** 2)
    if G > 1:
        var *= G / (G - 1)
    return p, float(np.sqrt(var))


def region_contrast(df: pd.DataFrame, mask: np.ndarray, target: str) -> dict:
    """Error rate inside vs outside `mask`, with game-clustered SEs and a z for the difference."""
    inside = df[mask]; outside = df[~mask]
    p_in, se_in = clustered_rate_se(inside[target].values, inside["game_id"].values)
    p_out, se_out = clustered_rate_se(outside[target].values, outside["game_id"].values)
    diff = p_in - p_out
    se = np.sqrt(se_in ** 2 + se_out ** 2)
    return {"n_in": int(mask.sum()), "n_out": int((~mask).sum()), "p_in": p_in, "p_out": p_out,
            "diff": diff, "se": se, "z": diff / se if se > 0 else np.nan,
            "games_in": int(inside["game_id"].nunique())}


def within_game_demean(df: pd.DataFrame, col: str) -> pd.Series:
    """Subtract each game's own mean: what is left is decision-level structure inside games."""
    return df[col] - df.groupby("game_id")[col].transform("mean")


def within_game_contrast(df: pd.DataFrame, mask: np.ndarray, col: str) -> dict:
    """Game-fixed-effects contrast of `col` inside vs outside `mask`.

    Each game with decisions on both sides contributes d_g = mean_in - mean_out with weight
    w_g = n_in * n_out / (n_in + n_out); estimate = sum(w d) / sum(w); the SE treats games as the
    independent units. Game composition (a bad game, a strong opponent, a fast time control) cancels
    by construction, which is what a decision-level mechanism must survive.
    """
    d = pd.DataFrame({"g": df["game_id"].values, "y": df[col].values, "m": np.asarray(mask, bool)})
    agg = d.groupby(["g", "m"])["y"].agg(["mean", "count"]).unstack("m")
    if agg.shape[1] < 2 or True not in agg["count"].columns or False not in agg["count"].columns:
        return {"n_games": 0, "est": np.nan, "se": np.nan, "z": np.nan, "n_in": int(d.m.sum()), "n_out": int((~d.m).sum())}
    both = agg.dropna(subset=[("count", True), ("count", False)])
    if len(both) < 2:
        return {"n_games": int(len(both)), "est": np.nan, "se": np.nan, "z": np.nan, "n_in": int(d.m.sum()), "n_out": int((~d.m).sum())}
    n_in = both[("count", True)].values; n_out = both[("count", False)].values
    dg = both[("mean", True)].values - both[("mean", False)].values
    w = n_in * n_out / (n_in + n_out)
    est = float((w * dg).sum() / w.sum())
    G = len(dg)
    var = float((w ** 2 * (dg - est) ** 2).sum() / (w.sum() ** 2)) * (G / (G - 1))
    se = float(np.sqrt(var))
    return {"n_games": int(G), "est": est, "se": se, "z": est / se if se > 0 else np.nan,
            "n_in": int(d.m.sum()), "n_out": int((~d.m).sum()), "n_in_paired": int(n_in.sum()), "n_out_paired": int(n_out.sum())}


def jaccard(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, bool); b = np.asarray(b, bool)
    u = (a | b).sum()
    return float((a & b).sum() / u) if u else 1.0
