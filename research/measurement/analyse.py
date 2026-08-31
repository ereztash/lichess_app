"""
THE FALSIFICATION RUN. Every number in `docs/measurement/FALSIFICATION_REGISTER.md` comes
from here, and every one of them is an attempt to break the candidate construct rather than to
illustrate it.

    python analyse.py --games games.jsonl --puzzles puzzles.jsonl --out results.json

NOTHING IN HERE CHOOSES A THRESHOLD. Rates are reported with Wilson intervals, imbalances are
reported as standardized mean differences, and agreements are reported as raw cross-tabulations
plus kappa. Where a decision rule would be needed to turn one of these into a verdict, the
verdict is left to the register and the absence of a justified cut point is recorded as an open
item. `0.7` and `0.8` do not appear.
"""

from __future__ import annotations

import argparse
import collections
import json
import math
import sys
from pathlib import Path

import chess

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sdt import Counts, compute, wilson_interval, standardized_mean_difference  # noqa: E402
from oracles import see  # noqa: E402

COVARIATES = [
    "n_legal_moves",
    "n_legal_captures",
    "n_checks_available",
    "n_mate_in_1",
    "n_forcing_moves",
    "piece_count",
    "material_balance",
    "total_material",
    "fullmove_number",
    "target_value",
    "n_targets",
    "attacker_count",
]

RATING_BANDS = [(0, 1200), (1200, 1400), (1400, 1600), (1600, 1800), (1800, 3500)]


def load(path: str) -> list[dict]:
    return [json.loads(line) for line in open(path, encoding="utf-8")]


def band_of(elo: int) -> str:
    for lo, hi in RATING_BANDS:
        if lo <= elo < hi:
            return f"{lo}-{hi}"
    return "unknown"


def rate(k: int, n: int) -> dict:
    lo, hi = wilson_interval(k, n)
    return {"k": k, "n": n, "p": (k / n) if n else float("nan"), "ci95": [lo, hi]}


def kappa(a: list[int], b: list[int]) -> float:
    """Cohen's kappa for two binary labellings of the same items."""
    n = len(a)
    if n == 0:
        return float("nan")
    agree = sum(1 for x, y in zip(a, b) if x == y) / n
    pa, pb = sum(a) / n, sum(b) / n
    chance = pa * pb + (1 - pa) * (1 - pb)
    if chance == 1.0:
        return float("nan")
    return (agree - chance) / (1 - chance)


# ---------------------------------------------------------------- F1

def f1_circular_selection(games: list[dict], puzzles: list[dict]) -> dict:
    """
    Does the predicate survive outside a corpus selected by the label it is being compared to?

    Two halves. The first is a base rate in a population no tactical filter ever touched. The
    second is the agreement between the frozen predicate and Lichess's `hangingPiece` theme,
    computed on puzzle positions and reported as a full cross-tabulation because sensitivity
    alone would hide the direction of the disagreement.
    """
    gs = collections.Counter(r["trigger_state"] for r in games)
    ps = collections.Counter(r["trigger_state"] for r in puzzles)

    pred = [1 if r["trigger_state"] == "positive" else 0 for r in puzzles]
    theme = [r["theme_hanging_piece"] for r in puzzles]
    tp = sum(1 for p, t in zip(pred, theme) if p and t)
    fp = sum(1 for p, t in zip(pred, theme) if p and not t)
    fn = sum(1 for p, t in zip(pred, theme) if not p and t)
    tn = sum(1 for p, t in zip(pred, theme) if not p and not t)

    t_plus = [r for r in puzzles if r["trigger_state"] == "positive"]
    solved_by_taking = sum(r["solution_is_capture_of_target"] for r in t_plus)
    hp = [r for r in puzzles if r["theme_hanging_piece"]]

    return {
        "question": (
            "Does the frozen board predicate fire in a population that was never selected by a "
            "tactical label, and does it mean the same thing as the label where both exist?"
        ),
        "game_corpus_trigger_rates": {
            "positive": rate(gs["positive"], sum(gs.values())),
            "negative": rate(gs["negative"], sum(gs.values())),
            "note": (
                "denominator is classifiable positions only; positions with 0 capturable "
                "non-pawn pieces or 2+ loose targets were never written out"
            ),
        },
        "puzzle_corpus_trigger_rates": {
            "positive": rate(ps["positive"], sum(ps.values())),
            "negative": rate(ps["negative"], sum(ps.values())),
        },
        "predicate_vs_hangingPiece_theme": {
            "cross_tab": {
                "pred_pos_theme_pos": tp,
                "pred_pos_theme_neg": fp,
                "pred_neg_theme_pos": fn,
                "pred_neg_theme_neg": tn,
            },
            "sensitivity_theme_given_pred": rate(tp, tp + fp),
            "recall_pred_given_theme": rate(tp, tp + fn),
            "cohens_kappa": kappa(pred, theme),
        },
        "solution_agreement_on_predicate_positives": {
            "solution_is_capture_of_the_loose_target": rate(solved_by_taking, len(t_plus)),
            "what_this_measures": (
                "on a curated tactic, how often the curated answer IS the action the candidate "
                "rule class names. Anything well below 1 means `capture(target)` is not the "
                "correct response even inside items the predicate calls T+."
            ),
        },
        "hangingPiece_items_the_predicate_calls_negative_or_unknown": rate(
            len(hp) - tp, len(hp)
        ),
    }


