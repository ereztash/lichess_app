"""
PHASE 5 -- metadata-only feasibility screen.

Before any cohort is selected, how many Lichess players can this instrument actually SAY something
about? Two gates decide it, and they pull against each other:

  BAND    the derived population band must be one the registry holds. The registry holds exactly
          one band, [1450, 1850], whose centre is 1650, so the player's blitz median must round to
          1650 -- a 50-point bucket, not a 400-point one.
  VOLUME  the corpus must clear POWER_PLAN's minimums. The residual question needs an order of
          magnitude more blitz games than the broad one.

The tension: a player with enough blitz history to answer the residual question has, by definition,
a long history, and long histories drift out of a 50-point bucket. This screen measures both gates
and their overlap on an UNFILTERED frame, so the answer is a rate and not an anecdote.

Nothing here fetches a game, scores a position, or reads an analysis result. It reads public
profile metadata and public game headers, and it stops.

    python feasibility_screen.py --mb 80 --sample 3000 --out FEASIBILITY_SCREEN.json
"""
from __future__ import annotations

import argparse
import io
import json
import math
import os
import random
import statistics
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(MECH))
REPL = os.path.join(MECH, "replication")
sys.path.insert(0, REPL)
import contract          # noqa: E402
import corpus as corpuslib  # noqa: E402
import populations       # noqa: E402

DUMP = "https://database.lichess.org/standard/lichess_db_standard_rated_2026-06.pgn.zst"
UA = "cor-sys-replication100/1.0 (research; contact via lichess erez281)"
BULK = "https://lichess.org/api/users"
BULK_MAX = 300

# Not a new decision: the frame uses the same time controls the registry's own population was
# built from, so the screen's denominator and the baseline's denominator are the same frame.
def blitz_time_controls(reg: list) -> set:
    tc: set[str] = set()
    for p in reg:
        tc.update(p.get("time_controls") or [])
    return tc


def http(url: str, data: bytes | None = None, headers: dict | None = None,
         retries: int = 5) -> bytes:
    h = {"User-Agent": UA}
    h.update(headers or {})
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=h,
                                         method="POST" if data else "GET")
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
            code = getattr(e, "code", None)
            time.sleep(65 if code == 429 else 2 ** i)
    raise RuntimeError("http failed: %s" % last)


def frame_from_dump(mb: int, cache: str, blitz_tc: set) -> dict:
    """Usernames + their June blitz Elos, from public game headers. No pre-filter on rating:
    filtering the frame by rating would bake the band into the denominator and make the yield
    circular."""
    if not os.path.exists(cache):
        raw = http(DUMP, headers={"Range": "bytes=0-%d" % (mb * 1024 * 1024 - 1)})
        open(cache, "wb").write(raw)
    import zstandard
    dec = zstandard.ZstdDecompressor().stream_reader(open(cache, "rb"))
    text = io.TextIOWrapper(dec, encoding="utf-8", errors="replace")

    players: dict[str, list[int]] = {}
    games = blitz_games = 0
    cur: dict[str, str] = {}
    try:
        for line in text:
            if line.startswith("["):
                k, _, rest = line[1:].partition(" ")
                cur[k] = rest.strip().strip('"]').strip('"')
            elif line.strip() == "" and cur:
                if "White" in cur and "Event" in cur:
                    games += 1
                    if cur.get("TimeControl") in blitz_tc and cur.get("Termination") == "Normal":
                        blitz_games += 1
                        for side, elo in (("White", "WhiteElo"), ("Black", "BlackElo")):
                            u, e = cur.get(side), cur.get(elo)
                            if u and e and e.isdigit():
                                players.setdefault(u.lower(), []).append(int(e))
                    cur = {}
    except Exception:  # truncated stream: expected, we asked for a prefix
        pass
    return {"players": players, "games_seen": games, "blitz_games_seen": blitz_games}


