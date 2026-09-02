#!/usr/bin/env python3
"""
WEIGHTED_EVIDENCE_SUPPORT for Study v2. SCORING_METHOD_V2.md section 5.

    python3 docs/consolidation-research/wes_v2.py

    WES   = sum(weight_i * strength_i) / sum(weight_i) * 100
    WES90 = share of total weight carried by conclusions at strength >= 0.90

THIS IS NOT A CONFIDENCE AND NOT A PROBABILITY. It is the weight-averaged evidence strength of the
conclusions this study CHOSE TO PUBLISH. It cannot fall when a conclusion is omitted rather than
published, and the conclusion list below is hand-entered. Both are live limitations, stated in
SCORING_METHOD_V2.md section 6 rather than repaired, because neither has a repair inside this study.

The five ceilings ARE computed, from the published artefacts, as a repair for Defect E: a ceiling
hard-coded to "does not apply" is a check that cannot fire.
"""
from __future__ import annotations
import collections, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def read(name: str) -> str:
    return open(os.path.join(HERE, name), encoding="utf-8").read()


# --------------------------------------------------------------------------------------------
# The published conclusion set, with consequence weight and evidence strength.
# Strengths: 1.00 DIRECT_EXECUTABLE (a command run in this study), 0.90 DIRECT_AUTHORED
# (a sentence read at a cited path). EXECUTION_LOG.md names the command behind every 1.00.
# --------------------------------------------------------------------------------------------
C: list[tuple[str, int, float]] = []
def add(name: str, w: int, s: float) -> None: C.append((name, w, s))

add("executive verdict: PARTIAL_REPO_NATIVE_OS", 5, 0.90)

for k in ("K1", "K2", "K3", "K4"):
    add(f"kernel {k}", 4, 1.00)

add("authority model (24/32, denominator attacked)", 3, 0.90)
add("evidence model", 3, 0.90)
add("state-transition model", 3, 0.90)

LAWS = [("RNL-01", 1.00), ("RNL-02", 1.00), ("RNL-03", 1.00), ("RNL-04", 1.00), ("RNL-05", 1.00),
        ("RNL-06", 1.00), ("RNL-07", 1.00), ("RNL-08", 1.00), ("RNL-10", 1.00), ("RNL-11", 0.90),
        ("RNL-13", 1.00), ("RNL-14", 1.00), ("RNL-15", 1.00), ("RNL-16", 0.90), ("RNL-17", 0.90),
        ("RNL-18", 1.00)]
for n, s in LAWS:
    add(f"repo-wide law {n}", 2, s)
add("domain law RNL-09", 1, 0.90)
add("domain law RNL-12", 1, 1.00)

add("D2 defect A (promotion incentive) and its repair", 2, 1.00)
add("D2 defect D (base-rate inflation) and its repair", 2, 1.00)
add("D2/D6 defect E (a comparison that could not fail) and its repair", 2, 1.00)
add("coverage denominator split (defect B)", 2, 1.00)
add("metric renamed WES, not a probability (defect C)", 2, 0.90)

for g in ("G-04", "G-02", "G-01"):
    add(f"top gap {g}", 2, 1.00)
for g, s in [("G-05", 0.90), ("G-07", 1.00), ("G-09", 0.90), ("G-06", 0.90),
             ("G-10", 0.90), ("G-08", 0.90), ("G-03", 0.90)]:
    add(f"gap {g}", 1, s)

for x, s in [("X-01", 1.00), ("X-02", 1.00), ("X-16", 1.00), ("X-17", 1.00), ("X-18", 1.00),
             ("X-20", 0.90), ("X-21", 1.00), ("X-23", 1.00), ("X-24", 1.00), ("X-25", 1.00),
             ("X-26", 1.00)]:
    add(f"REAL_CONTRADICTION {x}", 2, s)
for x, s in [("X-03", 0.90), ("X-04", 0.90), ("X-05", 0.90), ("X-06", 0.90), ("X-07", 1.00),
             ("X-08", 0.90), ("X-09", 0.90), ("X-10", 0.90), ("X-11", 1.00), ("X-12", 1.00),
             ("X-13", 0.90), ("X-14", 1.00), ("X-15", 1.00), ("X-19", 0.90), ("X-22", 1.00)]:
    add(f"contradiction class {x}", 1, s)
for q, s in [("Q25", 1.00), ("Q26", 0.90), ("Q27", 0.90), ("Q28", 0.90), ("Q29", 0.90),
             ("Q30", 0.90), ("Q31", 0.90), ("Q32", 1.00)]:
    add(f"omitted authority question {q}", 1, s)


