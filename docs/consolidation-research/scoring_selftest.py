#!/usr/bin/env python3
"""
D2's positive and negative controls.

`SCORING_METHOD_V2.md` §2 claims the corrected Dimension 2 does not reward promotion. That is a
claim about a function, and a claim about a function can be run. This file runs it against five
classification strategies over ONE fixed evidence table, and asserts that the correct one wins.

    python3 scoring_selftest.py

A scoring method with no control is a scoring method that has never been shown to discriminate.
"""
from __future__ import annotations
import itertools, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

# The evidence table. domains / operational / failures / non-authoring cases / corpus cases.
# Derived in Study v1 from PROCESS_CORPUS.json and frozen in REPO_NATIVE_OPERATING_SYSTEM.md §B.
EVIDENCE = {
    "RNL-01": (7, 7, 5, 8, 14), "RNL-02": (7, 5, 4, 9, 14), "RNL-03": (7, 4, 2, 7, 10),
    "RNL-04": (4, 5, 4, 9, 10), "RNL-05": (5, 5, 4, 7, 14), "RNL-06": (4, 4, 3, 3, 5),
    "RNL-07": (3, 4, 2, 4, 4),  "RNL-08": (10, 6, 3, 8, 16), "RNL-09": (2, 4, 2, 1, 3),
    "RNL-10": (8, 5, 3, 9, 12), "RNL-11": (3, 4, 2, 1, 5),   "RNL-12": (2, 3, 3, 5, 6),
    "RNL-13": (6, 4, 3, 9, 19), "RNL-14": (6, 4, 3, 6, 8),   "RNL-15": (6, 4, 3, 8, 13),
    "RNL-16": (3, 4, 3, 4, 4),  "RNL-17": (12, 5, 3, 19, 31), "RNL-18": (5, 5, 3, 6, 7),
}
REPO, DOMAIN, LOCAL = "REPO-NATIVE", "DOMAIN", "LOCAL"


def bar(ev) -> str:
    """The stated bar, applied to the evidence. SCORING_METHOD_V2.md section 2."""
    dom, op, fail, nonauth, _cases = ev
    if dom >= 3 and op >= 2 and fail >= 1 and nonauth >= 1:
        return REPO
    if dom == 2:
        return DOMAIN
    return LOCAL


def separation(cls: dict, ev: dict) -> float:
    promoted = [ev[k][0] for k, v in cls.items() if v == REPO]
    other = [ev[k][0] for k, v in cls.items() if v != REPO]
    if not promoted or not other:
        return 0.0
    wins = sum((a > b) + 0.5 * (a == b) for a in promoted for b in other)
    auc = wins / (len(promoted) * len(other))
    return 2 * max(0.0, auc - 0.5)


def classification_agreement(cls: dict, ev: dict) -> float:
    """Cohen's kappa between the published classification and the bar's.

    Chance-corrected on purpose: a classifier that assigns ONE class to everything has no variation
    in its marginal, so p_expected == p_observed and kappa is 0 however many it happens to get
    right. Plain agreement scored `promote everything` at 0.889 here, because 16 of 18 candidates
    genuinely qualify -- that is Defect D in SCORING_METHOD_V2.md section 0.
    """
    n = len(cls)
    truth = {k: bar(ev[k]) for k in cls}
    p_o = sum(1 for k in cls if cls[k] == truth[k]) / n
    classes = {REPO, DOMAIN, LOCAL}
    p_e = sum((sum(1 for k in cls if cls[k] == c) / n) * (sum(1 for k in cls if truth[k] == c) / n)
              for c in classes)
    if p_e >= 1.0:
        return 0.0
    return max(0.0, (p_o - p_e) / (1 - p_e))


def admissibility(cls: dict, ev: dict) -> float:
    return sum(1 for k in cls if ev[k][4] >= 1 and ev[k][1] >= 1) / len(cls)


def d2(cls: dict, ev: dict, falsification: float) -> float:
    return 20 * (0.35 * separation(cls, ev)
                 + 0.40 * classification_agreement(cls, ev)
                 + 0.15 * falsification
                 + 0.10 * admissibility(cls, ev))


