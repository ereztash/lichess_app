"""Pre-move features. Every one of them is a fact about the position the player FOUND.

The rule this file exists to keep: nothing here may read the move the player chose, the position it
produced, or anything later in the game. `tests/test_leakage.py` enforces it twice -- structurally,
through the `PRE_MOVE` tag on every name below, and empirically, by recomputing this whole vector
with a different legal move substituted and requiring it to come back bit-identical.

Where a name says "engine", it means engine. `best_move_changes` and `eval_volatility` measure how
hard the position was for THIS engine at THIS node budget. They are not measurements of a human
being, and calling them cognitive complexity would be inventing a result.
"""
from __future__ import annotations

import math

from common import (
    ACCURATE_WIN_PROBABILITY_LOSS,
    classify_phase,
    is_book,
    non_pawn_material,
    standing_from,
    win_probability,
)

MULTIPV = 4

# THE AMBIGUITY SCALE IS BORROWED, NOT CHOSEN.
#
# Both constants are `ACCURATE_WIN_PROBABILITY_LOSS` -- what 30 centipawns costs at a level
# position, which is the threshold this repository already uses to decide whether a move gave
# anything away. A candidate within that of the best is, by the study's own outcome definition, as
# good as the best; the temperature is the same quantity, so one "accuracy threshold" of difference
# is one unit of log-odds in the softmax.
#
# The first draft used round numbers (0.10 and 0.05). On a development smoke sample the median
# best-to-second gap is 0.013 win probability, so at tau = 0.10 the softmax was nearly uniform and
# the entropy sat at log(4) for half the corpus: a saturated feature is not a difficulty measure.
# The replacement is anchored to a constant that existed before B3 and was not selected by looking
# at any B3 relationship. Recorded in FAILURES.md.
AMBIGUITY_TAU = ACCURATE_WIN_PROBABILITY_LOSS
NEAR_BAND = ACCURATE_WIN_PROBABILITY_LOSS

PRE_MOVE = (
    "ply move_number phase non_pawn_material legal_moves in_check standing side is_book "
    "wp1 edge gap12 gap1k ambiguity_entropy n_near best_move_changes eval_volatility "
    "pv_instability final_depth nodes_to_depth10 is_mate_line "
    "voc_switch voc_regret voc_drift voc_rank voc_regret_censored "
    "clock_ms_self clock_ms_opp clock_frac clock_pressure clock_diff_frac "
    "opp_prev_think_s opp_prev_think_missing own_prev_think_s own_prev_think_missing "
    "rating opponent_rating rating_diff rating_band "
    # Derived at load time, both pre-move: the mover's colour as a number, and the indicator that
    # goes with imputing `nodes_to_depth10` when the search never reached depth 10.
    "side_num nodes_to_depth10_missing log_time"
).split()

POST_MOVE = "quality_loss accurate move_uci".split()


def softmax_entropy(values: list[float], tau: float) -> float:
    """Entropy of a softmax over candidate win probabilities, in nats.

    A temperature turns "how many moves are plausible" into a number, and the number depends on the
    temperature -- which is why `n_near` is carried beside it as a transformation-free count. Both
    are frozen; neither is chosen after seeing a result.
    """
    if len(values) < 2:
        return 0.0
    top = max(values)
    weights = [math.exp((v - top) / tau) for v in values]
    total = sum(weights)
    probabilities = [w / total for w in weights]
    return -sum(p * math.log(p) for p in probabilities if p > 0)


def search_complexity(complete_iterations) -> dict:
    """How much the engine's own opinion moved while it was forming it."""
    if not complete_iterations:
        return {
            "best_move_changes": 0,
            "eval_volatility": 0.0,
            "pv_instability": 0.0,
            "final_depth": 0,
            "nodes_to_depth10": None,
        }
    moves = [it.move(1) for it in complete_iterations]
    changes = sum(1 for a, b in zip(moves, moves[1:]) if a != b)

    wps = [it.wp(1) for it in complete_iterations if it.depth >= 4]
    if len(wps) >= 2:
        mean = sum(wps) / len(wps)
        volatility = math.sqrt(sum((w - mean) ** 2 for w in wps) / len(wps))
    else:
        volatility = 0.0

    distances = []
    for a, b in zip(complete_iterations, complete_iterations[1:]):
        pv_a, pv_b = a.lines[1][2], b.lines[1][2]
        span = min(len(pv_a), len(pv_b))
        if span:
            distances.append(sum(1 for x, y in zip(pv_a[:span], pv_b[:span]) if x != y) / span)
    instability = sum(distances) / len(distances) if distances else 0.0

    deep = next((it for it in complete_iterations if it.depth >= 10), None)
    return {
        "best_move_changes": changes,
        "eval_volatility": volatility,
        "pv_instability": instability,
        "final_depth": complete_iterations[-1].depth,
        "nodes_to_depth10": deep.nodes if deep else None,
    }


