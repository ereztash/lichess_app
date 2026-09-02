#!/usr/bin/env python3
"""
Study v2 score. Computes SCORING_METHOD_V2.md against this study's own artefacts.

    python3 docs/consolidation-research/score_v2.py

Every input is either read out of a published artefact in this directory or listed under
MEASURED below with the command that produced it. Nothing is entered as a bare number without a
source beside it.

Repair for Defect E. The first version of this file built the "published" classification by
applying the bar to the evidence, so the two could not disagree and D2's two chance-corrected
terms were assumed rather than measured. Both sides are now read: the classification out of
REPO_NATIVE_OPERATING_SYSTEM.md section B, the counts out of LAW_SUPPORT.json, and the domain
counts re-derived from PROCESS_CORPUS.json. The comparison can now fail.
"""
from __future__ import annotations
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OS_DOC = os.path.join(HERE, "REPO_NATIVE_OPERATING_SYSTEM.md")
SUPPORT = os.path.join(HERE, "LAW_SUPPORT.json")
CORPUS = os.path.join(HERE, "PROCESS_CORPUS.json")

REPO, DOMAIN, LOCAL = "REPO-NATIVE", "DOMAIN", "LOCAL"

# --------------------------------------------------------------------------------------------
# MEASURED — every one of these came from a command or a count recorded in EXECUTION_LOG.md
# --------------------------------------------------------------------------------------------
GOV_POPULATION, GOV_CLASSIFIED = 169, 169        # PROCESS_CORPUS.json governance classification
LB_IMPL, QUOTED_IMPL = 34, 11                    # shared|client/src|server|api|drizzle, coverage scan
LB_RESEARCH, QUOTED_RESEARCH = 51, 5             # research/** code, coverage scan
TESTS_PRESENT, TESTS_EXECUTED = 2954, 2928       # npm test
MIGRATIONS_PRESENT, MIGRATIONS_APPLIED = 19, 19  # drizzle/migrations/*.sql, applied by CI
CONTRA_TOTAL, CONTRA_CLASSIFIED = 26, 26         # CONTRADICTIONS.md
CONTRA_UNRESOLVED, CONTRA_CRITICAL = 0, 0        # CONTRADICTIONS.md
AUTHORITY_TOTAL, AUTHORITY_RESOLVED = 32, 24     # AUTHORITY_MAP_V2_ATTACK.md
ENFORCEMENT_EXECUTED = True                      # npm run gates && npm run gates:controls


# --------------------------------------------------------------------------------------------
# Reading the published table — neither side of D2's comparison is assumed
# --------------------------------------------------------------------------------------------
def read_published_classification(path: str = OS_DOC) -> dict[str, str]:
    """The class this study PUBLISHED for each candidate, parsed out of section B's table."""
    published = {}
    for line in open(path, encoding="utf-8"):
        if not line.lstrip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 7:
            continue
        m = re.fullmatch(r"\*{0,2}(RNL-\d\d)\*{0,2}", cells[0])
        if not m:
            continue
        cell = cells[6]
        if cell.startswith("**REPO-NATIVE LAW**"):
            cls = REPO
        elif cell.startswith("`DOMAIN LAW`"):
            cls = DOMAIN
        elif cell.startswith("`LOCAL PATTERN`"):
            cls = LOCAL
        else:
            sys.exit(f"score_v2: unparseable class for {m.group(1)}: {cell!r}")
        published[m.group(1)] = cls
    if not published:
        sys.exit("score_v2: no law rows parsed from section B")
    return published


def read_evidence(path: str = SUPPORT) -> dict[str, tuple[int, int, int, int]]:
    """domains / operational / failures / non-authoring, from the published support file."""
    doc = json.load(open(path, encoding="utf-8"))["laws"]
    return {k: (v["counts"]["domains"], v["counts"]["operational"],
                v["counts"]["failures"], v["counts"]["non_authoring_cases"])
            for k, v in doc.items()}


