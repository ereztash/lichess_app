"""D08 after D04: is the attribution veto still doing a job once a search can name the region?

D08'S OWN REVERSAL CONDITION 2 IS THIS QUESTION. It reads: *the vocabulary gains conjunctions (D04).
If `fast AND endgame` becomes expressible, the misattribution this node exists for largely stops
happening, and what remains is a different question about a different search.* D04 has now measured
a search that recovers `phase==endgame AND seconds<45` exactly on 33.5% of `interaction-only`
records, so the trigger has fired and the "largely" in that sentence is a prediction with a number
attached. This file checks it.

THE TWO PIPELINES RUN ON THE SAME RECORDS, WHICH IS THE ONLY WAY THE QUESTION MEANS ANYTHING. Every
record is drawn once and handed to both: the shipped chain through the TypeScript bridge (six frozen
buckets, judged on the validation half, then `attribution()` on what it validated), and D04's search
through Q7's own `run_record` (one frozen candidate region, judged on the same validation half). Two
runs on two draws would be comparing two samples.

WHAT IS COUNTED, AND THE POPULATION IS THE ONE THE VETO ACTS ON: records where the shipped chain
validated a claim. Attribution never sees the others. Each of those is placed in one of four cells:

    search on target  &  no veto   ->  the claim stands, and a right name existed anyway
    search on target  &  VETO      ->  the veto suppressed a record the search could have named
    search off target &  VETO      ->  silence instead of the wrong sentence  (the veto working)
    search off target &  no veto   ->  the wrong sentence survives             (what remains)

On the misattributing worlds every validated claim is a wrong name, so cell 3 is the veto earning
its place and cell 4 is the residue. On the clean worlds the planted region IS the claimed bucket,
so any veto at all is a false veto and cells 2 and 3 are both costs.

A FIFTH ROW IS REPORTED SEPARATELY: records where the chain said nothing and the search was on
target. That is D04's gain and it has nothing to do with attribution -- counting it inside the four
cells would let the search's benefit be read as the veto's.

WHAT THIS FILE DOES NOT CLAIM. That the two pipelines are comparable as pipelines. D04's harness is
narrower -- one pre-frozen region, no attribution, no protocol matching -- and its own node says so
at the point its clean-plant numbers are reported. Nothing here compares their rates. It asks one
question about one record at a time: given that the chain has produced a claim, does the existence of
a search change what the veto is for?

DEPTH IS NOT CHOSEN HERE. D04 left depth an open trade -- depth 2 buys `interaction-only` and loses
the clean plants -- and D06 is held shut until it is settled. So both depths are run and both are
reported, and picking the one that flatters the answer is the move this would otherwise be.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from oracle.bridge import run_detector, to_line  # noqa: E402
from oracle.worlds import BASE, PLANTS, generate_record, split_at_game  # noqa: E402
from q5_attribution import wilson  # noqa: E402
from q7_candidate_search import (  # noqa: E402
    ON_TARGET_JACCARD,
    run_record,
    split_index,
)

ROOT = Path(__file__).resolve().parents[2]
RESULTS = Path(__file__).resolve().parent / "results"

RECORDS_PER_PLANT = 400
GAMES_PER_RECORD = 40
DERIVATION_GAMES = 20
SEED = 20260902
DEPTHS = (1, 2)

#: The worlds whose planted region is NOT a bucket: every validated claim names something too wide,
#: so a veto is a catch. The two D08 measures `caught` on.
MISATTRIBUTING = ("interaction-only", "proxy-correlated")
#: The worlds whose planted region IS a bucket: a claim naming it is right and any veto is wrong.
CLEAN = ("clean-middlegame", "clean-fast")


def shipped_attribution_k() -> float:
    """`ATTRIBUTION_K`, read off the shipped file rather than transcribed.

    A COPIED CONSTANT IS A CONSTANT THAT DRIFTS. Q5 swept seven candidate `k` and D08 wrote 2.5 into
    `attribution.ts`; this file measures what the product would actually do, so it has to read what
    the product actually holds. If the export moves or changes shape this raises instead of
    measuring the wrong threshold quietly.
    """
    source = (ROOT / "shared/discovery/attribution.ts").read_text(encoding="utf-8")
    match = re.search(r"export const ATTRIBUTION_K = ([0-9.]+);", source)
    if match is None:
        raise RuntimeError("ATTRIBUTION_K is not exported from shared/discovery/attribution.ts")
    return float(match.group(1))


ATTRIBUTION_K = shipped_attribution_k()


def draw(plant, seed: int) -> list[dict]:
    rng = np.random.default_rng(seed)
    spec = replace(BASE, name=f"plant-{plant.name}")
    return [generate_record(rng, spec, GAMES_PER_RECORD, plant) for _ in range(RECORDS_PER_PLANT)]


def chain(plant, drawn: list[dict]) -> list[dict]:
    """The shipped chain over the drawn records, in order, through the TypeScript bridge."""
    lines = (
        to_line(record, f"{plant.name}-{i}", plant.name, split_at_game(record, DERIVATION_GAMES))
        for i, record in enumerate(drawn)
    )
    return list(run_detector(lines))


def searched(drawn: list[dict], depth: int) -> list[dict]:
    """D04's search over the SAME records at the same split, in the same order."""
    rows = []
    for record in drawn:
        split = split_index(record, DERIVATION_GAMES)
        # ASSERTED RATHER THAN ASSUMED. The two pipelines compute the split in two files -- Q7's
        # `split_index` and the generator's `split_at_game` -- and a one-decision disagreement would
        # put the two halves of one record on opposite sides of the wall in one pipeline and not the
        # other, which is a leak that would look like a finding.
        assert split == split_at_game(record, DERIVATION_GAMES), "the two pipelines split differently"
        rows.append(run_record(record, split, depth))
    return rows


