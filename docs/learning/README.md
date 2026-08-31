# `docs/learning/`

A research pass on the layer between **an insight the record can justify** and **a change in what
the player does**. No code was changed, no feature was built, nothing was measured on a person.

Read in this order:

| file | what it is |
| --- | --- |
| [`PRIOR_ART.md`](PRIOR_ART.md) | seven candidate mechanisms, what each is evidenced at, and what each predicts here |
| [`FALSIFICATION_REGISTER.md`](FALSIFICATION_REGISTER.md) | eight attacks on the claim, three of them answerable today against the shipped code |
| [`EXPERIMENT.md`](EXPERIMENT.md) | the one study, its declared failure conditions, and what it costs |

The decision it reaches is [`../decisions/D23-insight-to-action.md`](../decisions/D23-insight-to-action.md).
Arithmetic: [`research/learning/transfer_bar.py`](../../research/learning/transfer_bar.py), which
checks its own constants against `shared/learning-record.ts` and fails if they drift.

## The one sentence

The product can justify a finding and can schedule a test of it, and **between those two things
there is no teaching step at all** — so the layer that would convert an insight into a decision
policy does not exist to be evaluated, and the instrument that would tell you whether it worked
grades a rule `replicated` on a bar that clears **47–81%** of the time from base rates alone.

## The three findings that did not need a person

1. **The transfer bar has no null model.** Three positions, two successes. At plausible component
   rates the grade `replicated` arrives 47–81% of the time whether or not anything was learned.
2. **A "success" is not rule use.** `record-service.ts` scores one as *word-overlap recall floor
   cleared* **and** *move accurate*. The first is documented in the repo as "a floor against
   unrelated text, not a memory measure"; the second is what an unaided player of that strength
   does anyway. Neither is the act the rule prescribes.
3. **The study that was asked for cannot be bought with the participants available.** A four-arm
   between-subjects comparison needs ~446 people to see a 0.3 difference. Eight to thirty is the
   real supply. The design has to trade people for items, and that changes it from an RCT into a
   single-case design — which is the standard this repository already adopted at tier A.

## What this does not claim

That micro-training beats the current loop. Nothing here measured a person, and
[`EXPERIMENT.md`](EXPERIMENT.md) is written so it can come back saying the current loop is fine.
