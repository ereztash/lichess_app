"""
Rebuild the cohort's inputs on a fresh machine, and refuse to proceed if they are not the frozen
ones.

The corpora are gitignored, so a clone alone cannot run the cohort. They live in a private Hugging
Face dataset. Downloading them is the easy part; the point of this script is the check afterwards.

Every downloaded corpus is hashed and compared to `raw_sha256` in COHORT_FROZEN.json. That digest
was taken at freeze time and is what makes a rerun the same study rather than a similar one. If a
single file disagrees, this exits non-zero and scores nothing: continuing on different bytes is
worse than not continuing, because the disagreement would be silently averaged into the cohort.

    python restore.py --token hf_...        download, place and verify
    python restore.py --verify-only         re-check what is already on disk
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys

REPO_ID = "ereztash/lichess-cohort100-frozen-inputs"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
FROZEN = os.path.join(ROOT, "research/mechanism/replication100/COHORT_FROZEN.json")
ENGINE_SHA = "7fecbc0b26454b62be5e3b237b58dc5666401b56e520aeb1b0bf8f53fa8f2ef3"
PIPELINE_HASH = "eb840a439af4439bd44ed5a8da5ca76569fb8c68d38c34a6ba19eb2961da3143"


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def check_engine() -> bool:
    import shutil
    exe = shutil.which("stockfish")
    if not exe:
        print("  ENGINE: not on PATH")
        return False
    got = sha256_file(exe)
    ok = got == ENGINE_SHA
    print(f"  ENGINE: {'matches the freeze' if ok else 'DOES NOT MATCH: ' + got[:16]}")
    return ok


def check_pipeline() -> bool:
    sys.path.insert(0, os.path.join(ROOT, "research/mechanism/replication"))
    import corpus  # noqa: E402
    got = corpus.pipeline_version()["pipeline_hash"]
    ok = got == PIPELINE_HASH
    print(f"  PIPELINE: {'matches the freeze' if ok else 'MOVED: ' + got[:16]}")
    return ok


def download(token: str) -> None:
    from huggingface_hub import snapshot_download
    print(f"downloading {REPO_ID} ...", flush=True)
    local = snapshot_download(repo_id=REPO_ID, repo_type="dataset", token=token,
                              allow_patterns=["raw/**", "scored/**", "MANIFEST.json"])
    print(f"  cached at {local}")
    placed = 0
    for kind in ("raw", "scored"):
        src_root = os.path.join(local, kind)
        if not os.path.isdir(src_root):
            continue
        for run_dir in sorted(os.listdir(src_root)):
            dst = os.path.join(ROOT, "research/mechanism/replications", run_dir, kind)
            os.makedirs(dst, exist_ok=True)
            for f in sorted(os.listdir(os.path.join(src_root, run_dir))):
                src = os.path.join(src_root, run_dir, f)
                tgt = os.path.join(dst, f)
                if os.path.exists(tgt) and os.path.getsize(tgt) == os.path.getsize(src):
                    continue
                # hardlink where the cache shares a filesystem, copy otherwise
                try:
                    os.link(src, tgt)
                except OSError:
                    import shutil
                    shutil.copy2(src, tgt)
                placed += 1
    print(f"  placed {placed} files")


def verify_corpora() -> int:
    frozen = json.load(open(FROZEN))
    ok = missing = bad = 0
    offenders = []
    for m in frozen["members"]:
        p = os.path.join(ROOT, m["run_dir"], "raw", "history.ndjson")
        if not os.path.exists(p):
            missing += 1
            offenders.append((m["u"], "MISSING"))
            continue
        if sha256_file(p) == m["raw_sha256"]:
            ok += 1
        else:
            bad += 1
            offenders.append((m["u"], "DIGEST MISMATCH"))
    print(f"  CORPORA: {ok} match / {missing} missing / {bad} mismatched  (of {len(frozen['members'])})")
    for u, why in offenders[:10]:
        print("     ", u, why)
    return bad + missing


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--token", help="Hugging Face token with read access to the dataset")
    ap.add_argument("--verify-only", action="store_true")
    a = ap.parse_args()

    if not a.verify_only:
        if not a.token:
            print("need --token (a read token for the private dataset), or --verify-only")
            return 2
        download(a.token)

    print("\nverifying against the freeze:")
    problems = verify_corpora()
    engine_ok = check_engine()
    pipeline_ok = check_pipeline()

    if problems or not engine_ok or not pipeline_ok:
        print("\nNOT READY. Nothing was scored. Fix the above before running the cohort:")
        print("  a corpus mismatch means the inputs are not the frozen inputs and the cohort")
        print("  cannot be continued on them; an engine or pipeline mismatch means the")
        print("  instrument moved. Neither is worked around.")
        return 1

    print("\nREADY. Start the cohort with:")
    print("  python research/mechanism/replication100/cohort_run.py --workers N \\")
    print("      --out /work/COHORT_PROGRESS.json")
    print("\nResume is automatic: members with a terminal report/RESULT.json are skipped,")
    print("members awaiting scoring carry status FROZEN.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
