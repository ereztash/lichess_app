# Pre-release Gap Audit — research contract

## Purpose

The audit exists to answer one question before distribution:

> **What decision-relevant gaps still exist in this exact candidate, how critical is each one, and what exactly would have to become true to close it?**

It is not a product review, a praise/critique document, or a single maturity score.

## Unit of analysis

A **gap** is not “something that could be improved.” It is a falsifiable mismatch between the intended distribution state and evidence available for the current candidate.

Every reported gap must name:

1. **Problem** — the observable failure or missing evidence, stated narrowly.
2. **Layer** — the orthogonal domain that owns the gap.
3. **Criticality** — consequence/urgency, independent of the score.
4. **Evidence status** — where authority for the claim comes from and how current it is.
5. **Mechanism/context** — why the gap can occur or why the evidence is insufficient.
6. **Closure condition** — the cheapest falsifiable condition that would close the gap.
7. **Disposition** — what the distribution decision should do with it.

A sentence such as “UX needs work” is invalid. A sentence such as “no screen-reader walkthrough has established that the decision→reveal→next-decision path is usable even though axe is green” is valid.

## State law — what counts as a current gap

The debt register contains history as well as current work. The audit must not collapse them.

- `open`, `blocked`, `half fixed`, `partial`, `field required` → may be active gaps and may affect scores.
- `refuted`, `fixed`, `closed` → **historical evidence, not gaps**; excluded from scoring.
- `measured and deferred`, `deferred`, `deliberately governed` → **watch items**; remain visible but have zero score effect until a new failure condition reopens them.

A refuted hypothesis is an evidence asset. Penalising readiness for having disproved it would reward repositories that never test their own claims.

## Orthogonal score layers

The Action keeps these separate; it deliberately emits **no global composite**:

- `product-evidence`
- `ux-accessibility`
- `correctness`
- `release-integrity`
- `operations`
- `security-privacy`
- `maintainability`
- `research-validity`

A P1 in one layer cannot be compensated for by a clean result in another.

## Criticality

- **P0** — credible release-stopper: corruption, severe security/privacy failure, or core path fundamentally broken.
- **P1** — blocks broad distribution or invalidates a core evidence/release-integrity claim.
- **P2** — real bounded risk; controlled trial may proceed with the gap explicit.
- **P3** — hygiene/opportunity; does not justify delaying distribution by itself.

Criticality outranks score.

## Evidence authority

The audit separates these states because they must not be treated as equivalent:

- `verified-now` — measured by the current GitHub Action or a live external authority during this run.
- `repo-verified` — supported by evidence in the repository but not re-measured externally now.
- `field-required` — cannot be settled by more internal reasoning; human/prospective evidence is the authority.
- `external-unverified` — truth lives outside the repository and was not successfully re-read now.
- `asserted` — documented claim without stronger current verification.

Static repository text must not override a current external authority. `R-21` is the canonical example: branch/release protection is checked from GitHub Rulesets live rather than trusted from the debt register.

## Scores

The score is **gap pressure**, not a maturity/readiness percentage.

Each layer starts at `0` and rises with evidence-weighted active gaps:

- P0: +45
- P1: +25
- P2: +10
- P3: +4

Evidence multipliers prevent stale/asserted debt from receiving the same authority as a failure reproduced in this run.

Interpretation:

- `0` means **no decision-relevant gap was detected in that layer under the evidence available to this audit**.
- It does **not** mean “100% ready”, “perfect”, or “fully covered”.
- Higher scores mean more/severer identified gap pressure.

Each gap also receives a `priority_score` for ordering only. It never overrides criticality or evidence status.

## Distribution targets

The workflow supports two targets:

- `controlled-trial` — only verified P0 gaps block automatically.
- `broad-public` — verified P0/P1 gaps block; P1 field gaps therefore require field evidence before scale.

An `external-unverified` P1 is surfaced as `VERIFY_EXTERNAL_AUTHORITY` rather than silently treated as current truth.

## Sources used by the Action

1. The exact candidate revision checked out by GitHub Actions.
2. Typecheck, production build, full test suite, gates, positive controls, and bundle budget run on that candidate.
3. `docs/MASTER_PRODUCT_DEBT.md`, with state and evidence authority classified rather than trusted blindly.
4. Explicit current claim boundaries in `README.md`, including human-field and screen-reader evidence gaps.
5. GitHub Rulesets API for current release-integrity state.

## External authority rule

If current truth lives outside the tree, one of two things must happen:

1. the Action reads the live authority and records `verified-now`; or
2. it records `external-unverified` and asks for re-verification.

A static document is never allowed to overrule newer live state merely because it is versioned.

## Stop rule

The audit should stop generating internal work when the remaining decision-changing uncertainty is owned by `field-required` or an external authority. More tests are not a valid substitute for evidence that only a person, deployment, or external configuration can produce.

## Output

Every run deposits:

- `artifacts/pre-release-audit.json` — machine-readable evidence and decisions.
- `artifacts/pre-release-audit.md` — human-readable scorecard in the job summary.

The intended chain is:

`finding → state class → evidence authority → precise problem → criticality → gap-pressure score → disposition → closure condition`
