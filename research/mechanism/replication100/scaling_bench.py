"""
Compute-scaling benchmark for the FROZEN scorer. Measurement only.

Runs `pipeline/score_games.py` unmodified, at increasing worker counts, over an already-scored
NON-COHORT corpus (Player B, `lichess_vibesgalore_B`). It scores no cohort member and writes
nothing into the repository.

Nothing about the research regime is touched: depth 12, MultiPV 3, Threads 1, Hash 16, hash cleared
per position, Stockfish 17.1 avx2, the same binary the frozen manifests name. The ONLY variable is
how many worker PROCESSES the same work is split across, which is the one knob score_games.py
already exposes and which the pre-registration says nothing about, because it decides who computes
a position and not what the answer is.

Equivalence is the point, not an afterthought. For every topology the output is reassembled into one
record set keyed by game id, canonicalised with sorted keys, and hashed. All topologies must give
one digest, and that digest is also compared against the FROZEN scored records for the same games.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time

REPO = "/home/user/lichess_app"
SCORER = os.path.join(REPO, "research/mechanism/pipeline/score_games.py")
FROZEN = os.path.join(REPO, "research/mechanism/replications/lichess_vibesgalore_B")
SCR = os.path.dirname(os.path.abspath(__file__))
SLICE = os.path.join(SCR, "slice.ndjson")
FOCAL = "vibesgalore"
CORPUS = "lichess:vibesgalore"          # the frozen label, so the comparison excludes nothing
N_GAMES = int(os.environ.get("BENCH_GAMES", "64"))
TOPOLOGIES = [int(x) for x in os.environ.get("BENCH_WORKERS", "1,2,4,6,8,16,32").split(",")]
NCORES = os.cpu_count() or 1


def cpu_busy_jiffies() -> tuple[int, int]:
    f = open("/proc/stat").readline().split()[1:]
    v = [int(x) for x in f[:8]]
    idle = v[3] + v[4]
    return sum(v) - idle, sum(v)


def digest_of(out_dir: str) -> tuple[str, int, int]:
    """One digest over the reassembled record set, so sharding cannot change it."""
    recs = {}
    for name in sorted(os.listdir(out_dir)):
        if not name.endswith(".jsonl"):
            continue
        for line in open(os.path.join(out_dir, name)):
            if line.strip():
                r = json.loads(line)
                recs[r["id"]] = r
    blob = json.dumps([recs[k] for k in sorted(recs)], sort_keys=True,
                      separators=(",", ":")).encode()
    npos = sum(len(r["plies"]) for r in recs.values())
    return hashlib.sha256(blob).hexdigest(), len(recs), npos


def main() -> int:
    ids = []
    with open(SLICE, "w") as out:
        for i, line in enumerate(open(os.path.join(FROZEN, "admissible", "games.ndjson"))):
            if i >= N_GAMES:
                break
            out.write(line)
            ids.append(json.loads(line)["id"])
    print("slice: %d games from the already-scored Player B corpus" % len(ids), flush=True)

    # the frozen answer for exactly these games
    frozen = {}
    for name in sorted(os.listdir(os.path.join(FROZEN, "scored"))):
        if name.endswith(".jsonl"):
            for line in open(os.path.join(FROZEN, "scored", name)):
                if line.strip():
                    r = json.loads(line)
                    if r["id"] in set(ids):
                        frozen[r["id"]] = r
    fblob = json.dumps([frozen[k] for k in sorted(frozen)], sort_keys=True,
                       separators=(",", ":")).encode()
    frozen_digest = hashlib.sha256(fblob).hexdigest()
    print("frozen records for the slice: %d, digest %s" % (len(frozen), frozen_digest[:16]),
          flush=True)

    rows = []
    for w in TOPOLOGIES:
        out_dir = os.path.join(SCR, "out_w%02d" % w)
        subprocess.run(["rm", "-rf", out_dir], check=True)
        os.makedirs(out_dir)
        env = dict(os.environ)
        b0, t0c = cpu_busy_jiffies()
        t0 = time.time()
        procs = [subprocess.Popen(
            [sys.executable, SCORER, "--in", SLICE, "--out", out_dir,
             "--worker", str(k), "--workers", str(w),
             "--focal-player-id", FOCAL, "--corpus", CORPUS],
            cwd=os.path.dirname(SCORER), stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, env=env) for k in range(w)]
        codes = [p.wait() for p in procs]
        el = time.time() - t0
        b1, t1c = cpu_busy_jiffies()
        dig, nrec, npos = digest_of(out_dir)
        busy = (b1 - b0) / (t1c - t0c) if t1c > t0c else 0.0
        rows.append({"workers": w, "seconds": round(el, 1), "records": nrec, "positions": npos,
                     "pos_per_s": round(npos / el, 2), "exit_codes_nonzero": sum(1 for c in codes if c),
                     "cpu_busy_fraction_all_cores": round(busy, 3),
                     "digest": dig, "matches_frozen": dig == frozen_digest})
        print("  workers=%-2d  %6.1fs  %6.2f pos/s  cpu %.0f%%  digest %s  frozen-match %s"
              % (w, el, npos / el, 100 * busy, dig[:12], dig == frozen_digest), flush=True)

    base = next(r for r in rows if r["workers"] == 1)
    digests = {r["digest"] for r in rows}
    for r in rows:
        r["speedup_vs_1_worker"] = round(base["seconds"] / r["seconds"], 2)
        r["efficiency_vs_cores"] = round(
            (base["seconds"] / r["seconds"]) / min(r["workers"], NCORES), 3)
    doc = {
        "_what": "Compute-scaling benchmark of the FROZEN scorer. Measurement only. No cohort "
                 "member scored, nothing written into the repository, no research rule touched.",
        "measured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "host": {"cores": NCORES, "model": open("/proc/cpuinfo").read().split("model name")[1]
                 .split(":")[1].split("\n")[0].strip()},
        "engine_regime_unchanged": {"binary": os.environ.get("SF_BIN"), "depth": 12, "multipv": 3,
                                    "threads": 1, "hash_mb": 16,
                                    "hash_cleared_per_position": True},
        "corpus": {"source": "research/mechanism/replications/lichess_vibesgalore_B",
                   "why": "already scored, and NOT a cohort member",
                   "games": len(ids), "frozen_digest": frozen_digest},
        "output_equivalence": {
            "distinct_digests_across_topologies": len(digests),
            "all_topologies_agree": len(digests) == 1,
            "all_match_the_frozen_record": all(r["matches_frozen"] for r in rows),
            "_method": "records reassembled by game id, sorted, canonical JSON, sha256. Sharding "
                       "changes which part file holds a game and cannot change this digest.",
        },
        "rows": rows,
    }
    json.dump(doc, open(os.path.join(SCR, "SCALING_BENCH.json"), "w"), indent=1)
    print(json.dumps({k: doc[k] for k in ("host", "output_equivalence")}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
