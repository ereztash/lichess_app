# HARDENING HYPOTHESIS — written before implementation

**Branch:** `pre-consolidation/coherence-hardening`
**Base:** `main` at `6f5577ff5fd785e9d67415bf9a3ed5868b7aaf18` (the merge of PR #63)
**Written:** before the first line of hardening code, and not revised after seeing any result.

---

## The hypothesis

> The repository's own locally proven mechanisms — the two-mode gate contract, `register-scan`'s
> claim-against-tree reconciliation, `gradeFromRecord`'s derive-before-deciding, and the refusal
> idiom of `require_seal()` and `browser.ts` — can be **generalized** to reduce cross-artifact
> reconciliation burden **without** damaging scientific provenance or changing product semantics.

## The falsifier

> After applying those mechanisms, **authority ambiguity, reconciliation gaps, runtime uncertainty,
> stale derived state, or unverifiable blocking checks do not materially decrease** — or scientific
> provenance is damaged.

Either half falsifies it. The second half is the more serious: a hardening that raises the
benchmark by rewriting history has failed even if every number improves.

## What would make a score increase inadmissible

Stated here so it cannot be rationalised later. A rise in the Study v2 score is **invalid** if it
comes from any of:

1. a denominator that shrank — `D4`'s 36 questions, `D1b`'s 204 files, `D5`'s 18 candidates,
   `D3`'s 26 contradictions;
2. an `UNKNOWN` or an unresolved row that disappeared because the **question** was removed rather
   than answered;
3. a markdown file created to be "the authority" for a capability that does not exist;
4. an `L6` test whose claim is wider than what it touched;
5. a reconciliation scanner that whitelists `X-02` and `X-16` instead of detecting their class;
6. a derivation that changed product semantics rather than removing a duplicate authority;
7. a positive control that goes red for a reason unrelated to the mechanism it claims to prove;
8. any edit to a scientific verdict, population, protocol, preregistration or historical result.

## What this mission may not do

The scoring methodology is **frozen**. Formula, weights, categories, thresholds, evidence
strengths, minimum domain counts and denominator definitions are all fixed at the Study v2 state
merged in `6f5577f`. If a genuine benchmark defect is found during this mission, the mission
**stops** and documents it separately: repairing instrument and subject in the same pass destroys
the comparison, which is the whole point of freezing the baseline.

## The measurement that decides it

`90.73 / 100` is the frozen baseline. The same programs, unchanged, are run again at the end:

```
python3 docs/consolidation-research/score_v2.py
python3 docs/consolidation-research/wes_v2.py
```

**A lower but honest result is a better outcome than a higher one produced by shrinking a
denominator.** Study v2 earned its standing by publishing a number that fell. This mission is held
to the same rule.