def strategies():
    ev = dict(EVIDENCE)
    correct = {k: bar(v) for k, v in ev.items()}
    yield "P1 promote everything", {k: REPO for k in ev}, ev, 1.0
    yield "P2 demote everything to local", {k: LOCAL for k in ev}, ev, 1.0
    yield "P3 discriminate correctly (published)", correct, ev, 1.0
    # P4: pad with ten straws that carry no case and no operational instance, reject them all
    padded = dict(ev)
    for i in range(10):
        padded[f"STRAW-{i}"] = (0, 0, 0, 0, 0)
    p4 = {k: (correct[k] if k in correct else LOCAL) for k in padded}
    yield "P4 pad with straw candidates", p4, padded, 1.0
    # P5: a fixed pseudo-random assignment, seeded so the test is deterministic
    order = sorted(ev)
    p5 = {k: (REPO, DOMAIN, LOCAL)[(i * 7 + 3) % 3] for i, k in enumerate(order)}
    yield "P5 classify at random", p5, ev, 1.0


def published_table_matches() -> tuple[bool, list[str]]:
    """The frozen table above must still be what the study publishes.

    A control that silently moves with the thing it tests is not a control, so EVIDENCE stays
    hard-coded. But a control whose fixture has drifted from the study is testing a fiction, so the
    drift is checked and reported. Repair for Defect E: P3's label says "published", and that word
    is now earned rather than asserted.
    """
    import json
    here = os.path.dirname(os.path.abspath(__file__))
    try:
        doc = json.load(open(os.path.join(here, "LAW_SUPPORT.json"), encoding="utf-8"))["laws"]
    except FileNotFoundError:
        return False, ["LAW_SUPPORT.json not found"]
    problems = []
    if set(doc) != set(EVIDENCE):
        problems.append(f"candidate set differs: {set(doc) ^ set(EVIDENCE)}")
    for k in sorted(set(doc) & set(EVIDENCE)):
        c = doc[k]["counts"]
        frozen = EVIDENCE[k]
        live = (c["domains"], c["operational"], c["failures"],
                c["non_authoring_cases"], c["corpus_cases"])
        if frozen != live:
            problems.append(f"{k}: fixture {frozen} vs published {live}")
        want = {"REPO-NATIVE LAW": REPO, "DOMAIN LAW": DOMAIN, "LOCAL PATTERN": LOCAL}[
            doc[k]["published_class"]]
        if bar(EVIDENCE[k]) != want:
            problems.append(f"{k}: published class {want}, bar says {bar(EVIDENCE[k])}")
    return not problems, problems


def main() -> int:
    rows = []
    for name, cls, ev, fals in strategies():
        rows.append((name, d2(cls, ev, fals), separation(cls, ev), classification_agreement(cls, ev),
                     admissibility(cls, ev)))
    w = max(len(r[0]) for r in rows)
    print(f"{'strategy':<{w}}  {'D2/20':>6}  {'sep':>5}  {'kappa':>6}  {'adm':>5}")
    for n, s, sep, fid, adm in rows:
        print(f"{n:<{w}}  {s:>6.2f}  {sep:>5.3f}  {fid:>6.3f}  {adm:>5.3f}")
    by = {r[0]: r[1] for r in rows}
    correct = by["P3 discriminate correctly (published)"]
    checks = [
        ("P3 beats P1 (promote everything)", correct > by["P1 promote everything"]),
        ("P3 beats P2 (demote everything)", correct > by["P2 demote everything to local"]),
        ("P3 beats P4 (straw padding)", correct > by["P4 pad with straw candidates"]),
        ("P3 beats P5 (random)", correct > by["P5 classify at random"]),
        ("P1 scores below half marks", by["P1 promote everything"] < 10),
        ("P2 scores below half marks", by["P2 demote everything to local"] < 10),
    ]
    fixture_ok, fixture_problems = published_table_matches()
    checks.append(("the fixture still matches the published table, and P3 IS the published "
                   "classification", fixture_ok))
    print()
    bad = 0
    for label, ok in checks:
        print(f"{'PASS' if ok else 'FAIL'}  {label}")
        bad += not ok
    for problem in fixture_problems:
        print(f"      drift: {problem}")
    print(f"\n{len(checks) - bad} of {len(checks)} controls hold.")
    if not bad:
        print(f"\nD2 for the published classification: {correct:.2f} / 20")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
