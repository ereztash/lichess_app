"""What the shipped transfer bar actually clears, and what a component study would cost.

WHY THIS FILE EXISTS. `docs/learning/FALSIFICATION_REGISTER.md` makes three arithmetic claims about
the learning layer as it stands and about the study that would test a replacement. Arithmetic
asserted in prose is arithmetic nobody re-runs, and this repository's own rule is that a number in a
document has to be reproducible from something in the tree.

NOTHING HERE TOUCHES THE PRODUCT. It imports nothing from `shared/`, it is not on any build path,
and it is not called by any test. The constants it reads are transcribed from
`shared/learning-record.ts` and asserted against that file's text at the bottom, so a change to the
product surfaces here as a failed assertion rather than as a stale table.
"""

from __future__ import annotations

import re
from math import comb, sqrt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

#: Transcribed from `shared/learning-record.ts`, and checked against it below.
TRANSFER_POSITION_COUNT = 3
TRANSFER_MINIMUM_SUCCESSES = 2
RETRIEVAL_INTERVAL_DAYS = (1, 3, 7, 21)


def at_least(k: int, n: int, p: float) -> float:
    """P(at least k successes in n independent trials at rate p)."""
    return sum(comb(n, i) * p**i * (1 - p) ** (n - i) for i in range(k, n + 1))


def paired_items_for(p0: float, p1: float, power: float = 0.80, alpha: float = 0.05) -> float:
    """Items per condition to separate two per-item rates, normal approximation.

    A FLOOR AND NOT AN ESTIMATE. It assumes independent items, which chess positions inside one
    participant are not: items cluster by position type and by sitting. The real requirement is
    larger by the design effect, and the design effect is unknown until a pilot measures the
    intra-participant correlation -- which is one of the things Study 0 exists to produce.
    """
    z_a, z_b = 1.959963985, 0.8416212336 if power == 0.80 else 1.2815515655
    pbar = (p0 + p1) / 2
    return (
        z_a * sqrt(2 * pbar * (1 - pbar)) + z_b * sqrt(p0 * (1 - p0) + p1 * (1 - p1))
    ) ** 2 / (p1 - p0) ** 2


def between_subjects_for(delta: float, sd: float = 0.8, power: float = 0.80) -> float:
    """Participants per group to detect a mean difference of `delta` on a d'-like score."""
    z_a, z_b = 1.959963985, 0.8416212336 if power == 0.80 else 1.2815515655
    return 2 * ((z_a + z_b) ** 2) * ((sd / delta) ** 2)


def check_constants_against_product() -> list[str]:
    """The transcription above, differenced against the file it was transcribed from."""
    source = (ROOT / "shared/learning-record.ts").read_text(encoding="utf-8")
    problems = []
    for name, value in (
        ("TRANSFER_POSITION_COUNT", TRANSFER_POSITION_COUNT),
        ("TRANSFER_MINIMUM_SUCCESSES", TRANSFER_MINIMUM_SUCCESSES),
    ):
        match = re.search(rf"export const {name} = (\d+)", source)
        if match is None:
            problems.append(f"{name} is no longer exported from shared/learning-record.ts")
        elif int(match.group(1)) != value:
            problems.append(f"{name} is {match.group(1)} in the product, {value} here")
    days = re.search(r"export const RETRIEVAL_INTERVAL_DAYS = \[([\d, ]+)\]", source)
    if days is None:
        problems.append("RETRIEVAL_INTERVAL_DAYS is no longer exported")
    elif tuple(int(d) for d in days.group(1).split(",")) != RETRIEVAL_INTERVAL_DAYS:
        problems.append(f"RETRIEVAL_INTERVAL_DAYS is [{days.group(1)}] in the product")
    return problems


def main() -> int:
    problems = check_constants_against_product()
    if problems:
        print("TRANSCRIPTION IS STALE:")
        for p in problems:
            print(f"  {p}")
        return 1
    print(
        f"Constants match shared/learning-record.ts: {TRANSFER_POSITION_COUNT} positions, "
        f"{TRANSFER_MINIMUM_SUCCESSES} successes required, intervals {list(RETRIEVAL_INTERVAL_DAYS)} days.\n"
    )

    print("1. WHAT THE SHIPPED BAR CLEARS BY CHANCE")
    print("   A rule is graded on >= 2 successes in 3 positions. At per-item rate p:\n")
    print(f"   {'p':>6} {'P(graded replicated)':>22}")
    for p in (0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.75, 0.80, 0.90):
        print(f"   {p:>6.2f} {at_least(TRANSFER_MINIMUM_SUCCESSES, TRANSFER_POSITION_COUNT, p):>22.4f}")

    print("\n2. AND p IS A PRODUCT OF TWO THINGS, NEITHER OF WHICH IS RULE USE")
    print("   `record-service.ts` scores a success as: recall word-overlap floor cleared AND the")
    print("   move accurate. p = P(recall) x P(accurate) if the two are independent.\n")
    print(f"   {'P(recall)':>10} {'P(accurate)':>12} {'p':>7} {'P(replicated)':>15}")
    for r in (0.6, 0.8, 0.9):
        for a in (0.6, 0.7, 0.8):
            print(
                f"   {r:>10.2f} {a:>12.2f} {r * a:>7.3f} "
                f"{at_least(TRANSFER_MINIMUM_SUCCESSES, TRANSFER_POSITION_COUNT, r * a):>15.4f}"
            )

    print("\n3. WHAT A COMPONENT STUDY COSTS, IN THE TWO CURRENCIES")
    print("   Between participants, on a d'-like score with SD 0.8:\n")
    print(f"   {'difference':>12} {'per group':>11} {'four groups':>13}")
    for d in (0.2, 0.3, 0.5, 0.8):
        n = between_subjects_for(d)
        print(f"   {d:>12.1f} {n:>11.0f} {4 * n:>13.0f}")
    print("\n   Within one participant, on per-item rates:\n")
    print(f"   {'from':>6} {'to':>6} {'items per condition':>21}")
    for p0, p1 in ((0.50, 0.70), (0.60, 0.75), (0.70, 0.85), (0.50, 0.65)):
        print(f"   {p0:>6.2f} {p1:>6.2f} {paired_items_for(p0, p1):>21.0f}")

    print(
        "\n   The two currencies are not interchangeable. Eight to thirty people cannot buy a\n"
        "   four-arm comparison at any effect size the literature makes plausible; the same eight\n"
        "   to thirty people can buy several hundred items each."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