def recheck_domain_counts() -> None:
    """LAW_SUPPORT.json's domain column must equal what PROCESS_CORPUS.json says. RNL-01, applied
    to the study: a count that can be computed from the record is computed, not asserted."""
    doc = json.load(open(SUPPORT, encoding="utf-8"))["laws"]
    corpus = {c["id"]: c for c in json.load(open(CORPUS, encoding="utf-8"))}
    for law, v in doc.items():
        derived = {corpus[c]["domain"] for c in v["corpus_cases"] if c in corpus}
        missing = [c for c in v["corpus_cases"] if c not in corpus]
        if missing:
            sys.exit(f"score_v2: {law} cites cases absent from the corpus: {missing}")
        if len(derived) != v["counts"]["domains"]:
            sys.exit(f"score_v2: {law} domains published {v['counts']['domains']}, "
                     f"corpus gives {len(derived)}")
        if len(v["non_authoring_cases"]) != v["counts"]["non_authoring_cases"]:
            sys.exit(f"score_v2: {law} non-authoring count does not match its list")
        if len(v["operational_instances"]) != v["counts"]["operational"]:
            sys.exit(f"score_v2: {law} operational count does not match its list")
        if len(v["failures_explained"]) != v["counts"]["failures"]:
            sys.exit(f"score_v2: {law} failure count does not match its list")


def bar(ev) -> str:
    """The stated bar, applied to the evidence. SCORING_METHOD_V2.md section 2."""
    dom, op, fail, nonauth = ev
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
    return 2 * max(0.0, wins / (len(promoted) * len(other)) - 0.5)


def classification_agreement(cls: dict, ev: dict) -> float:
    """Cohen's kappa between the published classification and the bar's."""
    n = len(cls)
    truth = {k: bar(ev[k]) for k in cls}
    p_obs = sum(cls[k] == truth[k] for k in cls) / n
    classes = set(cls.values()) | set(truth.values())
    p_exp = sum((sum(v == c for v in cls.values()) / n) * (sum(v == c for v in truth.values()) / n)
                for c in classes)
    if p_exp == 1.0:
        return 0.0
    return max(0.0, (p_obs - p_exp) / (1 - p_exp))


def admissibility(cls: dict, ev: dict) -> float:
    doc = json.load(open(SUPPORT, encoding="utf-8"))["laws"]
    ok = sum(1 for k in cls
             if doc[k]["counts"]["corpus_cases"] >= 1 and doc[k]["counts"]["operational"] >= 1)
    return ok / len(cls)


def falsification_coverage(cls: dict) -> tuple[float, list[str]]:
    """A candidate counts only with all three of: a counterexample search with a recorded outcome,
    a stated failure condition, and a stated domain boundary."""
    doc = json.load(open(SUPPORT, encoding="utf-8"))["laws"]
    misses = []
    for k in cls:
        v = doc[k]
        has_search = len(v["counterexample_search"]) >= 1 and all(
            e["outcome"].strip() for e in v["counterexample_search"])
        has_failure_condition = len(v["failures_explained"]) >= 1
        has_boundary = bool(v["boundary"].strip())
        if not (has_search and has_failure_condition and has_boundary):
            misses.append(k)
    return (len(cls) - len(misses)) / len(cls), misses


