"""Build the B2 corpus by the rule in TIME_REPRESENTATION_PREREG.md §3, and by nothing else.

The rule, verbatim: the most recent N completed games that are rated, standard, blitz, and carry a
clock for the owner's moves; newest first; no further selection; split BY GAME into two halves
alternating by recency. Every exclusion is counted rather than silently dropped.

THIS FILE LIVED IN A SCRATCH DIRECTORY AND WAS NEVER REVIEWED, and that is how its worst defect
survived. `analyse.py` was committed, so review read it and found three real bugs in an afternoon.
The corpus builder was not committed, so nobody read it at all -- and it was deciding which games
existed. It is in the repository now for that reason.

WHAT IT GOT WRONG: it read RATED-NESS and BLITZ-NESS out of the free-text `Event` header.

    if "rated" not in event: drop("unrated")

A Lichess arena game's Event is `Hourly SuperBlitz Arena`. The substring "rated" does not appear in
it, so every arena game the account had played was dropped and counted as "unrated" -- 42 rated
blitz games, a third of the corpus. They are rated: all 42 carry `WhiteRatingDiff`, which Lichess
emits only for rated games. The study ran on 75 games when 117 qualified, and the results document
went as far as calling the exclusion a success ("the rule caught them and counted them"). It had
caught rated games and mislabelled them.

So the tests below are STRUCTURAL and never read prose:

    rated   `WhiteRatingDiff` or `BlackRatingDiff` is present. Lichess writes a rating delta only
            for a rated game, so its presence is the fact and the Event line is decoration.
    blitz   the TIME CONTROL, by Lichess's own definition -- estimated duration is
            `base + 40 * increment` seconds, and blitz is 179 < estimate <= 479. `180+0` is 180,
            `300+0` is 300, `300+3` is 420. All blitz, none of them by virtue of their name.
    standard  the `Variant` header.
    clock   `%clk` annotations actually present in the movetext.

The Event string is still parsed -- but only to REPORT a disagreement, never to decide one.
"""
import hashlib, json, os, re, sys

SRC = sys.argv[1]
OWNER = sys.argv[2] if len(sys.argv) > 2 else "erez281"
WANTED = int(sys.argv[3]) if len(sys.argv) > 3 else 10**6

raw = open(SRC, encoding="utf-8", errors="replace").read()
chunks = [c for c in re.split(r"\n\n(?=\[Event )", raw.strip()) if c.strip()]


def tag(text, name):
    m = re.search(rf'\[{name} "([^"]*)"\]', text)
    return m.group(1) if m else None


def parse_tc(tc):
    """Base and increment in seconds, or None if the header is not `base+inc`."""
    m = re.match(r"(\d+)\+(\d+)$", tc or "")
    return (int(m.group(1)), int(m.group(2))) if m else None


kept, reasons, disagreements = [], {}, []


def drop(why):
    reasons[why] = reasons.get(why, 0) + 1


for c in chunks:
    white, black = tag(c, "White") or "", tag(c, "Black") or ""
    if OWNER.lower() not in (white.lower(), black.lower()):
        drop("not the owner's game"); continue

    variant = tag(c, "Variant") or ""
    event = (tag(c, "Event") or "").lower()
    tc = tag(c, "TimeControl") or ""
    parsed = parse_tc(tc)

    rated = tag(c, "WhiteRatingDiff") is not None or tag(c, "BlackRatingDiff") is not None
    blitz = parsed is not None and 179 < parsed[0] + 40 * parsed[1] <= 479

    """The Event string's opinion, kept as a REPORT and never as the rule.

    This is the check that would have caught the original defect on the day it was written: when
    the header's prose and the game's own structure disagree about whether a game is rated, that is
    worth printing, because one of them is about to decide the corpus.
    """
    if rated != ("rated" in event or "arena" in event):
        disagreements.append((tag(c, "GameId"), tag(c, "Event"), rated))

    if not rated:
        drop("not rated (no RatingDiff)"); continue
    if variant and variant.lower() != "standard":
        drop(f"variant: {variant}"); continue
    if not blitz:
        drop(f"not blitz (time control {tc or 'missing'})"); continue

    body = c.split("]\n\n", 1)[-1] if "]\n\n" in c else c
    # A think time needs two consecutive readings of the OWNER's own clock, so four in the game.
    if len(re.findall(r"%clk", body)) < 4:
        drop("too few clock readings to derive a think time"); continue

    kept.append({
        "id": tag(c, "GameId") or (tag(c, "Site") or "").rsplit("/", 1)[-1],
        "white": white, "black": black, "pgn": c.strip(), "speed": "blitz",
        "_date": f'{tag(c,"UTCDate")} {tag(c,"UTCTime")}', "_tc": tc,
        "_base_ms": parsed[0] * 1000,
        "_colour": "w" if white.lower() == OWNER.lower() else "b",
        "_event": tag(c, "Event"),
    })

