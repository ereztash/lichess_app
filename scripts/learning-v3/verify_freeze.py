#!/usr/bin/env python3
"""
The freeze is only worth something if a command can tell that it held.

WHAT THIS ADDS TO THE GATE, which is the question worth answering before writing a second checker.
`GATE-RESEARCH-RECONCILED` already re-hashes both frozen documents on every `npm run gates`, and it
runs whether or not anybody remembers this file exists. So the hash is not what this is for.

A hash cannot catch the failure the ordering rule actually exists to prevent: a synthesis edited to
agree with the audit, with the hash recomputed in the same commit. Only git sees that, and this
checks three things git can answer and a hash cannot:

  1. ONE COMMIT introduced both frozen documents. Two commits mean the freeze is about two moments.
  2. That commit TOUCHED NOTHING ELSE. A commit that freezes a prior and changes the system is not
     a freeze.
  3. NO LATER COMMIT MODIFIED THEM. This is the one that matters, and the one the hash structurally
     cannot make, because an edit plus a recomputed hash is self-consistent.

The order check is topological rather than by timestamp: author dates can be set to anything.

WHY THE ORDER CHECK IS COMMIT-BASED AND NOT TIMESTAMP-BASED. Author dates can be set to anything.
The check is topological: the commit that introduced the crosswalk must be a descendant of the
commit that introduced the freeze, and the freeze commit must not touch anything but the freeze.

Exit 0 if the freeze held, 1 with a named reason if it did not.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# WHY THIS TAKES AN ARGUMENT NOW. A second mission (docs/system-invariant/) froze a research
# question under the same idiom, and the choice was between copying this file and generalising it.
# Copying would have produced two checkers that can drift, which is the exact failure X-02 and
# X-16 are in the tree to remember. The defaults below reproduce the learning-v3 behaviour
# exactly, so `python scripts/learning-v3/verify_freeze.py` with no argument still means what it
# meant.
#
# The file stays at this path deliberately. `docs/learning-v3/FROZEN_EXTERNAL_SYNTHESIS.md` names
# it, and that document is frozen: moving the script would make a frozen document wrong, and a
# frozen document may be contradicted by later evidence but not edited for tidiness.
DEFAULT_FREEZE = "docs/learning-v3/FREEZE.json"
DEFAULT_DOWNSTREAM = "docs/learning-v3/EXTERNAL_REPO_CROSSWALK.md"
DEFAULT_PREFIXES = ("docs/learning-v3/", "scripts/learning-v3/")


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, check=False
    ).stdout.strip()


def first_commit_touching(path: str) -> str:
    """The oldest commit that touched `path`, i.e. the one that introduced it."""
    out = git("log", "--reverse", "--format=%H", "--", path)
    return out.splitlines()[0] if out else ""


def main() -> int:
    problems: list[str] = []

    rel_freeze = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_FREEZE
    freeze_path = ROOT / rel_freeze
    if not freeze_path.exists():
        print(f"FAIL: {freeze_path} is missing. There is no freeze to verify.")
        return 1
    freeze = json.loads(freeze_path.read_text())

    # A freeze that names its own downstream artefact and its own allowed prefixes carries the
    # order claim with it, instead of leaving it here where a second mission would have to edit
    # this script. Absent keys fall back to learning-v3, whose FREEZE.json is itself frozen and
    # so cannot be given the keys retroactively.
    downstream = freeze.get("downstream_artifact", DEFAULT_DOWNSTREAM)
    prefixes = tuple(freeze.get("allowed_prefixes", DEFAULT_PREFIXES))

    # (1) content -- duplicated from the gate on purpose, so this file is runnable alone
    for rel, expected in freeze["files"].items():
        p = ROOT / rel
        if not p.exists():
            problems.append(f"{rel} was frozen and is now missing")
            continue
        actual = hashlib.sha256(p.read_bytes()).hexdigest()
        if actual != expected:
            problems.append(
                f"{rel} has been edited since the freeze\n"
                f"      frozen  {expected}\n"
                f"      current {actual}\n"
                f"      A frozen prior may be CONTRADICTED by later evidence, in the crosswalk.\n"
                f"      It may not be rewritten to agree with it."
            )

    # (2) order
    freeze_commits = {first_commit_touching(rel) for rel in freeze["files"]}
    freeze_commits.discard("")
    if not freeze_commits:
        problems.append("no commit introduced the frozen files; the freeze is uncommitted")
    elif len(freeze_commits) > 1:
        problems.append(
            "the frozen files were introduced in different commits: "
            + ", ".join(sorted(c[:12] for c in freeze_commits))
            + "\n      The freeze must be one commit, or its order claim is about two moments."
        )
    else:
        freeze_sha = freeze_commits.pop()
        touched = git("show", "--name-only", "--format=", freeze_sha).split()
        stray = [t for t in touched if not any(t.startswith(pref) for pref in prefixes)]
        if stray:
            problems.append(
                "the freeze commit also touched: "
                + ", ".join(stray)
                + "\n      A commit that freezes a prior and changes the system is not a freeze."
            )
        # (3) no later commit touched them. The one a hash cannot make.
        for rel in freeze["files"]:
            later = [c for c in git("log", "--format=%H", "--", rel).splitlines() if c != freeze_sha]
            if later:
                problems.append(
                    f"{rel} was modified after the freeze, in "
                    + ", ".join(c[:12] for c in later)
                    + "\n      The hashes may well agree -- an edit that recomputes its own hash is\n"
                    + "      self-consistent. That is precisely why this check is by commit."
                )

        cross_sha = first_commit_touching(downstream)
        if cross_sha:
            ancestor = subprocess.run(
                ["git", "merge-base", "--is-ancestor", freeze_sha, cross_sha],
                cwd=ROOT,
                check=False,
            )
            if ancestor.returncode != 0:
                problems.append(
                    f"the downstream commit {cross_sha[:12]} is not a descendant of the freeze "
                    f"commit {freeze_sha[:12]}\n"
                    f"      The audit did not happen after the freeze."
                )
        else:
            print(f"note: {downstream} does not exist yet; the order claim is not yet testable")

    if problems:
        print("FREEZE VIOLATED")
        for p in problems:
            print(f"  - {p}")
        return 1

    print(f"freeze holds: {len(freeze['files'])} documents unchanged, introduced before the audit")
    return 0


if __name__ == "__main__":
    sys.exit(main())
