"""
F1's POSITIVE CONTROL: generate candidates from a corpus that was never selected by the label.

The claim under attack is that "unprotected-piece capture discrimination" looks clean only
because the example bank was drawn from positions Lichess had already tagged `hangingPiece`. The
only way to answer that is to go somewhere the tag does not exist. This script walks a month of
ordinary rated Lichess games -- every game played, no filter of any kind on tactics, themes,
puzzle-worthiness or outcome -- samples plies uniformly, and applies `predicates.py`.

The comparison against Lichess labels happens in `scan_puzzles.py`, AFTERWARDS, and it is a
separate file so that the order is visible in the repository rather than asserted in prose.

    python scan_games.py --pgn lichess_db_standard_rated_2013-01.pgn.zst \\
                         --max-games 40000 --per-game 3 --seed 20260831 --out games.jsonl

WHY THE OLDEST MONTH. The 2013-01 dump is the smallest one Lichess publishes, and this analysis
needs a population, not a large one. That it is old is a limitation with a direction: the rating
distribution of Lichess in 2013 is not the rating distribution today, so the rates here describe
2013 players. `docs/measurement/FALSIFICATION_REGISTER.md` carries that as an open threat rather
than a footnote.
"""

from __future__ import annotations

import argparse
import io
import json
import random
import sys

import chess
import chess.pgn
import zstandard as zstd

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from predicates import classify, observed_action, position_features, PREDICATE_VERSION  # noqa: E402

CORPUS_SELECTION = {
    "selected_by": "every rated standard game in the month, no tactical filter",
    "excluded": [
        "games with no rating on either side (unrated or provisional-missing)",
        "positions before ply 2, which are book by construction rather than by choice",
        "positions where the side to move is in check -- a forced-reply position is not a "
        "free choice, and B would be measuring legality rather than discrimination",
    ],
    "NOT_excluded": [
        "positions with no capture available",
        "positions the engine dislikes",
        "blunders, mouse-slips, flagged games, or any outcome-conditioned property",
        "anything at all involving a Lichess theme or puzzle label",
    ],
}


def parse_elo(value: str | None) -> int | None:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def scan(pgn_path: str, max_games: int, per_game: int, seed: int, out_path: str) -> dict:
    rng = random.Random(seed)
    games_seen = 0
    games_used = 0
    positions = 0
    written = 0

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
            k = min(per_game, len(eligible))
            for ply in sorted(rng.sample(eligible, k)):
                board = game.board()
                for m in moves[:ply]:
                    board.push(m)
                if board.is_check():
                    continue
                positions += 1
                move = moves[ply]
                cls = classify(board)
                if cls["trigger_state"] == "unknown":
                    # Recorded in the manifest counts, not written out: an UNKNOWN item has no
                    # designated target, so it has no B, so there is nothing for it to say here.
                    continue
                feats = position_features(board)
                d = cls["designated"]
                actor_white = board.turn == chess.WHITE
                rec = {
                    "source": "lichess_db_standard_rated_2013-01",
                    "source_game_id": h.get("Site", "").rsplit("/", 1)[-1],
                    "source_ply": ply,
                    "original_fen": board.fen(),
                    "predicate_version": PREDICATE_VERSION,
                    "trigger_state": cls["trigger_state"],
                    "n_loose": cls["n_loose"],
                    "n_held": cls["n_held"],
                    "n_targets": cls["n_targets"],
                    "target_square": d["square_name"],
                    "target_piece": d["piece_symbol"],
                    "target_value": d["piece_value"],
                    "geometric_defenders": d["geometric_defenders"],
                    "defender_types": d["defender_types"],
                    "attacker_count": d["attacker_count"],
                    "legal_captures_on_target": d["legal_captures"],
                    "cheapest_attacker_value": d["cheapest_attacker_value"],
                    "move_played": move.uci(),
                    "observable_action": observed_action(board, move, cls),
                    "actor_elo": white_elo if actor_white else black_elo,
                    "opponent_elo": black_elo if actor_white else white_elo,
                    "time_control": h.get("TimeControl", "?"),
                    "event": h.get("Event", "?"),
                    "actor_is_white": int(actor_white),
                    # Everything below is a covariate for F2, not part of T or B.
                    **feats,
                }
                out.write(json.dumps(rec, separators=(",", ":")) + "\n")
                written += 1
        out.close()

    return {
        "pgn": pgn_path,
        "seed": seed,
        "per_game": per_game,
        "games_seen": games_seen,
        "games_used": games_used,
        "positions_sampled": positions,
        "records_written": written,
        "predicate_version": PREDICATE_VERSION,
        "corpus_selection": CORPUS_SELECTION,
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pgn", required=True)
    ap.add_argument("--max-games", type=int, default=40000)
    ap.add_argument("--per-game", type=int, default=3)
    ap.add_argument("--seed", type=int, default=20260831)
    ap.add_argument("--out", required=True)
    ap.add_argument("--manifest", required=True)
    a = ap.parse_args()
    manifest = scan(a.pgn, a.max_games, a.per_game, a.seed, a.out)
    with open(a.manifest, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    print(json.dumps(manifest, indent=2))
