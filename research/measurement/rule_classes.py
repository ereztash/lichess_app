"""
CANDIDATE RULE CLASSES, AND THE NINE CRITERIA A CANDIDATE MUST FACE.

WHY THIS FILE EXISTS AND WHAT IT REPLACES. The first iteration asked "can we measure whether a
player learned the unprotected-piece rule?" and the answer was no -- not because players do not
learn it, but because `capture(target)` is not a valid signature of having learned it. The deeper
finding, and the one that decides what to do next, is:

    T CAN BE OBJECTIVELY TRUE WITHOUT HAVING A SINGLE CORRECT B.

"The piece is undefended" is a fact about a chessboard that a program can settle exactly. It still
does not follow that taking it is the act a knowledgeable player performs -- Stockfish says taking
loses 100cp or more on 15.0% of those positions. So the next question is NOT "how do we rescue
this rule class". It is:

    DOES ANY RULE CLASS EXIST IN WHICH THE TRIGGER DETERMINES A CORRECT ACTION SHARPLY ENOUGH
    THAT `KNOWLEDGE -> ACTION` IS IDENTIFIABLE AT ALL?

That is a question about chess, not about people, and it is answerable without recruiting anybody.
If the answer is no for every family tried, that is itself a major result: it would say rule use
cannot be measured from the final move alone, and the program would have to move to process
evidence or a different paradigm entirely.

---

THE NINE CRITERIA. Three are enforced by the shape of this file rather than asserted:

  C1  T can be determined before behaviour.
      ENFORCED: `trigger()` receives the board and the previous move. It has no parameter through
      which the played move could reach it. This is not a promise; there is no channel.
  C2  B can be observed directly.
      ENFORCED: `satisfies()` receives one move and returns a boolean. No search, no oracle.
  C3  T does not contain B.
      GRADED, because the honest answer has three values -- see `C3Grade`.
  C4  Correct B follows from T with very few contextual exceptions.
      MEASURED by engine, in `screen_rule_classes.py`. Not declarable.
  C5  T- permits the same action, so false alarms are possible.
      ENFORCED: a position where the prescribed action is unavailable is not a T- item.
  C6  T+/T- can be made exchangeable or tightly matched.
      MEASURED as standardized mean differences.
  C7  No engine outcome is required to define B.
      ENFORCED: `satisfies()` has no engine and no SEE in scope.
  C8  Existing literature or a validated chess paradigm supports the construct.
      DECLARED per candidate, with the citation, and a candidate may declare `None`.
  C9  The rule can plausibly matter in ordinary play.
      MEASURED as a base rate in an unfiltered corpus.

---

NO THRESHOLD IS INVENTED ANYWHERE, and the device that makes that possible is two ANCHORS
measured under the identical harness:

  RC-00 `mate-in-one`   -- the CEILING. A rule class whose trigger determines the correct action
                           as sharply as chess allows. Whatever this scores is the best the
                           paradigm can do.
  RC-01 `loose-piece`   -- the INCUMBENT FLOOR. The refuted rule class, re-measured here so the
                           comparison is the same measurement rather than two studies.

Every candidate is then placed BETWEEN two measured reference points. "Is it closer to the ceiling
or to the floor" is a comparison; "is it above 0.8" would have been a number somebody made up.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Literal, Optional

import chess

RULE_CLASS_VERSION = "1.0.0"

VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}
ATTACKER_ORDER = {**VALUES, chess.KING: 100}

TriggerState = Literal["positive", "negative"]


@dataclass(frozen=True)
class Context:
    """
    Everything known BEFORE the player moves, other than the board itself.

    IT IS A TYPE RATHER THAN AN ATTRIBUTE ON THE BOARD, and the difference is not cosmetic. The
    first version of `recapture` read `board._prev_was_capture`, set by the scanner. A board
    rebuilt from a FEN in the screening stage has no such attribute, `getattr(..., False)` would
    have returned False, and every recapture item would have been silently reclassified as a
    negative -- a whole candidate quietly failing for a reason no test would have shown. A
    parameter cannot be forgotten; an attribute can.

    Both fields describe the opponent's last move, which is available before our turn begins and
    is therefore admissible under C1.
    """

    prev_move: Optional[chess.Move] = None
    prev_was_capture: bool = False


EMPTY_CONTEXT = Context()

#: How a candidate's trigger relates to the action it prescribes. The middle value is the one that
#: matters: it is legitimate and it changes what the construct means.
C3Grade = Literal[
    # T is a relation between pieces. It says nothing about any move. (`loose-piece`.)
    "independent",
    # T is "there exists a legal move with property P", settled by exhaustive enumeration without
    # knowing which move was played. LEGITIMATE -- no oracle, no behaviour, no curation -- but it
    # makes C4 nearly definitional, so the construct becomes "did you SEE it" rather than "does
    # the knowledge control the act". Recorded, never hidden. (`mate-in-one`.)
    "existential-over-legal-moves",
    # T is defined by reference to a CHOSEN or CURATED action. This is what Lichess's
    # `hangingPiece` theme does (it reads the solution's first move). A candidate graded this way
    # is disqualified by the screen, not scored.
    "defined-by-a-chosen-action",
]


@dataclass(frozen=True)
class RuleClass:
    id: str
    name: str
    family: str
    role: Literal["ceiling-anchor", "incumbent-floor", "candidate"]

    #: (board, context) -> "positive" | "negative" | None. NO ACCESS TO THE PLAYED MOVE.
    trigger: Callable[[chess.Board, "Context"], Optional[TriggerState]]
    #: (board, move, context) -> bool. One move in, a boolean out. No engine, no search.
    satisfies: Callable[[chess.Board, chess.Move, "Context"], bool]

    c3_grade: C3Grade
    needs_previous_move: bool
    #: What the rule tells a player to do, in the words a player would use.
    prescription: str
    #: C8. `None` is an allowed and honest answer.
    literature: Optional[str]
    #: Anything a reader has to know to interpret this candidate's numbers.
    caveats: list[str] = field(default_factory=list)

    def satisfying_moves(self, board: chess.Board, ctx: "Context") -> list[chess.Move]:
        """
        Every legal move that satisfies B.

        USED FOR TWO THINGS AND THE SECOND IS THE IMPORTANT ONE. It gives the engine a root-move
        set to search, so "the best move the rule permits" is comparable with "the best move".
        And its SIZE is a guard: a prescription satisfied by most of the legal moves is not a
        prescription, and a candidate that scored well on C4 only because its action set was
        nearly everything would otherwise look like a winner.
        """
        return [m for m in board.legal_moves if self.satisfies(board, m, ctx)]


# ---------------------------------------------------------------- shared board helpers

def _captures_to(board: chess.Board, square: int) -> list[chess.Move]:
    return [m for m in board.legal_moves if m.to_square == square and board.is_capture(m)]


def _cheapest_capture_to(board: chess.Board, square: int) -> Optional[chess.Move]:
    caps = _captures_to(board, square)
    if not caps:
        return None
    return min(caps, key=lambda m: ATTACKER_ORDER[board.piece_at(m.from_square).piece_type])


def _loose_and_held_targets(board: chess.Board) -> tuple[list[int], list[int]]:
    """Capturable opponent non-pawn pieces, split by whether anything defends them."""
    them = not board.turn
    by_dest: dict[int, list[chess.Move]] = {}
    for m in board.legal_moves:
        if board.is_capture(m):
            by_dest.setdefault(m.to_square, []).append(m)
    loose, held = [], []
    for sq, piece in board.piece_map().items():
        if piece.color != them or piece.piece_type in (chess.PAWN, chess.KING):
            continue
        if sq not in by_dest:
            continue
        (loose if not board.attackers(them, sq) else held).append(sq)
    return loose, held


def _opponent_has_mate_in_one(board: chess.Board) -> bool:
    """Whether the side to move can mate immediately. Called on a board it is THEIR turn on."""
    for m in board.legal_moves:
        if board.gives_check(m):
            board.push(m)
            mate = board.is_checkmate()
            board.pop()
            if mate:
                return True
    return False


def _threatens_mate_after_pass(board: chess.Board) -> bool:
    """
    Whether the opponent would mate if we did nothing.

    THE NULL MOVE IS THE STANDARD WAY TO ASK THIS and it is illegal in check, which is why every
    corpus in this program excludes positions where the side to move is in check. That exclusion
    was made for a different reason (a forced reply is not a free choice) and happens to be the
    precondition here too.
    """
    if board.is_check():
        return False
    board.push(chess.Move.null())
    threat = _opponent_has_mate_in_one(board)
    board.pop()
    return threat


def _opponent_has_check_available(board: chess.Board) -> bool:
    if board.is_check():
        return False
    board.push(chess.Move.null())
    has = any(board.gives_check(m) for m in board.legal_moves)
    board.pop()
    return has


def _mating_moves(board: chess.Board) -> list[chess.Move]:
    out = []
    for m in board.legal_moves:
        if board.gives_check(m):
            board.push(m)
            if board.is_checkmate():
                out.append(m)
            board.pop()
    return out


# ---------------------------------------------------------------- RC-00  ceiling anchor

def _mate1_trigger(board: chess.Board, ctx: Context) -> Optional[TriggerState]:
    mates = _mating_moves(board)
    if len(mates) == 1:
        # EXACTLY ONE, so B is a single unambiguous act. With two mates in the position a player
        # who finds either has applied the rule, and "which one" would be scoring the wrong thing.
        return "positive"
    if len(mates) == 0 and any(board.gives_check(m) for m in board.legal_moves):
        # A CHECK IS AVAILABLE AND IS NOT MATE. This is the noise trial the rule is about: the
        # error the rule prevents is playing a check in the belief that it ends the game.
        return "negative"
    return None


def _mate1_satisfies(board: chess.Board, move: chess.Move, ctx: Context) -> bool:
    """Gave check. On T+ the mate is a check; on T- every check is a false alarm."""
    return board.gives_check(move)


# ---------------------------------------------------------------- RC-01  incumbent floor

def _loose_trigger(board: chess.Board, ctx: Context) -> Optional[TriggerState]:
    loose, held = _loose_and_held_targets(board)
    if len(loose) == 1:
        return "positive"
    if len(loose) == 0 and held:
        return "negative"
    return None


def _loose_designated(board: chess.Board) -> Optional[int]:
    loose, held = _loose_and_held_targets(board)
    if len(loose) == 1:
        return loose[0]
    if len(loose) == 0 and held:
        return max(held, key=lambda s: (VALUES[board.piece_at(s).piece_type], -s))
    return None


def _loose_satisfies(board: chess.Board, move: chess.Move, ctx: Context) -> bool:
    sq = _loose_designated(board)
    return sq is not None and move.to_square == sq and board.is_capture(move)


# ---------------------------------------------------------------- RC-02  recapture

def _recapture_trigger(board: chess.Board, ctx: Context) -> Optional[TriggerState]:
    """
    THE MOST TIGHTLY MATCHED PAIR IN THIS FILE, and that is the reason it is here.

    In BOTH states an enemy piece stands on the square the opponent just moved to, and in both we
    can legally take it. The one thing that differs is whether that move took something of ours.
    Everything else about the position -- material, mobility, phase, king safety -- is whatever it
    happened to be, on both sides of the contrast. C6 is not something this candidate has to be
    argued into; it is how it is built.
    """
    if ctx.prev_move is None:
        return None
    q = ctx.prev_move.to_square
    piece = board.piece_at(q)
    if piece is None or piece.color == board.turn:
        return None
    if not _captures_to(board, q):
        return None
    # Whether that move TOOK something is not recoverable from the resulting position -- a board
    # cannot say what used to stand on a square -- so it travels in the context, written once by
    # whoever walked the game.
    return "positive" if ctx.prev_was_capture else "negative"


def _recapture_satisfies(board: chess.Board, move: chess.Move, ctx: Context) -> bool:
    return (
        ctx.prev_move is not None
        and move.to_square == ctx.prev_move.to_square
        and board.is_capture(move)
    )


# ---------------------------------------------------------------- RC-03  take the checker

def _checker_trigger(board: chess.Board, ctx: Context) -> Optional[TriggerState]:
    """
    NOT USABLE ON THE MAIN CORPUS, and it is here so that the reason is a measurement.

    Every corpus in this program excludes positions where the side to move is in check, because a
    forced reply is not a free choice. This candidate needs exactly those positions. It is
    declared, its base rate is reported as zero under the shared exclusion, and the screen records
    it as UNTESTED rather than as failed -- those are different outcomes and collapsing them would
    hide a real option.
    """
    if not board.is_check():
        return None
    checkers = list(board.checkers())
    if len(checkers) != 1:
        return None
    q = checkers[0]
    if not _captures_to(board, q):
        return None
    return "positive" if not board.attackers(not board.turn, q) else "negative"


def _checker_satisfies(board: chess.Board, move: chess.Move, ctx: Context) -> bool:
    checkers = list(board.checkers())
    if len(checkers) != 1:
        return False
    return move.to_square == checkers[0] and board.is_capture(move)


# ---------------------------------------------------------------- RC-04  save the attacked piece

def _attacked_piece(board: chess.Board) -> Optional[tuple[int, bool]]:
    """
    Our single attacked non-pawn piece, and whether it is materially threatened.

    Threatened means: attacked by something cheaper, or attacked and undefended. Both are pure
    attacker/defender geometry -- no SEE, no engine.
    """
    us = board.turn
    found = []
    for sq, piece in board.piece_map().items():
        if piece.color != us or piece.piece_type in (chess.PAWN, chess.KING):
            continue
        attackers = board.attackers(not us, sq)
        if not attackers:
            continue
        defenders = board.attackers(us, sq)
        cheaper = any(
            ATTACKER_ORDER[board.piece_at(a).piece_type] < VALUES[piece.piece_type]
            for a in attackers
        )
        found.append((sq, cheaper or not defenders))
    if len(found) != 1:
        return None
    return found[0]


def _save_trigger(board: chess.Board, ctx: Context) -> Optional[TriggerState]:
    hit = _attacked_piece(board)
    if hit is None:
        return None
    sq, threatened = hit
    if not any(m.from_square == sq for m in board.legal_moves):
        # C5 in the other direction: the prescribed act has to be available, or the item is not an
        # item. A piece with nowhere to go tests nothing about noticing that it is attacked.
        return None
    return "positive" if threatened else "negative"


def _save_satisfies(board: chess.Board, move: chess.Move, ctx: Context) -> bool:
    hit = _attacked_piece(board)
    return hit is not None and move.from_square == hit[0]


# ---------------------------------------------------------------- RC-05  promote

def _promotions(board: chess.Board) -> list[chess.Move]:
    return [m for m in board.legal_moves if m.promotion == chess.QUEEN]


def _promote_trigger(board: chess.Board, ctx: Context) -> Optional[TriggerState]:
    proms = _promotions(board)
    if not proms:
        return None
    squares = {m.to_square for m in proms}
    if len(squares) != 1:
        return None
    q = next(iter(squares))
    safe = not board.attackers(not board.turn, q)
    return "positive" if safe else "negative"


def _promote_satisfies(board: chess.Board, move: chess.Move, ctx: Context) -> bool:
    return move.promotion == chess.QUEEN


# ---------------------------------------------------------------- RC-06  answer the mate threat

def _threat_trigger(board: chess.Board, ctx: Context) -> Optional[TriggerState]:
    if _threatens_mate_after_pass(board):
        return "positive"
    if _opponent_has_check_available(board):
        return "negative"
    return None


def _threat_satisfies(board: chess.Board, move: chess.Move, ctx: Context) -> bool:
    """
    The move removes the threat that fired the trigger.

    A PREDICATE, NOT A NAMED MOVE, and that is the point of including this family: many different
    moves answer a mate threat and the rule does not say which. B is still directly observable
    from the board with no engine -- push the move, ask what the opponent has now -- which is what
    C2 and C7 actually require. What it costs is specificity, and `prescription_size` is where
    that cost shows up.

    IT BRANCHES ON THE TRIGGER, AND THE FIRST VERSION DID NOT. That version asked "is the
    opponent without a mate in one" on both sides of the contrast, which on a T- item -- where
    they never had one -- is satisfied by very nearly every legal move. The false-alarm cell was
    degenerate: P(B_valid | T-) would have come out near 1 and the separation near 0, for a
    reason that is about the predicate rather than about the rule class. Recomputing the trigger
    here is legitimate because the trigger is a function of the board alone; no behaviour and no
    oracle enters.
    """
    state = _threat_trigger(board, ctx)
    board.push(move)
    try:
        if state == "positive":
            return not _opponent_has_mate_in_one(board)
        # T-: the threat was a mere check, so removing it means leaving them no check at all.
        # Spending a move on that is the error this rule class's noise trial is made of.
        return not any(board.gives_check(m) for m in board.legal_moves)
    finally:
        board.pop()


# ---------------------------------------------------------------- the severity ladder
#
# WHY THESE EXIST, AND WHAT THEY ARE A TEST OF RATHER THAN A SEARCH.
#
# The first screen found exactly one eligible rule class, `RC-06 answer-the-mate-threat`, and the
# explanation offered for why the four capture families failed was structural: an OFFENSIVE rule
# competes with the whole rest of the board and is wrong whenever something better exists, while a
# DEFENSIVE rule against mate has no competition, because the alternative is losing. Severity
# protects the prescription.
#
# That is a mechanism, and a mechanism that only explains the data it was derived from is a story.
# So it is stated here as a prediction that these rule classes can falsify:
#
#   H1  SEVERITY.  `B_valid | T+` declines monotonically as the severity of the answered threat
#       declines: mate > queen > rook > minor. If it does not, severity is not what protects the
#       prescription and the explanation for RC-06 is wrong.
#
#   H2  OUTCOME vs METHOD.  `RC-04 save-the-attacked-piece` prescribed a METHOD -- "move that
#       piece" -- and scored .708. `RC-06` prescribed an OUTCOME -- "the threat is gone" -- and
#       scored .968. Those differ in trigger AND in prescription shape, so the comparison is
#       confounded. `RC-11` fixes that: the same trigger as `RC-09`, the same corpus, the same
#       noise cell, and only the prescription shape changed.
#
# ONE NOISE CELL FOR THE WHOLE LADDER. Every tier's T- is "the only thing the opponent threatens
# is a pawn", so the tiers differ from each other in exactly one thing -- what is at stake on the
# positive side -- and are directly comparable. The false alarm is spending your move to save a
# pawn.
#
# NO SEE AND NO ENGINE ANYWHERE IN HERE. "Threatened" is attacker/defender geometry: the opponent
# attacks the piece, and either nothing defends it or something cheaper attacks it. That is the
# same relation `RC-04` uses, computed from our side instead of theirs.


def _in_bad_spot(board: chess.Board, square: int, color: chess.Color) -> bool:
    """A piece of `color` on `square` that the opponent can profitably take, by geometry alone."""
    piece = board.piece_at(square)
    if piece is None or piece.color != color or piece.piece_type == chess.KING:
        return False
    attackers = board.attackers(not color, square)
    if not attackers:
        return False
    defenders = board.attackers(color, square)
    cheaper = any(
        ATTACKER_ORDER[board.piece_at(a).piece_type] < VALUES[piece.piece_type]  # type: ignore[union-attr]
        for a in attackers
    )
    return cheaper or not defenders


def _designated_threat(board: chess.Board) -> Optional[tuple[int, int]]:
    """
    The most valuable piece of ours the opponent can win, as (square, value).

    MOST VALUABLE, TIE-BROKEN BY SQUARE INDEX, so the designated piece is deterministic and does
    not depend on dictionary ordering. When several things hang at once the rule is about the
    biggest one; the rest are recorded by the tier's own trigger refusing to fire.
    """
    us = board.turn
    best = None
    for sq, piece in board.piece_map().items():
        if piece.color != us or piece.piece_type == chess.KING:
            continue
        if _in_bad_spot(board, sq, us):
            key = (VALUES[piece.piece_type], -sq)
            if best is None or key > best[0]:
                best = (key, sq, VALUES[piece.piece_type])
    return (best[1], best[2]) if best else None


def _threat_answered(board: chess.Board, move: chess.Move, square: int) -> bool:
    """
    Did the move stop the opponent from winning that piece?

    THE PIECE IS FOLLOWED, NOT THE SQUARE, and the difference is the whole point. Checking whether
    the ORIGINAL square is still attacked would score "I moved my hanging rook to another square
    where it also hangs" as a success, because the old square is empty. Following the piece to
    `move.to_square` catches that. A piece that is gone entirely -- traded off, or promoted -- is
    an answered threat: the opponent cannot win what no longer exists.
    """
    target = board.piece_at(square)
    if target is None:
        return False
    colour, kind = target.color, target.piece_type
    new_square = move.to_square if move.from_square == square else square
    board.push(move)
    try:
        piece = board.piece_at(new_square)
        if piece is None or piece.color != colour or piece.piece_type != kind:
            return True
        return not _in_bad_spot(board, new_square, colour)
    finally:
        board.pop()


def _tier_trigger(value: int):
    """A trigger for one rung of the ladder. T+ at this value, T- when only a pawn is at stake."""

    def trigger(board: chess.Board, ctx: Context) -> Optional[TriggerState]:
        hit = _designated_threat(board)
        if hit is None:
            return None
        _square, worth = hit
        if worth == value:
            return "positive"
        if worth == VALUES[chess.PAWN]:
            return "negative"
        return None

    return trigger


def _tier_satisfies(board: chess.Board, move: chess.Move, ctx: Context) -> bool:
    """The outcome prescription: whatever was at stake is no longer winnable."""
    hit = _designated_threat(board)
    return hit is not None and _threat_answered(board, move, hit[0])


def _tier_satisfies_by_moving(board: chess.Board, move: chess.Move, ctx: Context) -> bool:
    """The method prescription: the piece was moved. H2's whole content is this line."""
    hit = _designated_threat(board)
    return hit is not None and move.from_square == hit[0]


