"""
THREE THINGS THE FIRST PASS COULD NOT ANSWER.

  1. THE 29/29 REPRODUCTION. The preliminary result this program inherited -- "29/29 hanging-piece
     examples looked clean" -- exists nowhere in this repository at any commit (`git log --all -S`
     finds no `hangingPiece`, no `29/29`, no `unprotected`). It cannot be reproduced from the
     artifact, so it is reproduced from the DESIGN it describes: draw 29 items the way that claim
     would have drawn them, from a corpus selected by the `hangingPiece` label, and score them
     the way it would have. Then draw 29 the way F1 requires and score them identically. The
     contrast between those two numbers is the finding.

  2. NARROWING. If the construct fails as stated, does a narrower one survive? Each candidate
     narrowing is applied to the same corpus and scored the same way, so the comparison is between
     definitions and not between studies.

  3. ENGINE ADJUDICATION, kept in its own column. On the engine-scored subsample: how often is
     "take the designated piece" what the engine would play, and how often do SEE and the engine
     disagree about the same move?

    python narrow.py --games games_enriched.jsonl --puzzles puzzles_enriched.jsonl --out narrow.json
"""

from __future__ import annotations

import argparse
import collections
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sdt import Counts, compute, wilson_interval, standardized_mean_difference  # noqa: E402

RATING_BANDS = [(0, 1200), (1200, 1400), (1400, 1600), (1600, 1800), (1800, 3500)]


def rate(k: int, n: int) -> dict:
    lo, hi = wilson_interval(k, n)
    return {"k": k, "n": n, "p": (k / n) if n else None, "ci95": [lo, hi]}


def tabulate(rows) -> Counts:
    h = m = fa = cr = 0
    for r in rows:
        b = r["observable_action"]
        if r["trigger_state"] == "positive":
            h += b
            m += 1 - b
        else:
            fa += b
            cr += 1 - b
    return Counts(h, m, fa, cr)


def sdt_block(rows) -> dict:
    c = tabulate(rows)
    if c.signal_trials == 0 or c.noise_trials == 0:
        return {"error": "one cell empty", "counts": c.__dict__}
    s = compute(c)
    return {
        "n_t_plus": c.signal_trials,
        "n_t_minus": c.noise_trials,
        "hit_rate": s.hit_rate,
        "false_alarm_rate": s.false_alarm_rate,
        "d_prime": s.d_prime,
        "criterion_c": s.criterion_c,
        "a_prime": s.a_prime,
    }


def by_band(rows) -> dict:
    out = {}
    for lo, hi in RATING_BANDS:
        band = [r for r in rows if lo <= r.get("actor_elo", -1) < hi]
        if len(band) >= 200:
            out[f"{lo}-{hi}"] = sdt_block(band)
    return out


def monotone(seq) -> bool:
    return all(b >= a for a, b in zip(seq, seq[1:]))


# ------------------------------------------------------------------ 1. the 29/29 reproduction

def reproduce_29(puzzles: list[dict], seed: int) -> dict:
    """
    Two draws of 29, differing ONLY in whether the corpus was selected by the label being tested.
    """
    rng = random.Random(seed)
    labelled = [r for r in puzzles if r["theme_hanging_piece"] == 1]
    unlabelled = [r for r in puzzles if r["trigger_state"] == "positive"]

    def clean(r: dict) -> int:
        """The claim's own criterion, as generously as it can be read: the predicate fires and
        the curated answer is to take the designated piece."""
        return int(r["trigger_state"] == "positive" and r["solution_is_capture_of_target"] == 1)

    draw_labelled = rng.sample(labelled, 29)
    draw_unlabelled = rng.sample(unlabelled, 29)
    return {
        "what_was_inherited": (
            "29/29 hanging-piece examples looked clean. Not present in this repository at any "
            "commit; reproduced from the described design rather than from an artifact."
        ),
        "draw_A_corpus_selected_by_the_label_under_test": {
            "n_pool": len(labelled),
            "sample": rate(sum(clean(r) for r in draw_labelled), 29),
            "full_pool_rate": rate(sum(clean(r) for r in labelled), len(labelled)),
        },
        "draw_B_corpus_selected_only_by_the_frozen_predicate": {
            "n_pool": len(unlabelled),
            "sample": rate(sum(clean(r) for r in draw_unlabelled), 29),
            "full_pool_rate": rate(sum(clean(r) for r in unlabelled), len(unlabelled)),
        },
        "seed": seed,
    }