def main() -> int:
    recheck_domain_counts()
    published = read_published_classification()
    ev = read_evidence()
    if set(published) != set(ev):
        sys.exit(f"score_v2: section B and LAW_SUPPORT.json disagree on the candidate set: "
                 f"{set(published) ^ set(ev)}")

    # D1
    d1a = 10 * min(1, (GOV_CLASSIFIED / GOV_POPULATION) / 0.95)
    lb, quoted = LB_IMPL + LB_RESEARCH, QUOTED_IMPL + QUOTED_RESEARCH
    d1b = 6 * (0.7 * (quoted / lb) + 0.3)
    d1c = 4 * (0.6 * (TESTS_EXECUTED / TESTS_PRESENT)
               + 0.4 * (MIGRATIONS_APPLIED / MIGRATIONS_PRESENT))
    d1 = d1a + d1b + d1c

    # D2
    sep = separation(published, ev)
    kappa = classification_agreement(published, ev)
    fals, fals_misses = falsification_coverage(published)
    adm = admissibility(published, ev)
    d2 = 20 * (0.35 * sep + 0.40 * kappa + 0.15 * fals + 0.10 * adm)

    # D3-D6
    d3 = 0.0 if CONTRA_CRITICAL else 15 * CONTRA_CLASSIFIED / CONTRA_TOTAL - 3 * CONTRA_UNRESOLVED
    d4 = 15 * AUTHORITY_RESOLVED / AUTHORITY_TOTAL
    d5 = 15 * fals
    doc = json.load(open(SUPPORT, encoding="utf-8"))["laws"]
    repo_wide_laws = [k for k, v in published.items() if v == REPO]
    grounded = [k for k in repo_wide_laws if doc[k]["counts"]["operational"] >= 2]
    ungrounded = sorted(set(repo_wide_laws) - set(grounded))
    d6 = 15 * len(grounded) / len(repo_wide_laws) if repo_wide_laws else 0.0
    if not ENFORCEMENT_EXECUTED:
        d6 = min(d6, 12.0)

    rows = [("D1  corpus coverage (split)", d1, 20),
            ("     D1a governance", d1a, 10),
            ("     D1b implementation evidence", d1b, 6),
            ("     D1c support evidence", d1c, 4),
            ("D2  classification quality", d2, 20),
            ("D3  contradiction resolution", d3, 15),
            ("D4  authority resolution", d4, 15),
            ("D5  falsifiability", d5, 15),
            ("D6  operational grounding", d6, 15)]
    print(f"{'dimension':<38}{'score':>8}{'max':>6}")
    for n, v, m in rows:
        print(f"{n:<38}{v:>8.3f}{m:>6}")
    total = d1 + d2 + d3 + d4 + d5 + d6
    print(f"{'TOTAL':<38}{total:>8.3f}{100:>6}")
    print(f"\nSTUDY v2 SCORE = {total:.2f} / 100     (v1 published 97.78)")
    print(f"threshold >95: {'MET' if total > 95 else 'NOT MET'}")

    disagreements = [k for k in published if published[k] != bar(ev[k])]
    print("\nD2 inputs, both sides read rather than assumed:")
    print(f"  published classification   read from section B: "
          f"{sum(v == REPO for v in published.values())} repo-wide, "
          f"{sum(v == DOMAIN for v in published.values())} domain, "
          f"{sum(v == LOCAL for v in published.values())} local")
    print(f"  the bar applied to evidence: "
          f"{sum(bar(v) == REPO for v in ev.values())} repo-wide, "
          f"{sum(bar(v) == DOMAIN for v in ev.values())} domain, "
          f"{sum(bar(v) == LOCAL for v in ev.values())} local")
    print(f"  candidates where they DISAGREE: {len(disagreements)} {disagreements}")
    print(f"  separation (AUC-based)           {sep:.3f}")
    print(f"  classification agreement (kappa) {kappa:.3f}")
    print(f"  falsification coverage           {fals:.4f}  misses: {fals_misses}")
    print(f"  admissibility                    {adm:.3f}")

    print("\nother inputs, each measured elsewhere in this study:")
    print(f"  governance classified            {GOV_CLASSIFIED}/{GOV_POPULATION}")
    print(f"  load-bearing impl+research code  {lb}, of which QUOTED {quoted}  ({quoted/lb*100:.1f}%)")
    print(f"  tests executed                   {TESTS_EXECUTED}/{TESTS_PRESENT}"
          f"  ({TESTS_EXECUTED/TESTS_PRESENT*100:.1f}%)")
    print(f"  migrations applied in CI         {MIGRATIONS_APPLIED}/{MIGRATIONS_PRESENT}")
    print(f"  contradictions classified        {CONTRA_CLASSIFIED}/{CONTRA_TOTAL}, "
          f"{CONTRA_UNRESOLVED} unresolved, {CONTRA_CRITICAL} critical")
    print(f"  authority questions resolved     {AUTHORITY_RESOLVED}/{AUTHORITY_TOTAL}")
    print(f"  repo-wide laws grounded          {len(grounded)}/{len(repo_wide_laws)}"
          f"{' ungrounded: ' + str(ungrounded) if ungrounded else ''}, "
          f"enforcement executed: {ENFORCEMENT_EXECUTED}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
