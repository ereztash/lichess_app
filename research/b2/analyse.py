"""B2 -- does any representation of think time beat a raw second?

Written BEFORE the scored corpus existed, against TIME_REPRESENTATION_PREREG.md, and completed
while the scoring run was still mid-flight -- so every line below was fixed before any number it
produces existed. It computes; it does not decide. Section 7 is the outcome rule and this script
applies it verbatim and PRINTS THE VERDICT, rather than printing spreads and leaving a human to
choose one afterwards.

WHAT IS BEING MEASURED, and it is a proxy. The product compares a CALIBRATION GAP inside a bucket
against outside it. An imported record carries no stated confidence -- import-diagnostic.ts says so
in its own words -- so the outcome here is ACCURACY. A representation that separates accuracy may
fail to separate a calibration gap, which is why section 7 forbids this study from moving a cut.

THE CONTROL THAT MATTERS IS THE POSITIVE ONE. Section 7's most likely verdict is STOP-B2-A, "no
representation was better", and a script that cannot see a signal produces exactly that verdict on
every corpus in the world. So `--control plant-signal` writes a known time-shaped signal into the
outcome and the study MUST come back with OBSERVATION naming the planted representation. If it does
not, no negative result from this file means anything. The three destructive controls are the other
half: shuffle the outcome, shuffle the clock, or flatten the outcome, and OBSERVATION must vanish.

Run:  python3 research/b2/analyse.py [--control shuffle-outcome|shuffle-time|constant-outcome|plant-signal]
"""
import json, math, random, sys, collections

SEED = 20260830  # Fixed so the nulls are reproducible; not tuned.
EV = "research/b2/decision_evidence.jsonl"
MANIFEST = "research/b2/corpus_manifest.json"
OUT = "research/b2/analysis.json"
NULLS = 1000
PERMUTATIONS = 200
MIN_BUCKET = 20  # Below this a bucket rate is not a rate; such buckets are merged into their neighbour.
PREREGISTERED_N = 40  # Section 3 before Amendment 1: the newest 40 games, by recency rank.
BASELINE = "raw seconds (the shipped cut)"

CONTROL = None
if "--control" in sys.argv:
    CONTROL = sys.argv[sys.argv.index("--control") + 1]

rows = [json.loads(l) for l in open(EV) if l.strip()]
manifest = json.load(open(MANIFEST))
halves, ranks = manifest["halves"], manifest["recencyRank"]

# Only decisions the product would read: not forced, not book, and carrying a think time.
elig = [r for r in rows if not r["forced"] and not r["book"] and r["secondsTaken"] is not None]
for r in elig:
    r["half"] = halves.get(r["gameId"], "?")
    r["rank"] = ranks.get(r["gameId"], 10**6)

# ---- the five candidates, section 4. Frozen: section 8 forbids adding a sixth. ----------------
LICHESS = [0.1, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 60]

def start_clock(rs):
    """Starting clock per game, inferred as the largest remaining seen in it.

    An inference, not a field: the PGN's first clock comment is already one move in. It is the same
    inference for every candidate, so it cannot favour one.
    """
    s = {}
    for r in rs:
        if r["clockMsRemaining"] is not None:
            k = r["gameId"]
            s[k] = max(s.get(k, 0), r["clockMsRemaining"])
    return s

STARTS = start_clock(elig)

def cut(edges):
    def f(r):
        s = r["secondsTaken"]
        for i, e in enumerate(edges):
            if s < e: return i
        return len(edges)
    return f

def fit_quantiles(train):
    xs = sorted(r["secondsTaken"] for r in train)
    return [xs[int(q * len(xs))] for q in (0.25, 0.50, 0.75)]

def pressure(r):
    c, st = r["clockMsRemaining"], STARTS.get(r["gameId"])
    if c is None or not st: return None
    pct = 100 * c / st
    for i, e in enumerate([25, 50, 75]):
        if pct < e: return i
    return 3

# `None` in the first slot means "fit me on the derivation half"; section 5 forbids fitting on the
# half the result is read from.
CANDIDATES = {
    BASELINE:                     cut([45, 120]),
    "log seconds":                cut([1, 2, 4, 8, 16]),
    "lichess encoding buckets":   cut(LICHESS),
    "the player's own quartiles": None,
    "time pressure (clock %)":    pressure,
}

# ---- the measure, section 5 --------------------------------------------------------------------
def assign(rs, fn):
    out = []
    for r in rs:
        b = fn(r)
        if b is not None: out.append((b, r["accurate"]))
    return out

