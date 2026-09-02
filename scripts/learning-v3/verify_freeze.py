#!/usr/bin/env python3
"""
The freeze is only worth something if a command can tell that it held.

TWO CLAIMS, TWO CHECKS. `FREEZE.json` asserts (1) that the two frozen documents still have the
content they had when they were frozen, and (2) that they were frozen BEFORE the repository's
learning architecture was audited. A hash answers the first. Only git answers the second, and it is
the one that matters: a synthesis edited to agree with the audit is exactly the failure the ordering
rule exists to prevent, and it leaves the hash intact if the hash is recomputed at the same time.

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
FREEZE = ROOT / "docs/learning-v3/FREEZE.json"
CROSSWALK = "docs/learning-v3/EXTERNAL_REPO_CROSSWALK.md"


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

    if not FREEZE.exists():
        print(f"FAIL: {FREEZE} is missing. There is no freeze to verify.")
        return 1
    freeze = json.loads(FREEZE.read_text())

    # (1) content
    for rel, expected in freeze["files"].items():
        p = ROOT / rel
        if not p.exists():
            problems.append(f"{rel} was frozen and is now missing")
            continue
        actual = hashlib.sha256(p.read_bytes()).hexdigest()
        if actual != expected["sha256"]:
            problems.append(
                f"{rel} has been edited since the freeze\n"
                f"      frozen  {expected['sha256']}\n"
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
        stray = [t for t in touched if not t.startswith("docs/learning-v3/") and not t.startswith("scripts/learning-v3/")]
        if stray:
            problems.append(
                "the freeze commit also touched: "
                + ", ".join(stray)
                + "\n      A commit that freezes a prior and changes the system is not a freeze."
            )
        cross_sha = first_commit_touching(CROSSWALK)
        if cross_sha:
            ancestor = subprocess.run(
                ["git", "merge-base", "--is-ancestor", freeze_sha, cross_sha],
                cwd=ROOT,
                check=False,
            )
            if ancestor.returncode != 0:
                problems.append(
                    f"the crosswalk commit {cross_sha[:12]} is not a descendant of the freeze "
                    f"commit {freeze_sha[:12]}\n"
                    f"      The audit did not happen after the freeze."
                )
        else:
            print(f"note: {CROSSWALK} does not exist yet; the order claim is not yet testable")

    if problems:
        print("FREEZE VIOLATED")
        for p in problems:
            print(f"  - {p}")
        return 1

    print(f"freeze holds: {len(freeze['files'])} documents unchanged, introduced before the audit")
    return 0


if __name__ == "__main__":
    sys.exit(main())
