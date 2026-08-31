# D05 — the time buckets are wrong for the route built to measure time pressure

**Mode:** `DEFER` — the defect is measured end to end and the false advice it produced is fixed. One
candidate has been declared, measured and **rejected**, twice: once on a test that turned out to be
unanswerable, then again on a repaired one. It fixes readability outright and reaches a fifth of the
declared recovery bar where the shipped bucket reaches zero. No bucket is chosen, and the reason the
next step is not a third constant is measured rather than asserted.
**Evidence level:** E1 — measured on the shipped detector through the same harness as Q4, on
simulated worlds. No real blitz record exists yet, and reversal condition 2 is about exactly that.
**Depends on:** `research/discovery-oracle/q6_blitz_time.py`,
`research/discovery-oracle/q8_relative_time.py`, `research/discovery-oracle/q9_answerable_plant.py`,
`shared/detector.ts` (`BUCKETINGS`), `shared/blitz-time-candidate.ts`,
`docs/MASTER_PRODUCT_DEBT.md` R-18.

## CLAIM

`fast-under-45s` and `slow-over-2m` are absolute-second thresholds. Forty-five seconds is a quarter
of the entire clock in a three-minute game and two minutes is two thirds of it. So the bucket the
product's whole narrative rests on — *when you have little time, you commit before you have checked*
— may be unreadable on the route built to measure exactly that.

## MEASUREMENT

`q6_blitz_time.py`, 1,600 null records and 800 planted records, blitz-only time controls (3+0 at
0.6, 5+3 at 0.4), 40 games each, split 20/20 by game. Same chain as Q4 — six-bucket scan, three
variables, one claim, one prospective test — so the two tables read side by side.

**How often each bucket can be read at all**, pooled over the null worlds:

| bucket | non-empty | **usable** | cleared |
| --- | --- | --- | --- |
| `clock-under-1m` | 1.0000 | **1.0000** | 0.0000 |
| `phase-opening` | 1.0000 | **1.0000** | 0.0000 |
| `phase-middlegame` | 1.0000 | **1.0000** | 0.0000 |
| `phase-endgame` | 1.0000 | **1.0000** | 0.0000 |
| `fast-under-45s` | 1.0000 | **0.2725** | 0.0006 |
| `slow-over-2m` | 0.5844 | **0.0037** | 0.0000 |

*Non-empty* means at least one decision on each side. *Usable* means `MIN_BUCKET_N = 30` on each
side, which is what `detect` requires. **The gap between those two columns is the whole finding**,
and reporting only the first is what the first version of this measurement did: `fast-under-45s`
divides every blitz record and can be measured on 27% of them.

**What it costs when there is something to find**, at the same effect size:

| plant | delta | recall | on target | validated | on target |
| --- | --- | --- | --- | --- | --- |
| `clean-middlegame` | 0.180 | 0.5775 | 0.5650 | 0.4200 | **0.4175** |
| `clean-fast` | 0.180 | 0.0025 | 0.0025 | 0.0000 | **0.0000** |

A real effect of the same strength is recovered **0.25%** of the time in the fast bucket and **56.5%**
of the time in the middlegame, and validated **never** against **41.75%**. Q4's mixed-control world
puts `clean-fast` at 0.1250 validated-on-target; restricting to blitz takes it to zero.

**The middlegame row is the control and it is why this is a finding rather than a broken fixture.**
Q4 measures 0.4475 validated-on-target for the same plant on mixed controls; the blitz world gives
0.4175. The world is fine. The bucket is not.

**The false-claim rate is unaffected**: 0/1,600, upper 95% 0.0024 against a 0.02 ceiling. Fewer
usable comparisons cannot raise a false-positive rate, and this says so with a number rather than
with the argument.

## ALTERNATIVES

1. **Leave it.** Blitz players get four buckets instead of six, and the one thing the route was
   built to measure is the thing it cannot see.
