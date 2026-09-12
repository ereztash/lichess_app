"""
Re-hash every preserved failed attempt against the index that claims it.

`failed_attempts_index.json` records a sha256 per evidence file, taken when the attempt was
preserved. The files sit one directory down, committed, so unlike most hash sites in this
repository the claim is checkable from inside it. This is the checker `research-scan.ts` names.

What it would catch: a preserved worker log edited after the fact, an evidence file dropped from
the tree while its row stayed in the index, or a row added for a file that was never preserved. It
does not check that the attempts are a complete account of what failed; the index is append-only
and nothing here can prove an attempt was never written down.

    python verify_failed_attempts.py          -> prints one line per defect, exits 1 if any
"""
from __future__ import annotations

import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, "failed_attempts_index.json")
EVIDENCE = os.path.join(HERE, "failed_attempts")


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main() -> int:
    index = json.load(open(INDEX))
    attempts = index["attempts"]
    defects: list[str] = []
    claimed: set[str] = set()
    checked = 0

    for a in attempts:
        player = a["player_id"]
        for ev in a["evidence_files"]:
            rel = os.path.join(player, ev["file"])
            path = os.path.join(EVIDENCE, rel)
            claimed.add(os.path.normpath(path))
            if not os.path.exists(path):
                defects.append(f"MISSING   {rel}: the index claims it, the tree does not carry it")
                continue
            got = sha256_file(path)
            checked += 1
            if got != ev["sha256"]:
                defects.append(f"CHANGED   {rel}: index {ev['sha256'][:16]}, tree {got[:16]}")

    # A file present but unclaimed is the other direction of the same question: evidence that no
    # row vouches for is evidence a reader cannot date.
    for root, _dirs, files in os.walk(EVIDENCE):
        for f in files:
            p = os.path.normpath(os.path.join(root, f))
            if p not in claimed:
                defects.append(f"UNCLAIMED {os.path.relpath(p, EVIDENCE)}: in the tree, not in the index")

    for d in defects:
        print(d)
    print(f"{len(attempts)} attempts, {checked} evidence files re-hashed, {len(defects)} defects")
    return 1 if defects else 0


if __name__ == "__main__":
    sys.exit(main())
