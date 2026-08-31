"""D05: does a relative time bucket recover what the absolute one cannot?

THE RULE WAS WRITTEN FIRST. `docs/decisions/D05-blitz-time.md` carries the candidate, the two cuts
and the two conditions that would reject them, and it was committed before this file produced a
number. That ordering is the only thing that makes the numbers below worth reading, and it is the
discipline `q5_attribution.py` used for `ATTRIBUTION_K`.

WHAT Q6 MEASURED. `fast-under-45s` is usable on 27% of forty-game blitz records and recovers a real
effect on 0.00% of them, against 41.75% for `phase-middlegame` on the same worlds. Forty-five
seconds is a quarter of the entire clock in a three-minute game. The middlegame row is the control:
it scores 0.4175 here against Q4's 0.4475 on mixed controls, so the worlds are sound and the bucket
is not.

THE CANDIDATE, from D05's alternative 3: `thinkFractionOfClockBefore`, cut at half and double an
even pace across the product's own thirty-move planning horizon -- `< 1/60` is fast, `> 1/15` is
slow. `shared/blitz-time-candidate.ts` holds the definition; nothing that ships searches it.

WHAT WOULD REJECT IT, DECLARED BEFORE THIS RAN, and both must hold:

    1. the false-claim rate on blitz nulls at or under 0.02, upper 95% CI. `SEPARABILITY_K = 3.75`
       is a measurement of THOSE six searched together, so a redefined set is a different
       multiplicity and has to earn the threshold again.
    2. `clean-fast` validated-on-target at least HALF what `clean-middlegame` reaches on the same
       worlds -- against Q6's 0.4175, a bar of 0.209. Half rather than parity because a fast bucket
       is a tail and a phase bucket is a third of the record.

BOTH ARMS RUN HERE, on the same worlds and the same seeds, because the comparison is the point: a
candidate measured against a number from another file is a candidate measured against another
file's noise.

WHAT IT FOUND, written after the run and changing nothing above it. Condition 1 passes and
condition 2 fails, so the declared rule says REJECTED and the verdict below says REJECTED. The
candidate does fix readability outright -- `fast-relative` is usable on 99.6% of blitz records
against `fast-under-45s`'s 27.3%, and `slow-relative` on 100% against 0.4% -- and recovers nothing.

AND CONDITION 2 TURNED OUT NOT TO BE ANSWERABLE, which `region_probe` measures rather than argues.
`clean-fast` plants its effect on 97% of a blitz record, so there is almost no unplanted material
to contrast against: 16 decisions in a median derivation half of 528, against `MIN_BUCKET_N = 30`.
Neither arm could have passed it, and neither could any other bucketing. That defect is inherited
from Q6, whose recovery number for `fast-under-45s` has the same two sufficient causes -- see D05.
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from oracle.bridge import run_detector, to_line  # noqa: E402
from oracle.worlds import BASE, PLANTS, generate_record, split_at_game  # noqa: E402
from q4_end_to_end import null_scorecard, planted_scorecard, wilson  # noqa: E402
from q6_blitz_time import (  # noqa: E402
    BLITZ_CONTROLS,
    BLITZ_NULLS,
    BLITZ_PLANTS,
    MIN_BUCKET_N,
    bucket_liveness,
)

RESULTS = Path(__file__).resolve().parent / "results"

RECORDS_PER_WORLD = 400
GAMES_PER_RECORD = 40
DERIVATION_GAMES = 20
SEED = 20260831

#: Declared in D05 before this ran. Not edited afterwards.
FALSE_CLAIM_CEILING = 0.02
#: Q6's `clean-middlegame` validated-on-target, which the bar below is half of.
MIDDLEGAME_BENCHMARK = 0.4175
RECOVERY_BAR = MIDDLEGAME_BENCHMARK / 2

#: What `clean-fast`'s planted region is called in each arm. The plant is the same region either
#: way -- `seconds < 45` in a 3+0 game is almost always under half an even share -- and only the
#: NAME the search can give it changes.
TARGET = {"shipped": "fast-under-45s", "candidate": "fast-relative"}


def run_world(
    spec, records: int, seed: int, candidate: bool, plant=None
) -> tuple[list[dict], list[dict]]:
    """One world, one arm. The seed is the arm's own, so the two arms see the SAME records.

    THE DRAWN RECORDS COME BACK TOO, and they are what `region_probe` reads. A probe that redrew
    from the same seed would be describing a second sample and calling it the first.
    """
    rng = np.random.default_rng(seed)
    drawn = [generate_record(rng, spec, GAMES_PER_RECORD, plant) for _ in range(records)]
    lines = []
    for i, record in enumerate(drawn):
        line = to_line(
            record, f"{spec.name}-{i}", spec.name, split_at_game(record, DERIVATION_GAMES), sides=True
        )
        if candidate:
            line["candidate"] = True
        lines.append(line)
    return list(run_detector(iter(lines))), drawn


def region_probe(drawn: list[dict], results: list[dict], target: str) -> dict:
    """Was condition 2 a question the arm could have answered YES to at all?

    WHY THIS EXISTS. Condition 2 asks a bucket to recover a planted effect. That question is only
    meaningful if the plant is a *subset* of the record -- an effect present everywhere is not a
    pattern, and no bucketing of any kind can separate a constant. Nothing in Q6, Q4 or the D05
    rule checked that, so the failing score was going to be read as "the candidate does not work"
    when "the question is unanswerable" produces exactly the same number.

    TWO MARGINALS ARE ENOUGH, so this needs no crosstab and therefore no second copy of the bucket
    predicates in Python. `planted_share` comes from the world generator's own mask, the one place
    the region is decided; `inside_share` comes from the TypeScript bridge's `sides`, the shipping
    definition. If a share `p` of the derivation half is planted and a share `b` of it is inside
    the bucket, then at least `p + (1 - b) - 1 = p - b` of it is planted AND OUTSIDE -- a floor,
    true for every possible overlap. When that floor is large, the effect is mostly outside the
    bucket the arm is being scored on, and condition 2 could not have passed however good the
    bucket is.

    Everything here is measured on the DERIVATION half, because that is the half `sides` describes
    and the half a bucket has to be readable on before the prospective half is ever reached.
    """
    planted_shares, derivation_sizes = [], []
    for record in drawn:
        split = split_at_game(record, DERIVATION_GAMES)
        if split == 0:
            continue
        planted_shares.append(sum(record["planted"][:split]) / split)
        derivation_sizes.append(split)

    inside_shares, outside_counts = [], []
    for r in results:
        side = (r.get("sides") or {}).get(target)
        if side is None:
            continue
        total = side["inside"] + side["outside"]
        if total == 0:
            continue
        inside_shares.append(side["inside"] / total)
        outside_counts.append(side["outside"])

    planted = float(np.mean(planted_shares)) if planted_shares else 0.0
    inside = float(np.mean(inside_shares)) if inside_shares else 0.0
    size = float(np.median(derivation_sizes)) if derivation_sizes else 0.0
    floor = max(0.0, planted - inside)
    unplanted = 1.0 - planted
    """
    ANSWERABLE, AND THE TWO CLAUSES ARE STRUCTURAL RATHER THAN TUNED. The first is `MIN_BUCKET_N`
    itself: there has to be enough unplanted material in the record to form one measurable side.
    The second says the effect must not be mostly outside the bucket being scored -- when more of
    the record is planted-and-outside than is unplanted at all, whatever the bucket separates is
    not the plant. Neither clause carries a number this file chose.
    """
    answerable = bool(unplanted * size >= MIN_BUCKET_N and floor < unplanted)
    return {
        "target": target,
        "planted_share": planted,
        "inside_share": inside,
        "median_derivation_decisions": size,
        "median_outside_decisions": float(np.median(outside_counts)) if outside_counts else 0.0,
        "unplanted_decisions": unplanted * size,
        "planted_outside_floor": floor,
        "min_bucket_n": MIN_BUCKET_N,
        "answerable": answerable,
    }


def arm(candidate: bool, plants=BLITZ_PLANTS, probe_plant: str = "clean-fast") -> dict:
    """Every world, one arm, scored the way Q4 and Q6 score.

    PARAMETERISED FOR Q9, WHICH RUNS THE REPAIRED PLANT THROUGH THIS SAME FUNCTION. A second copy of
    the arm loop is how the two runs would come to disagree about something neither of them is
    about -- which is the failure this file spent its own result section describing.
    """
    name = "candidate" if candidate else "shipped"
    pooled_validated = 0
    pooled_n = 0
    liveness: dict[str, dict[str, float]] = {}
    nulls = []

    for i, spec in enumerate(BLITZ_NULLS):
        results, _ = run_world(spec, RECORDS_PER_WORLD, SEED + i, candidate)
        card = null_scorecard(spec.name, results)
        nulls.append(card)
        pooled_validated += card["validated_claims"]
        pooled_n += card["records"]
        for key, row in bucket_liveness(results).items():
            live = liveness.setdefault(key, {"nonempty": 0.0, "usable": 0.0, "cleared": 0.0, "n": 0.0})
            for field in ("nonempty", "usable", "cleared", "n"):
                live[field] += row[field]

    scorecards = []
    for i, plant in enumerate(plants):
        spec = replace(BASE, name=f"BLITZ-{plant.name}", time_controls=BLITZ_CONTROLS)
        results, drawn = run_world(spec, RECORDS_PER_WORLD, SEED + 100 + i, candidate, plant)
        """
        THE PLANT'S TARGET IS RENAMED, NOT THE PLANT. Scoring the candidate arm against
        `fast-under-45s`, a key its search space does not contain, would report zero on-target for a
        reason belonging entirely to this scorer, so `clean-fast`'s target is renamed to whichever
        key the arm under test can actually say.

        THIS RENAME WAS WRITTEN ON AN ASSUMPTION THAT THE PROBE BELOW DISPROVED. It said `seconds
        < 45` and "under half an even share" are very nearly the same set of decisions in a blitz
        game, so that renaming the target left the region unchanged. `region_probe` measures the two
        marginals and they are 0.97 and 0.16 -- not the same set, not close. The rename is still the
        only defensible scoring choice, but it does NOT make the two arms' condition-2 scores
        comparable, and the report says so rather than the comment quietly not saying it.
        """
        scored = planted_scorecard(
            replace(plant, expressible_as=TARGET[name]) if plant.name == probe_plant else plant,
            results,
        )
        scorecards.append(scored)
        if plant.name == probe_plant:
            probe = region_probe(drawn, results, TARGET[name])

    low, high = wilson(pooled_validated, pooled_n)
    return {
        "arm": name,
        "nulls": nulls,
        "pooled_null": {"validated": pooled_validated, "n": pooled_n, "ci": [low, high]},
        "false_claim_rate": pooled_validated / max(pooled_n, 1),
        "false_claim_upper": high,
        "bucket_liveness": liveness,
        "plants": scorecards,
        "region_probe": probe,
    }


def main() -> int:
    RESULTS.mkdir(exist_ok=True)
    shipped = arm(candidate=False)
    candidate = arm(candidate=True)

    def plant_row(a: dict, name: str) -> dict:
        return next(p for p in a["plants"] if p["plant"] == name)

    fast = plant_row(candidate, "clean-fast")
    middle = plant_row(candidate, "clean-middlegame")

    ceiling_ok = candidate["false_claim_upper"] <= FALSE_CLAIM_CEILING
    recovery_ok = fast["validated_on_target"] >= RECOVERY_BAR
    verdict = "ACCEPTED" if (ceiling_ok and recovery_ok) else "REJECTED"

    out: list[str] = [
        "Q8 / D05 -- does a relative time bucket recover what the absolute one cannot?",
        "",
        f"{RECORDS_PER_WORLD} records per world, {GAMES_PER_RECORD} games each, "
        f"{DERIVATION_GAMES} to derive. Blitz controls only.",
        "Both arms on the same worlds and the same seeds. Rule declared in D05 before this ran.",
        "",
        f"{'bucket':22} {'arm':>10} {'non-empty':>10} {'usable':>9} {'cleared':>9}",
    ]
    for a in (shipped, candidate):
        for key in sorted(a["bucket_liveness"]):
            row = a["bucket_liveness"][key]
            n = max(row["n"], 1)
            out.append(
                f"{key:22} {a['arm']:>10} {row['nonempty'] / n:>10.4f} "
                f"{row['usable'] / n:>9.4f} {row['cleared'] / n:>9.4f}"
            )
        out.append("")

    out += [f"{'plant':22} {'arm':>10} {'recall':>8} {'on target':>10} {'validated on target':>20}"]
    for a in (shipped, candidate):
        for p in a["plants"]:
            out.append(
                f"{p['plant']:22} {a['arm']:>10} {p['any_bucket_recall']:>8.4f} "
                f"{p['predicate_recovery']:>10.4f} {p['validated_on_target']:>20.4f}"
            )

    out += [
        "",
        "THE TWO CONDITIONS, DECLARED BEFORE THE RUN",
        f"  1. false-claim on blitz nulls  {candidate['false_claim_rate']:.4f} "
        f"(upper 95% {candidate['false_claim_upper']:.4f})  ceiling {FALSE_CLAIM_CEILING}"
        f"   -> {'PASS' if ceiling_ok else 'FAIL'}",
        f"  2. clean-fast validated-on-target  {fast['validated_on_target']:.4f}"
        f"   bar {RECOVERY_BAR:.4f} (half of Q6's middlegame {MIDDLEGAME_BENCHMARK})"
        f"   -> {'PASS' if recovery_ok else 'FAIL'}",
        "",
        f"  the control, this run's own middlegame: {middle['validated_on_target']:.4f}",
        f"  shipped arm's clean-fast, same worlds:  "
        f"{plant_row(shipped, 'clean-fast')['validated_on_target']:.4f}",
        "",
        f"VERDICT: {verdict}",
        "",
        "CONDITION 2 WAS NOT A VALID TEST, and this is measured, not argued.",
        "A bucket can only recover an effect that is INSIDE it. `clean-fast` plants its effect in",
        "`seconds < 45`, and on a 3+0 record that is nearly the whole record -- so there is little",
        "or nothing outside to contrast against, in either arm and for any bucketing whatsoever.",
        "",
        f"{'arm':>10} {'target bucket':16} {'planted':>8} {'inside':>8} "
        f"{'outside n':>10} {'planted & outside, at least':>28}",
    ]
    for a in (shipped, candidate):
        pr = a["region_probe"]
        out.append(
            f"{a['arm']:>10} {pr['target']:16} {pr['planted_share']:>8.4f} "
            f"{pr['inside_share']:>8.4f} {pr['median_outside_decisions']:>10.0f} "
            f"{pr['planted_outside_floor']:>28.4f}"
        )
    ship_probe, cand_probe = shipped["region_probe"], candidate["region_probe"]
    out += [
        "",
        f"  shipped   the bucket IS the region ({ship_probe['inside_share']:.2f} inside), so the",
        f"            contrast is right and there is nothing to contrast WITH: a median of",
        f"            {ship_probe['median_outside_decisions']:.0f} decisions outside against"
        f" MIN_BUCKET_N={MIN_BUCKET_N}.",
        f"  candidate the bucket is a real tail ({cand_probe['inside_share']:.2f} inside, usable on",
        "            99.6% of records), and at least "
        f"{cand_probe['planted_outside_floor']:.2f} of the record is planted and",
        "            outside it. The effect is on both sides, so no bucketing separates it.",
        "",
        "Two different failures, neither of them about the candidate's definition. Condition 2 could",
        "not have been passed by any bucket, and a valid replacement needs a plant whose region is a",
        "genuine subset of a blitz record under a relative definition -- declared before its run.",
    ]

    text = "\n".join(out) + "\n"
    (RESULTS / "q8_relative_time.txt").write_text(text, encoding="utf-8")
    (RESULTS / "q8_relative_time.json").write_text(
        json.dumps(
            {
                "seed": SEED,
                "records_per_world": RECORDS_PER_WORLD,
                "false_claim_ceiling": FALSE_CLAIM_CEILING,
                "recovery_bar": RECOVERY_BAR,
                "middlegame_benchmark": MIDDLEGAME_BENCHMARK,
                "verdict": verdict,
                "condition_2_answerable": {
                    a["arm"]: a["region_probe"]["answerable"] for a in (shipped, candidate)
                },
                "shipped": shipped,
                "candidate": candidate,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