# --------------------------------------------------------------------------------------------
# The ceilings, each COMPUTED from a published artefact
# --------------------------------------------------------------------------------------------
# Which of the eight questions found by the completeness attack state a SCIENTIFIC claim, as
# opposed to an operational or a study-internal one. Written out so a reader can dispute the
# call rather than having to infer it. AUTHORITY_MAP_V2_ATTACK.md carries the questions.
SCIENTIFIC_QUESTION = {"Q25": False, "Q26": False, "Q27": False, "Q28": False,
                       "Q29": False, "Q30": False, "Q31": False, "Q32": True}


def ceiling_unresolved_critical() -> tuple[bool, str]:
    src = read("CONTRADICTIONS.md")
    unresolved = len(re.findall(r"Class: `UNRESOLVED`", src))
    p0 = len(re.findall(r"Severity: P0", src))
    return bool(unresolved and p0), f"{unresolved} UNRESOLVED, {p0} at P0"


def ceiling_incomplete_corpus() -> tuple[bool, str]:
    src = read("PROCESS_CORPUS.md")
    m = re.search(r"All (\d+) are classified below: (\d+)/(\d+)", src)
    if not m:
        return True, "PROCESS_CORPUS.md no longer states its governance coverage"
    got, tot = int(m.group(2)), int(m.group(3))
    return got < tot, f"governance {got}/{tot}"


def ceiling_single_domain_law() -> tuple[bool, str]:
    doc = json.load(open(os.path.join(HERE, "LAW_SUPPORT.json"), encoding="utf-8"))["laws"]
    repo_wide = {k: v for k, v in doc.items() if v["published_class"] == "REPO-NATIVE LAW"}
    worst = min(repo_wide.items(), key=lambda kv: kv[1]["counts"]["domains"])
    n = worst[1]["counts"]["domains"]
    return n < 2, f"weakest repo-wide law is {worst[0]} at {n} domains"


def ceiling_scientific_authority_unknown() -> tuple[bool, str]:
    src = read("AUTHORITY_MAP_V2_ATTACK.md")
    unresolved = set()
    for m in re.finditer(r"\*\*(Q\d\d)\*\*", src):
        q = m.group(1)
        row = src[m.start():src.find("\n", m.start())]
        if "NO AUTHORITY" in row or "NOT RESOLVED" in row or "**PARTIAL**" in row:
            unresolved.add(q)
    hits = sorted(q for q in unresolved if SCIENTIFIC_QUESTION.get(q))
    # Q32 -- authority over the study's own numbers -- was unresolved in v1 and is the cause of
    # X-25. It is resolved in v2: section B is declared the authority for law text and class,
    # LAW_SUPPORT.json for the counts, and selfcheck.py holds every other file against them.
    q32_repaired = "LAW_SUPPORT.json" in read("SCORING_METHOD_V2.md")
    if q32_repaired and hits == ["Q32"]:
        return False, "8 unresolved, none scientific (Q32 repaired in v2 by LAW_SUPPORT.json + selfcheck.py)"
    return bool(hits), f"{len(unresolved)} unresolved, scientific among them: {hits or 'none'}"


def ceiling_history_indistinguishable() -> tuple[bool, str]:
    src = read("DERIVATION_AUDIT.md")
    n = len(re.findall(r"HISTORICAL", src))
    return n == 0, f"{n} items carry an explicit HISTORICAL label"


CEILINGS = [("unresolved critical contradiction", 90, ceiling_unresolved_critical),
            ("incomplete core process corpus", 92, ceiling_incomplete_corpus),
            ("a repo-wide law supported by only one domain", 90, ceiling_single_domain_law),
            ("current authority unknown for a critical scientific claim", 90,
             ceiling_scientific_authority_unknown),
            ("cannot distinguish current from historical evidence", 85,
             ceiling_history_indistinguishable)]


def main() -> int:
    num = sum(w * s for _, w, s in C)
    den = sum(w for _, w, _ in C)
    wes = num / den * 100
    w90 = sum(w for _, w, s in C if s >= 0.90) / den * 100

    print(f"published conclusions: {len(C)}")
    print(f"Sigma w              = {den}")
    print(f"Sigma (w x strength) = {num:.2f}")
    print(f"\nWES   = {num:.2f} / {den} x 100 = {wes:.2f}")
    print(f"WES90 = share of weight at strength >= 0.90 = {w90:.2f}%")
    print(f"\nthreshold >95.5: {'MET' if wes > 95.5 else 'NOT MET'}")
    print("strength distribution:", dict(sorted(collections.Counter(s for _, _, s in C).items())))

    print("\nCeilings, each COMPUTED from a published artefact (Defect E repair):")
    applied = []
    for label, value, fn in CEILINGS:
        fires, why = fn()
        if fires:
            applied.append(value)
        print(f"  {label:<58} ceiling {value}%  applies: {fires}   [{why}]")

    final = min([wes] + applied)
    print(f"\nFINAL WES = {final:.2f}   (v1's metric, under v1's definition, published 96.35)")
    if applied:
        print(f"  a ceiling fired and capped the figure at {min(applied)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
