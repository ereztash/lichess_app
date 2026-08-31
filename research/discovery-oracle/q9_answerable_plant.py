"""D05, second run: the same two arms, on a plant that can actually be recovered.

WHY THERE IS A SECOND RUN. Q8 scored condition 2 as FAIL and the verdict REJECTED stands. But its
own `region_probe` then measured that condition 2 was not a question either arm could have answered:
`clean-fast` plants its effect in `seconds < 45`, which on a 3+0 record is 96.9% of the decisions, so
there is almost nothing outside it to contrast against and no bucketing of any kind separates a
constant. A test that cannot come back positive is not evidence about its subject.

THE RULE FOR THIS RUN WAS DECLARED IN `docs/decisions/D05-blitz-time.md` AND COMMITTED BEFORE THIS
FILE EXISTED -- commit `1774b66`, "the relative bucket fixes readability and its recovery test was
unanswerable". That ordering is the whole point: a rule written after seeing Q8's numbers would be a
rule fitted to them.

THE PLANT. `relative-fast`, delta 0.180 -- the same strength as `clean-fast`, so `clean-middlegame`
stays a control at the same strength -- planted where

    thinkMs / clockBeforeMs < 1/40

1/40 is the midpoint IN VALUE between the candidate's own cut (1/60, half an even pace) and an even
pace across the product's thirty-move horizon (1/30): (1/60 + 1/30) / 2 = 1/40 exactly. It was
chosen to be a region NEITHER ARM NAMES, and both consequences were written down in D05 before the
run:

  - `fast-relative` (`< 1/60`) is a strict SUBSET of the plant. The candidate can name part of the
    region and not all of it -- a handicap, deliberately, so this is not the candidate marking its
    own homework.
  - `fast-under-45s` is a gross SUPERSET: on a blitz record it covers 97% of the decisions,
    including every planted one and almost everything else.

Each arm is scored against its OWN fast bucket, because the product question is whether a
time-pressure effect gets reported as time pressure, and neither key is the region.

WHAT WOULD REJECT IT, in this order, and the first is a gate on the RUN rather than on the candidate:

  1. Answerability, from Q8's own probe, reported first. If the new plant is not a genuine subset --
     unplanted material below `MIN_BUCKET_N`, or more of the record planted-and-outside than is
     unplanted at all -- this run reports NO VERDICT, and the finding is that the harness failed
     again.
  2. False-claim rate on blitz nulls at or under 0.02, upper 95%, from this run's own nulls.
  3. The candidate's validated-on-target on the new plant, at least half of `clean-middlegame`'s on
     THIS run -- the same bar shape as Q8's, against this run's control rather than Q6's number.

EVERY MOVING PART IS Q8'S. `run_world`, `arm`, `region_probe` and the scoring are imported, not
copied: two arm loops that could disagree about something neither run is about is the failure Q8's
result section is entirely about.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from oracle.worlds import PLANTS, Plant  # noqa: E402
from q6_blitz_time import MIN_BUCKET_N  # noqa: E402
from q8_relative_time import (  # noqa: E402
    DERIVATION_GAMES,
    FALSE_CLAIM_CEILING,
    GAMES_PER_RECORD,
    RECORDS_PER_WORLD,
    SEED,
    arm,
)

RESULTS = Path(__file__).resolve().parent / "results"

#: Declared in D05 before this file existed. Not edited afterwards.
PLANT_CUT = 1 / 40


def _region_relative_fast(row: dict) -> bool:
    """The plant's region, and the one place it is decided.

    IT IS A RATIO WRITTEN IN PYTHON, which is a second statement of something TypeScript also says,
    and that is the shape of five defects in `tests/LEVELS.md`. Two things keep it honest: the cut
    is deliberately NOT either bucket's cut, so this is not a restatement of a predicate under
    another name; and `region_probe` measures the plant's coverage against the bridge's own `sides`
    rather than against this function, so a disagreement between the two shows up as a number.

    `clock_ms` is the reading AFTER the decision -- the generator subtracts the think before it
    appends -- which is the same `clockMsRemaining` that `clockShareOfDecision` divides by. A
    decision with no clock is outside the region, because a decision the bucket cannot read must not
    be planted in.
    """
    clock = row["clock_ms"]
    if clock is None or clock <= 0:
        return False
    return (row["seconds"] * 1000.0) / clock < PLANT_CUT


RELATIVE_FAST = Plant("relative-fast", 0.180, _region_relative_fast, "fast-relative")
#: The plant under test, and the control at the same strength. `clean-middlegame` comes from the
#: shared registry unchanged, so its number here is comparable to Q4's, Q6's and Q8's.
PLANTS_HERE = (RELATIVE_FAST, next(p for p in PLANTS if p.name == "clean-middlegame"))


def main() -> int:
    RESULTS.mkdir(exist_ok=True)
    shipped = arm(candidate=False, plants=PLANTS_HERE, probe_plant="relative-fast")
    candidate = arm(candidate=True, plants=PLANTS_HERE, probe_plant="relative-fast")

    def row(a: dict, name: str) -> dict:
        return next(p for p in a["plants"] if p["plant"] == name)

    probe = candidate["region_probe"]
    answerable = probe["answerable"]
    fast = row(candidate, "relative-fast")
    middle = row(candidate, "clean-middlegame")
    bar = middle["validated_on_target"] / 2
    ceiling_ok = candidate["false_claim_upper"] <= FALSE_CLAIM_CEILING
    recovery_ok = fast["validated_on_target"] >= bar

    if not answerable:
        verdict = "NO VERDICT -- the plant is not a genuine subset either"
    else:
        verdict = "ACCEPTED" if (ceiling_ok and recovery_ok) else "REJECTED"

    out: list[str] = [
        "Q9 / D05 -- the same two arms, on a plant that can actually be recovered",
        "",
        f"{RECORDS_PER_WORLD} records per world, {GAMES_PER_RECORD} games each, "
        f"{DERIVATION_GAMES} to derive. Blitz controls only.",
        f"Plant `relative-fast`: thinkMs/clockBeforeMs < 1/{round(1 / PLANT_CUT)}, delta "
        f"{RELATIVE_FAST.delta:.3f}. Rule declared in D05 before this file existed.",
        "",
        "CONDITION 1, REPORTED FIRST: is this a question an arm could answer YES to?",
        "",
        f"{'arm':>10} {'target bucket':16} {'planted':>8} {'inside':>8} "
        f"{'unplanted n':>12} {'planted & outside':>18} {'answerable':>11}",
    ]
    for a in (shipped, candidate):
        pr = a["region_probe"]
        out.append(
            f"{a['arm']:>10} {pr['target']:16} {pr['planted_share']:>8.4f} "
            f"{pr['inside_share']:>8.4f} {pr['unplanted_decisions']:>12.0f} "
            f"{pr['planted_outside_floor']:>18.4f} {str(pr['answerable']):>11}"
        )
    out += [
        "",
        f"  a median derivation half holds {probe['median_derivation_decisions']:.0f} decisions, and"
        f" MIN_BUCKET_N is {MIN_BUCKET_N}.",
        "",
        f"{'bucket':22} {'arm':>10} {'non-empty':>10} {'usable':>9} {'cleared':>9}",
    ]
    for a in (shipped, candidate):
        for key in sorted(a["bucket_liveness"]):
            r = a["bucket_liveness"][key]
            n = max(r["n"], 1)
            out.append(
                f"{key:22} {a['arm']:>10} {r['nonempty'] / n:>10.4f} "
                f"{r['usable'] / n:>9.4f} {r['cleared'] / n:>9.4f}"
            )
        out.append("")

    out += [
        f"{'plant':22} {'arm':>10} {'recall':>8} {'on target':>10} {'validated on target':>20}"
        f" {'wrong proxy':>12}"
    ]
    for a in (shipped, candidate):
        for p in a["plants"]:
            out.append(
                f"{p['plant']:22} {a['arm']:>10} {p['any_bucket_recall']:>8.4f} "
                f"{p['predicate_recovery']:>10.4f} {p['validated_on_target']:>20.4f} "
                f"{p['wrong_proxy_rate']:>12.4f}"
            )

    out += [
        "",
        "THE THREE CONDITIONS, DECLARED BEFORE THE RUN",
        f"  1. the plant is a genuine subset  -> {'PASS' if answerable else 'FAIL -- no verdict'}",
        f"  2. false-claim on blitz nulls  {candidate['false_claim_rate']:.4f} "
        f"(upper 95% {candidate['false_claim_upper']:.4f})  ceiling {FALSE_CLAIM_CEILING}"
        f"   -> {'PASS' if ceiling_ok else 'FAIL'}",
        f"  3. relative-fast validated-on-target  {fast['validated_on_target']:.4f}"
        f"   bar {bar:.4f} (half of THIS run's middlegame "
        f"{middle['validated_on_target']:.4f})   -> {'PASS' if recovery_ok else 'FAIL'}",
        "",
        f"  the shipped arm on the same plant, same worlds, same seeds: "
        f"{row(shipped, 'relative-fast')['validated_on_target']:.4f} validated on target, "
        f"{row(shipped, 'relative-fast')['any_bucket_recall']:.4f} any-bucket recall",
        "",
        f"VERDICT: {verdict}",
    ]

    text = "\n".join(out) + "\n"
    (RESULTS / "q9_answerable_plant.txt").write_text(text, encoding="utf-8")
    (RESULTS / "q9_answerable_plant.json").write_text(
        json.dumps(
            {
                "seed": SEED,
                "records_per_world": RECORDS_PER_WORLD,
                "plant_cut": PLANT_CUT,
                "plant_delta": RELATIVE_FAST.delta,
                "false_claim_ceiling": FALSE_CLAIM_CEILING,
                "recovery_bar": bar,
                "answerable": answerable,
                "verdict": verdict,
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
