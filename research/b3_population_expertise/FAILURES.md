# B3 -- what went wrong, in the order it was found

A study that only records what worked is not reproducible, and a defect that is repaired without a
note is a defect that will be reintroduced. Everything here was found and fixed **before** any B3
scientific quantity existed, unless the entry says otherwise.

---

## F1. The SAN tokenizer described SAN instead of subtracting everything else

**Found:** implementation smoke test, before Gate 1 closed.
**Symptom:** a hand-written regex meant to match SAN moves matched `Nf3`, `exd5` and `O-O` and
silently dropped every plain pawn push (`e4`, `d5`).
**Why it mattered:** it would not have failed. It would have shifted every ply index in the corpus,
so every clock difference would have been attributed to the wrong move, and nothing downstream
would have complained.
**Fix:** the tokenizer is now subtractive -- strip comments, move numbers, NAGs and the result
token; whatever is left is a move, and `parse_san` is the arbiter.

## F2. 10.7% of sampled sides were dropped, and not at random

**Found:** implementation smoke test, before Gate 1 closed.
**Symptom:** `parse_san` rejected `h5?`, `Bf2?!`, `Rb1?`. Games that somebody had run Lichess's
computer analysis on carry `?`/`?!`/`!` suffixes in the dump. 624 of 5,827 sampled sides failed to
parse and were excluded as "abandoned mid-parse".
**Why it mattered:** "somebody requested an analysis of this game" is not independent of the game.
A 10.7% exclusion correlated with the outcome is a selection effect, not a parsing inconvenience.
**Fix:** annotation suffixes are stripped in the tokenizer. The exclusion count is now near zero
and is still reported.

## F3. `voc_rank` ran off its own scale

**Found:** inspecting the smoke-test feature distributions.
**Symptom:** `1 - spearman(shallow, deep)` reached 4.75 on a scale whose maximum is 2.
**Cause:** ranks were taken from each move's position in its own full ordering. When the two
orderings differ in membership those positions are not a permutation of `0..n-1`, and the
sum-of-squared-differences formula was being applied outside its domain.
**Fix:** ranks are re-derived inside the common subset.

## F4. The ambiguity temperature was a round number, and it saturated

**Found:** inspecting the smoke-test feature distributions.
**Symptom:** at `tau = 0.10` win probability, `ambiguity_entropy` sat at `log(4) = 1.386` for about
half the corpus and `n_near` sat at 4. The median best-to-second gap is 0.013 win probability, so a
temperature of 0.10 makes every candidate set look uniform.
**Why it mattered:** a saturated feature is not a difficulty measure. T1 would have been weaker
than it should be, and `unexpected_time` would have absorbed difficulty that was measurable.
**Fix:** both constants are now `ACCURATE_WIN_PROBABILITY_LOSS` -- what 30 centipawns costs at a
level position. That constant existed before B3, was not chosen by looking at any B3 relationship,
and ties B3's ambiguity scale to B2's outcome definition.
**Disclosure:** this is a constant that changed after a development sample was looked at. It was
changed before Gate 1 closed, before any period was fully scored and before any relationship
between a feature and an outcome had been computed. It is recorded here so the change is visible
rather than inferable.

## F5. Reading the last iteration of a search as "the engine's opinion"

**Found:** implementation smoke test (a crash, which is the good case).
**Symptom:** `KeyError: 1` reading the post-move search.
**Cause:** a node limit stops a search inside an iteration, and the partial set it leaves sometimes
holds MultiPV lines 2..K without line 1.
**Why it mattered:** the crash was luck. The same bug reading `lines[2]` as the best line would
have understated the quality loss of exactly those moves, silently.
**Fix:** the pre-move search only counts iterations whose MultiPV set is full; the post-move search
takes the deepest iteration that actually carries line 1.

---

*Everything below was found after scoring had begun. Each entry says where in the study it was
caught and what it would have done had it not been.*

## F6. A helper defined below its first use, in a fifteen-minute code path

**Found:** DEVELOPMENT analysis, fifteen minutes into a run.
**Symptom:** `UnboundLocalError: cannot access local variable 'want'`.
**Cause:** the selector that decides which optional estimates a stage computes was defined after the
first branch that called it. Nothing in the smoke tests exercised a full stage.
**Why it mattered:** not scientifically -- it is a crash -- but it burned a full scoring pass, and
the same shape of defect one branch later would have silently skipped an estimate rather than
crashing.
**Fix:** hoisted, and `tests/test_pipeline_smoke.py` added: it runs the whole stage on a tiny
synthetic corpus so that every code path a real run takes is executed by the test suite.

