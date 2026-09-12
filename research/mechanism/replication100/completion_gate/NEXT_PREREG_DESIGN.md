# Design for the next pre-registration

What protocol V2 must contain that V1 did not. Written after the V1 cohort finished, from what its
completion gate found. This is a design document, not a pre-registration: the pre-registration
itself is emitted and self-hashed by `make_cohort_prereg.py` at freeze time, and nothing here
carries a `prereg_hash`.

Everything below is a **proposal**. It changes nothing about the V1 cohort, whose verdict stays
`UNDETERMINED` under `governance.no_tuning_after_this_hash`.

## What V1 got right, so that V2 does not lose it

V1 was pre-registered. Six red flags were declared before a username was chosen, one fired, and the
verdict rule applied itself. The machinery worked. Two denominators were separated with an explicit
note about why pooling them would report corpus size as a null. Population safety was enforced at
selection and re-derived at readout rather than trusted. Rejections were pre-analysis. None of that
changes.

## What V1 was missing

V1 declared **what would count as a red flag** and did not declare **what would be done if one
fired**. So when one fired, the study had a tripwire and no procedure, and the procedure that
resolved it was designed after the result was visible. It refuted the hypothesis of the person who
designed it, which is the best available evidence it was not steered, but it was still a post-hoc
choice. A different analyst seeing a different pattern would have built a different test.

That is the gap V2 closes.

---

## 1. Calibration before any member runs

**Artefact: `CALIBRATION_NULL.json`, committed before the first member is fetched.**

The instrument's false-positive rate at its own bar is a property of the instrument. V1 measured it
three days after the run ended, with a lit red flag already needing an explanation. V2 measures it
first.

| | |
|---|---|
| players | 5, spanning corpus size across the power strata, drawn from development data |
| permutations | 200 per player per discovery stage per target |
| permutation | outcome columns permuted jointly within game; features, game membership and game sizes preserved |
| baseline | fitted on real data before permuting: the model is instrument, not hypothesis |
| depth | **chosen per permutation by the same cross-validation the real run uses** |
| stages | both, as `run.py` runs them: OBS on the frozen baseline columns, POP against the band population, blitz only |
| output | the null distribution of the deciding statistic, its percentiles, and the pass rate at the candidate bar |

The depth rule differs from what the completion gate ran. The gate reused each committed run's
chosen depth, which makes its null narrower than the procedure it models, because a real run also
gets to pick depth. A pre-study calibration has no committed depth to borrow and must re-choose it
inside every permutation. That is more expensive and it is the correct null.

**The bar is then set from this artefact.** V1 fixed `k = 3.5` and discovered its false-positive
rate afterwards. V2 states the false-positive rate it wants and reads the bar off the calibration.

**Development data.** `governance.one_run_per_player` makes a player whose result caused a pipeline
change into development data. If V2 changes the instrument, the V1 cohort's 100 members become
development data and V2 needs a new frame. The calibration players should come from that pool, so
that no V2 cohort member is ever seen before it is judged.

## 2. Flags in units that do not move with design choices

Three of V1's six flags were rates over denominators that are themselves defined by statistical
power. A rate like that measures the denominator as much as the instrument.

### Reformulated

**F1. V1:** `PERSONAL_RESIDUAL_CANDIDATE` rate above 50% of `RESIDUAL_POWERED` members.

The defect: `RESIDUAL_POWERED` is by construction the well-powered subgroup, and the threshold was
placed on its detection rate as though power were not a variable. V1 fired at 68.0% on detections
whose permutation p-values were at the floor.

**V2:** the 25th percentile of implied effect size `z / sqrt(n_in)` among passing members lies below
the 95th percentile of the same quantity under `CALIBRATION_NULL`.

Reads as: the passes are scraping the noise floor rather than sitting above it. Independent of how
the denominator was selected, because both sides of the comparison are in the same units.

**F4. V1:** `NO_STABLE_STRUCTURE` rate above 90% of `BROAD_POWERED` members.

Same defect in the other direction: a high null rate among the well-powered is a statement about the
power floor, which is exactly what V1's flag intended to catch, but expressed in a unit that also
moves with the frame.

**V2:** the median best `z / sqrt(n_in)` among `BROAD_POWERED` members lies below the median of the
same quantity under `CALIBRATION_NULL`.

**F2. V1:** every candidate region is R\* or R\*\* verbatim.

The defect: unfireable. It requires unanimity. V1 returned 28.3% and the flag stayed dark.

**V2:** the share of candidate regions that are R\* or R\*\* verbatim exceeds the share a
support-weighted random draw from the frozen vocabulary would produce, by a margin set at freeze
time from the vocabulary's own structure.

**F3. V1:** fewer than 3 distinct candidate regions across all members.

Not wrong, just far too loose to fire. V1 returned 21 distinct regions against a threshold of 3.

**V2:** distinct candidate regions fewer than a fraction of the vocabulary's reachable region count,
that fraction fixed at freeze time.

### Kept as rates