def merge_small(pairs):
    """A bucket under MIN_BUCKET is not a rate. Merge into the nearest large neighbour, below first.

    The `or` chain this replaces had a defect found before any result existed and worth naming:
    `max(...) or min(...)` treats bucket **0** as absent, because 0 is falsy in Python. Bucket 0 is
    the fastest bucket in every candidate here and, on a distribution whose median is two seconds,
    the largest -- so the bug misrouted small buckets away from the one neighbour they almost always
    belonged to. Verified in isolation: with 50 decisions in bucket 0, three in bucket 1 and 50 in
    bucket 2, the small bucket merged UPWARD into 2.
    """
    c = collections.Counter(b for b, _ in pairs)
    keep = sorted(c)
    big = [x for x in keep if c[x] >= MIN_BUCKET]
    remap = {}
    for b in keep:
        if c[b] >= MIN_BUCKET:
            remap[b] = b
            continue
        below = [x for x in big if x < b]
        above = [x for x in big if x > b]
        remap[b] = below[-1] if below else (above[0] if above else b)
    return [(remap[b], a) for b, a in pairs]

def spread(pairs):
    """Weighted SD of bucket accuracy, in percentage points. The measure, section 5."""
    if not pairs: return 0.0, {}
    by = collections.defaultdict(list)
    for b, a in pairs: by[b].append(a)
    n = len(pairs); pbar = sum(a for _, a in pairs) / n
    var = sum(len(v) * (sum(v) / len(v) - pbar) ** 2 for v in by.values()) / n
    rates = {b: (len(v), 100 * sum(v) / len(v)) for b, v in sorted(by.items())}
    return 100 * math.sqrt(var), rates

def null_95(pairs, rng):
    """Section 5's bar: the 95th percentile of random assignment preserving bucket SIZES."""
    labels = [b for b, _ in pairs]; outs = [a for _, a in pairs]
    vals = []
    for _ in range(NULLS):
        rng.shuffle(outs)
        vals.append(spread(list(zip(labels, outs)))[0])
    vals.sort()
    return vals[int(0.95 * NULLS)]

# ---- section 7, applied verbatim ---------------------------------------------------------------
def verdict(res):
    """Section 7's table, in order, returning the stop code and the sentence that justifies it."""
    if BASELINE not in res:
        return "STOP-B2-A", "the baseline was not computable, so nothing beat it"
    raw = res[BASELINE]
    others = {k: v for k, v in res.items() if k != BASELINE}
    if not others:
        return "STOP-B2-A", "no candidate other than raw seconds was computable"
    best = max(others, key=lambda k: others[k]["heldout_spread"])
    b = others[best]
    if b["heldout_spread"] <= raw["heldout_spread"]:
        return "STOP-B2-A", (f"no candidate beat raw seconds out of sample: the best was "
                             f"{best} at {b['heldout_spread']:.2f}pp against raw seconds' "
                             f"{raw['heldout_spread']:.2f}pp")
    if b["heldout_spread"] <= b["heldout_null95"]:
        return "STOP-B2-B", (f"{best} beat raw seconds out of sample ({b['heldout_spread']:.2f}pp "
                             f"vs {raw['heldout_spread']:.2f}pp) but not its own random-boundary "
                             f"null ({b['heldout_null95']:.2f}pp)")
    win_h = max(res, key=lambda k: res[k]["heldout_spread"])
    win_d = max(res, key=lambda k: res[k]["derivation_spread"])
    if win_h != win_d:
        return "STOP-B2-C", (f"the winner differs between the halves: {win_d} on the derivation "
                             f"half, {win_h} on the held-out half")
    if not (b["derivation_spread"] > raw["derivation_spread"]
            and b["derivation_spread"] > b["derivation_null95"]):
        return "STOP-B2-C", (f"{best} beats raw seconds and its null out of sample but not on the "
                             f"derivation half; section 7's fourth row requires both halves")
    return "OBSERVATION", (f"{best} beats raw seconds and its own random-boundary null on both "
                           f"halves ({b['heldout_spread']:.2f}pp vs raw {raw['heldout_spread']:.2f}pp, "
                           f"null {b['heldout_null95']:.2f}pp)")

