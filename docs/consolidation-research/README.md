# `docs/consolidation-research/`

An in-house process-mining study of this repository, run **before** any consolidation. It moves,
renames, deletes and merges nothing. It produces knowledge and a proposed operating model.

**Start here:** [`REPO_NATIVE_OPERATING_SYSTEM.md`](REPO_NATIVE_OPERATING_SYSTEM.md).

| file | what it is |
| --- | --- |
| [`REPO_NATIVE_OPERATING_SYSTEM.md`](REPO_NATIVE_OPERATING_SYSTEM.md) | **the result.** Verdict, kernel, primitives, transition model, authority model, evidence model, what to propagate, what not to touch, score, confidence |
| [`BASELINE.md`](BASELINE.md) | the repository state this study was run against. Immutable except by dated amendment; one amendment exists |
| [`PROCESS_CORPUS.md`](PROCESS_CORPUS.md) · [`.json`](PROCESS_CORPUS.json) | 48 cases across 12 domains, plus the classification of all 169 governing files. The JSON is authoritative |
| [`CONTRADICTIONS.md`](CONTRADICTIONS.md) | 16 apparent conflicts, each classified with direct evidence. 0 unresolved, 0 critical |
| [`AUTHORITY_MAP.md`](AUTHORITY_MAP.md) | 24 critical questions, their current authority, lineage, competitors, and whether a command decides them |
| [`DERIVATION_AUDIT.md`](DERIVATION_AUDIT.md) | 41 pieces of state, classified derived / declared-and-verified / declared-unverified / historical |
| [`EVIDENCE_MODEL.md`](EVIDENCE_MODEL.md) | are the six ladders one schema or several dimensions? Tested pairwise |
| [`LOCAL_SOLUTION_GAPS.md`](LOCAL_SOLUTION_GAPS.md) | where a strong solution exists in one place and a weaker variant survives elsewhere, ranked by a formula defined before use |
| [`EXTERNAL_CROSSWALK.md`](EXTERNAL_CROSSWALK.md) | SLSA, OpenSSF, OpenGitOps, ISO 25010, ACM badging, W3C PROV/RO-Crate, ADR/arc42, fitness functions — read **after** the internal model, as adversary and gap-detector |
| [`SCORING_METHOD.md`](SCORING_METHOD.md) | the formulas, written before the numbers and not revised after |
| [`ADVERSARIAL_REVIEW.md`](ADVERSARIAL_REVIEW.md) | eleven attacks on the model. It downgraded five things and upgraded nothing |
| [`EXECUTION_LOG.md`](EXECUTION_LOG.md) | every command run, and which conclusion each one upgraded from *authored* to *executable* evidence |

## The answer in four lines

**`STRONG_REPO_NATIVE_OS`.** Four kernel rules, sixteen repo-native laws, two domain laws.

**Score 97.78 / 100. Confidence 96.35 %.**

The evidence that decides it is not prose: **28 gates green and 28 controls red**, a **derivation
scan** whose numbers have already outrun the document describing it, an **adoption curve** (7/29 →
14/14) showing the discipline was learned at a datable point, and **both B3 verdicts reproducing
exactly** in a fresh session from the committed analyses.

**Consolidation under this model is not a merge.** `L5` (one authority per *question*) and `L10`
(failed history is provenance) are two halves of one rule, and reading either without the other
destroys what this repository is good at.