print(f"games in file            {len(chunks)}")
for why, n in sorted(reasons.items(), key=lambda kv: -kv[1]):
    print(f"  excluded, {why:42} {n}")
print(f"qualifying               {len(kept)}")
if disagreements:
    print(f"\n*** {len(disagreements)} games where the Event header disagrees with the game's own "
          f"structure about rated-ness. The STRUCTURE decides. ***")
    for gid, ev, rated in disagreements[:3]:
        print(f"    {gid}  Event={ev!r}  RatingDiff present={rated}")
    if len(disagreements) > 3:
        print(f"    ... and {len(disagreements)-3} more")

kept.sort(key=lambda g: g["_date"], reverse=True)  # Newest first; sorted rather than trusted.
short = len(kept) < WANTED
corpus = kept[:WANTED]
print(f"\ntaken (newest first)     {len(corpus)}"
      + (f"   *** SHORTFALL: {WANTED - len(corpus)} short of {WANTED} ***" if short and WANTED < 10**6 else ""))
print(f"date range               {corpus[-1]['_date']}  ..  {corpus[0]['_date']}")

tcs = {}
for g in corpus: tcs[g["_tc"]] = tcs.get(g["_tc"], 0) + 1
print("time controls            " + ", ".join(f"{k}: {v}" for k, v in sorted(tcs.items(), key=lambda kv: -kv[1])))
evs = {}
for g in corpus: evs[g["_event"]] = evs.get(g["_event"], 0) + 1
print("events                   " + ", ".join(f"{k}: {v}" for k, v in sorted(evs.items(), key=lambda kv: -kv[1])))
cols = {}
for g in corpus: cols[g["_colour"]] = cols.get(g["_colour"], 0) + 1
print(f"owner's colour           white {cols.get('w',0)}, black {cols.get('b',0)}")

for i, g in enumerate(corpus):
    g["_half"] = "derivation" if i % 2 == 0 else "heldout"
    g["_rank"] = i
d = sum(1 for g in corpus if g["_half"] == "derivation")
print(f"split                    derivation {d}, held-out {len(corpus)-d}")

games = [{k: v for k, v in g.items() if not k.startswith("_")} for g in corpus]
out = {
    "players": [{"playerId": hashlib.sha256(OWNER.encode()).hexdigest()[:16],
                 "username": OWNER, "games": games}],
    "provenance": {
        "source": "lichess.org export, supplied by the account owner",
        "account": OWNER,
        "rule": "TIME_REPRESENTATION_PREREG.md section 3, applied structurally: rated from "
                "RatingDiff, blitz from the time control, never from the Event string",
        "gamesInFile": len(chunks), "qualifying": len(kept), "taken": len(corpus),
        "shortfall": max(0, WANTED - len(corpus)) if WANTED < 10**6 else 0,
        "exclusions": reasons,
        "eventHeaderDisagreements": len(disagreements),
        "timeControls": tcs, "events": evs,
        "dateRange": [corpus[-1]["_date"], corpus[0]["_date"]],
        "halves": {g["id"]: g["_half"] for g in corpus},
        "recencyRank": {g["id"]: g["_rank"] for g in corpus},
        "baseClockMs": {g["id"]: g["_base_ms"] for g in corpus},
        "baseClockSource": "the PGN TimeControl header, base seconds, not inferred from any clock reading",
        "preregisteredN": 40,
        "amendedN": len(corpus),
    },
}
os.makedirs("research/b2", exist_ok=True)
json.dump(out, open("research/b2/corpus.json", "w"), ensure_ascii=False)
json.dump(out["provenance"], open("research/b2/corpus_manifest.json", "w"), indent=1, ensure_ascii=False)
print("\nwrote research/b2/corpus.json")