# ---------------------------------------------------------------- F2

def f2_exchangeability(rows: list[dict], label: str, extra: list[str] | None = None) -> dict:
    """Standardized mean differences on every covariate, T+ against T-."""
    pos = [r for r in rows if r["trigger_state"] == "positive"]
    neg = [r for r in rows if r["trigger_state"] == "negative"]
    cols = COVARIATES + (extra or [])
    smd = {}
    for c in cols:
        a = [r[c] for r in pos if c in r]
        b = [r[c] for r in neg if c in r]
        if not a or not b:
            continue
        smd[c] = {
            "t_plus_mean": sum(a) / len(a),
            "t_minus_mean": sum(b) / len(b),
            "smd": standardized_mean_difference(a, b),
        }
    phase_pos = collections.Counter(r["phase"] for r in pos)
    phase_neg = collections.Counter(r["phase"] for r in neg)
    piece_pos = collections.Counter(r["target_piece"].lower() for r in pos)
    piece_neg = collections.Counter(r["target_piece"].lower() for r in neg)
    return {
        "corpus": label,
        "n_t_plus": len(pos),
        "n_t_minus": len(neg),
        "standardized_mean_differences": smd,
        "phase_distribution": {
            "t_plus": {k: v / max(1, len(pos)) for k, v in phase_pos.items()},
            "t_minus": {k: v / max(1, len(neg)) for k, v in phase_neg.items()},
        },
        "target_piece_distribution": {
            "t_plus": {k: v / max(1, len(pos)) for k, v in piece_pos.items()},
            "t_minus": {k: v / max(1, len(neg)) for k, v in piece_neg.items()},
        },
        "interpretation_note": (
            "An SMD is reported, not judged. This program has no literature-justified cut point "
            "for 'balanced' in this design, and inventing one here is exactly the move the "
            "epistemic rule forbids."
        ),
    }


# ---------------------------------------------------------------- F3 / F4