# ---------------------------------------------------------------- RC-12  stop the promotion

def _safe_promotions_for_mover(board: chess.Board) -> int:
    """
    Promotions available to WHOEVER IS TO MOVE, onto a square the other side does not attack.

    SPLIT OUT FROM THE NULL-MOVE WRAPPER BELOW, AND THE SPLIT IS A BUG FIX. The first version had
    one function that always null-moved. `_promotion_stop_satisfies` called it AFTER pushing our
    move -- at which point it is already the opponent's turn -- so the extra null move handed the
    turn back to us and the function counted OUR promotions instead of theirs. The symptom was
    `prescription_size` of 0.969 on T+: nearly every legal move appeared to answer the threat,
    which is not a thing that can be true. The guard that exists to stop a vacuous prescription
    from scoring well is what surfaced it.
    """
    return sum(
        1
        for m in board.legal_moves
        if m.promotion == chess.QUEEN and not board.attackers(not board.turn, m.to_square)
    )


def _their_safe_promotions(board: chess.Board) -> int:
    """The same question about the opponent, asked on a board where it is OUR turn."""
    if board.is_check():
        return 0
    board.push(chess.Move.null())
    try:
        return _safe_promotions_for_mover(board)
    finally:
        board.pop()


def _promotion_stop_trigger(board: chess.Board, ctx: Context) -> Optional[TriggerState]:
    if _their_safe_promotions(board) > 0:
        return "positive"
    hit = _designated_threat(board)
    if hit is not None and hit[1] == VALUES[chess.PAWN]:
        return "negative"
    return None