def board_features(board, ply: int, decision: dict) -> dict:
    fen = board.fen()
    return {
        "ply": ply,
        "move_number": board.fullmove_number,
        "phase": classify_phase(board, ply),
        "non_pawn_material": non_pawn_material(board),
        "legal_moves": decision["legal_moves"],
        "in_check": int(decision["in_check"]),
        "is_book": int(is_book(fen)),
    }


def engine_features(final, complete_iterations) -> dict:
    """The engine's reading of the position, in win probability rather than centipawns."""
    wps = [win_probability(final.cp(k)) for k in sorted(final.lines)]
    wp1 = wps[0]
    return {
        "wp1": wp1,
        "edge": abs(wp1 - 0.5),
        "gap12": wp1 - wps[1] if len(wps) > 1 else 0.5,
        "gap1k": wp1 - wps[-1],
        "ambiguity_entropy": softmax_entropy(wps, AMBIGUITY_TAU),
        "n_near": sum(1 for w in wps if wp1 - w <= NEAR_BAND),
        "is_mate_line": int(final.is_mate(1)),
        "standing": standing_from(final.cp(1)),
        **search_complexity(complete_iterations),
    }


def search_trace(complete_iterations) -> dict:
    """A compact record of the whole iterative deepening, kept beside the derived features.

    WHY KEEP IT. Every difficulty and value-of-computation feature in this file is a summary of this
    trace, and each summary embeds a choice -- a temperature, a shallow depth, a clipping rule. If
    review asks for a different summary, the alternative is either a re-score of the whole corpus at
    engine cost, or a recomputation from a trace that was already paid for. Fifteen numbers a row is
    the cheaper of the two by several orders of magnitude, and it makes the corpus answer questions
    that were not asked when it was built.

    It is NOT a feature and no model reads it: it is not in `PRE_MOVE`.
    """
    if not complete_iterations:
        return {"trace_depths": [], "trace_wp1": [], "top_wps": [], "top_moves": [],
                "shallow_depth": None, "shallow_wps": [], "shallow_moves": [], "nodes_total": 0}
    final = complete_iterations[-1]
    shallow = [it for it in complete_iterations if it.depth <= 8]
    shallow = shallow[-1] if shallow else complete_iterations[0]
    return {
        "trace_depths": [it.depth for it in complete_iterations],
        "trace_wp1": [round(it.wp(1), 6) for it in complete_iterations],
        "trace_nodes": [it.nodes for it in complete_iterations],
        "top_wps": [round(win_probability(final.cp(k)), 6) for k in sorted(final.lines)],
        "top_moves": [final.lines[k][2][0] if final.lines[k][2] else "" for k in sorted(final.lines)],
        "shallow_depth": shallow.depth,
        "shallow_wps": [round(win_probability(shallow.cp(k)), 6) for k in sorted(shallow.lines)],
        "shallow_moves": [shallow.lines[k][2][0] if shallow.lines[k][2] else ""
                          for k in sorted(shallow.lines)],
        "nodes_total": final.nodes,
    }


def clock_features(decision: dict, base_seconds: int) -> dict:
    base_ms = 1000.0 * base_seconds
    frac = decision["clock_ms_self"] / base_ms
    opp_prev = decision.get("opp_prev_think_s")
    own_prev = decision.get("own_prev_think_s")
    return {
        "clock_ms_self": decision["clock_ms_self"],
        "clock_ms_opp": decision["clock_ms_opp"],
        "clock_frac": frac,
        "clock_pressure": -math.log(frac + 0.01),
        "clock_diff_frac": (decision["clock_ms_self"] - decision["clock_ms_opp"]) / base_ms,
        # Both are facts about clocks that had already been read when the player began deciding.
        "opp_prev_think_s": opp_prev,
        "opp_prev_think_missing": int(opp_prev is None),
        "own_prev_think_s": own_prev,
        "own_prev_think_missing": int(own_prev is None),
    }
