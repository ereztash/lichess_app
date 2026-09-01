"""Which clause of the functional predicate excludes each position the piece list certifies?

The headline `53.6% functional given piece list` is only a claim about OPPOSING RESOURCES if the
excluding clause is about an opposing resource. Clause 3 -- nothing at all on the promotion path --
also fires on OUR OWN pieces, which is a different fact. This separates them.
"""
import json, sys
from pathlib import Path
import chess
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "measurement"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from rule_classes import _lone_king_defends, _passed_pawns, Context
from predicate_semantics import (_path_squares, _pawn_steps, _enemy_pawn_can_reach,
                                 _enemy_pawn_promotes_within)

counts = {"total_lone_king": 0, "functional": 0,
          "no_forward_push": 0, "own_piece_on_path": 0, "their_king_on_path": 0,
          "enemy_pawn_attacks_path": 0, "enemy_pawn_promotes_in_window": 0}
import argparse
ap = argparse.ArgumentParser(); ap.add_argument("--items", default="rc.jsonl")
_a = ap.parse_args()
for line in open(_a.items):
    r = json.loads(line)
    if r["rule_class"] != "RC-21" or r["in_check"] or r["trigger_state"] != "positive":
        continue
    b = chess.Board(r["fen"]); ctx = Context()
    if not _lone_king_defends(b, ctx):
        continue
    counts["total_lone_king"] += 1
    us = b.turn
    passers = _passed_pawns(b, us)
    if len(passers) != 1:
        continue
    pawn = passers[0]
    path = _path_squares(pawn, us); steps = _pawn_steps(pawn, us)
    fails = []
    if not [m for m in b.legal_moves if m.from_square == pawn
            and chess.square_file(m.to_square) == chess.square_file(pawn)]:
        fails.append("no_forward_push")
    occupied = [sq for sq in path if b.piece_at(sq) is not None]
    if occupied:
        theirs = [sq for sq in occupied if b.piece_at(sq).color != us]
        fails.append("their_king_on_path" if theirs else "own_piece_on_path")
    if _enemy_pawn_can_reach(b, pawn, us, set(path) | {pawn}, steps):
        fails.append("enemy_pawn_attacks_path")
    if _enemy_pawn_promotes_within(b, us, steps):
        fails.append("enemy_pawn_promotes_in_window")
    if not fails:
        counts["functional"] += 1
    for f in fails:
        counts[f] += 1

n = counts["total_lone_king"]
print(json.dumps(counts, indent=1))
print("\nshare of piece-list-certified positions each clause excludes (clauses overlap):")
for k, v in counts.items():
    if k in ("total_lone_king", "functional"):
        continue
    print(f"  {k:32} {v:5d}   {v/n:6.1%}")
print(f"  {'FUNCTIONAL (no clause fires)':32} {counts['functional']:5d}   {counts['functional']/n:6.1%}")
opposing = counts["their_king_on_path"] + counts["enemy_pawn_attacks_path"] + counts["enemy_pawn_promotes_in_window"]
print(f"\n  excluded by at least one OPPOSING-RESOURCE clause (upper bound, overlapping): {opposing}")
print(f"  excluded ONLY by our-own-piece-on-path or no-forward-push: recomputed below")