def cells(chain_rows: list[dict], search_rows: list[dict]) -> dict:
    """The four cells, over the records where the SHIPPED CHAIN validated a claim."""
    on_target = [
        bool(r["validated"]) and float(r.get("jaccard", float("nan"))) >= ON_TARGET_JACCARD
        for r in search_rows
    ]
    counts = {"right_no_veto": 0, "right_veto": 0, "wrong_veto": 0, "wrong_no_veto": 0}
    unreadable = 0
    for row, right in zip(chain_rows, on_target, strict=True):
        if not row["validated"]:
            continue
        att = row["attribution"]
        z = None if att is None else att["maxAbsZ"]
        if z is None:
            # THREE SILENCES, NOT ONE. No claim, a bucket too small to split, or every split
            # one-sided. `attribution()` cannot veto what it cannot read, so these are counted as
            # "no veto" and reported apart -- "we could not look" must not read as "we looked".
            unreadable += 1
        vetoed = z is not None and z >= ATTRIBUTION_K
        key = ("right" if right else "wrong") + ("_veto" if vetoed else "_no_veto")
        counts[key] += 1
    validated = sum(1 for r in chain_rows if r["validated"])
    silent_but_found = sum(
        1 for r, right in zip(chain_rows, on_target, strict=True) if not r["validated"] and right
    )
    return {
        **counts,
        "chain_validated": validated,
        "attribution_unreadable": unreadable,
        "search_on_target": sum(on_target),
        "chain_silent_search_on_target": silent_but_found,
        "records": len(chain_rows),
    }


#: Which selector in the search's vocabulary corresponds to each of the six buckets. `slow-over-2m`
#: has none -- Q7's selector list is `seconds<45`, `seconds>=45`, `clock<60s`, `clock>=60s` and the
#: three phases -- so a veto naming it is counted as "the search could not have said this".
BUCKET_FEATURE = {
    "phase-opening": ("phase", "phase==0"),
    "phase-middlegame": ("phase", "phase==1"),
    "phase-endgame": ("phase", "phase==2"),
    "fast-under-45s": ("seconds", "seconds<45.0"),
    "clock-under-1m": ("clock_ms", "clock_ms<60000.0"),
    "slow-over-2m": (None, None),
}