# ---- section 6's controls ----------------------------------------------------------------------
def permutation_control(held, fns, bars, rng, stratified):
    """Shuffle the outcome, keeping every think time where it is. Section 6's first control.

    UNSTRATIFIED is the clean one: it must land near 5% for every candidate, because that is what a
    95th-percentile bar means. STRATIFIED shuffles within phase x standing, so anything that
    survives it is separation the bucketing shares with position type -- section 2.2's confound,
    measured rather than removed.

    THE BAR IS COMPUTED ONCE AND REUSED, and that is exact rather than a shortcut. Section 5's null
    is a distribution over random assignments preserving bucket SIZES, given the outcome multiset.
    A permutation changes neither: the labels are untouched, `merge_small` reads only bucket sizes,
    and permuting within strata preserves every stratum's count and so the total. The estimand is
    identical, so recomputing a thousand shuffles inside each of two hundred permutations would be
    a thousandfold cost for the same number -- and the first draft did exactly that, and could not
    finish.
    """
    strata = collections.defaultdict(list)
    for i, r in enumerate(held):
        strata[(r["phase"], r["standing"]) if stratified else "all"].append(i)
    outs = [r["accurate"] for r in held]
    survived = {name: 0 for name in fns if name in bars}
    for _ in range(PERMUTATIONS):
        shuffled = list(outs)
        for idx in strata.values():
            vals = [outs[i] for i in idx]
            rng.shuffle(vals)
            for i, v in zip(idx, vals): shuffled[i] = v
        for name in survived:
            # `assign` drops rows a candidate cannot place (time pressure with no clock), so the
            # permuted outcome is indexed through the same filter rather than zipped blindly.
            placed = [(fns[name](r), shuffled[i]) for i, r in enumerate(held) if fns[name](r) is not None]
            pairs = merge_small(placed)
            if not pairs: continue
            if spread(pairs)[0] > bars[name]: survived[name] += 1
    return {k: v / PERMUTATIONS for k, v in survived.items()}


def within_cell(held, fns, rng, winner):
    """Section 6's third control: repeat the comparison holding phase and standing fixed."""
    cells = collections.defaultdict(list)
    for r in held: cells[(r["phase"], r["standing"])].append(r)
    out = {}
    for cell, rs in sorted(cells.items()):
        if len(rs) < 2 * MIN_BUCKET: continue
        pairs = merge_small(assign(rs, fns[winner]))
        if len(set(b for b, _ in pairs)) < 2: continue
        sp, rates = spread(pairs)
        out["/".join(cell)] = {"n": len(rs), "buckets": len(rates), "spread": sp,
                               "null95": null_95(pairs, rng), "rates": rates}
    return out

# ---- one study over one corpus -----------------------------------------------------------------
def study(subset, label):
    rng = random.Random(SEED)
    deriv = [r for r in subset if r["half"] == "derivation"]
    held = [r for r in subset if r["half"] == "heldout"]
    print(f"\n{'=' * 86}\n{label}\n{'=' * 86}")
    print(f"games {len({r['gameId'] for r in subset}):>4}   eligible decisions {len(subset):>5}"
          f"   derivation {len(deriv):>5}   held-out {len(held):>5}")
    if not deriv or not held:
        sys.exit("one half is empty -- nothing to validate against")

    fns = {n: (f if f else cut(fit_quantiles(deriv))) for n, f in CANDIDATES.items()}
    res, bars = {}, {}
    print(f"\n{'representation':30}{'buckets':>8}{'held-out':>11}{'its null':>11}{'derivation':>12}  section 5")
    for name, fn in fns.items():
        hp, dp = merge_small(assign(held, fn)), merge_small(assign(deriv, fn))
        if not hp or not dp:
            print(f"{name:30}{'not computable on one of the halves':>50}")
            continue
        hs, rates = spread(hp)
        ds, _ = spread(dp)
        hn, dn = null_95(hp, rng), null_95(dp, rng)
        bars[name] = hn
        res[name] = {"heldout_spread": hs, "heldout_null95": hn, "derivation_spread": ds,
                     "derivation_null95": dn, "beats_null": hs > hn,
                     "rates": {str(k): v for k, v in rates.items()}}
        print(f"{name:30}{len(rates):>8}{hs:>10.2f}pp{hn:>10.2f}pp{ds:>11.2f}pp  "
              f"{'beats its null' if hs > hn else 'does NOT beat its null'}")

    print("\nbucket detail, held-out half (n, accuracy%):")
    for name, r in res.items():
        cells = "  ".join(f"[{b}] n={n} {a:.0f}%" for b, (n, a) in r["rates"].items())
        print(f"  {name}\n    {cells}")

    code, why = verdict(res)
    print(f"\nSECTION 7 VERDICT: {code}\n  {why}")

    controls = {
        "unstratified_permutation_survival": permutation_control(held, fns, bars, rng, False),
        "stratified_permutation_survival": permutation_control(held, fns, bars, rng, True),
    }
    print("\nsection 6, outcome permutation -- share of permutations still beating the null")
    print(f"  {'representation':30}{'plain':>9}{'within phase x standing':>26}")
    for name in res:
        print(f"  {name:30}{controls['unstratified_permutation_survival'].get(name, 0):>8.1%}"
              f"{controls['stratified_permutation_survival'].get(name, 0):>25.1%}")
    print("  a plain rate far from 5% means the bar itself is wrong; a stratified rate far above the")
    print("  plain one is separation shared with position type -- section 2.2's confound, not a bug.")

    winner = max(res, key=lambda k: res[k]["heldout_spread"]) if res else None
    if winner:
        cells = within_cell(held, fns, rng, winner)
        controls["within_phase_standing"] = cells
        print(f"\nsection 6, the difficulty confound -- '{winner}' inside one phase and standing at a time")
        if not cells:
            print("  no cell held enough held-out decisions to compare. UNMEASURED, not ruled out.")
        for cell, c in cells.items():
            print(f"  {cell:28} n={c['n']:>4}  {c['spread']:>6.2f}pp  null {c['null95']:>6.2f}pp  "
                  f"{'survives' if c['spread'] > c['null95'] else 'collapses'}")
    return {"label": label, "games": len({r["gameId"] for r in subset}), "decisions": len(subset),
            "derivation": len(deriv), "heldout": len(held), "candidates": res,
            "verdict": code, "verdict_reason": why, "controls": controls, "winner": winner}

