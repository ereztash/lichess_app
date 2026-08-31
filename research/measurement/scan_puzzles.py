"""
F1's SECOND HALF: the label comparison, run AFTER the predicate was frozen.

`predicates.py` was written and hashed before this file existed. This script applies that same
unmodified predicate to Lichess puzzle positions and only then reads the `Themes` column. The
question it answers is not "does the predicate find hanging pieces" -- that is circular -- but:

    Where do a board predicate and a curated tactical label DISAGREE, and in which direction?

DISAGREEMENT IS THE RESULT, not an error to be tuned away. A predicate that reproduced the theme
exactly would mean the theme is the construct, and then the honest thing would be to use the
theme and stop. A predicate that shares almost nothing with the theme would mean one of them is
not about unprotected pieces. The interesting and most likely case is the middle one, and its
shape decides whether `hangingPiece` may be used to build an item bank at all.

THE PUZZLE POSITION IS NOT THE FEN COLUMN. Lichess documents that `FEN` is the position BEFORE
the opponent's move and that the position shown to the solver is after applying `Moves[0]`; the
solution begins at `Moves[1]`. Getting this wrong shifts every position by one ply and would
silently make the whole analysis about the wrong side to move.

    python scan_puzzles.py --csv lichess_db_puzzle.csv.zst --sample-every 25 --out puzzles.jsonl
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys

import chess
import zstandard as zstd

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from predicates import classify, position_features, PREDICATE_VERSION  # noqa: E402


def scan(csv_path: str, sample_every: int, out_path: str, limit: int | None = None) -> dict:
    seen = 0
    used = 0
    written = 0
    malformed = 0

    with open(csv_path, "rb") as fh:
        reader = zstd.ZstdDecompressor().stream_reader(fh)
        text = io.TextIOWrapper(reader, encoding="utf-8", errors="replace", newline="")
        rows = csv.DictReader(text)
        out = open(out_path, "w", encoding="utf-8")
        for row in rows:
            seen += 1
            # SYSTEMATIC SAMPLING ON A COUNTER, not a random draw, because the file is sorted by
            # PuzzleId and a deterministic stride is reproducible without carrying a seed and a
            # random-number generator version. Every k-th row, no property of the row consulted.
            if seen % sample_every != 0:
                continue
            used += 1
            try:
                board = chess.Board(row["FEN"])
                moves = row["Moves"].split()
                board.push(chess.Move.from_uci(moves[0]))
                solution = chess.Move.from_uci(moves[1])
            except (ValueError, KeyError, IndexError, AssertionError):
                malformed += 1
                continue

            if board.is_check():
                # Same exclusion the game corpus applies, and for the same reason. It is applied
                # HERE rather than at analysis time so the two corpora are never accidentally
                # compared under different rules.
                continue

            cls = classify(board)
            if cls["trigger_state"] == "unknown":
                continue
            d = cls["designated"]
            themes = row.get("Themes", "").split()
            feats = position_features(board)

            rec = {
                "source": "lichess_db_puzzle",
                "item_id": row["PuzzleId"],
                "source_game_url": row.get("GameUrl", ""),
                "puzzle_fen": board.fen(),
                "predicate_version": PREDICATE_VERSION,
                "trigger_state": cls["trigger_state"],
                "n_loose": cls["n_loose"],
                "n_held": cls["n_held"],
                "n_targets": cls["n_targets"],
                "target_square": d["square_name"],
                "target_piece": d["piece_symbol"],
                "target_value": d["piece_value"],
                "geometric_defenders": d["geometric_defenders"],
                # THE ORACLE FIELDS, each in its own column, none of them consulted above.
                "lichess_themes": themes,
                "theme_hanging_piece": int("hangingPiece" in themes),
                "puzzle_rating": int(row["Rating"]),
                "rating_deviation": int(row["RatingDeviation"]),
                "popularity": int(row["Popularity"]),
                "nb_plays": int(row["NbPlays"]),
                # The curated correct answer, recorded as an observation about the item and NOT
                # used to decide the trigger state.
                "solution_move": solution.uci(),
                "solution_is_capture_of_target": int(
                    solution.to_square == d["square"] and board.is_capture(solution)
                ),
                "solution_is_capture": int(board.is_capture(solution)),
                "solution_gives_check": int(board.gives_check(solution)),
                **feats,
            }
            out.write(json.dumps(rec, separators=(",", ":")) + "\n")
            written += 1
            if limit is not None and written >= limit:
                break
        out.close()

    return {
        "csv": csv_path,
        "sample_every": sample_every,
        "rows_seen": seen,
        "rows_sampled": used,
        "malformed": malformed,
        "records_written": written,
        "predicate_version": PREDICATE_VERSION,
        "puzzle_position_rule": "board(FEN) then push(Moves[0]); solution is Moves[1]",
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--sample-every", type=int, default=25)
    ap.add_argument("--out", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args()
    manifest = scan(a.csv, a.sample_every, a.out, a.limit)
    with open(a.manifest, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    print(json.dumps(manifest, indent=2))
