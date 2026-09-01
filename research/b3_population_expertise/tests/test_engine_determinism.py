"""The engine claim B3's whole difficulty scale rests on, measured rather than assumed.

The repository has already paid for the version of this that was assumed: `StockfishClient` sent no
`ucinewgame`, a game's evaluations were computed against a table warmed by whatever came before,
and the import harness measured a player's accuracy moving by up to 14.3 percentage points on game
order alone.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from engine import Engine  # noqa: E402

BINARY = os.environ.get("B3_ENGINE", "/opt/b3/stockfish-17.1-avx2")
NODES = 60000
FENS = [
    "r2q1rk1/pp1nbppp/2p1pn2/3p4/2PP1B2/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 9",
    "4rrk1/pp3ppp/2n1bn2/q2p4/3P4/P1N1PN2/1PQ2PPP/R3RBK1 w - - 4 17",
    "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
]


def fingerprint(engine, fens):
    out = []
    for fen in fens:
        search = engine.search(fen, NODES)
        out.append(
            (
                fen,
                search.best_move,
                tuple(
                    (it.depth, tuple(sorted((k, v[0], v[1], tuple(v[2])) for k, v in it.lines.items())))
                    for it in search.iterations
                ),
            )
        )
    return {fen: row for fen, *row in [(f, b, i) for f, b, i in out]}


def test_identical_in_a_fresh_process_and_independent_of_order_and_hash_size():
    a = Engine(BINARY, multipv=4)
    first = fingerprint(a, FENS)
    a.quit()

    b = Engine(BINARY, multipv=4)
    second = fingerprint(b, FENS)
    b.quit()
    assert first == second, "the same search in a second process gave a different answer"

    c = Engine(BINARY, multipv=4)
    reversed_order = fingerprint(c, list(reversed(FENS)))
    c.quit()
    assert first == reversed_order, "position order changed a result; the hash is not being cleared"

    d = Engine(BINARY, hash_mb=128, multipv=4)
    bigger_hash = fingerprint(d, FENS)
    d.quit()
    assert first == bigger_hash, "hash size changed a result"


def test_the_engine_names_itself_rather_than_its_filename():
    engine = Engine(BINARY, multipv=4)
    try:
        assert engine.name.startswith("Stockfish"), engine.name
    finally:
        engine.quit()
