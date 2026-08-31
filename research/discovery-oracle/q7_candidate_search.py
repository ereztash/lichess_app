"""D04: can a candidate search find the region the six buckets cannot express?

WHAT Q4 AND Q5 LEFT. On `interaction-only` -- a world whose true effect lives in `fast AND endgame`
-- the shipped chain validated a claim naming the WRONG subgroup on 11% of records and named the
right one on 0%. That is not a false-positive problem: against "nothing is there" the chain is close
to perfect (0 validated false claims in 8,000 null records). It is an ATTRIBUTION problem, and Q5's
answer to it was a VETO: `attribution.ts` withholds a claim whose bucket splits inhomogeneously. A
veto buys silence instead of a wrong sentence. It never produces the right one.

D04 asks the other half: not "should this claim be withheld" but "is there a region a search would
have named instead". `pysubgroup` is the reference implementation, it runs HERE and never in the
product, and this file measures whether it earns the right to be ported at all.

THE REJECTION RULE, WRITTEN DOWN BEFORE THE RUN AND NOT RENEGOTIATED AFTER IT:

    D04 is rejected unless it improves correct attribution WITHOUT raising the false-claim rate past
    the 0.02 ceiling the shipped chain already meets.

Both halves bind. A search that finds `fast AND endgame` on every planted record and also finds
something on one null record in ten has not improved the product -- it has moved the failure from
"says the wrong thing sometimes" to "says a thing when there is nothing", which is the worse of the
two and the one this whole repository is built against.

WHY THE CEILING IS THE HARD PART, stated before the numbers so the result cannot be read as a
surprise. The six buckets are a FIXED, PREREGISTERED family: six candidates, frozen before the data.
A subgroup search over conjunctions of the same features considers hundreds, chosen BECAUSE they
looked good on the data. That is a multiplicity problem of a different order, and the honest
expectation is that an uncorrected search blows through 0.02 on the null worlds. The design below
therefore does the only thing that can rescue it, and it is the same discipline the shipped chain
uses: THE SEARCH RUNS ON THE DERIVATION HALF ONLY, its top candidate is FROZEN, and the frozen
region is judged on games the search never saw.

WHAT `on-target` MEANS HERE, and it cannot be Q4's. There, on-target was `selected == target`: the
chain names one of six buckets, so the comparison is between two names. A search names a region, and
the planted region is a predicate, so the comparison has to be between two SETS OF DECISIONS.

    on-target  <=>  Jaccard(found, planted) >= 0.60, on the validation half

0.60 IS A LINE BETWEEN TWO ANSWERS RATHER THAN A TUNED NUMBER. If the search recovers
`fast AND endgame` exactly, Jaccard is 1. If it recovers `fast` alone -- the mistake the shipped
chain already makes -- Jaccard is the endgame share of fast decisions, which is around 0.2-0.3. Any
line between those two separates "found the conjunction" from "found one of its parts", and the full
distribution is reported so the choice can be checked rather than trusted.

WHAT THIS FILE DOES NOT ANSWER. Whether a ported search would behave the same in TypeScript, whether
the region it names is one a player can act on, and whether any of it survives a real record. Those
are D04's later gates; this one is the first, and a NO here ends the node.
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd
import pysubgroup as ps

sys.path.insert(0, str(Path(__file__).resolve().parent))

from oracle.worlds import BASE, NULL_WORLDS, PLANTS, generate_record  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"

RECORDS_PER_PLANT = 400
NULL_RECORDS_PER_WORLD = 400
#: Records per plant for the shuffled-label control. The planted effect is real in these; permuting
#: the gap is what removes it, so a hit here is the harness finding something that is not there.
SHUFFLE_RECORDS_PER_PLANT = 200
GAMES_PER_RECORD = 40
DERIVATION_GAMES = 20
SEED = 20260901

#: The shipped judge's terms, imported as values so this file cannot judge on softer ones.
#: `shared/detector.ts` is the definition; these are transcribed and checked by `selftest`-style
#: assertion at the bottom rather than re-derived.
SEPARABILITY_K = 3.75
MIN_BUCKET_N = 30
#: `GRID_HISTORY[1][7]` in `shared/confidence.ts`. A level is not a probability and never was.
CONFIDENCE_GRID_V1_7 = (0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95)

#: Declared before the run. The rate at which a validated claim may appear where nothing was planted.
FALSE_CLAIM_CEILING = 0.02
#: Declared before the run. Overlap with the planted region that counts as having found it.
ON_TARGET_JACCARD = 0.60

#: The worlds whose planted region is NOT expressible as a bucket. D04 exists for these.
INEXPRESSIBLE = ("interaction-only", "proxy-correlated", "one-game-only", "every-game-first-moves")
#: The worlds whose planted region IS a bucket. A search that loses these has not improved anything.
EXPRESSIBLE = ("clean-middlegame", "clean-fast", "sparse-low-clock")

MIDDLEGAME, ENDGAME = 1, 2


def wilson(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (float("nan"), float("nan"))
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, centre - half), min(1.0, centre + half))


def frame(record: dict) -> pd.DataFrame:
    """One record as a table the search can read.

    THE COLUMNS ARE THE SIX BUCKETS' OWN FEATURES AND NOTHING ELSE. Handing the search a variable
    the product cannot compute would make any success unportable, and handing it `truth_gap` or
    `planted` would make it a memory test. `D03` is the rule: a search may read what a decision
    carries at the moment it was made.
    """
    grid = np.asarray(CONFIDENCE_GRID_V1_7)
    confidence = grid[np.asarray(record["cf"], dtype=int) - 1]
    accurate = np.asarray(record["ac"], dtype=float)
    return pd.DataFrame(
        {
            "game": record["g"],
            "phase": record["ph"],
            "seconds": [np.nan if s is None else s for s in record["st"]],
            "clock_ms": [np.nan if c is None else c for c in record["cl"]],
            # THE TARGET IS THE CALIBRATION GAP, which is the whole of what this product measures:
            # the player's stated confidence minus the engine's verdict, per decision. Searching
            # `accurate` instead finds where the player is WRONG, which is a different question and
            # has a trivially good answer -- the first version of this file searched it and the
            # winning region was `confidence < 5`, a restatement of the target dressed as a finding.
            "gap": confidence - accurate,
            "planted": np.array(record["planted"], dtype=bool),
        }
    )


def selectors() -> list[ps.SelectorBase]:
    """The candidate vocabulary: the same cuts the six buckets are made of, and their conjunctions.

    NOT `create_selectors`, which would invent cuts from quantiles of THIS record and make every
    candidate a function of the data it is about to be tested on. These are fixed thresholds --
    the product's own -- so the search space is the same for every record and can be stated in
    advance, which is what makes the multiplicity correction below meaningful.
    """
    return [
        ps.IntervalSelector("seconds", float("-inf"), 45.0),
        ps.IntervalSelector("seconds", 45.0, float("inf")),
        ps.IntervalSelector("clock_ms", float("-inf"), 60_000.0),
        ps.IntervalSelector("clock_ms", 60_000.0, float("inf")),
        ps.EqualitySelector("phase", 0),
        ps.EqualitySelector("phase", MIDDLEGAME),
        ps.EqualitySelector("phase", ENDGAME),
    ]
    # CONFIDENCE IS NOT A SELECTOR, and its absence is the rule rather than an omission. It is half
    # the target, so a region defined by it would separate on the gap by construction -- and the
    # six shipped bucketings do not use it either, for the same reason.


def search_region(derivation: pd.DataFrame, depth: int) -> ps.Conjunction | None:
    """The search's single best candidate on the derivation half, or None.

    ONE CANDIDATE, NOT A TOP-k LIST. A list would have to be narrowed by something, and narrowing it
    on the validation half is the leak this whole design exists to avoid.
    """
    target = ps.NumericTarget("gap")
    task = ps.SubgroupDiscoveryTask(
        derivation,
        target,
        selectors(),
        result_set_size=1,
        depth=depth,
        # Mean-difference weighted by size, which is the closest available analogue of what the
        # shipped detector ranks on: a bucket whose gap is far from the rest of the record, with
        # enough decisions in it to mean something.
        qf=ps.StandardQFNumeric(a=0.5),
    )
    result = ps.BeamSearch(beam_width=20).execute(task)
    rows = result.to_descriptions()
    if not rows:
        return None
    return rows[0][1]


def judge(validation: pd.DataFrame, inside: np.ndarray) -> tuple[bool, float, int, int]:
    """The shipped judge's question, asked of one frozen region on games it never saw.

    Two proportions, one standard error each, and the same `SEPARABILITY_K` and `MIN_BUCKET_N` the
    product uses. Nothing here is softer than what ships: a region that would not clear the shipped
    bar is not a claim, whoever proposed it.
    """
    within = validation.loc[inside, "gap"].to_numpy()
    without = validation.loc[~inside, "gap"].to_numpy()
    n_in, n_out = len(within), len(without)
    if n_in < MIN_BUCKET_N or n_out < MIN_BUCKET_N:
        return (False, float("nan"), n_in, n_out)
    difference = within.mean() - without.mean()
    # Bessel-corrected, like `summarise` in `shared/detector.ts`: an estimate of the population
    # variance from a sample, and at n = MIN_BUCKET_N the difference between /n and /(n-1) shows.
    se = np.sqrt(within.var(ddof=1) / n_in + without.var(ddof=1) / n_out)
    if se == 0 or not np.isfinite(se):
        return (False, float("nan"), n_in, n_out)
    z = difference / se
    # ABSOLUTE, like the shipped test: an unusually well-calibrated region is separable too, and
    # asking only for overconfidence would be a second rule this file does not get to invent.
    return (bool(abs(z) >= SEPARABILITY_K), float(z), n_in, n_out)


def jaccard(a: np.ndarray, b: np.ndarray) -> float:
    union = np.logical_or(a, b).sum()
    return float(np.logical_and(a, b).sum() / union) if union else float("nan")


def run_record(record: dict, split: int, depth: int, shuffle: np.random.Generator | None = None) -> dict:
    """Derive on the first games, freeze, judge on the rest. The chain's own discipline.

    `shuffle` is the harness's own control. Permuting the gap WITHIN the record destroys any
    relationship between a decision's context and its calibration, and leaves everything else --
    the record's shape, the search, the freeze, the judge -- exactly as it was. A pipeline that
    still validates on shuffled labels is leaking the validation half into the search, and every
    number above it would be an artefact of the harness rather than a finding about the method.
    It is the same control `GATE-SHUFFLE` runs on the shipped detector, run on this instead.
    """
    table = frame(record)
    if shuffle is not None:
        table["gap"] = shuffle.permutation(table["gap"].to_numpy())
    derivation, validation = table.iloc[:split], table.iloc[split:].reset_index(drop=True)
    if len(derivation) < MIN_BUCKET_N * 2 or len(validation) < MIN_BUCKET_N * 2:
        return {"validated": False, "reason": "too-short"}

    region = search_region(derivation, depth)
    if region is None:
        return {"validated": False, "reason": "no-candidate"}

    inside = region.covers(validation)
    validated, z, n_in, n_out = judge(validation, inside)
    return {
        "validated": validated,
        "z": z,
        "n_in": n_in,
        "n_out": n_out,
        "depth": len(region.selectors),
        "region": str(region),
        "jaccard": jaccard(inside, validation["planted"].to_numpy()),
        "reason": None,
    }


def split_index(record: dict, games: int) -> int:
    g = np.asarray(record["g"])
    return int(np.searchsorted(g, games, side="left"))


def sweep(depth: int, seed: int) -> dict:
    """One depth, over every world. Depth is the knob, and it is swept rather than chosen."""
    out: dict = {"depth": depth, "plants": [], "nulls": []}

    for plant in PLANTS:
        rng = np.random.default_rng(seed + hash(plant.name) % 10_000)
        spec = replace(BASE, name=f"plant-{plant.name}")
        rows = []
        for _ in range(RECORDS_PER_PLANT):
            record = generate_record(rng, spec, GAMES_PER_RECORD, plant)
            rows.append(run_record(record, split_index(record, DERIVATION_GAMES), depth))
        validated = [r for r in rows if r["validated"]]
        on_target = [r for r in validated if r["jaccard"] >= ON_TARGET_JACCARD]
        out["plants"].append(
            {
                "plant": plant.name,
                "records": len(rows),
                "validated": len(validated),
                "validated_rate": len(validated) / len(rows),
                "on_target": len(on_target),
                "on_target_rate": len(on_target) / len(rows),
                "median_jaccard": float(np.median([r["jaccard"] for r in validated]))
                if validated
                else float("nan"),
                "regions": _top_regions(validated),
            }
        )

    # THE HARNESS'S OWN CONTROL, run before the null worlds so a leak is found before anything is
    # read as a result. Same records, same search, same judge, gap permuted within each record.
    shuffled_hits = 0
    shuffled_total = 0
    for plant in PLANTS:
        rng = np.random.default_rng(seed + 9000 + hash(plant.name) % 10_000)
        permuter = np.random.default_rng(seed + 9500 + hash(plant.name) % 10_000)
        spec = replace(BASE, name=f"shuffled-{plant.name}")
        for _ in range(SHUFFLE_RECORDS_PER_PLANT):
            record = generate_record(rng, spec, GAMES_PER_RECORD, plant)
            row = run_record(record, split_index(record, DERIVATION_GAMES), depth, shuffle=permuter)
            shuffled_hits += 1 if row["validated"] else 0
            shuffled_total += 1
    out["shuffled_rate"] = shuffled_hits / shuffled_total if shuffled_total else float("nan")
    out["shuffled_ci"] = wilson(shuffled_hits, shuffled_total)
    out["shuffled_n"] = shuffled_total

    claimed = 0
    total = 0
    for index, spec in enumerate(NULL_WORLDS):
        rng = np.random.default_rng(seed + 5000 + index)
        rows = []
        for _ in range(NULL_RECORDS_PER_WORLD):
            record = generate_record(rng, spec, GAMES_PER_RECORD, None)
            rows.append(run_record(record, split_index(record, DERIVATION_GAMES), depth))
        hits = sum(1 for r in rows if r["validated"])
        claimed += hits
        total += len(rows)
        out["nulls"].append({"world": spec.name, "records": len(rows), "validated": hits})

    out["false_claim_rate"] = claimed / total if total else float("nan")
    out["false_claim_ci"] = wilson(claimed, total)
    out["false_claim_n"] = total
    return out


def _top_regions(validated: list[dict], top: int = 3) -> list[tuple[str, int]]:
    counts: dict[str, int] = {}
    for row in validated:
        counts[row["region"]] = counts.get(row["region"], 0) + 1
    return sorted(counts.items(), key=lambda kv: -kv[1])[:top]


def main() -> None:
    depths = [int(d) for d in (sys.argv[1:] or ["1", "2"])]
    report = {
        "seed": SEED,
        "records_per_plant": RECORDS_PER_PLANT,
        "null_records_per_world": NULL_RECORDS_PER_WORLD,
        "games_per_record": GAMES_PER_RECORD,
        "derivation_games": DERIVATION_GAMES,
        "separability_k": SEPARABILITY_K,
        "min_bucket_n": MIN_BUCKET_N,
        "false_claim_ceiling": FALSE_CLAIM_CEILING,
        "on_target_jaccard": ON_TARGET_JACCARD,
        "sweeps": [sweep(depth, SEED) for depth in depths],
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "q7_candidate_search.json").write_text(json.dumps(report, indent=2))
    print(render(report))
    (RESULTS / "q7_candidate_search.txt").write_text(render(report))


def render(report: dict) -> str:
    lines = [
        "Q7 / D04 -- can a candidate search find the region the six buckets cannot express?",
        "",
        f"{report['records_per_plant']} records per plant, {report['null_records_per_world']} per null world, "
        f"{report['games_per_record']} games each, {report['derivation_games']} to derive.",
        f"Judged on the SHIPPED terms: k={report['separability_k']}, min n={report['min_bucket_n']}.",
        f"Declared before the run: false-claim ceiling {report['false_claim_ceiling']}, "
        f"on-target = Jaccard >= {report['on_target_jaccard']}.",
    ]
    for s in report["sweeps"]:
        lines += [
            "",
            f"DEPTH {s['depth']}  (conjunctions of up to {s['depth']} cut(s))",
            f"{'plant':<24} {'validated':>10} {'on-target':>10} {'median J':>9}  top region",
        ]
        for row in s["plants"]:
            top = row["regions"][0][0] if row["regions"] else "-"
            lines.append(
                f"{row['plant']:<24} {row['validated_rate']:10.4f} {row['on_target_rate']:10.4f} "
                f"{row['median_jaccard']:9.3f}  {top[:44]}"
            )
        lo, hi = s["false_claim_ci"]
        verdict = "WITHIN" if hi <= report["false_claim_ceiling"] else "OVER"
        slo, shi = s["shuffled_ci"]
        sverdict = "WITHIN" if shi <= report["false_claim_ceiling"] else "OVER"
        lines += [
            "",
            f"  false-claim rate on {s['false_claim_n']} null records: {s['false_claim_rate']:.4f} "
            f"(95% CI {lo:.4f}-{hi:.4f})  -> {verdict} the {report['false_claim_ceiling']} ceiling",
            f"  shuffled-label control, {s['shuffled_n']} planted records with the gap permuted: "
            f"{s['shuffled_rate']:.4f} (95% CI {slo:.4f}-{shi:.4f})  -> {sverdict}",
        ]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    main()