def _promotion_stop_satisfies(board: chess.Board, move: chess.Move, ctx: Context) -> bool:
    """
    Branches on the trigger, for the reason `_threat_satisfies` branches: on a T- item the
    opponent never had a promotion, so "they still have none" would be satisfied by almost every
    legal move and the false-alarm cell would be degenerate.
    """
    positive = _their_safe_promotions(board) > 0
    if positive:
        board.push(move)
        try:
            # No null move here: after our move it is ALREADY their turn.
            return _safe_promotions_for_mover(board) == 0
        finally:
            board.pop()
    hit = _designated_threat(board)
    return hit is not None and _threat_answered(board, move, hit[0])


# ---------------------------------------------------------------- the register

RULE_CLASSES: list[RuleClass] = [
    RuleClass(
        id="RC-00",
        name="mate-in-one",
        family="immediate mate threats",
        role="ceiling-anchor",
        trigger=_mate1_trigger,
        satisfies=_mate1_satisfies,
        c3_grade="existential-over-legal-moves",
        needs_previous_move=False,
        prescription="if a move mates, play it; a check that is not mate is the error",
        literature=(
            "STRONG, and only for the detection half. Mating tasks are a validated "
            "expertise-sensitive paradigm: Kuchelmeister et al. (2024), 'Expertise-dependent "
            "visuocognitive performance of chess players in mating tasks', Frontiers in "
            "Psychology 15:1294424, ran n-mate tasks on a real board with eye tracking across "
            "novice/intermediate/expert. Sheridan & Reingold (2014) use the same logic on "
            "minimised boards. Every one of these measures whether the player SEES the mate; "
            "none measures whether they then play it."
        ),
        caveats=[
            "C3 is `existential-over-legal-moves`: T is 'a mating move exists', so C4 is nearly "
            "definitional and the construct is 'did you SEE it', not 'does knowledge control "
            "the act'. This is why it is an ANCHOR and not a product candidate.",
            "B is 'gave check', which on T+ is satisfied by non-mating checks too. That is "
            "deliberate: it keeps the same B on both sides of the contrast, which is what makes "
            "the T- cell a false-alarm cell rather than a different measurement.",
        ],
    ),
    RuleClass(
        id="RC-01",
        name="loose-piece",
        family="elementary tactical safety relations",
        role="incumbent-floor",
        trigger=_loose_trigger,
        satisfies=_loose_satisfies,
        c3_grade="independent",
        needs_previous_move=False,
        prescription="if exactly one enemy piece is capturable and undefended, take it",
        literature=(
            "No validated instrument. The practitioner heuristic 'loose pieces drop off' is "
            "tier F. See docs/measurement/EXISTING_MEASURE_AUDIT.md."
        ),
        caveats=[
            "Already refuted as a measurement in docs/measurement/FALSIFICATION_REGISTER.md. "
            "Re-measured here under the identical harness so every candidate is compared with "
            "the incumbent by the same instrument rather than across two studies.",
        ],
    ),
    RuleClass(
        id="RC-02",
        name="recapture",
        family="recapture decisions",
        role="candidate",
        trigger=_recapture_trigger,
        satisfies=_recapture_satisfies,
        c3_grade="independent",
        needs_previous_move=True,
        prescription="if the opponent just captured on a square you attack, take back there",
        literature=(
            "No dedicated validated paradigm found. Recapture is the canonical worked example in "
            "static-exchange treatments (Chess Programming Wiki, SEE) and in every introductory "
            "text; that is tier E/F support for the CONSTRUCT existing, not for a measure of it."
        ),
        caveats=[
            "T reads the previous move, so it is a property of a position PLUS one ply of "
            "history, not of a position alone. docs/measurement/ITEM_BANK_PROTOCOL.md rejected "
            "this family on that ground; the rejection was too strict -- history before the "
            "player's turn is available before behaviour, which is what C1 asks -- and this "
            "candidate is the correction.",
        ],
    ),
    RuleClass(
        id="RC-03",
        name="capture-the-checker",
        family="responding to check / escaping check",
        role="candidate",
        trigger=_checker_trigger,
        satisfies=_checker_satisfies,
        c3_grade="independent",
        needs_previous_move=False,
        prescription="when a single piece checks you and nothing defends it, capture it",
        literature=(
            "STRONGEST IN THIS TABLE, and again only for detection. Check detection is the "
            "most-replicated chess-perception task: Sheridan & Reingold (2014) minimised-board "
            "check and double-check detection; Rosch & Vogel (2022), 'Expertise-dependent "
            "perceptual performance in chess tasks with varying complexity', Frontiers in "
            "Psychology 13:986787, report a check/no-check priming RT task with an expert "
            "congruency advantage and expert immunity to a distractor cost novices pay."
        ),
        caveats=[
            "Needs positions where the side to move IS in check -- exactly the positions every "
            "corpus here excludes, because a forced reply is not a free choice. Its base rate "
            "under the shared exclusion is zero by construction and the screen records it as "
            "UNTESTED, not as failed.",
        ],
    ),
    RuleClass(
        id="RC-04",
        name="save-the-attacked-piece",
        family="forced defensive responses",
        role="candidate",
        trigger=_save_trigger,
        satisfies=_save_satisfies,
        c3_grade="independent",
        needs_previous_move=False,
        prescription="if exactly one of your pieces is attacked and materially threatened, move it",
        literature=(
            "MODERATE, detection only. The threat-detection task -- count the black pieces "
            "attacking white pieces -- is used in the chess-expertise eye-movement literature, "
            "where experts fixate the pieces forming the threat relationship more than novices "
            "do, within the first three seconds. It establishes that threat relations are "
            "perceptually available to experts. It says nothing about what they then play."
        ),
        caveats=[
            "B is 'moved that piece', a set of moves rather than one. Moving it is also not the "
            "only correct answer -- defending it or counter-attacking can be better -- so a low "
            "P(B_valid | T+) here would be evidence about the PRESCRIPTION, not about players.",
        ],
    ),
    RuleClass(
        id="RC-05",
        name="safe-promotion",
        family="promotion-race decisions",
        role="candidate",
        trigger=_promote_trigger,
        satisfies=_promote_satisfies,
        c3_grade="independent",
        needs_previous_move=False,
        prescription="if a pawn can promote to a square nothing attacks, promote",
        literature="None found. Declared absent rather than padded.",
        caveats=["Base rate expected to be very low; C9 is the criterion this is likely to fail."],
    ),
    RuleClass(
        id="RC-06",
        name="answer-the-mate-threat",
        family="threat recognition",
        role="candidate",
        trigger=_threat_trigger,
        satisfies=_threat_satisfies,
        c3_grade="independent",
        needs_previous_move=False,
        prescription="if the opponent threatens mate next move, play a move that stops it",
        literature=(
            "MODERATE, detection only. Threat recognition is a named construct in chess "
            "cognition and the threat-detection task above is its validated form. The mating "
            "literature covers seeing a mate; nothing found covers preventing the opponent's."
        ),
        caveats=[
            "B is a predicate over the resulting position, so the satisfying set can be large. "
            "`prescription_size` is the guard: a rule satisfied by most legal moves scores well "
            "on C4 for no good reason.",
        ],
    ),
    RuleClass(
        id="RC-07",
        name="answer-the-queen-threat",
        family="severity ladder: defensive threat answering",
        role="candidate",
        trigger=_tier_trigger(VALUES[chess.QUEEN]),
        satisfies=_tier_satisfies,
        c3_grade="independent",
        needs_previous_move=False,
        prescription="if the opponent can win your queen, stop them",
        literature=(
            "MODERATE, detection only, and it is the same source as RC-04's: the chess-expertise threat-detection task (count the pieces forming a threat relationship) establishes that threat relations are perceptually available to experts within the first three seconds. Nothing found measures whether they then answer the threat."
        ),
        caveats=[
            "H1's top material rung. The mechanism predicts it scores below the mate rung and above the rook rung; anything else falsifies the severity account of why RC-06 worked.",
            "The noise cell is shared with every other rung of the ladder -- T- is always 'the only thing at stake is a pawn' -- so the rungs differ from one another in exactly one thing, which is what makes H1 a comparison rather than four separate studies.",
        ],
    ),
    RuleClass(
        id="RC-08",
        name="answer-the-rook-threat",
        family="severity ladder: defensive threat answering",
        role="candidate",
        trigger=_tier_trigger(VALUES[chess.ROOK]),
        satisfies=_tier_satisfies,
        c3_grade="independent",
        needs_previous_move=False,
        prescription="if the opponent can win your rook, stop them",
        literature=(
            "MODERATE, detection only, and it is the same source as RC-04's: the chess-expertise threat-detection task (count the pieces forming a threat relationship) establishes that threat relations are perceptually available to experts within the first three seconds. Nothing found measures whether they then answer the threat."
        ),
        caveats=[
            "H1's middle rung.",
            "The noise cell is shared with every other rung of the ladder -- T- is always 'the only thing at stake is a pawn' -- so the rungs differ from one another in exactly one thing, which is what makes H1 a comparison rather than four separate studies.",
        ],
    ),
    RuleClass(
        id="RC-09",
        name="answer-the-minor-threat",
        family="severity ladder: defensive threat answering",
        role="candidate",
        trigger=_tier_trigger(VALUES[chess.KNIGHT]),
        satisfies=_tier_satisfies,
        c3_grade="independent",
        needs_previous_move=False,
        prescription="if the opponent can win a knight or bishop, stop them",
        literature=(
            "MODERATE, detection only, and it is the same source as RC-04's: the chess-expertise threat-detection task (count the pieces forming a threat relationship) establishes that threat relations are perceptually available to experts within the first three seconds. Nothing found measures whether they then answer the threat."
        ),
        caveats=[
            "H1's bottom rung, and half of H2's controlled pair: RC-11 has this exact trigger and a different prescription.",
            'Knight and bishop share a value here, so this rung is both minors together. Separating them would have made two rungs at the same severity, which is not a rung.',
            "The noise cell is shared with every other rung of the ladder -- T- is always 'the only thing at stake is a pawn' -- so the rungs differ from one another in exactly one thing, which is what makes H1 a comparison rather than four separate studies.",
        ],
    ),
    RuleClass(
        id="RC-11",
        name="move-the-threatened-minor",
        family="prescription-shape control",
        role="candidate",
        trigger=_tier_trigger(VALUES[chess.KNIGHT]),
        satisfies=_tier_satisfies_by_moving,
        c3_grade="independent",
        needs_previous_move=False,
        prescription="if a knight or bishop of yours can be won, move it",
        literature=(
            "None. This is a control, not a construct: its literature is RC-09's."
        ),
        caveats=[
            "H2'S CONTROL, AND ITS ONLY REASON FOR EXISTING. Identical trigger to RC-09, identical corpus, identical noise cell; the ONE thing that differs is that B names a method (move the piece) instead of an outcome (the threat is gone). RC-04 scored .708 with a method and RC-06 scored .968 with an outcome, but those also differed in trigger, so that comparison could not separate the two explanations. This pair can.",
            'A LOW SCORE HERE IS NOT A FAILURE OF THIS CANDIDATE. It is the measurement H2 asked for, and the difference from RC-09 is the result whichever way it goes.',
        ],
    ),
    RuleClass(
        id="RC-12",
        name="stop-the-promotion",
        family="severity ladder: defensive threat answering",
        role="candidate",
        trigger=_promotion_stop_trigger,
        satisfies=_promotion_stop_satisfies,
        c3_grade="independent",
        needs_previous_move=False,
        prescription="if the opponent can safely promote a pawn, prevent it",
        literature=(
            'None found. Declared absent rather than padded.'
        ),
        caveats=[
            'A SEPARATE SEVERITY-PROTECTED FAMILY rather than a rung: what is at stake is a queen, but the threat is a promotion rather than a capture, so it tests whether the mechanism is about severity itself or only about material already on the board.',
            "Base rate expected to be low, as RC-05's was. C9 is the criterion this is likeliest to fail, and a low base rate is a measurement rather than a disqualification.",
        ],
    ),
]

