"""
PHASES 7, 8, 9, 19 -- select the cohort, and freeze it before anything is scored.

Walks the committed order over the frame, tries each candidate against the pre-registered
eligibility, and takes the first 100 that pass. Every rejection is recorded with its reason, so the
rejection rate is auditable and a silent re-roll is visible.

Nothing here reads an analysis result. A candidate is accepted or rejected on: account status, the
leave-one-player-out population check, the size of their frozen window, and the population band the
window derives. All four are knowable before a single position is scored, and the run stops at
FREEZE so that none is.

Resumable: state is written after every candidate, and a rerun continues from it.

    python cohort_select.py [--limit N] [--out COHORT_SELECTION.json]
"""
from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
REPL = os.path.join(MECH, "replication")
sys.path.insert(0, REPL)
import contract          # noqa: E402
import corpus as corpuslib  # noqa: E402
import populations       # noqa: E402

REPLICATIONS = os.path.join(MECH, "replications")


def promote(run_dir: str) -> str:
    """Move an accepted probe into the tree and return its repo-relative path."""
    dest = os.path.join(REPLICATIONS, os.path.basename(run_dir))
    if os.path.abspath(run_dir) != os.path.abspath(dest):
        if os.path.exists(dest):
            raise SystemExit("%s already exists; refusing to overwrite a run directory" % dest)
        shutil.move(run_dir, dest)
    rel = os.path.relpath(dest, REPO)
    if rel.startswith(".."):
        raise SystemExit("%s resolves outside the repository; a member must live in the tree" % rel)
    return rel


def blitz_median_from_admissible(admissible_ndjson: str, focal_player_id: str) -> float | None:
    """The band-centre input `populations.focal_blitz_median_rating` reads, taken BEFORE any scoring.

    Selection has to know a candidate's band before committing an engine-hour to them, and the
    decisions parquet does not exist yet at that point. This reads the admissible games directly and
    applies the identical rule: the focal side's rating, one per BLITZ game, median.

    It lives HERE, in selection, and not in `populations.py`, because `populations.py` is one of the
    seventeen files the pipeline hash is taken over. Adding to it would change the identity of the
    research code and invalidate the erez281 run of record and Player B, which are frozen historical
    findings this mission puts off-limits. `select_player_b.py` reads the same field the same way for
    the same reason.

    It is a second implementation of one rule, which is how rules drift. `cohort_run.py` therefore
    asserts that the band this returns equals the band `populations.resolve` derives from the scored
    parquet, per member, and records a mismatch as a defect rather than preferring either answer.
    Verified against the recorded vibesgalore run: 1626.0 from both.
    """
    ratings = []
    want = (focal_player_id or "").lower()
    with open(admissible_ndjson) as f:
        for line in f:
            g = json.loads(line)
            if g.get("speed") != "blitz":
                continue
            for side in ("white", "black"):
                p = (g.get("players") or {}).get(side) or {}
                if ((p.get("user") or {}).get("id") or "").lower() == want and p.get("rating"):
                    ratings.append(int(p["rating"]))
    return float(statistics.median(ratings)) if ratings else None


PY = os.environ.get("REPLICATION_PYTHON", sys.executable)
POP_GAMES = os.path.join(MECH, "data", "population_games.ndjson")
RUN_ID = "COHORT"
# Candidate probes happen OUTSIDE the repository. Most candidates are rejected on the band and
# their probe is deleted; a probe is not repository content, and a walk that littered the tree with
# transient run directories would make every commit during selection a lie about what exists.
#
# An ACCEPTED probe is different: it is a cohort member from that moment, so it is promoted into the
# tree immediately rather than at freeze time. That is not tidiness. Selection takes hours and the
# scratch root does not outlive a session, so a member left in scratch is a member that can vanish
# between the walk and the freeze, taking the frozen corpus it was accepted on with it.
DEFAULT_PROBE_ROOT = os.environ.get(
    "COHORT_PROBE_ROOT",
    os.path.join(os.environ.get("TMPDIR", "/tmp"), "cohort_probes"))


def population_members() -> set[str]:
    """PHASE 19. Every player in the baseline corpus that would judge a cohort member.

    Read from the population's own committed games rather than from a list somebody maintains,
    because a list can fall out of step with the corpus and this check would then pass while being
    false.
    """
    ids: set[str] = set()
    with open(POP_GAMES) as f:
        for line in f:
            g = json.loads(line)
            for side in ("white", "black"):
                u = ((g.get("players") or {}).get(side) or {}).get("user") or {}
                if u.get("id"):
                    ids.add(u["id"].lower())
    return ids