# ------------------------------------------------------------------ 2. narrowing

def narrowings() -> dict:
    """
    Candidate definitions, each a pair of filters. Written as data so a reader can see that the
    same scoring ran over all of them and that none was chosen after seeing its result.
    """
    def base_pos(r: dict) -> bool:
        return r["trigger_state"] == "positive"

    def base_neg(r: dict) -> bool:
        return r["trigger_state"] == "negative"

    def quiet(r: dict) -> bool:
        return r.get("capture_gives_check", 0) == 0 and r["n_mate_in_1"] == 0

    def no_bigger(r: dict) -> bool:
        return r.get("bigger_capture_elsewhere", 0) == 0

    def costly(r: dict) -> bool:
        see = r.get("see_result")
        return see is not None and see < 0

    return {
        "N0_as_stated": (base_pos, base_neg),
        "N1_quiet": (
            lambda r: base_pos(r) and quiet(r),
            lambda r: base_neg(r) and quiet(r),
        ),
        "N2_quiet_and_no_larger_capture": (
            lambda r: base_pos(r) and quiet(r) and no_bigger(r),
            lambda r: base_neg(r) and quiet(r),
        ),
        "N3_negatives_must_be_material_errors": (
            lambda r: base_pos(r) and quiet(r) and no_bigger(r),
            lambda r: base_neg(r) and quiet(r) and costly(r),
        ),
        "N4_N3_plus_minor_or_better_target_only": (
            lambda r: base_pos(r) and quiet(r) and no_bigger(r) and r["target_value"] >= 3,
            lambda r: base_neg(r) and quiet(r) and costly(r) and r["target_value"] >= 3,
        ),
        "N5_N3_plus_single_attacker": (
            lambda r: base_pos(r) and quiet(r) and no_bigger(r) and r["attacker_count"] == 1,
            lambda r: base_neg(r) and quiet(r) and costly(r) and r["attacker_count"] == 1,
        ),
    }


COVARIATES = [
    "n_legal_moves", "n_legal_captures", "n_checks_available", "n_forcing_moves",
    "piece_count", "material_balance", "total_material", "fullmove_number",
    "target_value", "attacker_count",
]


def balance(pos: list[dict], neg: list[dict]) -> dict:
    out = {}
    for c in COVARIATES:
        a = [r[c] for r in pos if c in r]
        b = [r[c] for r in neg if c in r]
        if len(a) > 1 and len(b) > 1:
            out[c] = standardized_mean_difference(a, b)
    return out


def narrow_report(games: list[dict]) -> dict:
    out = {}
    for name, (fp, fn) in narrowings().items():
        pos = [r for r in games if fp(r)]
        neg = [r for r in games if fn(r)]
        rows = pos + neg
        block = sdt_block(rows)
        bands = by_band(rows)
        ds = [v["d_prime"] for v in bands.values() if "d_prime" in v]
        cs = [v["criterion_c"] for v in bands.values() if "criterion_c" in v]
        bal = balance(pos, neg)
        out[name] = {
            "overall": block,
            "by_actor_rating_band": bands,
            "d_prime_monotone_in_rating": monotone(ds) if len(ds) >= 3 else None,
            "d_prime_span": (max(ds) - min(ds)) if ds else None,
            "criterion_monotone_decreasing": monotone([-c for c in cs]) if len(cs) >= 3 else None,
            "criterion_span": (max(cs) - min(cs)) if cs else None,
            "covariate_balance_smd": bal,
            "max_abs_smd": max((abs(v) for v in bal.values()), default=None),
        }
    return out


# ------------------------------------------------------------------ 3. engine adjudication

