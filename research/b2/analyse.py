"""B2 -- does any representation of think time beat a raw second?

Written BEFORE the scored corpus existed, against TIME_REPRESENTATION_PREREG.md. It computes; it
does not decide. The outcome rule is section 7 of the preregistration and is applied verbatim at
the end.

WHAT IS BEING MEASURED, and it is a proxy. The product compares a CALIBRATION GAP inside a bucket
against outside it. An imported record carries no stated confidence -- import-diagnostic.ts says so
in its own words -- so the outcome here is ACCURACY. A representation that separates accuracy may
fail to separate a calibration gap, which is why section 7 forbids this study from moving a cut.
"""
import json, math, random, sys, collections

random.seed(20260830)  # Fixed so the nulls are reproducible; not tuned.
EV = "research/b2/decision_evidence.jsonl"
MANIFEST = "research/b2/corpus_manifest.json"
NULLS = 1000
MIN_BUCKET = 20  # Below this a bucket rate is not a rate; such buckets are merged into their neighbour.

rows = [json.loads(l) for l in open(EV) if l.strip()]
halves = json.load(open(MANIFEST))["halves"]

# Only decisions the product would read: not forced, not book, and carrying a think time.
elig = [r for r in rows if not r["forced"] and not r["book"] and r["secondsTaken"] is not None]
for r in elig:
    r["half"] = halves.get(r["gameId"], "?")
deriv = [r for r in elig if r["half"] == "derivation"]
held  = [r for r in elig if r["half"] == "heldout"]

print(f"decisions scored          {len(rows)}")
print(f"  eligible (not forced/book, has a think time)   {len(elig)}")
print(f"  derivation {len(deriv)}   held-out {len(held)}")
if not deriv or not held:
    sys.exit("one half is empty -- nothing to validate against")

def start_clock(rs):
    """Starting clock per game, inferred as the largest remaining seen in it."""
    s = {}
    for r in rs:
        if r["clockMsRemaining"] is not None:
            k = r["gameId"]
            s[k] = max(s.get(k, 0), r["clockMsRemaining"])
    return s

STARTS = start_clock(elig)

# ---- the five candidates, section 4 -------------------------------------------------------
LICHESS = [0.1, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 60]

def cut(edges):
    def f(r, _fit=None):
        s = r["secondsTaken"]
        for i, e in enumerate(edges):
            if s < e: return i
        return len(edges)
    return f

def fit_quantiles(train):
    xs = sorted(r["secondsTaken"] for r in train)
    return [xs[int(q * len(xs))] for q in (0.25, 0.50, 0.75)]

def pressure(r, _fit=None):
    c, st = r["clockMsRemaining"], STARTS.get(r["gameId"])
    if c is None or not st: return None
    pct = 100 * c / st
    for i, e in enumerate([25, 50, 75]):
        if pct < e: return i
    return 3

CANDIDATES = {
    "raw seconds (the shipped cut)": (cut([45, 120]), None),
    "log seconds":                   (cut([1, 2, 4, 8, 16]), None),
    "lichess encoding buckets":      (cut(LICHESS), None),
    "the player's own quartiles":    (None, fit_quantiles),
    "time pressure (clock %)":       (pressure, None),
}

def assign(rs, fn):
    out = []
    for r in rs:
        b = fn(r)
        if b is not None: out.append((b, r["accurate"]))
    return out

def merge_small(pairs):
    """A bucket under MIN_BUCKET is not a rate. Merge upward rather than report noise."""
    c = collections.Counter(b for b, _ in pairs)
    remap, keep = {}, sorted(c)
    for b in keep:
        remap[b] = b if c[b] >= MIN_BUCKET else (max((x for x in keep if x < b and c[x] >= MIN_BUCKET), default=None)
                                                 or min((x for x in keep if x > b and c[x] >= MIN_BUCKET), default=b))
    return [(remap[b], a) for b, a in pairs]

def spread(pairs):
    """Weighted SD of bucket accuracy, in percentage points. The measure, section 5."""
    if not pairs: return 0.0, {}
    by = collections.defaultdict(list)
    for b, a in pairs: by[b].append(a)
    n = len(pairs); pbar = sum(a for _, a in pairs) / n
    var = sum(len(v) * (sum(v)/len(v) - pbar) ** 2 for v in by.values()) / n
    rates = {b: (len(v), 100*sum(v)/len(v)) for b, v in sorted(by.items())}
    return 100 * math.sqrt(var), rates

def null_95(pairs):
    """Section 5's bar: the 95th percentile of random assignment preserving bucket SIZES."""
    labels = [b for b, _ in pairs]; outs = [a for _, a in pairs]
    vals = []
    for _ in range(NULLS):
        random.shuffle(outs)
        vals.append(spread(list(zip(labels, outs)))[0])
    vals.sort()
    return vals[int(0.95 * NULLS)]

print("\n" + "=" * 78)
print("HELD-OUT SEPARATION, against each representation's own random-boundary null")
print("=" * 78)
print(f"{'representation':32} {'buckets':>7} {'spread':>8} {'null95':>8}  verdict")
results = {}
for name, (fn, fitter) in CANDIDATES.items():
    f = fn if fn else cut(fit_quantiles(deriv))
    hp = merge_small(assign(held, f))
    if not hp:
        print(f"{name:32} {'-':>7} {'-':>8} {'-':>8}  not computable on the held-out half")
        continue
    sp, rates = spread(hp)
    n95 = null_95(hp)
    beat = sp > n95
    results[name] = {"spread": sp, "null95": n95, "beats_null": beat, "rates": rates,
                     "derivation_spread": spread(merge_small(assign(deriv, f)))[0]}
    print(f"{name:32} {len(rates):>7} {sp:>7.2f}pp {n95:>7.2f}pp  {'beats its null' if beat else 'does NOT beat its null'}")

print("\nbucket detail, held-out half (n, accuracy%):")
for name, r in results.items():
    print(f"  {name}")
    print("    " + "  ".join(f"[{b}] n={n} {a:.0f}%" for b, (n, a) in r["rates"].items()))

json.dump(results, open("research/b2/analysis.json", "w"), indent=1)
print("\nwrote research/b2/analysis.json")
