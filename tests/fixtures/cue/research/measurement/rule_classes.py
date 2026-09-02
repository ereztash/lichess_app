"""
THE CONTROL FOR `GATE-CUE-PLAYER-OBSERVABLE`, and it must go red.

A register with two rule classes. The first is honest: its trigger is board geometry, exactly the
shape every class in the real register has. The second is the defect the gate exists to catch -- a
cue defined by an evaluation, which no player can see at the board and which would make a
behavioural packet untestable rather than merely weak.

`_sharp_trigger` is not a straw man. It is the most natural wrong thing somebody would write: "fire
when the position is roughly level and sharp" is a sentence a product person would ask for, and the
only way to compute it is to ask an engine. That is exactly why it must fail here rather than in a
review.

THE THIRD CASE IS THE ONE THAT MATTERS MOST. `_deep_trigger` is four clean lines and calls a helper
that does the forbidden thing, so a scanner that read only the declaration would pass it. The real
register has the same shape -- `_promote_trigger` is four lines that call `_promotions`.
"""


def _promotions(board):
    return [m for m in board.legal_moves if m.promotion == 5]


def _honest_trigger(board, ctx):
    proms = _promotions(board)
    if not proms:
        return None
    squares = {m.to_square for m in proms}
    if len(squares) != 1:
        return None
    q = next(iter(squares))
    return "positive" if not board.attackers(not board.turn, q) else "negative"


def _sharp_trigger(board, ctx):
    info = _ENGINE.analyse(board, Limit(nodes=200000))
    cp = info["score"].pov(board.turn).score()
    return "positive" if abs(cp) < 50 else "negative"


def _losing_side_helper(board):
    info = _ENGINE.analyse(board, Limit(nodes=200000))
    return info["score"].pov(board.turn).wdl().losses > 500


def _deep_trigger(board, ctx):
    if not board.legal_moves:
        return None
    return "positive" if _losing_side_helper(board) else "negative"


RULE_CLASSES = [
    dict(id="FX-00", trigger=_honest_trigger),
    dict(id="FX-01", trigger=_sharp_trigger),
    dict(id="FX-02", trigger=_deep_trigger),
]
