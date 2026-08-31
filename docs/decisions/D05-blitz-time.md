# D05 — the time buckets are wrong for the route built to measure time pressure

**Mode:** `DEFER` — the defect is measured end to end and the false advice it produced is fixed; the
replacement bucket is not chosen, and the conditions for choosing one are written down below.
**Evidence level:** E1 — measured on the shipped detector through the same harness as Q4, on
simulated worlds. No real blitz record exists yet.
**Depends on:** `research/discovery-oracle/q6_blitz_time.py`, `shared/detector.ts` (`BUCKETINGS`),
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