2. **Move the thresholds.** 5 seconds instead of 45. Fastest to write and the worst of these: it is
   a number chosen to make a bucket fill, which is the post-hoc move D08 refuses one level up, and
   it breaks the untimed loop where 45 seconds is a real division.
3. **Think time as a share of the clock the player had** — `thinkFractionOfClockBefore`, which
   `shared/blitz-features.ts` already computes. Point-in-time safe by construction. Its weakness is
   that the share a decision costs rises through a game even at a perfectly even pace, so a fixed
   threshold is not a fixed meaning.
4. **Think time against the fair share the clock implies** — `clockBeforeMs / expected moves
   remaining`. Structure-derived, point-in-time safe, fitted to nothing. Needs an estimate of moves
   remaining, which is a model.
5. **Think time relative to this player's own distribution.** The most natural reading of "fast for
   you", and the one that leaks: a percentile computed over the record includes decisions that came
   after the one being described. `blitz-features.ts` already carries `percentileSource` because of
   this, and a reference fitted on the same games is §20's violation with a label on it.
6. **A separate bucket set per time control**, chosen by the game rather than by the record.

## DECISION

`DEFER`, and the deferral is on the CHOICE, not on the defect.

**What shipped instead**, because the false advice was the urgent half: a bucket whose split is
saturated on a record large enough to have filled it is now reported as `one-side-empty` — a
division that does not divide — and named as a dead end that says which line nothing crossed. Before
that, the record page told a blitz player "thirty more decisions" on a record where four hundred and
eighty had already failed to produce one. That is the same class of advice `no-clock-data` exists to
prevent, and it is gone.

**Why the bucket itself is not replaced here.** `SEPARABILITY_K = 3.75` is a measurement of *those
six buckets searched together* — `docs/MEASUREMENTS.md` says so at the point it is set. A seventh
bucket, or a redefined one, is a different search space with a different multiplicity, so the
threshold has to be re-measured before anything may be searched under it. The six are also frozen in
`shared/discovery/hypothesis-manifest.ts`, so changing them changes the manifest hash, which is the
thing that makes a pre-registration mean anything.

**And choosing among 3, 4, 5 and 6 by measuring them is the trap this project keeps naming.** Four
candidates measured on the same worlds, with the best kept, is a search with four comparisons and no
correction — the post-hoc choice D08 refuses inside validation, arriving here as a research method.
The choice rule has to be declared first.

## THE CHOICE RULE, DECLARED BEFORE THE RUN

Reversal condition 1 below is the intended path and it asks for two things in this order: the rule
first, then one run. This section is the rule. It was written and committed before the harness that
tests it produced a single number, which is the only thing that makes the number worth reading — and
it is the discipline `q5_attribution.py` used for `ATTRIBUTION_K`.

### The candidate

**Alternative 3: `thinkFractionOfClockBefore`**, which `shared/blitz-features.ts` already computes as
`thinkMs / clockBeforeMs`. Point-in-time safe by construction: it reads the clock the player had
when the position appeared, and nothing later.

Chosen over the other five for stated reasons rather than by measuring all six, which would be the
four-comparison search this node already refuses:

- **2 (move the seconds)** is a number picked to make a bucket fill, and it breaks the untimed loop
  where 45 seconds is a real division.
- **4 (against the fair share the clock implies)** needs an estimate of moves remaining, which is a
  model, and a model is a second thing to be wrong about.
