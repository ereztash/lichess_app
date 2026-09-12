# Instrumentation burden audit

Three questions carry the burden. None of their parameters is changed by this mission.

## Confidence, `ASK_RATE = 0.15`

**Unique evidence bought.** A number stated before any evaluation existed. Nothing else in the
product, and nothing an engine can do afterwards, produces it. The import panel says so in the
product's own words: *"משחק שכבר שוחק לא יכול לייצר את זה, בשום כמות."*

**Immediate value depending on it:** none. The reveal reads the same with or without it.

**Downstream finding depending on it:** the calibration gap, its three-way split, the
discrimination area, the effort correlation, the detector's six buckets, and every drill verdict.
`scoreDecisions` excludes any row with a null confidence rather than defaulting it, so the whole
measured population is exactly the drawn subset.

**Justified by repository evidence or owner judgement?** **Both, and the file separates them.** The
draw's behaviour is measured: 0.1525 marginal rate over 500 games x 60 plies, longest run five, no
game without a question, re-measured at 5,000 games. The *level* is owner judgement, and the file
says so: the rate was lowered from a higher value to pay for the probe, with the arithmetic written
out, and the curve that would settle it is named as producible on a shuffle harness.

**Verdict:** a covered tax. Heavy, irreplaceable, honestly parameterised, and the one thing about
it a player cannot see is its multiplier.

## The reads, coupled to the confidence draw

**What reads them.** `vocabulary-reading.ts` reads the **parts**, that is which menu options get
tapped and what gets typed beside them, to measure the menu rather than the answer. And
`shared/reveal.ts` `nextQuestion` reads `statedUnknown` directly to anchor the reveal's question.

**Historical evidence, and it cuts against H1 twice.** These fields were once required on every
decision. They were cut to a sample with the reason written down: *"on six decisions out of seven
two of those three bought nothing measurable at all"*, and *"an instrument too expensive to use is
not a more careful instrument."* **The repository has already run the delete test on itself, on
this exact field, and acted on the answer.** A product that systematically over-collects does not
do that.

The coupling is the second point. A decision is either fully instrumented or a move and nothing
else, so the vocabulary sample and the calibration sample are the same decisions. Two independent
draws would have cost the same and bought less.

**Verdict:** value-aligned, with an unannounced payoff. The player is not told their words come
back as the next question.

## The counterfactual probe, `PROBE_PROBABILITY = 0.35`

The chain, traced end to end:

```text
question at commit (35% of eligible decisions, >= 2 legal moves)
  -> stored on the decision as an arm assignment plus the named move, or an explicit "could not name one"
  -> the alternative is searched and scored beside the played move
  -> classified: reachable / narrow / both-good / neither
  -> CounterfactualPanel inside RecordDashboard, gated at MIN_BUCKET_N = 30 probed decisions
  -> no user action is derived from it in the reachable build
```

**Immediate output:** the named alternative's score, in the analysis column, behind the
`פרטי הניתוח` disclosure. Real, and not where the cost is paid.

**Is the rate a measurement optimisation, a user-value optimisation, or an unvalidated tradeoff?**
The file answers it itself, and the answer is the third: *"A JUDGEMENT, NOT A MEASUREMENT... Nothing
here has measured what rate a player tolerates; what has been decided is which of the two questions
is worth the interruption when only one of them can be."*

**Verdict:** the heaviest interruption in the product, the least covered at the point of payment,
and the one the repository itself marks as unvalidated. It is also the only instrument that can
answer whether the better move was in the player's hand and went unplayed, which is the most
product-specific question anything here asks.

## The arithmetic of the two draws together

From `shared/confidence-asked.ts`, the repository's own figures: over a forty-move game the two
draws used to produce 10 + 8 = 18 extra questions and now produce 6 + 14 = 20. The share of
decisions carrying at least one extra step rose from 40% to 45%. **The burden went up slightly and
moved to the question that measures what nothing else here can.**

That is a deliberate, documented, argued reallocation. It is not the signature of a product that
has never asked who the burden is for.

## What the burden audit contributes to the hypothesis

Two of the three burdens have an immediate or structural justification the repository derived and
recorded. One is marked by its own author as an unvalidated tradeoff. The distribution is not
"everything is tax"; it is "one of three is an open question, and the file says so."
