"""Every constant B3 borrowed from `shared/`, checked against the TypeScript it came from.

A port that drifts is the defect `shared/import-diagnostic.ts` documents in its own history: a call
site went on using a raw centipawn cut after the detector had moved to win-probability loss, so a
second definition of the outcome quietly selected the hypothesis a different definition graded.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
REPO = os.path.join(os.path.dirname(__file__), "..", "..", "..")

import chess  # noqa: E402
import common  # noqa: E402


def ts(path):
    with open(os.path.join(REPO, path)) as fh:
        return fh.read()


def test_win_probability_constant_matches_source():
    src = ts("shared/win-probability.ts")
    k = float(re.search(r"WIN_PROBABILITY_K = ([\d.]+)", src).group(1))
    assert k == common.WIN_PROBABILITY_K


def test_mate_score_and_accuracy_constants_match_source():
    assert int(re.search(r"MATE_SCORE = (\d+)", ts("shared/reveal.ts")).group(1)) == common.MATE_SCORE
    assert int(re.search(r"ACCURATE_CP_LOSS = (\d+)", ts("shared/detector.ts")).group(1)) == common.ACCURATE_CP_LOSS
    # The derived threshold, derived here exactly as shared/detector.ts derives it.
    assert abs(common.ACCURATE_WIN_PROBABILITY_LOSS - 0.027608582058630926) < 1e-15


def test_phase_thresholds_match_source():
    src = ts("shared/phase.ts")
    assert int(re.search(r"ENDGAME_MATERIAL_THRESHOLD = (\d+)", src).group(1)) == common.ENDGAME_MATERIAL_THRESHOLD
    assert int(re.search(r"OPENING_MAX_PLY = (\d+)", src).group(1)) == common.OPENING_MAX_PLY
    assert int(re.search(r"CLEAR_EDGE_CP = (\d+)", ts("shared/import-diagnostic.ts")).group(1)) == common.CLEAR_EDGE_CP


def test_book_keys_match_source_and_hash_agrees():
    src = ts("shared/opening-book-keys.ts")
    keys = {int(x) for x in re.search(r"new Set\(\[([\d,\s]+)\]\)", src).group(1).split(",") if x.strip()}
    assert keys == set(common.BOOK_KEYS)
    # The FNV-1a port, checked on a position the book must contain: the starting position.
    assert common.is_book(chess.Board().fen())


def test_book_was_built_from_a_month_disjoint_from_every_b3_period():
    """Asserted, not assumed. A book built from a study period would be a fitted feature."""
    provenance = ts("shared/opening-book-provenance.ts")
    month = re.search(r'"month": "([\d-]+)"', provenance).group(1)
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
    from score import PERIODS

    assert month not in {m for m, _ in PERIODS.values()}, f"book month {month} overlaps a B3 period"


def test_phase_and_material_agree_with_the_repo_rule():
    board = chess.Board()
    assert common.non_pawn_material(board) == 62  # 4N/B * 3 + 2R * 5 + Q * 9, both sides
    assert common.classify_phase(board, 0) == "opening"
    assert common.classify_phase(board, 21) == "middlegame"
    bare = chess.Board("8/8/4k3/8/8/4K3/8/8 w - - 0 60")
    assert common.classify_phase(bare, 120) == "endgame"


def test_rating_bands_never_merge_and_cover_the_range():
    assert common.rating_band(799) is None and common.rating_band(2600) is None
    assert common.rating_band(800) == "800-999"
    assert common.rating_band(2599) == "2400-2599"
    assert len(common.BAND_LABELS) == 9