def f3_f4_alternative_pathways(games: list[dict], sample: int, seed: int) -> dict:
    """
    Is `capture(target)` a valid behavioural signature of the intended discrimination?

    Two failures are counted separately because they break the construct at different ends:
      * a T+ item where taking is NOT the best available act (a mate, a bigger capture, or a
        swap-off that loses material) -- so a MISS is correct behaviour and is scored as error;
      * a T- item where taking the defended piece IS materially sound -- so a FALSE ALARM is
        correct behaviour and is scored as error.
    SEE is used here as one oracle among several and is reported as its own field (F4). It is
    never allowed to relabel `trigger_state`.
    """
    import random

    rng = random.Random(seed)
    pos = [r for r in games if r["trigger_state"] == "positive"]
    neg = [r for r in games if r["trigger_state"] == "negative"]
    pos = rng.sample(pos, min(sample, len(pos)))
    neg = rng.sample(neg, min(sample, len(neg)))

    def analyse(rows: list[dict]) -> dict:
        n = 0
        mate_available = 0
        capture_is_check = 0
        bigger_capture_elsewhere = 0
        see_neg = 0
        see_zero_or_better = 0
        see_missing = 0
        see_values: list[int] = []
        for r in rows:
            board = chess.Board(r["original_fen"])
            sq = chess.parse_square(r["target_square"])
            caps = [
                m for m in board.legal_moves
                if m.to_square == sq and board.is_capture(m)
            ]
            if not caps:
                see_missing += 1
                continue
            n += 1
            # Cheapest attacker takes: the move a player applying the rule would actually make.
            best = min(
                caps,
                key=lambda m: {
                    chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3,
                    chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 100,
                }[board.piece_at(m.from_square).piece_type]  # type: ignore[union-attr]
            )
            v = see(board, best)
            if v is not None:
                see_values.append(v)
                if v < 0:
                    see_neg += 1
                else:
                    see_zero_or_better += 1
            if r["n_mate_in_1"] > 0:
                mate_available += 1
            if board.gives_check(best):
                capture_is_check += 1
            # A materially larger capture available somewhere else on the board.
            vals = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3,
                    chess.ROOK: 5, chess.QUEEN: 9}
            target_val = r["target_value"]
            for m in board.legal_moves:
                if not board.is_capture(m) or m.to_square == sq:
                    continue
                victim = board.piece_at(m.to_square)
                if victim is None:
                    continue
                if vals.get(victim.piece_type, 0) > target_val:
                    bigger_capture_elsewhere += 1
                    break
        return {
            "n": n,
            "see_missing": see_missing,
            "mate_in_1_also_available": rate(mate_available, n),
            "target_capture_also_gives_check": rate(capture_is_check, n),
            "larger_capture_available_elsewhere": rate(bigger_capture_elsewhere, n),
            "see_negative": rate(see_neg, n),
            "see_zero_or_better": rate(see_zero_or_better, n),
            "see_median": sorted(see_values)[len(see_values) // 2] if see_values else None,
        }

    p, q = analyse(pos), analyse(neg)
    return {
        "sample_seed": seed,
        "sample_size_requested": sample,
        "t_plus": p,
        "t_minus": q,
        "the_two_construct_breaking_rates": {
            "t_plus_where_taking_is_not_clearly_the_act": {
                "any_of_mate_or_bigger_capture_or_negative_see": None,
                "components": {
                    "mate_in_1_also_available": p["mate_in_1_also_available"],
                    "larger_capture_available_elsewhere": p["larger_capture_available_elsewhere"],
                    "see_negative": p["see_negative"],
                },
            },
            "t_minus_where_taking_is_materially_sound": p and q["see_zero_or_better"],
        },
    }


def f3_composite(games: list[dict], sample: int, seed: int) -> dict:
    """The union rate, computed once per item so the components cannot be double counted."""
    import random

    rng = random.Random(seed)
    pos = [r for r in games if r["trigger_state"] == "positive"]
    pos = rng.sample(pos, min(sample, len(pos)))
    contaminated = 0
    n = 0
    breakdown = collections.Counter()
    for r in pos:
        board = chess.Board(r["original_fen"])
        sq = chess.parse_square(r["target_square"])
        caps = [m for m in board.legal_moves if m.to_square == sq and board.is_capture(m)]
        if not caps:
            continue
        n += 1
        best = min(caps, key=lambda m: {
            chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3,
            chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 100,
        }[board.piece_at(m.from_square).piece_type])  # type: ignore[union-attr]
        flags = []
        if r["n_mate_in_1"] > 0:
            flags.append("mate_in_1")
        if board.gives_check(best):
            flags.append("capture_is_check")
        v = see(board, best)
        if v is not None and v < 0:
            flags.append("see_negative")
        vals = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}
        for m in board.legal_moves:
            if board.is_capture(m) and m.to_square != sq:
                victim = board.piece_at(m.to_square)
                if victim and vals.get(victim.piece_type, 0) > r["target_value"]:
                    flags.append("bigger_capture")
                    break
        if flags:
            contaminated += 1
            breakdown[tuple(sorted(flags))] += 1
    return {
        "n": n,
        "any_competing_explanation": rate(contaminated, n),
        "flag_combinations": {"+".join(k): v for k, v in breakdown.most_common(12)},
        "what_this_is": (
            "the share of T+ items where SOMETHING other than the taught relationship can "
            "produce, or should prevent, the scored action"
        ),
    }


# ---------------------------------------------------------------- F5 / F10