- **5 (this player's own percentile)** leaks: a percentile over the record includes decisions taken
  after the one being described.
- **6 (a bucket set per time control)** multiplies the search space by the number of time controls,
  which is the multiplicity problem this whole node is about.
- **1 (leave it)** is the status quo the defect describes.

### The thresholds, and why they are not fitted

The product already derives a per-move budget from a **thirty-move planning horizon** — the world
generator's `budget = max(initial / 1000 / 30, 1.5)` carries the same constant and the same
sentence. A player spending evenly across that horizon spends **1/30 ≈ 0.0333** of the clock they
have on each decision. So:

| bucket | cut | what it is |
| --- | --- | --- |
| `fast-relative` | `thinkFractionOfClockBefore < 1/60` | **half** an even share |
| `slow-relative` | `thinkFractionOfClockBefore > 1/15` | **double** an even share |

Halving and doubling one constant the product already uses. Neither number was chosen by looking at
how full the resulting bucket is, and **neither moves after the run** — if the candidate fails, the
finding is that alternative 3 is refuted, and the next candidate is 4.

D05's own objection to alternative 3 stands and is not answered by this: *the share a decision costs
rises through a game even at a perfectly even pace, so a fixed threshold is not a fixed meaning.* A
decision late in a game is nearer the fast cut than the same deliberation early in one. That is a
real weakness of the candidate and it is why the measurement below is a test rather than a
formality.

### What would reject it

Both must hold. The run measures the **new six** — the four working buckets, plus these two in place
of `fast-under-45s` and `slow-over-2m` — through the same chain and the same worlds as Q4 and Q6.

1. **The false-claim rate on blitz null records must stay at or under 0.02**, upper 95% CI. This is
   not a formality: `SEPARABILITY_K = 3.75` is a measurement of *those six buckets searched
   together*, so a redefined set is a different multiplicity and has to earn the threshold again.
   Over the ceiling and the candidate is rejected outright — a bucket that fills by finding things
   that are not there is worse than a bucket that cannot be read.
2. **`clean-fast` validated-on-target must reach at least half of what `clean-middlegame` reaches on
   the same worlds** — so against Q6's 0.4175, a bar of **0.209**. Half rather than parity because a
   fast bucket is a tail and a phase bucket is a third of the record: requiring parity would be
   requiring the bucket to beat its own size. Below the bar and the candidate has not fixed the
   defect, whatever else it improved.

Rejection is a result, not a failure. R-18's point is that the *thresholds* are wrong; a measurement
showing that a relative threshold is wrong too is worth as much as one showing it is right, and
would move the node to alternative 4 with an argument instead of a preference.

### What the run may not do

Report a third number and choose on it. Search a seventh bucket. Move a cut. Or ship anything: the
six in `hypothesis-manifest.ts` are frozen, and a passing candidate earns the right to be *proposed*
for that manifest, which is its own decision with its own hash change.

## THE RESULT

`research/discovery-oracle/q8_relative_time.py`. Both arms on the same worlds and the same seeds —
400 records per world, 40 games each, split 20/20 by game, blitz controls only. Full output in
`research/discovery-oracle/results/q8_relative_time.txt`.

### VERDICT: REJECTED

| condition, as declared above | measured | required | |
| --- | --- | --- | --- |
| 1 · false-claim rate on blitz nulls | 0.0000, upper 95% **0.0024** | ≤ 0.02 | **PASS** |
| 2 · `clean-fast` validated-on-target | **0.0000** | ≥ 0.209 | **FAIL** |

Both had to hold. The rule said *neither number moves after the run* and *rejection is a result, not
a failure*. **Alternative 3 as tested is rejected**, and nothing in the rest of this section converts
that into a pass.

### What the candidate did prove, and it is the half R-18 is actually about

**Readability, outright.** The two dead buckets come alive, on the same worlds that killed them:

| | shipped | candidate |
| --- | --- | --- |
| fast bucket usable (`MIN_BUCKET_N` on both sides) | `fast-under-45s` **0.2725** | `fast-relative` **0.9956** |
| slow bucket usable | `slow-over-2m` **0.0037** | `slow-relative` **1.0000** |
| non-empty, slow bucket | 0.5844 | 1.0000 |

`slow-over-2m` does not even divide 42% of blitz records; `slow-relative` divides all of them and is
measurable on all of them. The four working buckets are unchanged in both arms, so this is the
redefinition and not a different world.

**And condition 1 is a real result, not a formality.** `SEPARABILITY_K = 3.75` was measured on
*those six searched together*; the redefined six earn the 0.02 ceiling in their own right — 0 false
claims in 1,600 blitz null records, upper 95% 0.0024. A bucket that fills by finding things that are
not there would have failed here, and this one does not.

### CONDITION 2 WAS NOT A QUESTION EITHER ARM COULD ANSWER

This is measured by `region_probe` in the same file, not argued, and it is a defect in the harness
rather than in the candidate.

A bucket can only recover an effect that is **inside** it, contrasted against material that is
**outside** it. `clean-fast` plants its effect in `seconds < 45` — and on a 3+0 record that is
nearly the entire record. Measured on the derivation half of the same 400 records each arm was
scored on:

| arm | target bucket | planted share | inside the bucket | outside decisions, median | planted **and** outside, at least |
| --- | --- | --- | --- | --- | --- |
| shipped | `fast-under-45s` | 0.9692 | 0.9692 | **15** | 0.0000 |
| candidate | `fast-relative` | 0.9692 | 0.1834 | 431 | **0.7858** |

Two different failures, and neither is about the candidate's definition:

- **shipped** — the bucket *is* the region, exactly (`inside` equals `planted` to four places, because
  `fast-under-45s` and the plant are the same predicate). The contrast is perfectly aimed and there
  is nothing to aim it at: a median of **15** decisions on the far side against `MIN_BUCKET_N = 30`.
- **candidate** — the bucket is a genuine tail, usable on 99.6% of records, and at least **79%** of
  the record is planted *and* outside it. The effect is on both sides of the line, and no bucketing
  of any kind separates a constant.

The floor in the last column needs no crosstab and therefore no second copy of the bucket predicates
in Python: if a share `p` of the record is planted and a share `b` of it is inside the bucket, then
at least `p − b` of it is planted and outside, whatever the overlap. `p` comes from the world
generator's own mask and `b` from the TypeScript bridge's `sides`, so each number is produced by the
one place that owns it.

**So condition 2 could not have been passed by any bucket**, including a perfect one. It is scored
`FAIL` because that is what the rule says, and the rule is not edited after the fact — but it does
not license the sentence *"a relative bucket does not recover blitz effects"*. That sentence is
still unmeasured.

### WHAT THIS DOES TO Q6, WHICH IS THE SAME DEFECT ONE FILE EARLIER

Q6 concluded *"the world is fine, the bucket is not"* from two rows: `fast-under-45s` usable on 27%
of records, and `clean-fast` recovered at 0.00% against the middlegame's 41.75%. The probe splits
those two apart.

- **The `usable` column stands, and it is the stronger evidence.** It is measured on **null** worlds
  with no plant at all, so nothing about a plant's coverage can touch it. `fast-under-45s` divides
  every blitz record and can be measured on 27% of them: that is R-18, entire, and it needs no
  planted effect to be true.
- **The recovery row does not stand as stated.** 0.00% has two sufficient causes — the bucket is
  unreadable, *and* the plant fills 97% of the record so nothing could have read it. Q6 could not
  tell them apart and did not know it had to. The row is not wrong; the inference drawn from it was
  over-strong.

This is the same failure class as the five in `tests/LEVELS.md`: **an instrument that is right about
what it looks at, read as evidence about something else.** It is written here rather than quietly
repaired because Q6's number is cited in `docs/MASTER_PRODUCT_DEBT.md` R-18 and in this file above.

### THE SECOND RULE, DECLARED BEFORE ITS RUN

Same discipline, same ordering: this subsection is committed before the harness that tests it
produces a number. Condition 2 failed as a *test*, so the honest next step is to repair the test —
not to re-score the old run, and not to write a rule that fits numbers already seen.

**The new plant.** `relative-fast` — the same effect strength as `clean-fast` (delta 0.180, so the
middlegame control is comparable at the same strength), planted where

> `thinkMs / clockBeforeMs < 1/40`

**Why 1/40 and why it is not fitted.** It is the midpoint, in value, between the candidate's own cut
(`1/60`) and an even pace across the product's thirty-move horizon (`1/30`): `(1/60 + 1/30) / 2 =
1/40` exactly. It was chosen to be a region **neither arm names**, and the two consequences are
stated here rather than discovered later:

- `fast-relative` (`< 1/60`) is a strict **subset** of the plant. The candidate can name part of the
  region and not all of it — a handicap, deliberately, so the run is not the candidate marking its
  own homework.
- `fast-under-45s` is a gross **superset**: on a blitz record it covers 97% of the decisions,
  including every planted one and almost everything else.

**How each arm is scored.** Against its own fast bucket — `fast-under-45s` for shipped,
`fast-relative` for the candidate — because the product question is *does a time-pressure effect get
reported as time pressure*, and neither key is the region.

**What would reject it.** In this order, and the first is a gate on the run rather than on the
candidate:

1. **The run reports `answerable` first, from the same probe.** If the new plant is not a genuine
   subset — unplanted material below `MIN_BUCKET_N`, or more of the record planted-and-outside than
   is unplanted at all — the run reports **no verdict**, and the finding is that the harness failed
   again. A verdict read off an unanswerable question is the mistake this whole section is about.
2. **The false-claim rate on blitz nulls at or under 0.02**, upper 95%, from this run's own nulls.
   Unchanged, and re-measured rather than carried over.
3. **The candidate's validated-on-target on the new plant at least half of `clean-middlegame`'s on
   the same run.** Same shape as before, and against *this run's* control rather than Q6's number.

**What the second run may not do.** Move the cut. Move 1/40. Search a seventh bucket. Report a third
number and choose on it. Or ship anything — the six in `hypothesis-manifest.ts` are frozen, and a
passing candidate earns the right to be *proposed*, which is its own decision with its own hash
change.

## THE SECOND RESULT

`research/discovery-oracle/q9_answerable_plant.py`, run against the rule committed above in
`1774b66` before the file existed. Same two arms, same worlds, same seeds, same scoring code —
`run_world`, `arm` and `region_probe` are imported from Q8 rather than copied, because two arm loops
that can disagree about something neither run is about is the failure this node's first result
section is entirely about. Full output in
`research/discovery-oracle/results/q9_answerable_plant.txt`.

### Condition 1, reported first: the plant is a genuine subset

| arm | target bucket | planted share | inside the bucket | unplanted decisions | planted **and** outside, at least | answerable |
| --- | --- | --- | --- | --- | --- | --- |
| shipped | `fast-under-45s` | 0.2722 | 0.9681 | 380 | 0.0000 | **yes** |
| candidate | `fast-relative` | 0.2722 | 0.1867 | 380 | 0.0856 | **yes** |

A median derivation half holds 522 decisions and `MIN_BUCKET_N` is 30. The plant covers 27% of the
record instead of `clean-fast`'s 97%; there are **380** unplanted decisions to contrast against
instead of 16; and only 8.6% of the record is planted-and-outside the candidate's bucket instead of
79%. **This is a question either arm could have answered yes to**, which is what makes the rest of
the table evidence about buckets rather than about the fixture.

### VERDICT: REJECTED — and this time the rejection is about the candidate

| condition, as declared | measured | required | |
| --- | --- | --- | --- |
| 1 · the plant is a genuine subset | answerable, both arms | — | **PASS** |
| 2 · false-claim rate on blitz nulls | 0.0000, upper 95% **0.0024** | ≤ 0.02 | **PASS** |
| 3 · `relative-fast` validated-on-target | **0.0475** | ≥ 0.2112 | **FAIL** |

The bar is half of *this run's own* middlegame control, 0.4225. That control has now been drawn four
times — 0.4475 on Q4's mixed controls, 0.4175 in Q6 and Q8, 0.4225 here on a different draw of the
same world — so the worlds are stable and the bar is not an artefact of one seed.

### What the two arms actually did, on the same plant

| | shipped | candidate |
| --- | --- | --- |
| any-bucket recall | 0.0500 | **0.1775** |
| named the fast bucket | **0.0000** | 0.1225 |
| validated on target | **0.0000** | 0.0475 |
| named something else, right direction | 0.0325 | 0.0325 |

**The shipped bucket recovers a relative-time effect exactly never**, on a plant built to be
recoverable, with 380 unplanted decisions to contrast against and the middlegame scoring 0.4225 on
the same records. That is R-18 stated at its strongest, and it is the first time it has been said
with a plant that could have come out otherwise.

**The candidate recovers it 4.75% of the time**, which is a real improvement over zero and a fifth of
what the rule asked for. It also names the fast bucket 12.25% of the time and fails to validate more
than half of those, which is the prospective half doing its job.

### Why 4.75% and not more, and why the cut does not now move

`fast-relative` is `< 1/60` and the plant is `< 1/40`, so **the candidate's bucket is a strict subset
of the region it is being asked to name** — it holds 18.67% of the record against the plant's 27.22%.
That handicap was declared before the run and on purpose: a plant sitting exactly on the candidate's
own cut would have been the candidate marking its own homework. So 0.0475 is a *lower bound* on what
a cut aligned with a real effect would reach.

**And the cut still does not move.** "Try 1/40 as the bucket" is fitting a threshold to a plant this
file drew, which is the post-hoc move D08 refuses one level up and D05 refuses in alternative 2. The
declared rule said the cut may not move after the run, and it does not.

**What the number actually argues for is D04.** A bucket with a declared cut can only ever be near
the truth by luck; the mechanism that finds where the line is, instead of guessing it, is the
candidate search — which recovers `phase==endgame AND seconds<45` exactly, taking correct attribution
from 0% to 33.5% at a 0.0010 false-claim rate. D05's alternatives 3 and 4 are both "pick a better
constant". Q9 is the measurement that says picking a better constant is worth about five points where
the search is worth thirty-three.

### Where this leaves alternative 3

**Rejected at these cuts, and not refuted as an idea.** Precisely:

- as a *readability* fix it works and the evidence is strong — 0.2725 → 0.9956 usable, 0.0037 →
  1.0000, at no cost to the false-claim rate in either run;
- as a *recovery* fix it reaches a fifth of the declared bar with its bucket covering two thirds of
  the planted region, and the shipped bucket reaches zero;
- moving to alternative 4 (the fair share the clock implies) would be swapping one declared constant
  for another declared constant plus a model of moves remaining, and Q9 is the reason to expect that
  to buy little.

The node stays `DEFER`. The next thing that changes it is D04's depth trade being settled, or a real
blitz record, not a third constant.

## REVERSAL CONDITION

Any one of these reopens it, and the first is the intended path:

1. **A declared choice rule, then one run.** Write down — before the run — which candidate is
   preferred and what would have to be true for it to be rejected. `q5_attribution.py` did exactly
   this for `ATTRIBUTION_K` ("the smallest k whose worst false-veto rate stays inside 10%"), and the
   discipline is the reason that number is trustworthy. Then measure: the new set's false-claim rate
   on the blitz nulls against the 0.02 ceiling, and `clean-fast` recovery against the 0.4175 the
   middlegame gets.
2. **A real blitz record.** Every number here is simulated. The generator's think times are
   log-normal with a spread drawn from a spec, and a real player's are not — the synthetic 3+0
   record in `tests/shared/a-line-nobody-crossed.test.ts` produces `fast-under-45s` at 480/0, which
   is far more saturated than the 27%-usable this harness reports. Which of the two is closer to a
   person is not yet knowable, and the answer changes whether the bucket is unreadable or merely
   underpowered.
3. **The vocabulary gains conjunctions (D04).** If a region can be named as `fast AND middlegame`,
   the search space changes anyway and this node's arithmetic is re-done inside that one.
4. **The blitz record reaches the size where 27% usable stops mattering.** `fast-under-45s` is
   usable on 27% of forty-game records; a player with three times the record clears the floor far
   more often, and the question becomes power rather than readability.
