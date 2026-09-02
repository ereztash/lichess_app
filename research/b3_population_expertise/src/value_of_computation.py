"""Value of computation: what more search would have been worth, BEFORE the player moved.

THE CIRCULARITY THIS AVOIDS. The tempting definition of "was more thinking worth it here" is one
that looks at what the player played and how it turned out. That definition would make the primary
expertise metric a restatement of the outcome, and every rating gradient it produced would be
guaranteed. Nothing in this file reads the human's move.

WHERE THE NUMBERS COME FROM. One search of the pre-move position, and the engine's own iterative
deepening inside it: the last completed iteration at depth <= D_SHALLOW is "what a shallow look
said", the last completed iteration is "what a deep look said". No second search, no second budget,
and the comparison is between two states of the same computation rather than between two engines.

THE HAZARD, STATED. `voc_regret` and the study's quality outcome are both anchored on the same
deep evaluation of the same search, so they share its estimation noise. Control C9 re-scores a
subset at a different node budget for exactly this reason. It is a direction check on 5,000
decisions, not a proof.
"""
from __future__ import annotations

from common import win_probability

D_SHALLOW = 8  # frozen in FEATURE_SCHEMA.md
REGRET_CLIP = 0.5


def _spearman(order_a: list[str], order_b: list[str]) -> float:
    """Rank correlation over the moves present in BOTH orderings.

    The ranks are re-derived inside the common subset. Using each move's position in its own full
    ordering looks equivalent and is not: when the two lists differ in membership, those positions
    are not a permutation of `0..n-1`, the sum-of-squared-differences formula is then applied
    outside its domain, and it returns values off the [-1, 1] scale. A first draft did exactly that
    and produced `voc_rank` up to 4.75 on a scale whose maximum is 2.
    """
    common = [m for m in order_a if m in order_b]
    if len(common) < 3:
        return 1.0
    rank_a = {m: i for i, m in enumerate(common)}
    order_b_common = [m for m in order_b if m in rank_a]
    rank_b = {m: i for i, m in enumerate(order_b_common)}
    n = len(common)
    d2 = sum((rank_a[m] - rank_b[m]) ** 2 for m in common)
    return 1 - (6 * d2) / (n * (n**2 - 1))


def voc_features(complete_iterations) -> dict:
    """`{voc_switch, voc_regret, voc_drift, voc_rank, voc_regret_censored}`."""
    if not complete_iterations:
        return {
            "voc_switch": 0,
            "voc_regret": 0.0,
            "voc_drift": 0.0,
            "voc_rank": 0.0,
            "voc_regret_censored": 0,
        }
    final = complete_iterations[-1]
    shallow_candidates = [it for it in complete_iterations if it.depth <= D_SHALLOW]
    shallow = shallow_candidates[-1] if shallow_candidates else complete_iterations[0]
    if shallow is final:
        # The whole search finished inside the shallow band: there was no "more computation" to
        # value, and reporting a regret here would be reporting the absence of a search as evidence.
        return {
            "voc_switch": 0,
            "voc_regret": 0.0,
            "voc_drift": 0.0,
            "voc_rank": 0.0,
            "voc_regret_censored": 0,
        }

    best_shallow, best_deep = shallow.move(1), final.move(1)
    deep_by_move = {final.lines[k][2][0]: win_probability(final.cp(k)) for k in sorted(final.lines)
                    if final.lines[k][2]}
    wp_deep_best = win_probability(final.cp(1))

    censored = 0
    if best_shallow in deep_by_move:
        wp_deep_shallow_choice = deep_by_move[best_shallow]
    else:
        # The shallow favourite has fallen out of the deep top-K entirely. Its true deep value is at
        # most the K-th line's, so the K-th is a LOWER BOUND on the regret. Recorded as censored
        # rather than imputed, and the censoring rate is a gate in VERDICT_RULES.md.
        wp_deep_shallow_choice = min(deep_by_move.values())
        censored = 1

    regret = max(0.0, min(REGRET_CLIP, wp_deep_best - wp_deep_shallow_choice))
    order_shallow = [shallow.lines[k][2][0] for k in sorted(shallow.lines) if shallow.lines[k][2]]
    order_deep = [final.lines[k][2][0] for k in sorted(final.lines) if final.lines[k][2]]

    return {
        "voc_switch": int(best_shallow != best_deep),
        "voc_regret": regret,
        "voc_drift": abs(wp_deep_best - win_probability(shallow.cp(1))),
        "voc_rank": 1 - _spearman(order_shallow, order_deep),
        "voc_regret_censored": censored,
    }
