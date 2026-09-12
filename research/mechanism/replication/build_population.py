"""
Build a population reference corpus for a rating band, so that
`POPULATION_BASELINE_INSUFFICIENT` is a missing asset and not a dead end.

    band -> candidate games from the monthly dump -> sample -> games.ndjson
    (then: score_games.py under the frozen regime, features.py, register in registry/populations.json)

WHAT IS VERIFIED AND WHAT IS NOT
--------------------------------
The FILTER below is verified against the frozen corpus: re-reading the first 80 MB of
`lichess_db_standard_rated_2026-06.pgn.zst` and applying it yields 20,040 candidate games, and all
600 games of `data/population_games.ndjson` are inside that set. Band, time controls, Termination,
clocks, berserk and the 20-ply floor are therefore reproduced exactly.

The SAMPLER is not. The ledger records only "hash-sampled with seed string `20260905:<gameId>`".
Ordering the candidates by `sha256("20260905:<gameId>")` and taking the per-time-control quotas
greedily under one-game-per-player recovers 143 of the frozen 600 -- far above the ~18 expected by
chance, so the hash and the seed string are right and the selection procedure around them is not
recoverable from what was written down. That is an `AMBIGUOUS_BASELINE`, and it is declared rather
than guessed at:

  * `population_2026-06` stays the frozen reference for the 1450-1850 band. Nothing rebuilds it.
  * A corpus built here is a NEW asset with its own id and its own manifest. It never claims to be
    the frozen one, and registering it is a research decision, made and dated by a person.

Usage:
    python build_population.py --prefix <lichess_db_...pgn.zst or .pgn> --band 1800 2200 \
        --out <dir> [--month 2026-06] [--seed 20260905]
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contract

TAG = re.compile(r'\[(\w+) "(.*?)"\]')
DEFAULT_QUOTAS = {"180+0": 420, "300+0": 180}          # the frozen mix: 600 games
MIN_PLIES = contract.POPULATION_CONTRACT["min_plies"]


def pgn_games(path: str, max_bytes: int | None):
    """Yield PGN chunks from a .pgn or .pgn.zst, stopping after max_bytes of DECOMPRESSED text."""
    if path.endswith(".zst"):
        import zstandard as zstd
        fh = open(path, "rb")
        stream = zstd.ZstdDecompressor().stream_reader(fh)
        text = io_wrap(stream)
    else:
        text = open(path, errors="replace")
    buf, seen = [], 0
    try:
        for line in text:
            seen += len(line)
            if max_bytes and seen > max_bytes:
                break
            if line.startswith("[Event ") and buf:
                yield "".join(buf)
                buf = [line]
            else:
                buf.append(line)
    except Exception:
        pass                                   # a truncated prefix ends mid-frame; that is expected
    if buf:
        yield "".join(buf)


def io_wrap(stream):
    import io
    return io.TextIOWrapper(stream, errors="replace")


def candidates(prefix: str, band: tuple[int, int], quotas: dict, max_bytes: int | None):
    """The frozen population filter. Verified: every game of the frozen corpus satisfies it."""
    out, n = [], 0
    for chunk in pgn_games(prefix, max_bytes):
        n += 1
        t = dict(TAG.findall(chunk))
        if t.get("Termination") != contract.POPULATION_CONTRACT["termination"]:
            continue
        if t.get("TimeControl") not in quotas:
            continue
        try:
            we, be = int(t.get("WhiteElo", "0")), int(t.get("BlackElo", "0"))
        except ValueError:
            continue
        if not (band[0] <= we <= band[1] and band[0] <= be <= band[1]):
            continue
        if t.get("WhiteBerserk") == "true" or t.get("BlackBerserk") == "true":
            continue
        if "%clk" not in chunk:
            continue
        blank = chunk.find("\n\n")
        if blank < 0 or len(re.findall(r"%clk", chunk[blank:])) < MIN_PLIES:
            continue
        gid = (t.get("Site") or "").rstrip("/").split("/")[-1]
        if not gid:
            continue
        out.append({"id": gid, "tc": t["TimeControl"], "white": t.get("White"),
                    "black": t.get("Black"), "white_elo": we, "black_elo": be, "pgn": chunk})
    return out, n


def sample(cands: list[dict], quotas: dict, seed: str) -> list[dict]:
    """Declared sampler: order by sha256("<seed>:<gameId>"), take the per-time-control quotas
    greedily, one game per player. See the module docstring for what this does and does not
    reproduce."""
    ordered = sorted(cands, key=lambda c: hashlib.sha256(f"{seed}:{c['id']}".encode()).hexdigest())
    used, taken = set(), collections.defaultdict(list)
    for c in ordered:
        if len(taken[c["tc"]]) >= quotas[c["tc"]]:
            continue
        if c["white"] in used or c["black"] in used:
            continue
        used.add(c["white"]); used.add(c["black"])
        taken[c["tc"]].append(c)
    return [c for tc in quotas for c in taken[tc]]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prefix", required=True, help="monthly dump (.pgn.zst) or a decompressed prefix")
    ap.add_argument("--band", nargs=2, type=int, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--month", default=None)
    ap.add_argument("--seed", default="20260905")
    ap.add_argument("--max-bytes", type=int, default=None,
                    help="stop after this many decompressed bytes (the frozen run used an 80 MB compressed prefix)")
    ap.add_argument("--quota", action="append", default=None, help="TC=N, repeatable; default 180+0=420,300+0=180")
    a = ap.parse_args()
    quotas = DEFAULT_QUOTAS if not a.quota else {q.split("=")[0]: int(q.split("=")[1]) for q in a.quota}
    band = (a.band[0], a.band[1])
    os.makedirs(a.out, exist_ok=True)
    cands, n_read = candidates(a.prefix, band, quotas, a.max_bytes)
    picked = sample(cands, quotas, a.seed)
    corpus_id = f"population_{a.month or 'unknown'}_{band[0]}_{band[1]}"
    path = os.path.join(a.out, "games.ndjson")
    with open(path, "w") as f:
        for c in picked:
            f.write(json.dumps({"id": c["id"], "pgn": c["pgn"], "corpus": corpus_id,
                                "focal_colors": ["w", "b"], "band": list(band),
                                "time_control": c["tc"],
                                "players": {"white": {"user": {"id": (c["white"] or "").lower(),
                                                               "name": c["white"]}, "rating": c["white_elo"]},
                                            "black": {"user": {"id": (c["black"] or "").lower(),
                                                               "name": c["black"]}, "rating": c["black_elo"]}}}) + "\n")
    manifest = {
        "corpus_id": corpus_id, "band": list(band), "month": a.month, "seed": a.seed,
        "quotas": quotas, "games_read": n_read, "candidates": len(cands), "sampled": len(picked),
        "by_time_control": dict(collections.Counter(c["tc"] for c in picked)),
        "filter": {k: contract.POPULATION_CONTRACT[k] for k in
                   ("termination", "requires_clocks", "no_berserk", "min_plies", "both_sides_in_band",
                    "one_game_per_player", "both_colours_focal")},
        "sampler": "sha256(<seed>:<gameId>) ordering, per-time-control quotas, greedy one-game-per-player",
        "sampler_status": "AMBIGUOUS_BASELINE — the frozen corpus's exact sampler is not recoverable "
                          "from the ledger; this corpus is a NEW asset and does not claim to reproduce "
                          "population_2026-06",
        "next_steps": ["score with pipeline/score_games.py under the frozen regime",
                       "extract with pipeline/features.py",
                       "register in replication/registry/populations.json (a dated research decision)"],
    }
    with open(os.path.join(a.out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    print(json.dumps(manifest, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