def agreement(chain_rows: list[dict], search_rows: list[dict]) -> dict:
    """When the veto fires, does it point at the same feature the search's region is built from?

    THIS IS A DESCRIPTION AND NOT A TEST. No rule was declared for it before the run and none is
    read off it: there is no threshold, no pass and no fail. It exists because attribution and the
    search are the same act approached from two directions -- attribution names WHICH DIVISION of
    the claimed bucket broke it (`splitBy`, a bucket key), the search names A REGION -- and one of
    them runs in TypeScript inside the product while the other is a Python oracle that does not.
    How often the cheap one points where the expensive one looks is worth knowing before anyone
    argues about porting either.

    Three levels, from weakest to strongest, because "agree" on its own would be a word doing the
    work of a number:

        expressible   the veto named a bucket the search's vocabulary could describe at all
        same feature  the search's region is built from the variable the veto named
        same side     it is built from that variable AT THE SAME CUT
    """
    counts = {"vetoed": 0, "search_had_region": 0, "expressible": 0, "same_feature": 0, "same_side": 0}
    named: dict[str, int] = {}
    #: WHICH BUCKET THE VETOED CLAIM ITSELF NAMED. Recorded because the sentence "the chain claims
    #: the endgame and attribution says it breaks on the fast decisions" is otherwise an inference
    #: about the data rather than a reading of it -- `splitBy` is the DIVIDING bucket and is never
    #: the claimed one, so the claimed one has to be read separately or not said.
    claimed: dict[str, int] = {}
    for row, found in zip(chain_rows, search_rows, strict=True):
        if not row["validated"]:
            continue
        att = row["attribution"]
        z = None if att is None else att["maxAbsZ"]
        if z is None or z < ATTRIBUTION_K:
            continue
        counts["vetoed"] += 1
        key = att["splitBy"]
        named[key] = named.get(key, 0) + 1
        which = row["selected"] or "none"
        claimed[which] = claimed.get(which, 0) + 1
        region = found.get("region")
        if region is None:
            continue
        counts["search_had_region"] += 1
        feature, selector = BUCKET_FEATURE.get(key, (None, None))
        if feature is None:
            continue
        counts["expressible"] += 1
        if feature in region:
            counts["same_feature"] += 1
        if selector in region:
            counts["same_side"] += 1
    return {**counts, "named": named, "claimed": claimed}


