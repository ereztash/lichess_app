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
