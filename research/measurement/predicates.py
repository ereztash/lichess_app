"""
THE BOARD PREDICATES, FROZEN BEFORE ANY LABEL WAS READ.

This file is the operational definition of the candidate Rule Class
"unprotected-piece capture discrimination". It is deliberately the FIRST artifact written in
this research program, and `docs/measurement/ITEM_BANK_PROTOCOL.md` records its SHA-256, because
the falsification F1 asks whether the effect exists only inside a corpus that was preselected by
the `hangingPiece` label. That question is only answerable if the detector was specified without
looking at the label -- so it was.

WHAT IS AND IS NOT IN HERE. Everything in this file is a statement about the arrangement of
pieces on a board and the legality of moves. There is no engine, no SEE, no Lichess theme, no
puzzle rating and no human judgement. Those exist -- they live in `oracles.py` -- and they are
kept in SEPARATE FIELDS on purpose (F4): the moment one of them is allowed to decide what counts
as a trigger, the trigger stops being a fact about a chessboard and becomes a fact about that
oracle. `UNKNOWN` is a permitted and desirable value everywhere.

VOCABULARY.
  actor      the side to move. The player whose behaviour is measured.
  target     an opponent piece the actor could legally capture this move.
  loose      a target with ZERO opponent pieces attacking its square. "Unprotected"/"hanging".
  held       a target with at least one opponent piece attacking its square.

The word "hanging" is avoided in field names because Lichess uses it for a puzzle theme, and the
whole point of F1 is that these two things must be able to disagree.
"""

from __future__ import annotations

import chess

PREDICATE_VERSION = "1.0.0"

#: Centipawn-ish nominal values, used ONLY to say "non-pawn" and to order targets by size.
#: They are not an evaluation and never enter a score. King is absent: it is never a target.
PIECE_VALUE = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
}


def _captures_by_destination(board: chess.Board) -> dict[int, list[chess.Move]]:
    """
    Every LEGAL capture available to the side to move, grouped by the square it lands on.

    Computed once per position rather than once per candidate target. The per-target form was
    the obvious way to write it and is quadratic in a corpus this size; the semantics are
    identical, and `tests/research/predicates.test.ts` pins them against the naive form.
    """
    out: dict[int, list[chess.Move]] = {}
    for m in board.legal_moves:
        if board.is_capture(m):
            out.setdefault(m.to_square, []).append(m)
    return out


def targets(board: chess.Board) -> list[dict]:
    """
    Every opponent NON-PAWN, NON-KING piece the actor can legally capture this move.

    NON-PAWN because the candidate Rule Class is about pieces; a loose pawn is a different
    (and much weaker) discrimination and pooling the two would make the construct two things.
    NON-KING because a king is never capturable, so it can never be a target.

    LEGALITY IS REQUIRED, not just attack geometry. `board.attackers` will report a pinned
    knight as an attacker; a pinned knight cannot take anything. A "capture opportunity" that
    cannot be played is not an opportunity.
    """
    out = []
    them = not board.turn
    by_dest = _captures_by_destination(board)
    for square, piece in board.piece_map().items():
        if piece.color != them:
            continue
        if piece.piece_type in (chess.PAWN, chess.KING):
            continue
        caps = by_dest.get(square)
        if not caps:
            continue
        defenders = board.attackers(them, square)
        attackers = board.attackers(board.turn, square)
        out.append(
            {
                "square": square,
                "square_name": chess.square_name(square),
                "piece_type": piece.piece_type,
                "piece_symbol": piece.symbol(),
                "piece_value": PIECE_VALUE[piece.piece_type],
                # GEOMETRIC DEFENDERS. Direct attacks by the owning side on the target's square.
                # X-rays are excluded because python-chess `attackers` respects blockers, and a
                # defender behind a blocker is not defending this move. Pinned defenders ARE
                # counted, which is a known and recorded imprecision -- see `defender_types`.
                "geometric_defenders": len(defenders),
                "defender_types": sorted(
                    board.piece_at(s).symbol() for s in defenders  # type: ignore[union-attr]
                ),
                "attacker_count": len(attackers),
                "legal_captures": len(caps),
                "cheapest_attacker_value": min(
                    (
                        PIECE_VALUE.get(board.piece_at(m.from_square).piece_type, 0)  # type: ignore[union-attr]
                        for m in caps
                    ),
                    default=0,
                ),
                "capture_moves": sorted(m.uci() for m in caps),
            }
        )
    return out