**F5** (eligibility rejection rate above 90% of tried candidates) and **F6** (derived band differs
from the screen's prediction for more than 80% of tried candidates) are properties of the frame and
the screen, not of the judge. A rate is the right unit for them and they stay.

Both came close in V1 without firing: 87.0% and 62.1%. F6 in particular says the metadata screen
predicted the band wrongly for nearly two thirds of tried candidates, which is close to selection
being random over the frame. V2 should keep the threshold but report the value prominently rather
than only its flag state.

## 3. The diagnostic that fires with the flag

**For every flag, V2 declares the test that runs when it fires, and what each outcome of that test
means, before any member runs.**

Worked example for F1, which is the one V1 actually hit:

```
flag:        F1
diagnostic:  permutation null over the passing members, same design as CALIBRATION_NULL,
             200 draws per member per stage
refuted if:  the observed statistic exceeds the null's 99th percentile for a majority of
             passing members
if refuted:  the flag's reading does not hold. The verdict follows the ordinary rule as though
             F1 had not fired, and the refutation is recorded with its numbers.
if upheld:   the verdict is UNDETERMINED and the cohort is not interpretable as it stands.
if neither:  UNDETERMINED. An ambiguous diagnostic is not a licence.
```

**The tension this creates, stated because it is real.** A diagnostic that can lift a flag is an
escape hatch, and a loose one would destroy the point of declaring flags at all. Three constraints
keep it closed:

1. the diagnostic, its threshold and its verdict mapping are fixed in the hashed document, before
   any result exists;
2. it must be able to fail, and its failure mode must be written down beside its success;
3. no diagnostic may be added, swapped or re-parameterised after a flag fires. A flag with no
   pre-declared diagnostic stands, and the verdict is `UNDETERMINED`.

Under those constraints the diagnostic is part of the hypothesis rather than a response to the
result.

## 4. Power on every output class

An output class states that something was **detected**. V1's classes were read, including by the
red flag that fired, as though they stated that something **exists**. A player with 3,000 decisions
and the same true effect as a player with 14,000 receives a different label.

V2 adds to every member's verdict block:

| field | meaning |
|---|---|
| `min_detectable_effect` | the implied effect size this member's `n_in` would need for the statistic to reach the bar |
| `power_stratum` | which pre-declared corpus-size stratum the member falls in |
| `class_is_detection` | fixed text: the class states detection under this member's power, not existence |

And at cohort level:

- class rates are reported **stratified by power stratum** and never pooled into a single rate;
- any flag or verdict rule that consumes a class rate consumes the stratified form;
- the readout carries the minimum detectable effect distribution beside the class distribution.

This is the change that would have prevented V1's flag from being written the way it was.

## 5. The exploratory section, and what it may not touch

V2 carries two layers, named in the hashed document.

**Confirmatory.** Every analysis named here, with its statistic, its threshold and its verdict
mapping. This layer and only this layer produces the verdict.

**Exploratory.** Everything else. The clause, to be quoted verbatim in the prereg:

> Findings in this section do not enter the verdict, may not change any threshold in this document,
> and enter only the next contract version's pre-registration. Any analysis not named in the
> confirmatory section is exploratory by default, including any analysis devised after a result was
> seen.

**`EXPLORATORY_LOG.md`**, append-only, one entry per post-hoc analysis: the date, what prompted it,
what was run, what it returned, and whether it was later promoted into a confirmatory section. The
log makes drift visible from outside. Without it, each individual post-hoc decision looks reasonable
and the accumulation is invisible from inside.

By this standard the whole completion gate, including the permutation null that refuted the flag's
declared reading, is **exploratory**. It changed no threshold and no verdict, and it belongs in this
document rather than in V1's record. That is the discipline working, and it happened by accident
this time.

---

## Carried gaps that V2 must close

**`BOUND_INVARIANT.json` has never been produced.** `check_bound_invariant.py` exists and has never
run. The retrieval bound sits outside the seventeen files the pipeline hash covers, which is honest
only while the bound cannot change which games form a corpus. V1 asserted the enforcement in prose.
V2 should require the measurement as a pre-study artefact, on the same footing as
`CALIBRATION_NULL.json`.

**The power plan needs recomputing.** V1's denominators were derived for a fixed-`z` bar. If V2 sets
its bar from calibration and states its flags in effect-size units, the corpus sizes that define
`BROAD_POWERED` and `RESIDUAL_POWERED` follow from different arithmetic. No number is proposed here:
it is an output of `make_power_plan.py` once the bar exists.

**Cohort size is not automatically 100.** V1's 100 was sized for V1's thresholds. V2's follows from
V2's, and should be recomputed rather than inherited.

## Sequence

```
1  calibration players selected from development data
2  CALIBRATION_NULL.json           committed
3  BOUND_INVARIANT.json            committed
4  bar read off the calibration
5  make_power_plan.py              denominators and cohort size from the new bar
6  flags written in effect-size units, each with its diagnostic
7  make_cohort_prereg.py           emits and self-hashes protocol V2
8  frame, screen, selection, freeze
9  first member runs
```

Steps 2, 3 and 4 are what V1 did not have. Nothing in steps 5 through 9 may move once step 7 has
hashed.