def profiles(usernames: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for i in range(0, len(usernames), BULK_MAX):
        chunk = usernames[i:i + BULK_MAX]
        body = ",".join(chunk).encode()
        data = json.loads(http(BULK, data=body,
                               headers={"Content-Type": "text/plain"}) or b"[]")
        for u in data:
            out[u["id"]] = u
        time.sleep(1.0)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mb", type=int, default=80)
    ap.add_argument("--sample", type=int, default=3000)
    ap.add_argument("--seed", type=int, default=20260907)
    ap.add_argument("--cache", default=os.path.join(HERE, ".dump_prefix.zst"))
    ap.add_argument("--out", default=os.path.join(HERE, "FEASIBILITY_SCREEN.json"))
    a = ap.parse_args()

    plan = json.load(open(os.path.join(HERE, "POWER_PLAN.json")))
    freeze = json.load(open(os.path.join(HERE, "INSTRUMENT_FREEZE.json")))
    reg = populations.registry()
    bands = sorted({tuple(p["band"]) for p in reg})
    blitz_tc = blitz_time_controls(reg)
    centres = sorted({(b[0] + b[1]) // 2 for b in bands})
    half = contract.POPULATION_CONTRACT["band_halfwidth"]

    def band_ok(rating: float) -> bool:
        return tuple(contract.population_band(rating)) in {tuple(b) for b in bands}

    fr = frame_from_dump(a.mb, a.cache, blitz_tc)
    frame = fr["players"]
    names = sorted(frame)
    rng = random.Random(a.seed)
    sample = names if len(names) <= a.sample else rng.sample(names, a.sample)
    sample = sorted(sample)

    profs = profiles(sample)

    broad_games = plan["broad_minimum"]["admissible_games"]
    resid_games = plan["residual_minimum"]["operative_minimum_admissible_blitz_games"]
    resid_judge_games = plan["residual_minimum"]["admissible_blitz_games"]
    cap_adm = plan["enumeration_ceiling"]["max_admissible_games"]
    cap_blitz = plan["enumeration_ceiling"]["max_blitz_games"]
    # A player's LIFETIME blitz count is an upper bound on what any window can hold. Admissible
    # rate observed on the one measured player; used as an upper-bound conversion, stated as such.
    adm_rate = plan["enumeration_ceiling"]["admissible_rate"]

    rows, drifts = [], []
    for u in sample:
        p = profs.get(u)
        if not p:
            rows.append({"u": u, "status": "NOT_FOUND"}); continue
        if p.get("disabled") or p.get("tosViolation"):
            rows.append({"u": u, "status": "CLOSED_OR_FLAGGED"}); continue
        b = (p.get("perfs") or {}).get("blitz") or {}
        rating, ngames = b.get("rating"), b.get("games", 0)
        if not rating or b.get("prov"):
            rows.append({"u": u, "status": "NO_RATED_BLITZ"}); continue
        june = frame[u]
        drifts.append(abs(rating - statistics.median(june)))
        rows.append({
            "u": u, "status": "OK", "blitz_rating": rating, "blitz_games": ngames,
            "june_median_elo": statistics.median(june), "june_appearances": len(june),
            "band_now": list(contract.population_band(rating)),
            "band_registered_now": band_ok(rating),
            "band_registered_june": band_ok(statistics.median(june)),
            "vol_broad": ngames * adm_rate >= broad_games,
            "vol_residual_judge": ngames * adm_rate >= resid_judge_games,
            "vol_residual": ngames * adm_rate >= resid_games,
        })

    ok = [r for r in rows if r["status"] == "OK"]
    # Conditional reliability of a screen HIT, which is the number that sets screening cost. The
    # overall disagreement rate is dominated by players who are non-hits under both readings and so
    # agree trivially; it understates how often a hit evaporates.
    hits = [r for r in ok if r["band_registered_now"]]
    hits_conf = [r for r in hits if r["band_registered_june"]]
    # A player seen once in June has a one-game "median", which is a noisy second reading. Restrict
    # to players with several June appearances to separate proxy error from sampling error.
    hits_multi = [r for r in hits if r["june_appearances"] >= 5]
    hits_multi_conf = [r for r in hits_multi if r["band_registered_june"]]
    def n(pred) -> int:
        return sum(1 for r in ok if pred(r))
    band = n(lambda r: r["band_registered_now"])
    both_band = n(lambda r: r["band_registered_now"] and r["band_registered_june"])
    b_and_broad = n(lambda r: r["band_registered_now"] and r["vol_broad"])
    b_and_res = n(lambda r: r["band_registered_now"] and r["vol_residual"])
    b_and_res_j = n(lambda r: r["band_registered_now"] and r["vol_residual_judge"])
    disagree = n(lambda r: r["band_registered_now"] != r["band_registered_june"])

    N = len(ok)
    def rate(k: int) -> float:
        return round(k / N, 5) if N else 0.0

    doc = {
        "_what": "Metadata-only feasibility. How many Lichess players the frozen instrument can "
                 "reach at all, and how many of those it can reach for the RESIDUAL question.",
        "_method": "Public game headers give an unfiltered frame of blitz players; the public bulk "
                   "user endpoint gives their profile metadata. No game is fetched, no position is "
                   "scored, no analysis result is read.",
        "screened_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "instrument_hash": freeze["instrument_hash"],
        "repo_sha": corpuslib.repo_sha(),
        "seed": a.seed,
        "frame": {
            "source": DUMP, "prefix_mb": a.mb,
            "games_seen": fr["games_seen"], "blitz_games_seen": fr["blitz_games_seen"],
            "blitz_time_controls": sorted(blitz_tc),
            "distinct_players": len(frame),
            "pre_filter": "NONE. Rating is deliberately not filtered here: filtering the frame by "
                          "rating would bake the band gate into the denominator and make the "
                          "reported yield circular.",
            "sampled": len(sample),
        },
        "registry": {"bands": [list(b) for b in bands], "band_centres": centres,
                     "band_halfwidth": half,
                     "band_rule": "round(median blitz rating / 50) * 50 +/- %d" % half,
                     "median_window_that_lands_in_a_registered_band":
                         [[c - 25, c + 25] for c in centres],
                     "_note": "The registry holds %d band(s). A player is reachable only if their "
                              "OWN derived band is one of them, which is a %d-point window on the "
                              "median, not a %d-point one." % (len(bands), 50, 2 * half)},
        "gates": {
            "band": "derived band in registry",
            "volume_broad": ">= %d admissible games (POWER_PLAN.broad_minimum)" % broad_games,
            "volume_residual_judge": ">= %d admissible blitz games (judge stage only)" % resid_judge_games,
            "volume_residual": ">= %d admissible blitz games (judge AND search floor)" % resid_games,
            "volume_proxy": "lifetime blitz game count x %.4f. This is an UPPER BOUND: it assumes "
                            "the whole lifetime is enumerable and admissible at the observed rate. "
                            "Real windows are smaller, so every volume yield below is optimistic."
                            % adm_rate,
        },
        "counts": {
            "sampled": len(sample),
            "not_found": sum(1 for r in rows if r["status"] == "NOT_FOUND"),
            "closed_or_flagged": sum(1 for r in rows if r["status"] == "CLOSED_OR_FLAGGED"),
            "no_rated_blitz": sum(1 for r in rows if r["status"] == "NO_RATED_BLITZ"),
            "screenable": N,
            "band_registered": band,
            "volume_broad": n(lambda r: r["vol_broad"]),
            "volume_residual_judge": n(lambda r: r["vol_residual_judge"]),
            "volume_residual": n(lambda r: r["vol_residual"]),
            "band_and_broad": b_and_broad,
            "band_and_residual_judge": b_and_res_j,
            "band_and_residual": b_and_res,
        },
        "rates": {
            "band_registered": rate(band),
            "band_and_broad": rate(b_and_broad),
            "band_and_residual_judge": rate(b_and_res_j),
            "band_and_residual": rate(b_and_res),
        },
        "band_proxy_reliability": {
            "_what": "The screen can only see a CURRENT rating; the instrument reads the median "
                     "over the fetched window. This measures how often the two disagree about the "
                     "band, using each player's own June games as the second observation.",
            "current_vs_june_band_disagreement": disagree,
            "disagreement_rate": rate(disagree),
            "band_registered_under_both": both_band,
            "screen_hits": len(hits),
            "screen_hits_confirmed_by_june": len(hits_conf),
            "hit_confirmation_rate": (round(len(hits_conf) / len(hits), 4) if hits else None),
            "hits_with_5plus_june_games": len(hits_multi),
            "hits_with_5plus_june_games_confirmed": len(hits_multi_conf),
            "hit_confirmation_rate_5plus": (round(len(hits_multi_conf) / len(hits_multi), 4)
                                            if hits_multi else None),
            "_confirmation_caveat": "The June reading is itself a median over however many June "
                                    "games the player appears in; for most that is a handful, so "
                                    "part of the disagreement is sampling error in the SECOND "
                                    "reading, not proxy error in the first. The 5+ figure is the "
                                    "less noisy of the two and is still not the pipeline's own "
                                    "median over the fetched window.",
            "abs_drift_median": statistics.median(drifts) if drifts else None,
            "abs_drift_p90": (sorted(drifts)[int(0.9 * (len(drifts) - 1))] if drifts else None),
            "_direction_of_the_error": "June is three months stale, and the pipeline reads a "
                                       "RECENT window, so the current rating is nearer the "
                                       "pipeline's median than June is. The confirmation rate here "
                                       "is therefore pessimistic: it is a floor on how often a hit "
                                       "survives, not an estimate of it.",
            "_what_it_does_establish": "Median absolute drift (%s) is of the same order as the "
                                       "50-point bucket the band rule quantises to. A rating that "
                                       "moves by a bucket width between two readings cannot decide "
                                       "the band from either reading alone." % (
                                           statistics.median(drifts) if drifts else "n/a"),
            "consequence": "A screened hit is a CANDIDATE, never a confirmed eligible. The band is "
                           "authoritative only once the pipeline derives it from the fetched "
                           "corpus, so eligibility confirmation costs a fetch per candidate and "
                           "cannot be bought with metadata.",
        },
        "reachable_cohort_size": {
            "_what": "How large a cohort each question can actually support, per 1000 screened.",
            "per_1000_screened": {
                "broad_powered": round(1000 * rate(b_and_broad)),
                "residual_powered": round(1000 * rate(b_and_res)),
                "residual_powered_judge_only": round(1000 * rate(b_and_res_j)),
            },
            "screens_needed_for_100_broad": (math.ceil(100 / rate(b_and_broad))
                                             if b_and_broad else None),
            "screens_needed_for_100_residual": (math.ceil(100 / rate(b_and_res))
                                                if b_and_res else None),
        },
        "enumeration_ceiling_applied": {
            "_what": "The volume gate above assumes a player's whole blitz history is reachable. "
                     "Without a LICHESS_API_TOKEN it is not: the public HTML list caps at %d games."
                     % (plan["enumeration_ceiling"]["raw_ids_max"]),
            "max_admissible_games": cap_adm,
            "max_blitz_games": cap_blitz,
            "broad_minimum": broad_games,
            "residual_minimum": resid_games,
            "broad_reachable_without_token": cap_adm >= broad_games,
            "residual_reachable_without_token": cap_blitz >= resid_games,
            "consequence_without_token":
                "The ceiling binds BEFORE the player does. No matter how many players pass the "
                "screen, none of them can be brought above the minimum, so the cohort's yield "
                "would measure the enumeration cap and not the population.",
        },
    }
    json.dump(doc, open(a.out, "w"), indent=1)
    # The screened rows are the SAMPLING FRAME the cohort would be drawn from. Persisted so that
    # selection can be shown to be deterministic over a frame that existed before it.
    frame_out = os.path.splitext(a.out)[0].replace("FEASIBILITY_SCREEN", "SCREENED_FRAME") + ".json"
    json.dump({"_what": "Every player the metadata screen looked at, with the metadata it read. "
                        "Public profile fields only.",
               "screened_at": doc["screened_at"], "seed": a.seed,
               "instrument_hash": freeze["instrument_hash"],
               "frame_hash": corpuslib.sha256_json(rows),
               "rows": rows}, open(frame_out, "w"), indent=1)
    doc["screened_frame"] = {"path": os.path.basename(frame_out),
                             "frame_hash": corpuslib.sha256_json(rows)}
    json.dump(doc, open(a.out, "w"), indent=1)
    print(json.dumps({"out": a.out, "frame_players": len(frame), "sampled": len(sample),
                      "screenable": N, "counts": doc["counts"], "rates": doc["rates"],
                      "reachable": doc["reachable_cohort_size"]}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