## F7. The block bootstrap rebuilt its resample indices for every statistic

**Found:** profiling a DEVELOPMENT run that would not finish.
**Symptom:** about ninety intervals, each concatenating a few thousand per-player index arrays.
**Fix:** the 400 player draws are fixed at construction and the row indices they select are built
once. Identical numbers, two orders of magnitude less work.

## F8. A control was deleted along with the stale duplicates beside it

**Found:** the verdict engine's required-control check.
**Symptom:** C8 (single-player influence) absent from the emitted controls block.
**Cause:** an edit removing two stale duplicated C6/C7 blocks took the C8 block with them.
**Why it mattered:** a missing control does not announce itself. The verdict engine would have read
a control set that was silently one short.
**Fix:** C8 restored, and a test added that asserts every control named in `REQUIRED_CONTROLS` is
present in the emitted block for every period. `evaluate.py` now refuses a malformed control set
rather than scoring around it.

## F9. Five destructive controls "failed" on VALIDATION, and the estimator was not the cause

**Found:** VALIDATION analysis.
**Symptom:** five permutation controls returned intervals excluding zero at once.
**Cause:** the controls drew **one** permutation and put a player-block bootstrap interval around
it. An interval around a single draw is an interval around that draw's own realised value, not
around the null.
**Why it mattered:** it is the failure mode that makes a study conclude its own pipeline is broken
and start adjusting the science. The estimator was ruled out first, by construction, before any
change was made.
**Fix:** every destructive control is now 200 permutations, and the reported interval is the
2.5/97.5 percentile **across** permutations, with the Monte-Carlo standard error and the distance
from zero in null standard deviations printed beside it.

## F10. The C3 null carried a deterministic term from the freeze

**Found:** Gate 3, after the holdout was opened; the mechanical verdict was `INVALID_EXPERIMENT`
because of it.
**Symptom:** C3's Metric A null excluded zero on FINAL only, at 2.5 null standard deviations.
**Cause:** the permuted regressor was formed as `perm_rating - ratinghat`, subtracting a frozen
prediction of the *real* rating from a *permuted* one. The residue is
`-cov(y_resid, ratinghat) / [var(rating) + var(ratinghat)]`, which is zero only on the period the
model was fitted on.
**Why it mattered:** it failed the whole experiment on a defect in a control rather than on
anything the experiment measured -- and the class had been derived at Gate 2 for a different
control and not applied to this one.
**Fix:** one line, pinned by the adversary before any variant was tried
(`perm_resid = perm_rating`), applied to all three slope-based fields, with the shipped block
retained beside the repaired one and byte-identity asserted everywhere else. Amendment A7 and
section 2 of `REPORT.md` carry the whole derivation, both verdicts, and the Gate 2 miss.
**Disclosure:** this is the only post-holdout change in the study.

## F11. The secondary time control was run without checking that the frozen models were in range

**Found:** Gate 3.
**Symptom:** every frozen number on `300+0` is an extrapolation artefact. The frozen time model
predicts log-time down to about -7.35 where log-time is non-negative by construction; roughly two
thirds of decisions sit outside the frozen knot range; the reported `beta` equals its own
destroyed-outcome null to three decimals.
**Cause:** the design froze the nuisance models on three-minute clocks and applied them to
five-minute clocks with no range check, and `analyse_period(..., want_controls=False)` meant the
pipeline's own C1 -- which would have failed at roughly a hundred null standard deviations -- was
never run there.
**Why it mattered:** the block looked like a clean cross-context replication of `beta`. It is the
extrapolation reproducing itself in both residuals.
**Fix:** none available after the fact. The block is reported as **not evaluable**, the
preregistered cross-context condition is not scored, and B4 gives the second time control its own
development day, its own frozen fits and its own destructive controls.

## F12. Two estimates written to the same key, and the report generator crashed on it

**Found:** Gate 3 ran `write_report.py` and it raised.
**Symptom:** `TypeError` formatting a dictionary with `:.4f`.
**Cause:** `estimands.estimate` wrote the pooled Metric B slope to `tae_pooled`, and the band-shape
loop later wrote the partial-pooling dictionary to the same key.
**Why it mattered:** the crash is the good case. The same collision between two floats would have
put the wrong number in a sentence.
**Fix:** the main effect is now `tae_pooled_slope_at_centre`; the partial-pooling dictionary keeps
`tae_pooled`. No verdict reads either key.