def f5_f10_sdt_by_rating(games: list[dict]) -> dict:
    """
    Hit rate, false-alarm rate, d' and criterion, overall and by rating band.

    F5 asks whether an apparent discrimination is a response bias; F10 asks whether the
    instrument separates skill groups in the direction the expertise literature predicts. They
    share one table because they are answered by the same two numbers read two ways: a pure
    criterion shift moves H and F together and leaves d' flat, and a real skill difference moves
    d' with rating while c may go either way.
    """
    def table(rows: list[dict]) -> dict:
        trials = [(r["trigger_state"], r["observable_action"]) for r in rows
                  if r["observable_action"] is not None]
        if not trials:
            return {}
        counts = from_trials_safe(trials)
        s = compute(counts)
        return {
            **s.as_dict(),
            "hit_rate_raw": rate(counts.hits, counts.signal_trials),
            "false_alarm_rate_raw": rate(counts.false_alarms, counts.noise_trials),
            "capture_propensity": rate(
                counts.hits + counts.false_alarms,
                counts.signal_trials + counts.noise_trials,
            ),
        }

    by_band = {}
    for lo, hi in RATING_BANDS:
        key = f"{lo}-{hi}"
        band = [r for r in games if lo <= r["actor_elo"] < hi]
        if len(band) >= 200:
            by_band[key] = table(band)

    return {
        "overall": table(games),
        "by_actor_rating_band": by_band,
        "reading_rule": (
            "d' rising with rating while c stays put is a discrimination gradient. H and F "
            "rising together with d' flat is a criterion gradient and is NOT evidence of "
            "discrimination. Both patterns produce higher accuracy on T+."
        ),
    }


def from_trials_safe(trials) -> Counts:
    h = m = fa = cr = 0
    for state, b in trials:
        if state == "positive":
            h += b
            m += 1 - b
        elif state == "negative":
            fa += b
            cr += 1 - b
    return Counts(hits=h, misses=m, false_alarms=fa, correct_rejections=cr)


def f2b_matched_sdt(games: list[dict]) -> dict:
    """
    The same SDT table after EXACT matching of T+ and T- items on the covariates F2 flagged.

    If the discrimination survives matching, the item-difficulty explanation is weakened. If it
    disappears, the original d' was an item effect wearing a player's clothes. This is the one
    analysis that can distinguish those, and it is why F2 is not answerable by d' alone.
    """
    def key(r: dict) -> tuple:
        return (
            r["phase"],
            r["target_value"],
            min(r["n_legal_captures"], 6),
            min(r["n_checks_available"], 4),
            min(r["piece_count"] // 4, 7),
            band_of(r["actor_elo"]),
        )

    pos = collections.defaultdict(list)
    neg = collections.defaultdict(list)
    for r in games:
        if r["observable_action"] is None:
            continue
        (pos if r["trigger_state"] == "positive" else neg)[key(r)].append(r)

    kept_pos, kept_neg = [], []
    strata = 0
    for k in set(pos) & set(neg):
        n = min(len(pos[k]), len(neg[k]))
        if n == 0:
            continue
        strata += 1
        kept_pos.extend(pos[k][:n])
        kept_neg.extend(neg[k][:n])

    rows = kept_pos + kept_neg
    trials = [(r["trigger_state"], r["observable_action"]) for r in rows]
    if not trials:
        return {"error": "no matched strata"}
    s = compute(from_trials_safe(trials))
    bal = f2_exchangeability(rows, "games-matched")
    return {
        "strata_used": strata,
        "n_matched_pairs": len(kept_pos),
        "sdt": s.as_dict(),
        "residual_balance": bal["standardized_mean_differences"],
        "matching_keys": [
            "phase", "target_value", "n_legal_captures (capped 6)",
            "n_checks_available (capped 4)", "piece_count//4 (capped 7)",
            "actor rating band",
        ],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", required=True)
    ap.add_argument("--puzzles", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--sample", type=int, default=4000)
    ap.add_argument("--seed", type=int, default=20260831)
    a = ap.parse_args()

    games = load(a.games)
    puzzles = load(a.puzzles)

    results = {
        "inputs": {
            "games_records": len(games),
            "puzzle_records": len(puzzles),
            "seed": a.seed,
            "sample": a.sample,
        },
        "F1_circular_selection": f1_circular_selection(games, puzzles),
        "F2_exchangeability_games": f2_exchangeability(games, "games"),
        "F2_exchangeability_puzzles": f2_exchangeability(
            puzzles, "puzzles", extra=["puzzle_rating", "nb_plays", "popularity"]
        ),
        "F2b_matched_sdt": f2b_matched_sdt(games),
        "F3_F4_alternative_pathways": f3_f4_alternative_pathways(games, a.sample, a.seed),
        "F3_composite_contamination": f3_composite(games, a.sample, a.seed),
        "F5_F10_sdt": f5_f10_sdt_by_rating(games),
    }
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, default=str)
    print(json.dumps(results["F1_circular_selection"], indent=2, default=str)[:1500])


if __name__ == "__main__":
    main()