def main() -> int:
    RESULTS.mkdir(exist_ok=True)
    wanted = MISATTRIBUTING + CLEAN
    plants = [p for p in PLANTS if p.name in wanted]
    assert len(plants) == len(wanted), "a world named above is not in the shared registry"

    report: dict = {
        "seed": SEED,
        "records_per_plant": RECORDS_PER_PLANT,
        "attribution_k": ATTRIBUTION_K,
        "on_target_jaccard": ON_TARGET_JACCARD,
        "depths": list(DEPTHS),
        "worlds": {},
    }

    for index, plant in enumerate(plants):
        print(f"{plant.name}: drawing and running the chain ...", file=sys.stderr)
        drawn = draw(plant, SEED + index)
        chain_rows = chain(plant, drawn)
        per_depth = {}
        for depth in DEPTHS:
            print(f"{plant.name}: search at depth {depth} ...", file=sys.stderr)
            search_rows = searched(drawn, depth)
            per_depth[str(depth)] = {
                **cells(chain_rows, search_rows),
                "agreement": agreement(chain_rows, search_rows),
            }
        report["worlds"][plant.name] = {
            "expressible": plant.expressible_as,
            "kind": "misattributing" if plant.name in MISATTRIBUTING else "clean",
            "by_depth": per_depth,
        }

    out: list[str] = [
        "Q10 / D08 after D04 -- is the veto still doing a job once a search can name the region?",
        "",
        f"{RECORDS_PER_PLANT} records per world, {GAMES_PER_RECORD} games each, "
        f"{DERIVATION_GAMES} to derive. Both pipelines on the SAME records.",
        f"ATTRIBUTION_K = {ATTRIBUTION_K}, read off shared/discovery/attribution.ts. "
        f"On target = Jaccard >= {ON_TARGET_JACCARD}.",
        "",
        "Of the records where the SHIPPED CHAIN validated a claim:",
        "",
        f"{'world':22} {'d':>2} {'validated':>10} {'right+no veto':>14} {'right+VETO':>11} "
        f"{'wrong+VETO':>11} {'wrong+no veto':>14}",
    ]
    for name, world in report["worlds"].items():
        for depth in DEPTHS:
            c = world["by_depth"][str(depth)]
            out.append(
                f"{name:22} {depth:>2} {c['chain_validated']:>10} {c['right_no_veto']:>14} "
                f"{c['right_veto']:>11} {c['wrong_veto']:>11} {c['wrong_no_veto']:>14}"
            )
        out.append("")

    out += [
        "The same, as rates over every record, plus what the search found where the chain was silent:",
        "",
        f"{'world':22} {'d':>2} {'chain claims':>13} {'veto rate':>10} {'search on target':>17} "
        f"{'silent + found':>15} {'unreadable':>11}",
    ]
    for name, world in report["worlds"].items():
        for depth in DEPTHS:
            c = world["by_depth"][str(depth)]
            n = c["records"]
            vetoed = c["right_veto"] + c["wrong_veto"]
            rate = vetoed / c["chain_validated"] if c["chain_validated"] else float("nan")
            out.append(
                f"{name:22} {depth:>2} {c['chain_validated'] / n:>13.4f} {rate:>10.4f} "
                f"{c['search_on_target'] / n:>17.4f} "
                f"{c['chain_silent_search_on_target'] / n:>15.4f} "
                f"{c['attribution_unreadable']:>11}"
            )
        out.append("")

    out += ["WHAT THE CELLS MEAN, PER KIND OF WORLD", ""]
    for kind, worlds in (("misattributing", MISATTRIBUTING), ("clean", CLEAN)):
        for depth in DEPTHS:
            rows = [report["worlds"][w]["by_depth"][str(depth)] for w in worlds]
            validated = sum(r["chain_validated"] for r in rows)
            if validated == 0:
                out.append(f"  {kind:15} depth {depth}: the chain validated nothing to veto")
                continue
            caught = sum(r["wrong_veto"] for r in rows)
            residue = sum(r["wrong_no_veto"] for r in rows)
            suppressed = sum(r["right_veto"] for r in rows)
            stood = sum(r["right_no_veto"] for r in rows)
            low, high = wilson(caught, validated)
            if kind == "misattributing":
                out.append(
                    f"  {kind:15} depth {depth}: {caught}/{validated} wrong names silenced "
                    f"({caught / validated:.4f}, 95% {low:.4f}-{high:.4f}); "
                    f"{residue} wrong names survive; "
                    f"{suppressed + stood} of them the search could have named "
                    f"({suppressed} of those vetoed anyway)"
                )
            else:
                false_vetoes = caught + suppressed
                out.append(
                    f"  {kind:15} depth {depth}: {false_vetoes}/{validated} TRUE claims withheld "
                    f"({false_vetoes / validated:.4f}); {stood + residue} stood"
                )
        out.append("")

    out += [
        "WHERE THE VETO POINTS, WHEN IT FIRES -- a description, with no rule read off it",
        "",
        f"{'world':22} {'d':>2} {'vetoed':>7} {'search had one':>15} {'expressible':>12} "
        f"{'same feature':>13} {'same cut':>9}",
    ]
    for name, world in report["worlds"].items():
        for depth in DEPTHS:
            a = world["by_depth"][str(depth)]["agreement"]
            out.append(
                f"{name:22} {depth:>2} {a['vetoed']:>7} {a['search_had_region']:>15} "
                f"{a['expressible']:>12} {a['same_feature']:>13} {a['same_side']:>9}"
            )
        out.append("")
    out += ["  which division each veto named:"]
    for name, world in report["worlds"].items():
        for depth in DEPTHS:
            a = world["by_depth"][str(depth)]["agreement"]
            if a["named"]:
                pretty = ", ".join(f"{k} x{v}" for k, v in sorted(a["named"].items()))
                claim = ", ".join(f"{k} x{v}" for k, v in sorted(a["claimed"].items()))
                out.append(f"    {name:22} depth {depth}: claimed {claim}  ->  split by {pretty}")
    out.append("")

    text = "\n".join(out) + "\n"
    (RESULTS / "q10_veto_after_search.txt").write_text(text, encoding="utf-8")
    (RESULTS / "q10_veto_after_search.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