BY_ID = {rc.id: rc for rc in RULE_CLASSES}


#: Families considered and rejected on structure alone, recorded so the search is not silently
#: narrower than it claims. A structural rejection is cheaper than a measurement and is not worth
#: less; what would be worth less is leaving them out and implying they were never thought about.
#: WHAT THE LITERATURE SEARCH FOUND, AS ONE SENTENCE, because it is the same sentence for every
#: family and that is itself the finding: EVERY VALIDATED CHESS PARADIGM MEASURES DETECTION, NOT
#: ACTION. Check detection, mate detection, threat detection -- all of them ask whether the player
#: SAW something, none asks whether the seeing governed the move. C8 support therefore never
#: transfers to the half of the construct this program cares about, in any family tried.
LITERATURE_COVERS_DETECTION_NOT_ACTION = True

#: The two predictions the second batch of candidates exists to falsify, written down BEFORE the
#: screen ran. `screen_rule_classes.py` reports them and does not decide them; a mechanism that
#: only explains the data it was derived from is a story, and this is what makes it a claim.
PREDICTIONS = {
    "H1_severity": (
        "B_valid | T+ declines monotonically down the severity ladder: "
        "RC-06 mate > RC-07 queen > RC-08 rook > RC-09 minor. If it does not, severity is not "
        "what protects the prescription and the explanation given for RC-06 is wrong."
    ),
    "H2_outcome_over_method": (
        "RC-09 (outcome: the threat is gone) scores above RC-11 (method: move the piece), on an "
        "identical trigger and an identical noise cell. This is the controlled version of the "
        "confounded RC-04 vs RC-06 comparison."
    ),
}

STRUCTURALLY_REJECTED = [
    {
        "family": "legal / illegal tactical affordances",
        "why": (
            "In every interface this product could ship, illegal moves are unplayable. B has no "
            "variance, so there is nothing to discriminate."
        ),
    },
    {
        "family": "prohibitions -- 'do not move a piece to a square a cheaper piece attacks'",
        "why": (
            "Hits are non-events: complying with a prohibition looks identical to never having "
            "considered it. The noise trial would be every other move in the position, so the "
            "false-alarm cell has no natural denominator."
        ),
    },
    {
        "family": "'capture toward the centre' and similar positional maxims",
        "why": "No board-only trigger exists; the condition is a judgement, which is what C3 forbids.",
    },
]