def engine_report(games: list[dict]) -> dict:
    scored = [r for r in games if r.get("engine_best_move") is not None]
    pos = [r for r in scored if r["trigger_state"] == "positive"]
    neg = [r for r in scored if r["trigger_state"] == "negative"]

    def block(rows: list[dict], label: str) -> dict:
        n = len(rows)
        best_is_take = sum(r["engine_best_is_designated_capture"] for r in rows)
        losses = [r["engine_capture_cp_loss"] for r in rows if r.get("engine_capture_cp_loss") is not None]
        losses.sort()
        blunder = sum(1 for v in losses if v >= 100)
        free = sum(1 for v in losses if v <= 10)
        see_pos = [r for r in rows if r.get("see_result") is not None and r["see_result"] >= 0]
        see_neg = [r for r in rows if r.get("see_result") is not None and r["see_result"] < 0]
        return {
            "label": label,
            "n_engine_scored": n,
            "engine_best_move_is_the_designated_capture": rate(best_is_take, n),
            "cp_loss_of_taking_median": losses[len(losses) // 2] if losses else None,
            "cp_loss_of_taking_q1_q3": (
                [losses[len(losses) // 4], losses[3 * len(losses) // 4]] if len(losses) >= 4 else None
            ),
            "taking_loses_100cp_or_more": rate(blunder, len(losses)),
            "taking_costs_10cp_or_less": rate(free, len(losses)),
            "see_says_sound_but_engine_says_blunder": rate(
                sum(1 for r in see_pos
                    if r.get("engine_capture_cp_loss") is not None
                    and r["engine_capture_cp_loss"] >= 100),
                len(see_pos),
            ),
            "see_says_losing_but_engine_plays_it": rate(
                sum(1 for r in see_neg if r["engine_best_is_designated_capture"] == 1),
                len(see_neg),
            ),
        }

    quiet_pos = [
        r for r in pos
        if r.get("capture_gives_check", 0) == 0
        and r["n_mate_in_1"] == 0
        and r.get("bigger_capture_elsewhere", 0) == 0
    ]
    return {
        "engine_build": next((r["engine_build"] for r in scored), None),
        "engine_nodes": next((r["engine_nodes"] for r in scored), None),
        "t_plus": block(pos, "T+ as stated"),
        "t_plus_narrowed_N2": block(quiet_pos, "T+ quiet, no larger capture"),
        "t_minus": block(neg, "T- as stated"),
        "the_two_oracles_disagree": (
            "SEE and the engine are reported against each other rather than fused. Where SEE "
            "says a capture is sound and the engine says it loses 100cp or more, the difference "
            "is a tactic on another square -- which is exactly the class of thing SEE cannot see "
            "and exactly the reason it may not define the construct."
        ),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", required=True)
    ap.add_argument("--puzzles", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=20260831)
    a = ap.parse_args()

    games = [json.loads(l) for l in open(a.games, encoding="utf-8")]
    puzzles = [json.loads(l) for l in open(a.puzzles, encoding="utf-8")]

    result = {
        "inputs": {"games": len(games), "puzzles": len(puzzles), "seed": a.seed},
        "reproduction_of_the_inherited_29_of_29": reproduce_29(puzzles, a.seed),
        "narrowings": narrow_report(games),
        "engine_adjudication": engine_report(games),
        "puzzle_solution_agreement_by_narrowing": puzzle_narrow(puzzles),
    }
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, default=str)
    print(json.dumps(result["reproduction_of_the_inherited_29_of_29"], indent=2, default=str))


def puzzle_narrow(puzzles: list[dict]) -> dict:
    """
    The same narrowings, scored against the CURATED answer instead of against a player.

    This is the cleanest available read on F3: inside items a strong external source already
    called a tactic, how often is `capture(designated target)` the right act? A narrowing that
    does not raise this number is not buying interpretability.
    """
    out = {}
    for name, (fp, _fn) in narrowings().items():
        pos = [r for r in puzzles if fp(r)]
        if not pos:
            continue
        out[name] = {
            "n": len(pos),
            "solution_is_capture_of_target": rate(
                sum(r["solution_is_capture_of_target"] for r in pos), len(pos)
            ),
            "carries_hangingPiece_theme": rate(
                sum(r["theme_hanging_piece"] for r in pos), len(pos)
            ),
            "median_puzzle_rating": sorted(r["puzzle_rating"] for r in pos)[len(pos) // 2],
        }
    return out


if __name__ == "__main__":
    main()
