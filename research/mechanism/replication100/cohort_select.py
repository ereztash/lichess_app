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
import statistics
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


# A transport failure means back off, not press on: the export is one request at a time and a walk
# that keeps knocking through a rate limit turns a pause into a longer one. Doubling from 30s caps
# at 8 minutes, which is above lichess's own "wait a full minute" guidance with room to spare.
FETCH_BACKOFF_BASE = 30
FETCH_BACKOFF_CAP = 480

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


def try_candidate(username: str, window: int, fetch_max: int, root: str,
                  run_id: str = RUN_ID) -> dict:
    """Everything up to the derived band, and not one step further."""
    d = corpuslib.run_dir("lichess", username, run_id, root)
    cmd = [PY, os.path.join(REPL, "run.py"), "--platform", "lichess", "--username", username,
           "--ingest-mode", "api-user-export", "--run-id", run_id, "--window", str(window),
           "--stop-after", "FREEZE"]
    if root:
        cmd += ["--root", root]
    # fetch_max of 0 means no bound: the full history, which is what a size rejection has to be
    # decided on so that it is the player's shortage and not the client's.
    env = dict(os.environ)
    env.pop("REPLICATION_FETCH_MAX_GAMES", None)
    if fetch_max:
        env["REPLICATION_FETCH_MAX_GAMES"] = str(fetch_max)
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)
    # The ingest layer waits out a 429 inside the request, up to six times at 65s. From out here a
    # throttled fetch and a slow one look identical, and only one of them means the walk should
    # ease off. Count the waits it announced, so throttling is a number in the record rather than
    # something inferred afterwards from the clock. Computed before any exit, because the run that
    # dies without a RESULT.json is exactly the one whose throttling matters most.
    rate_limited = (p.stderr or "").count("lichess 429")
    res_path = os.path.join(d, "report", "RESULT.json")
    if not os.path.exists(res_path):
        return {"accepted": False, "reason": "RUN_FAILED", "run_dir": d,
                "stderr": (p.stderr or "")[-400:], "rate_limited": rate_limited}
    res = json.load(open(res_path))
    if res.get("status") != "FROZEN":
        # `detail` is the ingest layer's own message. Without it a FETCH_FAILED is unauditable:
        # a closed account and a rate limit look identical in the record, and only one of them is
        # a fact about the candidate.
        return {"accepted": False, "reason": res.get("failure_code") or res.get("status"),
                "detail": res.get("detail"), "run_dir": d, "corpus": res.get("corpus"),
                "rate_limited": rate_limited}
    return {"accepted": None, "run_dir": d, "corpus": res["corpus"],
            "player_id": res["focal"]["player_id"], "rate_limited": rate_limited}


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

    # ONE-TIME MIGRATION. An earlier walk recorded a transport failure as a rejection, which reads
    # as "the selection judged this candidate and said no" when in fact it never reached them. The
    # accounts behind all eleven were alive with thousands of games. They go back into the queue at
    # their committed positions rather than being written off, because a candidate skipped for a
    # client failure is a candidate the committed order still owes a try.
    migrated = [r for r in state["rejected"] if r["reason"] == "FETCH_FAILED"]
    if migrated:
        state["rejected"] = [r for r in state["rejected"] if r["reason"] != "FETCH_FAILED"]
        state.setdefault("unreachable", []).extend(
            {**r, "migrated_from_rejected": True} for r in migrated)
        state.setdefault("retry_queue", []).extend(r["u"] for r in migrated)
        print("migrated %d FETCH_FAILED out of rejected and into the retry queue" % len(migrated),
              flush=True)
        json.dump(state, open(state_path, "w"), indent=1)

    tried_this_call = 0
    fails = 0
    while len(state["accepted"]) < cohort_n:
        # The retry queue is drained FIRST and in committed order, so a candidate the client failed
        # to reach is tried at the position the seed gave them rather than after everyone else.
        queue = state.get("retry_queue") or []
        if queue:
            u = queue.pop(0)
            state["retry_queue"] = queue
        elif state["cursor"] < len(order):
            u = order[state["cursor"]]
            state["cursor"] += 1
        else:
            break
        if a.limit is not None and tried_this_call >= a.limit:
            break
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
        # PHASE A probes EVERY candidate at the BROAD window. The residual window is five times
        # the data and about five times the fetch, and roughly seven in eight candidates are
        # rejected on the band, so paying the residual price to discover a rejection is the bulk of
        # the cost: measured over 165 fetches, 176s each at the residual bound against an implied
        # 36s at the broad one. Residual members are promoted in PHASE B, from the members that
        # were already accepted, so the expensive fetch is paid about 25 times and not about 870.
        window, fetch_max = w_broad, bound["broad"]

        t0 = time.time()
        r = try_candidate(u, window, fetch_max, a.root)
        if r.get("reason") == "FETCH_FAILED":
            # NOT a rejection. The walk never reached the rule, so nothing about this candidate was
            # decided, and recording it among the rejected would put a claim in the frozen record
            # that the selection made a judgement it never made. It would also inflate the
            # pre-declared "eligibility rejection rate" flag with the client's own failures.
            #
            # Eleven of these arrived in one twenty-fetch stretch and every account behind them was
            # alive with thousands of games, which is what a rate limit looks like from here. So the
            # walk now backs off instead of spending the committed order on its own transport, and
            # the candidate goes back in the queue at its committed position.
            shutil.rmtree(r["run_dir"], ignore_errors=True)
            fails += 1
            state.setdefault("unreachable", []).append(
                {"u": u, "reason": "FETCH_FAILED", "detail": r.get("detail"),
                 "rate_limited_waits": r.get("rate_limited", 0),
                 "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "requeued": True})
            state.setdefault("retry_queue", []).append(u)
            json.dump(state, open(state_path, "w"), indent=1)
            back = min(FETCH_BACKOFF_CAP, FETCH_BACKOFF_BASE * (2 ** (fails - 1)))
            print("  FETCH_FAILED (%d in a row): %s. requeued, sleeping %ds"
                  % (fails, str(r.get("detail"))[:120], back), flush=True)
            time.sleep(back)
            continue
        fails = 0
        if r["accepted"] is False:
            state["rejected"].append({"u": u, "reason": r["reason"], "detail": r.get("detail"),
                                      "rate_limited_waits": r.get("rate_limited", 0),
                                      "corpus": r.get("corpus")})
            shutil.rmtree(r["run_dir"], ignore_errors=True)
            json.dump(state, open(state_path, "w"), indent=1)
            continue

        c = r["corpus"]
        if c["admissible"] < window:
            # The window did not fill, so the retrieval bound MAY be why rather than the player's
            # history. The bound's margin is calibrated to the observed admissible rate; a player
            # who forfeits on time often, or plays many short games, sits below it and would be
            # rejected for a property of the client. Retry once with no bound at all, so that a
            # size rejection is always the player's and never ours.
            shutil.rmtree(r["run_dir"], ignore_errors=True)
            r = try_candidate(u, window, 0, a.root)
            if r.get("reason") == "FETCH_FAILED":
                shutil.rmtree(r["run_dir"], ignore_errors=True)
                fails += 1
                state.setdefault("unreachable", []).append(
                    {"u": u, "reason": "FETCH_FAILED", "detail": r.get("detail"),
                     "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                     "requeued": True, "on_unbounded_retry": True})
                state.setdefault("retry_queue", []).append(u)
                json.dump(state, open(state_path, "w"), indent=1)
                time.sleep(min(FETCH_BACKOFF_CAP, FETCH_BACKOFF_BASE * (2 ** (fails - 1))))
                continue
            if r["accepted"] is False:
                state["rejected"].append({"u": u, "reason": r["reason"], "detail": r.get("detail"),
                                          "corpus": r.get("corpus"), "retried_unbounded": True})
                shutil.rmtree(r["run_dir"], ignore_errors=True)
                json.dump(state, open(state_path, "w"), indent=1)
                continue
            c = r["corpus"]
            fetch_max = 0
        if c["admissible"] < window:
            state["rejected"].append({"u": u, "reason": "INSUFFICIENT_ELIGIBLE_GAMES",
                                      "admissible": c["admissible"], "needed": window,
                                      "blitz_admissible": c["speeds"].get("blitz", 0),
                                      "fetch_max": fetch_max, "window_full": False,
                                      "unbounded": fetch_max == 0,
                                      "seconds": round(time.time() - t0, 1)})
            shutil.rmtree(r["run_dir"], ignore_errors=True)
            json.dump(state, open(state_path, "w"), indent=1)
            continue

        med = blitz_median_from_admissible(
            os.path.join(r["run_dir"], "admissible", "games.ndjson"), r["player_id"])
        if med is None:
            state["rejected"].append({"u": u, "reason": "NO_BLITZ_GAMES",
                                      "admissible": c["admissible"], "window": window,
                                      "seconds": round(time.time() - t0, 1)})
            shutil.rmtree(r["run_dir"], ignore_errors=True)
            json.dump(state, open(state_path, "w"), indent=1)
            continue
        band = tuple(contract.population_band(med))
        if band not in bands:
            state["rejected"].append({"u": u, "reason": "POPULATION_BASELINE_INSUFFICIENT",
                                      "blitz_median": med, "derived_band": list(band),
                                      "screen_predicted_band": m["band_now"],
                                      "admissible": c["admissible"],
                                      "blitz_admissible": c["speeds"].get("blitz", 0),
                                      "window": window, "fetch_max": fetch_max,
                                      "window_full": c["admissible"] >= window,
                                      "seconds": round(time.time() - t0, 1)})
            shutil.rmtree(r["run_dir"], ignore_errors=True)
            json.dump(state, open(state_path, "w"), indent=1)
            continue

        blitz_admissible = c["speeds"].get("blitz", 0)
        state["accepted"].append({
            "u": u, "player_id": r["player_id"], "run_dir": promote(r["run_dir"]),
            "window": window, "window_class": "BROAD",
            # From metadata, so it is knowable now and does not read anything the run produced.
            # PHASE B tries these in this same committed order.
            "residual_capable": m["blitz_games"] * adm_rate >= resid_games_min,
            "residual_attempted": False,
            "admissible": c["admissible"], "blitz_admissible": blitz_admissible,
            "speeds": c["speeds"], "blitz_median": med, "derived_band": list(band),
            "fetch_max": fetch_max, "window_full": c["admissible"] >= window,
            "screen_predicted_band": m["band_now"],
            "screen_band_agreed": list(band) == m["band_now"],
            "seconds": round(time.time() - t0, 1),
        })
        json.dump(state, open(state_path, "w"), indent=1)

    # ---- PHASE B: promote residual members from the members already accepted -------------------
    #
    # A member accepted in PHASE A holds a broad window. Promotion refetches them at the residual
    # window and keeps that corpus ONLY if the wider window still derives a registered band and
    # still fills. So a residual member satisfies the band rule on BOTH of their windows, which is
    # stricter than the one-shot rule it replaces, not looser.
    #
    # The refetch goes to a scratch probe first. A promotion that fails the wider window must leave
    # the member exactly as PHASE A accepted them: they were validly accepted on the broad window
    # and losing a residual slot is not a reason to lose a member.
    if len(state["accepted"]) >= cohort_n:
        for i, mem in enumerate(state["accepted"]):
            if state["residual_slots_filled"] >= resid_n:
                break
            if mem.get("residual_attempted") or not mem.get("residual_capable"):
                continue
            if a.limit is not None and tried_this_call >= a.limit:
                break
            tried_this_call += 1
            mem["residual_attempted"] = True
            t0 = time.time()
            r = try_candidate(mem["u"], w_resid, bound["residual"], a.root, run_id=RUN_ID + "R")
            if r.get("reason") == "FETCH_FAILED":
                # Same rule as PHASE A, and it belongs here for the same reason: the walk never
                # reached the residual window, so nothing about this member's residual capacity was
                # decided. Marking the attempt done would spend a slot on the client's transport,
                # and with twenty-five slots that is how the residual subset comes up short for a
                # reason that has nothing to do with any player.
                mem["residual_attempted"] = False
                shutil.rmtree(r["run_dir"], ignore_errors=True)
                fails += 1
                state.setdefault("unreachable", []).append(
                    {"u": mem["u"], "reason": "FETCH_FAILED", "detail": r.get("detail"),
                     "rate_limited_waits": r.get("rate_limited", 0), "phase": "B",
                     "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "requeued": True})
                json.dump(state, open(state_path, "w"), indent=1)
                time.sleep(min(FETCH_BACKOFF_CAP, FETCH_BACKOFF_BASE * (2 ** (fails - 1))))
                continue
            fails = 0
            keep = False
            if r["accepted"] is not False:
                c = r["corpus"]
                med = blitz_median_from_admissible(
                    os.path.join(r["run_dir"], "admissible", "games.ndjson"), r["player_id"])
                blitz = c["speeds"].get("blitz", 0)
                band = tuple(contract.population_band(med)) if med is not None else None
                keep = (c["admissible"] >= w_resid and blitz >= resid_games_min
                        and band in bands)
                mem["residual_probe"] = {
                    "admissible": c["admissible"], "blitz_admissible": blitz,
                    "blitz_median": med, "derived_band": list(band) if band else None,
                    "window_full": c["admissible"] >= w_resid,
                    "band_registered": band in bands,
                    "seconds": round(time.time() - t0, 1),
                }
            else:
                mem["residual_probe"] = {"reason": r["reason"],
                                         "seconds": round(time.time() - t0, 1)}
            if keep:
                # The old corpus is destroyed LAST. This used to rmtree the member's accepted
                # broad run and then move the residual one into its place, so a move that failed
                # between the two left the member with no corpus at all: promoted out of existence.
                # The comment above promises that a failed promotion leaves the member exactly as
                # PHASE A accepted them, and only this order keeps that promise.
                dest = os.path.join(REPLICATIONS, os.path.basename(
                    corpuslib.run_dir("lichess", mem["u"], RUN_ID, None)))
                rel = os.path.relpath(dest, REPO)
                if rel.startswith(".."):
                    raise SystemExit("%s resolves outside the repository" % rel)
                staging = dest + ".promoting"
                shutil.rmtree(staging, ignore_errors=True)
                shutil.move(r["run_dir"], staging)
                shutil.rmtree(os.path.join(REPO, mem["run_dir"]), ignore_errors=True)
                shutil.rmtree(dest, ignore_errors=True)
                os.rename(staging, dest)
                mem.update({"run_dir": rel, "window": w_resid, "window_class": "RESIDUAL",
                            "admissible": mem["residual_probe"]["admissible"],
                            "blitz_admissible": mem["residual_probe"]["blitz_admissible"],
                            "blitz_median": mem["residual_probe"]["blitz_median"],
                            "derived_band": mem["residual_probe"]["derived_band"],
                            "fetch_max": bound["residual"], "window_full": True,
                            "screen_band_agreed":
                                mem["residual_probe"]["derived_band"] == mem["screen_predicted_band"]})
                state["residual_slots_filled"] += 1
            else:
                shutil.rmtree(r["run_dir"], ignore_errors=True)
            json.dump(state, open(state_path, "w"), indent=1)

    if (len(state["accepted"]) >= cohort_n
            and state["residual_slots_filled"] < resid_n
            and not any(m.get("residual_capable") and not m.get("residual_attempted")
                        for m in state["accepted"])):
        # Every capable member has been tried and the subset is still short. That is a finding
        # about the cohort, not a crash, but it stops the pipeline at freeze_cohort.py, so it is
        # said here rather than discovered there.
        print("PHASE B EXHAUSTED: %d of %d residual slots filled, and every residual-capable "
              "member has been probed. The cohort cannot carry its residual denominator as it "
              "stands." % (state["residual_slots_filled"], resid_n), flush=True)

    state["complete"] = (len(state["accepted"]) >= cohort_n
                         and state["residual_slots_filled"] >= resid_n)
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