def try_candidate(username: str, window: int, fetch_max: int, root: str) -> dict:
    """Everything up to the derived band, and not one step further."""
    d = corpuslib.run_dir("lichess", username, RUN_ID, root)
    cmd = [PY, os.path.join(REPL, "run.py"), "--platform", "lichess", "--username", username,
           "--ingest-mode", "api-user-export", "--run-id", RUN_ID, "--window", str(window),
           "--stop-after", "FREEZE"]
    if root:
        cmd += ["--root", root]
    env = dict(os.environ, REPLICATION_FETCH_MAX_GAMES=str(fetch_max))
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)
    res_path = os.path.join(d, "report", "RESULT.json")
    if not os.path.exists(res_path):
        return {"accepted": False, "reason": "RUN_FAILED", "run_dir": d,
                "stderr": (p.stderr or "")[-400:]}
    res = json.load(open(res_path))
    if res.get("status") != "FROZEN":
        return {"accepted": False, "reason": res.get("failure_code") or res.get("status"),
                "run_dir": d, "corpus": res.get("corpus")}
    return {"accepted": None, "run_dir": d, "corpus": res["corpus"],
            "player_id": res["focal"]["player_id"]}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="stop after trying this many candidates")
    ap.add_argument("--root", default=DEFAULT_PROBE_ROOT,
                    help="where candidate probes are written. Outside the repository by default: "
                         "a probe is not repository content until freeze_cohort.py promotes it.")
    ap.add_argument("--out", default=os.path.join(HERE, "COHORT_SELECTION.json"))
    a = ap.parse_args()

    pre = json.load(open(os.path.join(HERE, "COHORT_PREREG.json")))
    frame = json.load(open(os.path.join(HERE, "COHORT_FRAME.json")))
    plan = json.load(open(os.path.join(HERE, "POWER_PLAN.json")))

    cohort_n = pre["denominators"]["BROAD_POWERED"]["n"]
    resid_n = pre["denominators"]["RESIDUAL_POWERED"]["n"]
    seed = pre["selection"]["seed"]
    w_broad = pre["window"]["broad_members"]["admissible_games"]
    w_resid = pre["window"]["residual_members"]["admissible_games"]
    resid_games_min = plan["residual_minimum"]["operative_minimum_admissible_blitz_games"]
    adm_rate = plan["ingestion_reach"]["admissible_rate"]
    # Selection gate, in the unit that is knowable before scoring. The decision-count denominators
    # are computed after scoring, per the prereg; this gate only has to guarantee they CAN be met.
    #
    # The gate is the FULL window, not a fraction of it, and that is what makes the retrieval bound
    # sound: a full window holds the newest N admissible games, which is what an unbounded fetch
    # would have given, because an unbounded fetch adds only older games that the window discards.
    pf = pre["selection"]["prefilter"]["measured_recall"]["chosen"]
    bound = pre["window"]["retrieval_bound"]
    centres = sorted({(b[0] + b[1]) // 2 for b in
                      (tuple(p["band"]) for p in populations.registry())})

    bands = {tuple(p["band"]) for p in populations.registry()}
    pop_ids = population_members()

    ok = [r for r in frame["rows"] if r["status"] == "OK"]
    order = [r["u"] for r in ok]
    random.Random(seed).shuffle(order)
    meta = {r["u"]: r for r in ok}

    os.makedirs(a.root, exist_ok=True)
    state_path = a.out
    state = (json.load(open(state_path)) if os.path.exists(state_path) else {
        "_what": "The selection walk. Every candidate tried, in the committed order, with the "
                 "reason each rejected one was rejected.",
        "prereg_hash": pre["prereg_hash"], "frame_hash": frame["frame_hash"], "seed": seed,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "cursor": 0, "accepted": [], "rejected": [], "prefiltered": {},
        "residual_slots_filled": 0})
    state.setdefault("prefiltered", {})
    if state["prereg_hash"] != pre["prereg_hash"] or state["frame_hash"] != frame["frame_hash"]:
        raise SystemExit("the prereg or the frame changed under a walk in progress; refusing")

    tried_this_call = 0
    while len(state["accepted"]) < cohort_n and state["cursor"] < len(order):
        if a.limit is not None and tried_this_call >= a.limit:
            break
        u = order[state["cursor"]]
        state["cursor"] += 1
        tried_this_call += 1
        m = meta[u]

        # Declared prefilter (Phase 7): skips a candidate the metadata says cannot pass, so the
        # walk does not spend a full fetch to reject 95% of the frame. It never ACCEPTS anyone.
        if min(abs(m["blitz_rating"] - c) for c in centres) > pf:
            # Counted, not listed: the prefilter skips most of the frame without a fetch, and a
            # per-name list of thousands would bury the rejections that cost something.
            k = "PREFILTER_RATING_FAR_FROM_BAND"
            state["prefiltered"][k] = state["prefiltered"].get(k, 0) + 1
            continue
        if not m["vol_broad"]:
            k = "PREFILTER_TOO_FEW_GAMES"
            state["prefiltered"][k] = state["prefiltered"].get(k, 0) + 1
            continue
        if u.lower() in pop_ids:
            state["rejected"].append({"u": u, "reason": "IN_POPULATION_BASELINE",
                                      "_phase": 19})
            continue
        # Residual-slot assignment is made from METADATA, before the fetch, so the window can be
        # declared before the corpus exists.
        wants_residual = (state["residual_slots_filled"] < resid_n
                          and m["blitz_games"] * adm_rate >= resid_games_min)
        window = w_resid if wants_residual else w_broad
        fetch_max = bound["residual"] if wants_residual else bound["broad"]

        t0 = time.time()
        r = try_candidate(u, window, fetch_max, a.root)
        if r["accepted"] is False:
            state["rejected"].append({"u": u, "reason": r["reason"],
                                      "corpus": r.get("corpus")})
            shutil.rmtree(r["run_dir"], ignore_errors=True)
            json.dump(state, open(state_path, "w"), indent=1)
            continue

        c = r["corpus"]
        if c["admissible"] < window:
            state["rejected"].append({"u": u, "reason": "INSUFFICIENT_ELIGIBLE_GAMES",
                                      "admissible": c["admissible"], "needed": window,
                                      "window_full": False})
            shutil.rmtree(r["run_dir"], ignore_errors=True)
            json.dump(state, open(state_path, "w"), indent=1)
            continue

        med = blitz_median_from_admissible(
            os.path.join(r["run_dir"], "admissible", "games.ndjson"), r["player_id"])
        if med is None:
            state["rejected"].append({"u": u, "reason": "NO_BLITZ_GAMES"})
            shutil.rmtree(r["run_dir"], ignore_errors=True)
            json.dump(state, open(state_path, "w"), indent=1)
            continue
        band = tuple(contract.population_band(med))
        if band not in bands:
            state["rejected"].append({"u": u, "reason": "POPULATION_BASELINE_INSUFFICIENT",
                                      "blitz_median": med, "derived_band": list(band),
                                      "screen_predicted_band": m["band_now"]})
            shutil.rmtree(r["run_dir"], ignore_errors=True)
            json.dump(state, open(state_path, "w"), indent=1)
            continue

        blitz_admissible = c["speeds"].get("blitz", 0)
        is_residual = wants_residual and blitz_admissible >= resid_games_min
        if is_residual:
            state["residual_slots_filled"] += 1
        state["accepted"].append({
            "u": u, "player_id": r["player_id"], "run_dir": promote(r["run_dir"]),
            "window": window, "window_class": "RESIDUAL" if is_residual else "BROAD",
            "admissible": c["admissible"], "blitz_admissible": blitz_admissible,
            "speeds": c["speeds"], "blitz_median": med, "derived_band": list(band),
            "fetch_max": fetch_max, "window_full": c["admissible"] >= window,
            "screen_predicted_band": m["band_now"],
            "screen_band_agreed": list(band) == m["band_now"],
            "seconds": round(time.time() - t0, 1),
        })
        json.dump(state, open(state_path, "w"), indent=1)

    state["complete"] = len(state["accepted"]) >= cohort_n
    state["frame_exhausted"] = state["cursor"] >= len(order)
    state["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    json.dump(state, open(state_path, "w"), indent=1)

    by_reason: dict[str, int] = {}
    for r in state["rejected"]:
        by_reason[r["reason"]] = by_reason.get(r["reason"], 0) + 1
    print(json.dumps({"out": state_path, "walked": state["cursor"], "of_frame": len(order),
                      "prefiltered": state["prefiltered"],
                      "fetched": len(state["accepted"]) + len(state["rejected"]),
                      "accepted": len(state["accepted"]),
                      "residual_slots": state["residual_slots_filled"],
                      "rejected": len(state["rejected"]), "by_reason": by_reason,
                      "complete": state["complete"]}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
