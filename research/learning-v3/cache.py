"""
THE RULE THIS FILE ENFORCES: no research step may rerun an engine evaluation this repository
already has.

52,691 searches at 200,000 nodes is about fifty minutes of four-way CPU, and the reason it is
committed rather than reproduced on demand is that a download is cheap and a search is not. That
argument only holds if a later run can actually FIND what was bought, which needs an identity a
program can compute rather than a filename somebody has to remember.

THE IDENTITY IS CONTENT-ADDRESSED AND INCLUDES THE POLICY. Two numbers for the same position and
the same move under different search policies are different measurements -- a MultiPV line
restricted to B is not a full-width search -- and merging them under one key would be the silent
instrument change this repository keeps catching in other people's work and in its own.

    move  sha256("move|" + fen + "|" + uci + "|" + build + "|" + nodes + "|" + policy)
    set   sha256("set|"  + fen + "|" + ",".join(sorted(uci)) + "|" + build + "|" + nodes + "|" + policy)

A MISS IS AN ANSWER. `lookup` returns None rather than raising, because the caller's next step is
to search, and a cache that threw would make its own absence an error condition.

    python cache.py --stats
    python cache.py --fen "<fen>" --move e7e8q --policy multipv-over-B
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import io
import json
from pathlib import Path

import zstandard

CORPUS = Path(__file__).resolve().parent / "corpus" / "engine_evaluations.jsonl.zst"
DEFAULT_BUILD = "Stockfish 17.1"
DEFAULT_NODES = "200000"


def key_for(fen: str, moves: list[str], build: str, nodes: str, policy: str) -> str:
    kind = "move" if len(moves) == 1 and policy != "root-restricted-max" else "set"
    body = moves[0] if kind == "move" else ",".join(sorted(moves))
    return hashlib.sha256("|".join([kind, fen, body, build, nodes, policy]).encode()).hexdigest()


def rows(path: Path = CORPUS):
    """Stream the corpus. Decompressed on the fly; it is 34 MB open and 3.6 MB at rest."""
    with open(path, "rb") as fh:
        for line in io.TextIOWrapper(
            zstandard.ZstdDecompressor().stream_reader(fh), encoding="utf-8"
        ):
            yield json.loads(line)


def index(path: Path = CORPUS) -> dict[str, dict]:
    return {r["key"]: r for r in rows(path)}


def lookup(fen: str, moves: list[str], policy: str, build: str = DEFAULT_BUILD,
           nodes: str = DEFAULT_NODES, idx: dict | None = None) -> dict | None:
    idx = idx if idx is not None else index()
    return idx.get(key_for(fen, moves, build, nodes, policy))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--fen")
    ap.add_argument("--move", action="append", default=[])
    ap.add_argument("--policy", default="multipv-over-B")
    ap.add_argument("--build", default=DEFAULT_BUILD)
    ap.add_argument("--nodes", default=DEFAULT_NODES)
    a = ap.parse_args()

    if a.stats:
        by_policy: collections.Counter = collections.Counter()
        by_run: collections.Counter = collections.Counter()
        positions: set[str] = set()
        keys: set[str] = set()
        dup = 0
        for r in rows():
            by_policy[r["policy"]] += 1
            by_run[r["run_id"]] += 1
            positions.add(r["position_id"])
            if r["key"] in keys:
                dup += 1
            keys.add(r["key"])
        print(json.dumps({
            "evaluations": len(keys),
            "distinct_positions": len(positions),
            "by_policy": dict(by_policy),
            "by_run": dict(by_run),
            "duplicate_keys_in_corpus": dup,
        }, indent=1))
        return 0

    if not a.fen or not a.move:
        ap.error("--fen and at least one --move, or --stats")
    hit = lookup(a.fen, a.move, a.policy, a.build, a.nodes)
    print(json.dumps(hit if hit else {"hit": False, "note": "not evaluated; a search is required"},
                     indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
