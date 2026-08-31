"""
WALK THE SAME CORPUS, ASK SEVEN RULE CLASSES INSTEAD OF ONE.

THE SAME 60,000 GAMES, THE SAME SEED, THE SAME SAMPLED PLIES as `scan_games.py`. That is
deliberate and it is the whole comparability argument: the incumbent rule class and every
candidate are measured on one identical set of positions, so a difference between them is a
difference between definitions rather than between studies.

ONE DEPARTURE, AND IT IS RECORDED PER ITEM. `scan_games.py` skipped positions where the side to
move is in check, because a forced reply is not a free choice. `RC-03 capture-the-checker` lives
in exactly those positions. So this scan visits them, stamps `in_check` on every item, and lets
the screen apply the exclusion per candidate: everything except RC-03 is read on the not-in-check
subset, RC-03 on the in-check one. Two denominators, both reported. Dropping the positions
outright would have made a whole family unanswerable for a reason that has nothing to do with it.

    python scan_rule_classes.py --pgn lichess_db_standard_rated_2013-01.pgn.zst \\
        --max-games 60000 --per-game 3 --seed 20260831 --out rc.jsonl --manifest rc_manifest.json
"""

from __future__ import annotations

import argparse
import io
import json
import random
import sys
from pathlib import Path

import chess
import chess.pgn
import zstandard as zstd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from predicates import position_features  # noqa: E402
from rule_classes import RULE_CLASSES, RULE_CLASS_VERSION, Context  # noqa: E402


def parse_elo(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def scan(pgn_path: str, max_games: int, per_game: int, seed: int, out_path: str) -> dict:
    rng = random.Random(seed)
    games_seen = games_used = positions = written = 0
    in_check_positions = 0
    per_class = {rc.id: {"positive": 0, "negative": 0} for rc in RULE_CLASSES}

    with open(pgn_path, "rb") as fh:
        reader = zstd.ZstdDecompressor().stream_reader(fh)
        text = io.TextIOWrapper(reader, encoding="utf-8", errors="replace")
        out = open(out_path, "w", encoding="utf-8")
        while games_used < max_games:
            game = chess.pgn.read_game(text)
            if game is None:
                break
            games_seen += 1
            h = game.headers
            white_elo, black_elo = parse_elo(h.get("WhiteElo")), parse_elo(h.get("BlackElo"))
            if white_elo is None or black_elo is None:
                continue
            moves = list(game.mainline_moves())
            if len(moves) < 6:
                continue
            games_used += 1

            eligible = list(range(2, len(moves)))
            # SAME DRAW AS `scan_games.py`: same rng stream, same call, same k. Changing
            # `per_game` here would silently change which positions are visited and quietly end
            # the comparability this file's docstring claims.
            for ply in sorted(rng.sample(eligible, min(per_game, len(eligible)))):
                board = game.board()
                prev = None
                prev_was_capture = False
                for m in moves[:ply]:
                    prev_was_capture = board.is_capture(m)
                    prev = m
                    board.push(m)
                positions += 1
                if board.is_check():
                    in_check_positions += 1
                ctx = Context(prev_move=prev, prev_was_capture=prev_was_capture)
                played = moves[ply]

                fired = []
                for rc in RULE_CLASSES:
                    state = rc.trigger(board, ctx)
                    if state is None:
                        continue
                    per_class[rc.id][state] += 1
                    sat = rc.satisfies(board, played, ctx)
                    fired.append(
                        {
                            "rule_class": rc.id,
                            "trigger_state": state,
                            # B, computed from the board and the played move alone. No engine
                            # anywhere in this loop -- adjudication happens in a later stage, on
                            # a sample, into different fields.
                            "observable_action": int(sat),
                        }
                    )
                if not fired:
                    continue

                feats = position_features(board)
                actor_white = board.turn == chess.WHITE
                base = {
                    "source": "lichess_db_standard_rated_2013-01",
                    "source_game_id": h.get("Site", "").rsplit("/", 1)[-1],
                    "source_ply": ply,
                    "fen": board.fen(),
                    "prev_move": prev.uci() if prev else None,
                    "prev_was_capture": int(prev_was_capture),
                    "in_check": int(board.is_check()),
                    "move_played": played.uci(),
                    "actor_elo": white_elo if actor_white else black_elo,
                    "opponent_elo": black_elo if actor_white else white_elo,
                    "time_control": h.get("TimeControl", "?"),
                    "rule_class_version": RULE_CLASS_VERSION,
                    **feats,
                }
                for f in fired:
                    out.write(json.dumps({**base, **f}, separators=(",", ":")) + "\n")
                    written += 1
        out.close()

    return {
        "pgn": pgn_path,
        "seed": seed,
        "per_game": per_game,
        "games_seen": games_seen,
        "games_used": games_used,
        "positions_sampled": positions,
        "positions_in_check": in_check_positions,
        "records_written": written,
        "rule_class_version": RULE_CLASS_VERSION,
        "trigger_counts": per_class,
        "note": (
            "one record per (position, rule class that fired). A position can appear under "
            "several rule classes; they are different items and are never pooled."
        ),
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pgn", required=True)
    ap.add_argument("--max-games", type=int, default=60000)
    ap.add_argument("--per-game", type=int, default=3)
    ap.add_argument("--seed", type=int, default=20260831)
    ap.add_argument("--out", required=True)
    ap.add_argument("--manifest", required=True)
    a = ap.parse_args()
    manifest = scan(a.pgn, a.max_games, a.per_game, a.seed, a.out)
    with open(a.manifest, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    print(json.dumps(manifest, indent=2))
