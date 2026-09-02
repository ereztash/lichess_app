# `docs/consolidation-research/`

An in-house process-mining study of this repository, run **before** any consolidation. It moves,
renames, deletes and merges nothing. It produces knowledge and a proposed operating model.

> ### THE SCORES HERE EVALUATE THE RECONSTRUCTION STUDY.
> ### THEY ARE NOT A SCORE OF THE APPLICATION.
>
> They say how well this repository's operating system was *reconstructed*. Nothing here says the
> product is production-ready, the science is valid, or consolidation is safe.
> [`SCORING_METHOD_V2.md`](SCORING_METHOD_V2.md) §7 lists what is knowingly outside them.

**Start here:** [`REPO_NATIVE_OPERATING_SYSTEM.md`](REPO_NATIVE_OPERATING_SYSTEM.md).
**Then read why the numbers moved:** [`AMENDMENT_CHAIN.md`](AMENDMENT_CHAIN.md).

## The answer in five lines

**`PARTIAL_REPO_NATIVE_OS`.** Four kernel rules, sixteen repo-native laws, two domain laws.

**Study v2 score 91.82 / 100 — target > 95 NOT MET.**
**Weighted evidence support 96.52, `WES₉₀` 100.00 % — target > 95.5 MET.**

Study v1 published `97.78`, `96.35 %` and `STRONG_REPO_NATIVE_OS`. A second pass whose job was to
falsify it found **six methodological defects and ten new contradictions**, eight of the ten inside
the study's own artefacts. All of v1 is preserved; none of it is overwritten.

The evidence that still stands is not prose: **28 gates green and 28 controls red**, a **derivation
scan** whose numbers have already outrun the document describing it, an **adoption curve** (7/29 →
14/14) showing the discipline was learned at a datable point, and **both B3 verdicts reproducing
exactly** in a fresh session from the committed analyses.

What makes it `PARTIAL` rather than `STRONG`: **four critical questions with no authority at all**
— rollback, observability, retention, supported runtimes, the whole operational surface — and a
study that quoted **16 of 85** load-bearing implementation files.

**Consolidation under this model is not a merge.** `RNL-05` (one authority per *question*) and
`RNL-10` (failed history is provenance) are two halves of one rule, and reading either without the
other destroys what this repository is good at.

## The files

### The result

| file | what it is |
| --- | --- |
| [`REPO_NATIVE_OPERATING_SYSTEM.md`](REPO_NATIVE_OPERATING_SYSTEM.md) | **the result.** Verdict, kernel, primitives, transition model, authority model, evidence model, what to propagate, what not to touch, score, evidence support |
| [`AMENDMENT_CHAIN.md`](AMENDMENT_CHAIN.md) | **why the numbers moved.** v1 → v2: the six defects, the changed formulas, the changed classifications, the corrected result |

### The evidence

| file | what it is |
| --- | --- |
| [`BASELINE.md`](BASELINE.md) | the repository state this study was run against. Immutable except by dated amendment; one amendment exists |
| [`PROCESS_CORPUS.md`](PROCESS_CORPUS.md) · [`.json`](PROCESS_CORPUS.json) | 48 cases across 12 domains, plus the classification of all 169 governing files. The JSON is authoritative |
| [`LAW_SUPPORT.json`](LAW_SUPPORT.json) | the law → case, law → enforcement and law → failure mapping behind §B's table. Published in v2 so the counts can be audited rather than believed |
| [`CONTRADICTIONS.md`](CONTRADICTIONS.md) | 26 conflicts, each classified with direct evidence. 0 unresolved, 0 critical. `X-17`…`X-26` are the study's own |
| [`AUTHORITY_MAP.md`](AUTHORITY_MAP.md) | v1's 24 critical questions, their current authority, lineage, competitors, and whether a command decides them. **Preserved unchanged** |
| [`AUTHORITY_MAP_V2_ATTACK.md`](AUTHORITY_MAP_V2_ATTACK.md) | the completeness attack on that denominator. Eight omitted questions, four with no authority at all. **24 / 32, not 24 / 24** |
| [`DERIVATION_AUDIT.md`](DERIVATION_AUDIT.md) | 41 pieces of state, classified derived / declared-and-verified / declared-unverified / historical |
| [`EVIDENCE_MODEL.md`](EVIDENCE_MODEL.md) | are the six ladders one schema or several dimensions? Tested pairwise |
| [`LOCAL_SOLUTION_GAPS.md`](LOCAL_SOLUTION_GAPS.md) | where a strong solution exists in one place and a weaker variant survives elsewhere, ranked by a formula defined before use |
| [`EXTERNAL_CROSSWALK.md`](EXTERNAL_CROSSWALK.md) | SLSA, OpenSSF, OpenGitOps, ISO 25010, ACM badging, W3C PROV/RO-Crate, ADR/arc42, fitness functions — read **after** the internal model, as adversary and gap-detector |
| [`ADVERSARIAL_REVIEW.md`](ADVERSARIAL_REVIEW.md) | eleven attacks on the model. It downgraded five things and upgraded nothing |
| [`EXECUTION_LOG.md`](EXECUTION_LOG.md) | every command run, and which conclusion each one upgraded from *authored* to *executable* evidence |

### The method, and the programs that check it

| file | what it is |
| --- | --- |
| [`SCORING_METHOD.md`](SCORING_METHOD.md) | v1's formulas. **Preserved unchanged**, including the ones that were wrong |
| [`SCORING_METHOD_V2.md`](SCORING_METHOD_V2.md) | **the authority for the formulas.** Written before the v2 numbers; §0 records all six defects with the old formula intact |
| [`score_v2.py`](score_v2.py) | computes the score, reading its inputs out of the published artefacts. Prints the disagreement between the published classification and the bar, which is a measurement and not an assumption |
| [`wes_v2.py`](wes_v2.py) | computes `WES` and `WES₉₀`, with all five ceilings evaluated from published artefacts |
| [`scoring_selftest.py`](scoring_selftest.py) | `D2`'s controls. Five classification strategies over one evidence table; the correct one must win and the degenerate ones must score below half marks. **7 / 7** |
| [`selfcheck.py`](selfcheck.py) | eleven predicates holding every study file against `REPO_NATIVE_OPERATING_SYSTEM.md` §B, plus a fixture with six injected drifts that must all go red. **11 / 11 and 6 / 6** |

```
python3 docs/consolidation-research/selfcheck.py
python3 docs/consolidation-research/selfcheck.py --positive-controls
python3 docs/consolidation-research/scoring_selftest.py
python3 docs/consolidation-research/score_v2.py
python3 docs/consolidation-research/wes_v2.py
```
