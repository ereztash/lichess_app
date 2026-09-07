"""
Selecting a replication player, using the criterion the pipeline actually applies.

The first attempt screened on the account's CURRENT blitz rating as a proxy for the median the band
rule reads. The proxy failed on the first candidate: `livio68` is rated 1655 today, but the median
over the 269 admissible blitz games in the enumerable window is 1772, because they slid from ~1770
to ~1660 across that window. Their derived band is 1550-1950, which the registry does not hold.

That is an ELIGIBILITY failure, found before a single position was scored, so nothing about the
player's chess was read and no analytic choice was taken from them. The repair is to stop using a
proxy and apply the exact criterion:

    derived band = population_band(median own_rating over admissible BLITZ games in the window)
    the band must be one registry/populations.json holds

This screen looks only at ratings, game counts and account status. It never looks at any analysis
result. Candidates are screened in the deterministic order declared in PLAYER_B_SELECTION.json and
the FIRST one that passes is taken, so the choice is mechanical.

There is no cheap pre-filter at all: every candidate gets the exact criterion, in order. A profile
rating decides nothing, which is the whole lesson of the first attempt.

    python select_player_b.py --candidates <json> --limit 12 --out PLAYER_B_SCREEN.json
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import contract          # noqa: E402
import eligibility       # noqa: E402
import ingest_lichess    # noqa: E402
import populations       # noqa: E402

MIN_ADMISSIBLE_GAMES = 200      # declared before screening: below this the frames get thin
MIN_BLITZ_GAMES = 150
PY = os.environ.get("REPLICATION_PYTHON", sys.executable)


def enumerate_ids(username: str, pages: int, out: str) -> list[str]:
    subprocess.check_call([PY, os.path.join(HERE, "enumerate_ids_html.py"),
                           "--username", username, "--pages", str(pages), "--out", out],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return json.load(open(out))


def screen_one(username: str, pages: int, workdir: str) -> dict:
    """Everything up to, and only up to, the derived band. No scoring, no analysis."""
    rec = {"username": username}
    try:
        profile = ingest_lichess.verify_account(username)
    except ingest_lichess.IngestError as e:
        return {**rec, "eligible": False, "reason": e.code}
    rec["player_id"] = profile["id"]
    blitz = (profile.get("perfs") or {}).get("blitz") or {}
    rec["profile_blitz_rating"] = blitz.get("rating")
    rec["profile_blitz_games"] = blitz.get("games")

    d = os.path.join(workdir, username)
    os.makedirs(d, exist_ok=True)
    ids = enumerate_ids(username, pages, os.path.join(d, "ids.json"))
    rec["ids_enumerated"] = len(ids)
    if not ids:
        return {**rec, "eligible": False, "reason": "NO_ENUMERABLE_GAMES"}
    try:
        ingest_lichess.ingest(username, os.path.join(d, "raw"), mode="api-ids", game_ids=ids)
    except ingest_lichess.IngestError as e:
        return {**rec, "eligible": False, "reason": e.code}
    elig = eligibility.apply(os.path.join(d, "raw", "history.ndjson"), os.path.join(d, "admissible"),
                             focal_player_id=profile["id"], corpus=f"lichess:{profile['id']}")
    rec["admissible"] = elig["admissible"]
    rec["scorable"] = elig["scorable"]
    rec["speeds"] = elig["speeds"]
    rec["exclusions"] = elig["excluded_by_reason"]

    ratings = []
    for line in open(elig["admissible_path"]):
        g = json.loads(line)
        if g.get("speed") != "blitz":
            continue
        for side in ("white", "black"):
            p = (g.get("players") or {}).get(side) or {}
            if ((p.get("user") or {}).get("id") or "").lower() == profile["id"].lower() and p.get("rating"):
                ratings.append(int(p["rating"]))
    rec["blitz_games_in_window"] = len(ratings)
    if not ratings:
        return {**rec, "eligible": False, "reason": "NO_BLITZ_GAMES"}
    med = statistics.median(ratings)
    band = list(contract.population_band(med))
    hit = [p for p in populations.registry() if tuple(p["band"]) == tuple(band)]
    rec.update({"blitz_median_in_window": med, "derived_band": band,
                "registry_hit": bool(hit), "registry_entry": hit[0]["id"] if hit else None,
                "blitz_rating_min": min(ratings), "blitz_rating_max": max(ratings)})
    reasons = []
    if not hit:
        reasons.append(f"POPULATION_BASELINE_INSUFFICIENT: derived band {band} is not registered")
    if elig["scorable"] < MIN_ADMISSIBLE_GAMES:
        reasons.append(f"TOO_FEW_ADMISSIBLE_GAMES: {elig['scorable']} < {MIN_ADMISSIBLE_GAMES}")
    if len(ratings) < MIN_BLITZ_GAMES:
        reasons.append(f"TOO_FEW_BLITZ_GAMES: {len(ratings)} < {MIN_BLITZ_GAMES}")
    rec["eligible"] = not reasons
    rec["reason"] = "; ".join(reasons) if reasons else "ELIGIBLE"
    return rec


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", required=True, help="deterministically ordered candidate list")
    ap.add_argument("--limit", type=int, default=12)
    ap.add_argument("--pages", type=int, default=40)
    ap.add_argument("--workdir", default=None)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    workdir = a.workdir or tempfile.mkdtemp(prefix="playerb_screen_")
    cands = json.load(open(a.candidates))
    screened, chosen = [], None
    for c in cands:
        if len(screened) >= a.limit:
            break
        u = c["username"] if isinstance(c, dict) else c
        rec = screen_one(u, a.pages, workdir)
        screened.append(rec)
        print(json.dumps({k: rec.get(k) for k in ("username", "blitz_median_in_window",
                                                  "derived_band", "registry_hit", "scorable",
                                                  "eligible", "reason")}), flush=True)
        if rec.get("eligible"):
            chosen = rec
            break
        time.sleep(1.0)
    out = {"criterion": {
               "exact": "population_band(median own_rating over admissible BLITZ games in the "
                        "enumerable window) must be a band registry/populations.json holds",
               "min_admissible_games": MIN_ADMISSIBLE_GAMES,
               "min_blitz_games": MIN_BLITZ_GAMES,
               "order": "the deterministic order of PLAYER_B_SELECTION.json; the first pass wins",
               "looks_at": ["rating", "game count", "account status"],
               "never_looks_at": ["any analysis result"]},
           "screened": screened, "chosen": chosen, "workdir": workdir,
           "screened_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    with open(a.out, "w") as f:
        json.dump(out, f, indent=1)
    print(json.dumps({"chosen": (chosen or {}).get("username"), "screened": len(screened)}))
    return 0 if chosen else 1


if __name__ == "__main__":
    raise SystemExit(main())