def classify(board: chess.Board) -> dict:
    """
    The trigger state of one position, and everything needed to argue about it later.

    T+  exactly one loose target exists.
    T-  zero loose targets exist AND at least one held target exists.
    NA  neither (no capturable non-pawn piece at all, or more than one loose target).

    WHY "EXACTLY ONE" FOR T+, and it is not a convenience. `B = player captures the designated
    target` is only a well-defined binary observation when there is exactly one designated
    target. With two loose targets the scored action is ambiguous, and an item bank that scores
    an ambiguous action manufactures both hits and misses out of the ambiguity. Positions with
    two or more loose targets are recorded (`n_loose`) and EXCLUDED, not silently folded in.

    WHY T- REQUIRES A HELD TARGET. A T- item has to present the actor with a capture that looks
    like the T+ capture and is not one; a position with no capture available at all tests
    nothing about this discrimination. This is the design's own answer to "what is a noise
    trial" and it is the assumption F2 attacks hardest.
    """
    ts = targets(board)
    loose = [t for t in ts if t["geometric_defenders"] == 0]
    held = [t for t in ts if t["geometric_defenders"] >= 1]

    if len(loose) == 1:
        state = "positive"
        designated = loose[0]
    elif len(loose) == 0 and len(held) >= 1:
        state = "negative"
        # The designated target on a noise trial is the LARGEST held target, tie-broken by
        # square index so the choice is deterministic and does not depend on dict ordering.
        designated = max(held, key=lambda t: (t["piece_value"], -t["square"]))
    else:
        state = "unknown"
        designated = None

    return {
        "predicate_version": PREDICATE_VERSION,
        "trigger_state": state,
        "n_targets": len(ts),
        "n_loose": len(loose),
        "n_held": len(held),
        "designated": designated,
        "all_targets": ts,
    }


def observed_action(board: chess.Board, move: chess.Move, cls: dict) -> int | None:
    """
    B -- did the actor capture the designated target?

    NO POST-REVEAL INFORMATION. This reads the move that was played and the classification that
    was fixed before the move was known. It does not read the game result, the engine, the
    opponent's reply, or whether the capture turned out well.

    None when there is no designated target, which is the only honest answer for an NA item.
    """
    d = cls.get("designated")
    if d is None:
        return None
    return int(move.to_square == d["square"] and board.is_capture(move))


def position_features(board: chess.Board) -> dict:
    """
    The covariates F2 says T+ and T- must be compared on, computed from the board alone.

    Every one of these is a candidate confound: if T+ items are systematically shorter, quieter,
    less forcing or more material-lopsided than T- items, then a difference in behaviour between
    them is a difference between two item sets and not a discrimination by a player.
    """
    legal = list(board.legal_moves)
    captures = [m for m in legal if board.is_capture(m)]
    checks = []
    mates = 0
    for m in legal:
        # `gives_check` answers without a push/pop; the board is only advanced for the moves
        # that DO check, which is where the mate question is the only remaining one.
        if board.gives_check(m):
            checks.append(m)
            board.push(m)
            if board.is_checkmate():
                mates += 1
            board.pop()

    pm = board.piece_map()
    def material(color: chess.Color) -> int:
        return sum(
            PIECE_VALUE.get(p.piece_type, 0) for p in pm.values() if p.color == color
        )

    actor_material = material(board.turn)
    opp_material = material(not board.turn)
    piece_count = len(pm)

    return {
        "n_legal_moves": len(legal),
        "n_legal_captures": len(captures),
        "n_checks_available": len(checks),
        "n_mate_in_1": mates,
        "n_forcing_moves": len(set(captures) | set(checks)),
        "in_check": int(board.is_check()),
        "piece_count": piece_count,
        "actor_material": actor_material,
        "opponent_material": opp_material,
        "material_balance": actor_material - opp_material,
        "total_material": actor_material + opp_material,
        # PHASE BY MATERIAL, not by move number, because the same ply number is a different phase
        # in a queenless middlegame and a book line. The cut points are the ones this repository
        # already uses in `shared/phase.ts`; they are a convention, not a finding.
        "phase": (
            "endgame"
            if actor_material + opp_material <= 24
            else "opening"
            if board.fullmove_number <= 10
            else "middlegame"
        ),
        "fullmove_number": board.fullmove_number,
        "halfmove_clock": board.halfmove_clock,
    }
