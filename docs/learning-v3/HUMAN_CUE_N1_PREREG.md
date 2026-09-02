# P4 — N-of-1 human cue transfer preregistration

Status: FROZEN BEFORE CUE EXTRACTION OR ITEM SELECTION

## Authority entering P4

P3 licensed only this claim: a rule-agnostic relational/system representation carries transferable information about move quality among already-valid actions. P3 did **not** establish human recognizability, teaching efficacy, homeostasis, controllability, or uncued natural transfer.

## Goal

Test whether one system-derived relation can be compressed into a short, board-observable cue that one human player can learn from prototypes and then use to improve choices on unseen positions **without the cue being shown at decision time**.

This is an N-of-1 pilot. It can establish within-participant evidence only; it cannot establish population efficacy.

## Frozen concept-extraction rule

Source data: the same committed RC-07/08/09 move-level corpus used by P3. No new engine search.

1. Refit the frozen P3 M2 Ridge model in three leave-one-rule-class-out folds.
2. Consider only P3 SYSTEM features; local move geometry is excluded from cue selection.
3. A feature is eligible only if its standardized Ridge coefficient has the same non-zero sign in all three folds.
4. Select the eligible feature with the largest median absolute standardized coefficient across the three folds. Ties break lexicographically by feature name.
5. The sign fixes direction: positive coefficient means lower is preferred (higher predicts more regret); negative means higher is preferred.
6. Translate only the selected feature into plain Hebrew using its literal board-observable meaning. No second feature may be added after seeing results.

## Frozen item eligibility

Only natural positive RC-07/08/09 items with at least two already-valid B moves and preserved move-level expected-score evaluations are eligible.

For a pair of B moves in the same position:
- the better move is the one with lower preserved regret;
- require absolute regret gap >= 0.10 expected score;
- TARGET item: selected cue feature differs between the two moves and the frozen cue direction ranks the lower-regret move correctly;
- CONTROL item: selected cue feature is exactly equal between the two moves despite regret gap >= 0.10.

Within a position choose the eligible move pair with the largest regret gap; ties break by UCI tuple.

## Frozen bank construction

Seed: `20260902`.

Construct:
- baseline: 8 TARGET + 4 CONTROL;
- teaching: 4 TARGET prototypes;
- test: 8 TARGET + 4 CONTROL.

No position may appear in more than one phase. Sample as evenly across RC-07/08/09 as availability permits. Option A/B order is randomized by the frozen seed. Test positions and answers remain hidden until baseline responses are committed.

Baseline and test items show only the board, side to move, and the two legal candidate moves. They do **not** display cue language, feature values, engine values, rule class, or correctness.

Teaching shows the cue and four prototypes with the better continuation and a literal explanation of the selected relation. No test position is used for teaching.

## Human endpoint

Primary endpoint: TARGET accuracy, test minus baseline.

Specificity endpoint: CONTROL accuracy, test minus baseline. A generic improvement or cue over-application should not be mistaken for concept-specific learning.

Timing endpoint: median decision time on TARGET items, test versus baseline. Faster is supportive but not required.

## Frozen decision rule

`P4-N1-PASS` requires all of:
1. test TARGET accuracy >= baseline TARGET accuracy + 0.25;
2. test TARGET accuracy >= 0.75;
3. CONTROL accuracy does not fall by more than 0.25;
4. at least 6/8 test TARGET responses are present and interpretable;
5. no cue text or correctness was exposed before baseline submission.

`P4-N1-PARTIAL` if TARGET improves but any PASS condition fails.

`P4-N1-FAIL` if TARGET accuracy does not improve.

The thresholds are operational pilot thresholds, not population effect-size claims.

## Falsifiers / guards

- If no SYSTEM feature has stable sign in 3/3 LOCO folds: STOP — no cue is licensed.
- If fewer than 20 eligible TARGET positions exist after freeze: STOP — do not weaken eligibility post hoc.
- If fewer than 8 eligible CONTROL positions exist: continue TARGET test but specificity is `NOT IDENTIFIED`; PASS is impossible.
- If item generation requires new Stockfish search: STOP.
- Model/signal extraction from AI is not human recognizability. Only the participant responses can decide P4.

## Does not establish

Even a PASS does not establish population generalization, real-game transfer, long-term retention, homeostasis, controllability, or superiority to engine analysis. A later natural-game uncued retest is still required.