# ---- controls that rewrite the record, so a negative result can be told from a blind script -----
if CONTROL:
    rng = random.Random(99)
    if CONTROL == "shuffle-outcome":
        outs = [r["accurate"] for r in elig]; rng.shuffle(outs)
        for r, o in zip(elig, outs): r["accurate"] = o
    elif CONTROL == "shuffle-time":
        ts = [(r["secondsTaken"], r["clockMsRemaining"]) for r in elig]; rng.shuffle(ts)
        for r, t in zip(elig, ts): r["secondsTaken"], r["clockMsRemaining"] = t
    elif CONTROL == "constant-outcome":
        for r in elig: r["accurate"] = True
    elif CONTROL == "plant-signal":
        # A signal shaped like ONE named candidate, so the study must name that candidate back.
        f = cut(LICHESS)
        for r in elig: r["accurate"] = rng.random() < (0.9 if f(r) <= 6 else 0.35)
    else:
        sys.exit(f"unknown control {CONTROL}")
    print(f"*** CONTROL: {CONTROL} -- the record below is FALSIFIED on purpose ***")

print(f"decisions scored          {len(rows)}")
print(f"  eligible (not forced/book, has a think time)   {len(elig)}")

prereg = [r for r in elig if r["rank"] < PREREGISTERED_N]
out = {"control": CONTROL, "seed": SEED, "nulls": NULLS, "permutations": PERMUTATIONS,
       "minBucket": MIN_BUCKET, "decisionsScored": len(rows), "eligible": len(elig)}
out["preregistered"] = study(prereg, f"PREREGISTERED CORPUS -- the newest {PREREGISTERED_N} games "
                                    f"(section 3). This is the result.")
out["amended"] = study(elig, f"AMENDED CORPUS -- all {len(ranks)} qualifying games (Amendment 1). "
                             f"Reported beside the preregistered result, never instead of it.")

print(f"\n{'=' * 86}\nBOTH CORPORA\n{'=' * 86}")
print(f"  preregistered ({PREREGISTERED_N} games) : {out['preregistered']['verdict']}")
print(f"  amended ({len(ranks)} games)        : {out['amended']['verdict']}")
if out["preregistered"]["verdict"] != out["amended"]["verdict"]:
    print("  THE TWO DISAGREE. Amendment 1: the preregistered verdict stands and the disagreement")
    print("  is reported as instability. The amended corpus is older, stronger and more 3+0, so the")
    print("  difference may be composition rather than sample size.")
out["agree"] = out["preregistered"]["verdict"] == out["amended"]["verdict"]

if not CONTROL:
    json.dump(out, open(OUT, "w"), indent=1)
    print(f"\nwrote {OUT}")
else:
    print(f"\ncontrol run: {OUT} NOT written")
