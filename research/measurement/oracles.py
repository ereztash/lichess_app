"""
THE FOUR THINGS THAT ARE NOT THE BOARD, KEPT APART FROM IT AND FROM EACH OTHER.

F4 is the falsification that says: the rule only looks valid because Stockfish (or SEE, or the
Lichess theme) is what decides the correct answer. The defence is structural rather than
argumentative -- each oracle writes its own field, no oracle writes another's, and
`docs/measurement/FALSIFICATION_REGISTER.md` reports how often they DISAGREE. A disagreement is
information about the construct. A single fused "ground truth" would have destroyed it.

  board_predicate   `predicates.py`. Geometry and legality. No oracle inside it.
  see_result        this file. A reproduction of a published static-exchange algorithm.
  engine_result     this file. Stockfish, at a recorded build and node budget.
  lichess_theme     read from the puzzle database, never computed.
  human_adjudication not automated. Absent is `UNKNOWN`, and `UNKNOWN` never enters a score.
"""

from __future__ import annotations

import chess
import chess.engine

SEE_VERSION = "1.0.0"

SEE_VALUE = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 20000,
}


def _least_valuable_attacker(board: chess.Board, square: int, color: chess.Color,
                             occupied: chess.SquareSet) -> int | None:
    """The cheapest piece of `color` still on `occupied` that attacks `square`."""
    best = None
    best_val = None
    for sq in board.attackers(color, square):
        if sq not in occupied:
            continue
        piece = board.piece_at(sq)
        if piece is None:
            continue
        val = SEE_VALUE[piece.piece_type]
        if best_val is None or val < best_val:
            best, best_val = sq, val
    return best


def see(board: chess.Board, move: chess.Move) -> int | None:
    """
    Static exchange evaluation of one capture, in centipawns, from the mover's point of view.

    WHAT THIS IS. A faithful reproduction of the standard swap-off algorithm described in the
    Chess Programming Wiki ("Static Exchange Evaluation -- The Swap Algorithm"): play out the
    capture sequence on one square with the least valuable attacker each time, then fold the
    gain list back with a negamax max(-a, b).

    WHAT THIS IS NOT, and this is the entire reason it is in `oracles.py`:
      * not an evaluation of the position,
      * not a statement that the capture is good,
      * not aware of pins, discovered attacks, overloaded defenders, back-rank mates, or of
        anything at all that happens on another square.
    An SEE of 0 on a defended rook is compatible with the capture being winning, losing or
    irrelevant. It measures the material outcome of a swap-off and nothing else, which is
    precisely why it may not be allowed to define the construct.

    RECURSION IS NOT USED because the published algorithm is iterative and the iterative form is
    the one that has a stated termination condition. `None` for a non-capture, whose swap value
    is not defined.

    KNOWN DEPARTURE, RECORDED RATHER THAN HIDDEN: x-ray attackers behind a departing piece are
    NOT re-discovered, because `board.attackers` recomputes from the real board and this
    implementation only removes squares from an `occupied` set it carries alongside. That makes
    this a LOWER-FIDELITY SEE than Stockfish's on batteries (Q behind R, B behind P). It is kept
    because the alternative was a second unvalidated implementation of sliding-piece x-ray
    resolution, and because `engine_result` is present in every record to disagree with it.
    """
    if not board.is_capture(move):
        return None

    if board.is_en_passant(move):
        captured_value = SEE_VALUE[chess.PAWN]
    else:
        victim = board.piece_at(move.to_square)
        if victim is None:
            return None
        captured_value = SEE_VALUE[victim.piece_type]

    attacker = board.piece_at(move.from_square)
    if attacker is None:
        return None

    occupied = chess.SquareSet(board.occupied)
    occupied.discard(move.from_square)

    gain = [captured_value]
    on_square_value = SEE_VALUE[attacker.piece_type]
    side = not board.turn

    while True:
        frm = _least_valuable_attacker(board, move.to_square, side, occupied)
        if frm is None:
            break
        gain.append(on_square_value - gain[-1])
        piece = board.piece_at(frm)
        assert piece is not None
        on_square_value = SEE_VALUE[piece.piece_type]
        occupied.discard(frm)
        side = not side

    for i in range(len(gain) - 2, -1, -1):
        gain[i] = -max(-gain[i], gain[i + 1])
    return gain[0]


class Engine:
    """
    Stockfish, with its build and budget recorded on every answer it gives.

    NODES, NOT DEPTH. A depth-N search is a different amount of work in a quiet endgame and a
    tactical middlegame, so a corpus scored by depth is a corpus where the hard items got more
    thinking. `scripts/uci-engine.ts` in this repository made the same choice for the same
    reason, and this is the Python side of that argument, not a second opinion about it.
    """

    def __init__(self, path: str, nodes: int = 200_000, threads: int = 1, hash_mb: int = 64):
        self.engine = chess.engine.SimpleEngine.popen_uci(path)
        self.engine.configure({"Threads": threads, "Hash": hash_mb})
        self.nodes = nodes
        self.build = self.engine.id.get("name", "unknown")

    def evaluate(self, board: chess.Board, multipv: int = 3) -> dict:
        """Top `multipv` lines. Scores are POV of the side to move, in centipawns or mate."""
        info = self.engine.analyse(
            board, chess.engine.Limit(nodes=self.nodes), multipv=multipv
        )
        lines = []
        for entry in info:
            pv = entry.get("pv") or []
            score = entry["score"].pov(board.turn)
            lines.append(
                {
                    "move": pv[0].uci() if pv else None,
                    "cp": score.score(),          # None when it is a mate score
                    "mate": score.mate(),         # None when it is a cp score
                    "is_mate": score.is_mate(),
                }
            )
        return {
            "engine_build": self.build,
            "engine_nodes": self.nodes,
            "lines": lines,
        }

    def score_move(self, board: chess.Board, move: chess.Move) -> dict:
        """
        What the engine thinks of ONE named move, searched under the same budget.

        This is how the record can hold "the engine's best move" and "the engine's opinion of the
        capture" as two separate facts. A design that stored only the first would make every
        non-best move indistinguishable from every other.
        """
        info = self.engine.analyse(
            board, chess.engine.Limit(nodes=self.nodes), root_moves=[move]
        )
        entry = info[0] if isinstance(info, list) else info
        score = entry["score"].pov(board.turn)
        return {"cp": score.score(), "mate": score.mate(), "is_mate": score.is_mate()}

    def close(self) -> None:
        self.engine.quit()
