"""What the move cost, in the one unit that means the same thing twice.

`quality_loss = wp1_before - (1 - wp1_after)`

`wp1_after` is the best line of the position the move PRODUCED, and that position has the opponent
to move, so `1 - wp1_after` is the mover's own winning chances afterwards. Both searches run at the
same node budget with the same MultiPV and a cleared hash, so the two numbers are measured the same
way and their difference is not partly an artefact of asymmetric depth.

WHY NOT CENTIPAWNS. Thirty centipawns costs 2.76 points of winning chances at a level position and
0.28 at +10.00 -- nearly ten to one across the range. A centipawn is a currency whose exchange rate
moves with the position, so an effect size in centipawns means something different in each stratum
this study compares. `shared/win-probability.ts` documents the same repair.
"""
from __future__ import annotations

from common import ACCURATE_WIN_PROBABILITY_LOSS, win_probability


def quality_from(after_search, board_after, wp1_before: float) -> dict | None:
    """`None` when the resulting position could not be scored at all."""
    if after_search.terminal or not after_search.iterations:
        # The move ended the game. That is not a missing measurement; it is a known one.
        if board_after.is_checkmate():
            wp_after_for_mover = 1.0
        elif board_after.is_stalemate() or board_after.is_insufficient_material():
            wp_after_for_mover = 0.5
        else:
            return None
    else:
        # The DEEPEST iteration that actually carries line 1. A node limit can stop a search inside
        # an iteration, and the partial set it leaves behind sometimes holds lines 2..K without
        # line 1 -- reading `iterations[-1]` blindly is a KeyError waiting for the position that
        # produces it, and worse, silently reading line 2 as the best line would understate every
        # such move's quality.
        with_best = [it for it in after_search.iterations if 1 in it.lines]
        if not with_best:
            return None
        wp_after_for_mover = 1.0 - win_probability(with_best[-1].cp(1))

    loss = max(0.0, wp1_before - wp_after_for_mover)
    return {
        "quality_loss": loss,
        "wp_after": wp_after_for_mover,
        # B2-compatible binary, for control C10 and for nothing else.
        "accurate": int(loss <= ACCURATE_WIN_PROBABILITY_LOSS),
    }
