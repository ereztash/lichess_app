"""
READ-ONLY audit: how much of the cohort's engine work is redundant.

Answers one question, over the corpora already on disk: if the scorer never searched the same
position twice, how much less engine time would the cohort cost? It runs NO engine, writes into no
frozen artefact, and changes no research rule. It replays the admissible games with python-chess to
recover exactly the positions `pipeline/score_games.py` would hand the engine, and counts them.

    python audit_compute_compression.py [--out COMPUTE_AUDIT.json]

THE UNIT OF ENGINE WORK, read out of score_games.py rather than assumed:

  * per ply, on the position BEFORE the move:   analyse(depth=12, multipv=3, game=object())
  * on the terminal position, only when the game is NOT already over: analyse(depth=12, multipv=1)

Those are two different regimes. An mpv3 result answers an mpv1 request (take the first line); the
converse is false. They are counted separately and never pooled.

WHAT MAKES A REUSE SOUND, and why the headline number is the conservative one:

  `game=object()` sends ucinewgame, so the hash is cleared before every search: a search depends on
  the position and nothing carried over. But python-chess sends `position fen <root> moves ...`, so
  Stockfish still sees the game's move history and can detect a repetition. Two occurrences of one
  FEN whose histories differ in whether that position has already appeared can therefore evaluate
  differently.

  So the audit splits every occurrence into:
    FIRST  -- this position had not occurred earlier in its own game. No repetition is available
              from it, in any game, so all FIRST occurrences of one FEN are interchangeable.
    REPEAT -- the position had already occurred in this game. History-sensitive; counted, never
              claimed as reusable.

  The headline bound is over FIRST occurrences only.

THREE KEYS, from soundest to loosest. Only the first two are proposed as usable:
  FEN_FULL         the exact FEN the record carries.
  FEN_NO_FULLMOVE  the same without the fullmove counter, which cannot change a fixed-depth search.
  EPD              also without the halfmove clock. NOT sound: the fifty-move counter changes what
                   is a draw. Reported as a ceiling on what any keying could reach, not as a plan.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import sys
import time

import chess

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
DATA = os.path.join(MECH, "data")
REPLICATIONS = os.path.join(MECH, "replications")


def h(s: str) -> bytes:
    return hashlib.blake2b(s.encode(), digest_size=16).digest()


def strip_fullmove(fen: str) -> str:
    return " ".join(fen.split(" ")[:5])


def strip_clock(fen: str) -> str:
    return " ".join(fen.split(" ")[:4])


def positions_of_game(g: dict):
    """Exactly the positions score_games.py hands the engine, in order.

    Yields (fen, uci, is_first_occurrence_in_this_game) per ply, then a terminal (fen, None, True)
    when the game is not already over, mirroring the scorer's own terminal branch.
    """
    board = chess.Board()
    seen = collections.Counter()
    for san in g["moves"].split():
        fen = board.fen()
        key = board.epd()
        first = seen[key] == 0
        seen[key] += 1
        try:
            mv = board.parse_san(san)
        except Exception:
            return                      # the scorer drops the game here too
        yield fen, mv.uci(), first
        board.push(mv)
    if not board.is_game_over():
        key = board.epd()
        yield board.fen(), None, seen[key] == 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "COMPUTE_AUDIT.json"))
    ap.add_argument("--members", type=int, default=None, help="cap, for a quick pass")
    a = ap.parse_args()

    sel = json.load(open(os.path.join(HERE, "COHORT_SELECTION.json")))
    members = sel["accepted"][: a.members] if a.members else sel["accepted"]

    # ---- pass 1: the cohort's own positions -----------------------------------------------------
    per_player = {}                     # u -> Counter over FEN_FULL digests, FIRST occurrences
    per_player_all = {}                 # u -> Counter over FEN_FULL digests, every occurrence
    ply_full = collections.Counter()    # FIRST-occurrence ply searches, mpv3, by FEN_FULL
    ply_nofm = collections.Counter()
    ply_epd = collections.Counter()
    term_full = collections.Counter()   # terminal searches, mpv1
    pair_keys = set()                   # (FEN_FULL, uci)
    game_ids = collections.Counter()
    totals = {"games": 0, "games_unparsable": 0, "ply_searches": 0, "ply_first": 0,
              "ply_repeat": 0, "terminal_searches": 0}
    rows = []
    depth_seen: dict = {}               # FEN digest -> the shallowest ply it was ever seen at
    depth_occ = collections.Counter()   # ply index -> FIRST-occurrence searches at that depth
    t0 = time.time()

    for m in members:
        u = m["u"]
        path = os.path.join(REPO, m["run_dir"], "admissible", "games.ndjson")
        if not os.path.exists(path):
            rows.append({"u": u, "corpus_present": False})
            continue
        pc, pca = collections.Counter(), collections.Counter()
        n_games = n_ply = n_first = n_repeat = n_term = 0
        for line in open(path):
            if not line.strip():
                continue
            g = json.loads(line)
            if g.get("variant") != "standard":
                continue
            game_ids[g["id"]] += 1
            n_games += 1
            got_any = False
            for ply_ix, (fen, uci, first) in enumerate(positions_of_game(g)):
                got_any = True
                d = h(fen)
                if first and uci is not None:
                    depth_seen[d] = ply_ix if d not in depth_seen else min(depth_seen[d], ply_ix)
                    depth_occ[ply_ix] += 1
                if uci is None:
                    n_term += 1
                    term_full[d] += 1
                    continue
                n_ply += 1
                pca[d] += 1
                pair_keys.add(h(fen + "|" + uci))
                if first:
                    n_first += 1
                    pc[d] += 1
                    ply_full[d] += 1
                    ply_nofm[h(strip_fullmove(fen))] += 1
                    ply_epd[h(strip_clock(fen))] += 1
                else:
                    n_repeat += 1
            if not got_any:
                totals["games_unparsable"] += 1
        per_player[u], per_player_all[u] = pc, pca
        totals["games"] += n_games
        totals["ply_searches"] += n_ply
        totals["ply_first"] += n_first
        totals["ply_repeat"] += n_repeat
        totals["terminal_searches"] += n_term
        rows.append({"u": u, "corpus_present": True, "games": n_games,
                     "ply_searches": n_ply, "ply_first_occurrence": n_first,
                     "ply_repeat_occurrence": n_repeat, "terminal_searches": n_term,
                     "distinct_FEN_FULL_first": len(pc),
                     "within_player_duplicate_searches": n_first - len(pc)})
        print("  %-18s %5d games  %7d ply  %7d distinct  %6d within-player dupes  (%.0fs)"
              % (u, n_games, n_first, len(pc), n_first - len(pc), time.time() - t0), flush=True)

    # ---- cross-player structure -----------------------------------------------------------------
    owners = collections.Counter()
    for u, pc in per_player.items():
        for d in pc:
            owners[d] += 1
    shared = {d for d, n in owners.items() if n >= 2}
    cross_occurrences = sum(c for u, pc in per_player.items() for d, c in pc.items() if d in shared)
    shared_games = {gid: n for gid, n in game_ids.items() if n >= 2}

    # ---- pass 2: what is already scored ----------------------------------------------------------
    already = set()
    scored_sources = []
    for name in sorted(os.listdir(DATA)):
        if not (name.startswith("scored_") and name.endswith(".jsonl.zst")):
            continue
        try:
            import zstandard                                                  # noqa: PLC0415
        except ImportError:
            scored_sources.append({"source": name, "read": False,
                                   "why": "zstandard is not installed here"})
            continue
        n = 0
        with open(os.path.join(DATA, name), "rb") as fh:
            rd = zstandard.ZstdDecompressor().stream_reader(fh)
            for line in io_lines(rd):
                rec = json.loads(line)
                for p in rec.get("plies") or []:
                    already.add(h(p["fen"])); n += 1
                t = rec.get("terminal") or {}
                if t.get("fen"):
                    already.add(h(t["fen"]))
        scored_sources.append({"source": "research/mechanism/data/" + name, "read": True,
                               "ply_positions": n})
    for d in sorted(os.listdir(REPLICATIONS)):
        sd = os.path.join(REPLICATIONS, d, "scored")
        if not os.path.isdir(sd):
            continue
        n = 0
        for part in sorted(os.listdir(sd)):
            if not part.endswith(".jsonl"):
                continue
            for line in open(os.path.join(sd, part)):
                if not line.strip():
                    continue
                rec = json.loads(line)
                for p in rec.get("plies") or []:
                    already.add(h(p["fen"])); n += 1
                t = rec.get("terminal") or {}
                if t.get("fen"):
                    already.add(h(t["fen"]))
        if n:
            scored_sources.append({"source": "research/mechanism/replications/%s/scored" % d,
                                   "read": True, "ply_positions": n})

    # ---- how the distinct-position count saturates as members are added ------------------------
    # One number at N=16 cannot say what N=100 costs. This is the measured curve over the members
    # actually on disk, in the committed acceptance order, so the growth is read rather than
    # assumed. It is still an extrapolation beyond the last point and is labelled as one.
    cum: set = set()
    curve = []
    seen_ply = 0
    for m in members:
        u = m["u"]
        if u not in per_player:
            continue
        cum |= set(per_player[u])
        seen_ply += sum(per_player[u].values())
        curve.append({"members": len(curve) + 1, "cumulative_ply_first": seen_ply,
                      "cumulative_distinct": len(cum),
                      "cumulative_saved": seen_ply - len(cum),
                      "marginal_new_positions": len(cum) - (curve[-1]["cumulative_distinct"]
                                                            if curve else 0)})

    # where the duplication actually sits. A saving concentrated in the first few plies is an
    # opening book, not a cache, and the two are different pieces of software.
    bands = [(0, 5), (6, 11), (12, 19), (20, 29), (30, 10 ** 9)]
    by_depth = []
    for lo, hi in bands:
        occ = sum(c for i, c in depth_occ.items() if lo <= i <= hi)
        dis = sum(1 for d, i in depth_seen.items() if lo <= i <= hi)
        by_depth.append({"plies": ("%d-%d" % (lo, hi)) if hi < 10 ** 9 else "%d+" % lo,
                         "searches": occ, "distinct_positions": dis,
                         "duplicate_searches": occ - dis,
                         "share_of_all_duplicates": None})
    tot_dupes = sum(b["duplicate_searches"] for b in by_depth)
    for b in by_depth:
        b["share_of_all_duplicates"] = (b["duplicate_searches"] / tot_dupes) if tot_dupes else None
    singletons = sum(1 for c in ply_full.values() if c == 1)

    # terminal positions are searched at mpv1; an mpv3 entry for the same FEN would answer them
    term_in_ply = sum(c for d, c in term_full.items() if d in ply_full)

    hit = sum(c for d, c in ply_full.items() if d in already)
    hit_distinct = sum(1 for d in ply_full if d in already)

    need_full = len(ply_full)
    need_nofm = len(ply_nofm)
    need_epd = len(ply_epd)
    total_ply = totals["ply_searches"]

    doc = {
        "_what": "READ-ONLY audit of redundant engine work over the cohort corpora already on "
                 "disk. No engine was run. No frozen artefact was read for anything but its "
                 "positions, and none was written.",
        "audited_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "members_audited": len([r for r in rows if r.get("corpus_present")]),
        "members_in_selection": len(sel["accepted"]),
        "engine_unit": {
            "per_ply": "analyse(depth=12, multipv=3, ucinewgame before each) on the position "
                       "BEFORE the move",
            "terminal": "analyse(depth=12, multipv=1) on the final position, only when the game is "
                        "not already over",
            "_note": "two regimes. An mpv3 result answers an mpv1 request; the converse is false. "
                     "They are never pooled below.",
        },
        "totals": totals,
        "occurrence_split": {
            "_why": "python-chess sends the move history, so Stockfish can see a repetition. Two "
                    "occurrences of one FEN are interchangeable only when neither had already "
                    "occurred in its own game. REPEAT occurrences are counted and never claimed.",
            "ply_first_occurrence": totals["ply_first"],
            "ply_repeat_occurrence": totals["ply_repeat"],
            "repeat_share": (totals["ply_repeat"] / total_ply) if total_ply else None,
        },
        "distinct_positions": {
            "FEN_FULL": need_full,
            "FEN_NO_FULLMOVE": need_nofm,
            "EPD_no_halfmove_clock": need_epd,
            "_sound": "FEN_FULL and FEN_NO_FULLMOVE. EPD is a ceiling: dropping the halfmove clock "
                      "changes what is a draw, so it is not a keying anyone may use.",
        },
        "unique_fen_move_pairs": len(pair_keys),
        "_pairs_note": "the DECISION unit, not the engine unit. The engine is called on the "
                       "position; the move is what the player then played. Reuse is keyed on the "
                       "position alone, so this number bounds decisions, not searches.",
        "duplication": {
            "_decomposition": "FIRST-occurrence searches = distinct positions + within-player "
                              "duplicates + cross-player duplicates. The three sum to "
                              "ply_first_occurrence exactly.",
            "distinct_positions_FEN_FULL": need_full,
            "within_player_duplicate_searches": totals["ply_first"] - sum(
                len(pc) for pc in per_player.values()),
            "cross_player_duplicate_searches": sum(
                len(pc) for pc in per_player.values()) - need_full,
            "positions_held_by_more_than_one_member": len(shared),
            "cross_player_occurrences_of_shared_positions": cross_occurrences,
            "games_held_by_more_than_one_member": len(shared_games),
            "_games_note": "a game appearing in two members' corpora means those two played each "
                           "other. Every position of it is scored twice today.",
        },
        "overlap_with_existing_scored_corpora": {
            "sources": scored_sources,
            "distinct_cohort_positions_already_scored": hit_distinct,
            "cohort_ply_searches_those_cover": hit,
        },
        "upper_bound_on_reusable_engine_work": {
            "_definition": "searches the cohort would issue today, minus the searches a perfect "
                           "position cache would issue. FIRST occurrences only; REPEAT occurrences "
                           "and terminal mpv1 searches are excluded from the saving.",
            "ply_searches_today": total_ply,
            "terminal_searches_today": totals["terminal_searches"],
            "searches_today_total": total_ply + totals["terminal_searches"],
            "by_FEN_FULL": {
                "searches_needed": need_full + totals["ply_repeat"],
                "searches_saved": total_ply - need_full - totals["ply_repeat"],
                "share_saved": ((total_ply - need_full - totals["ply_repeat"]) / total_ply)
                               if total_ply else None,
            },
            "by_FEN_NO_FULLMOVE": {
                "searches_needed": need_nofm + totals["ply_repeat"],
                "searches_saved": total_ply - need_nofm - totals["ply_repeat"],
                "share_saved": ((total_ply - need_nofm - totals["ply_repeat"]) / total_ply)
                               if total_ply else None,
            },
            "with_existing_corpora_reused_too": {
                "_note": "adds the FIRST-occurrence positions already scored at d12 mpv3 elsewhere "
                         "in the tree. Keyed on FEN_FULL.",
                "searches_needed": need_full - hit_distinct + totals["ply_repeat"],
                "searches_saved": total_ply - (need_full - hit_distinct) - totals["ply_repeat"],
            },
            "ceiling_by_EPD_not_sound": {
                "searches_needed": need_epd + totals["ply_repeat"],
                "searches_saved": total_ply - need_epd - totals["ply_repeat"],
            },
        },
        "where_the_duplication_is": {
            "_what": "FIRST-occurrence searches banded by how deep into the game the position "
                     "first appears. A saving concentrated in the opening plies is an opening "
                     "book, not a general position cache, and those are different pieces of "
                     "software with different risks.",
            "bands": by_depth,
            "positions_searched_exactly_once": singletons,
            "singleton_share_of_distinct": (singletons / need_full) if need_full else None,
            "_singleton_note": "a cache must hold these too, and never answers from them. They "
                               "set the memory cost against which the saving is bought.",
        },
        "saturation_curve": {
            "_what": "cumulative distinct positions as members are added in acceptance order. The "
                     "marginal column is what each additional member costs in NEW searches; it "
                     "falls as the shared opening tree fills in, and that fall is the only "
                     "measured basis for saying anything about a hundred members.",
            "points": curve,
        },
        "terminal_positions": {
            "_what": "the mpv1 terminal search is a second regime. An mpv3 entry for the same FEN "
                     "would answer it; the converse would not.",
            "terminal_searches": totals["terminal_searches"],
            "terminal_fens_also_seen_as_a_ply_position": term_in_ply,
            "_note": "the remainder are genuinely new positions and no keying removes them.",
        },
        "per_member": rows,
    }
    json.dump(doc, open(a.out, "w"), indent=1)
    print(json.dumps({k: doc[k] for k in (
        "members_audited", "totals", "occurrence_split", "distinct_positions",
        "unique_fen_move_pairs", "duplication", "overlap_with_existing_scored_corpora",
        "upper_bound_on_reusable_engine_work")}, indent=1, default=str))
    return 0


def io_lines(reader):
    buf = b""
    while True:
        chunk = reader.read(1 << 20)
        if not chunk:
            break
        buf += chunk
        *lines, buf = buf.split(b"\n")
        for ln in lines:
            if ln.strip():
                yield ln
    if buf.strip():
        yield buf


if __name__ == "__main__":
    raise SystemExit(main())
