# D04 — can a candidate search find the region the six buckets cannot express?

**Mode:** `PSEUDOCODE_ORACLE` — `pysubgroup` runs under `research/`, never in the product.
**Evidence level:** E3 — it passes the planted and null harness. It has never seen a real record.
**Status:** **measured, not rejected.** Both halves of the rejection rule are met. Porting is a
separate decision with its own gate, and nothing here authorises it.
**Depends on:** `research/discovery-oracle/q7_candidate_search.py`, `shared/detector.ts`,
`docs/discovery-v2/M0_AUDIT.md` §Q4, `docs/decisions/D08-attribution.md`.

## CLAIM

M0 Q4 measured the shipped chain over 11,600 records. Against "nothing is there" it is close to
perfect: **0 validated false claims in 8,000 null records**. On `interaction-only` — a world whose
true effect lives in `fast AND endgame`, a region no bucket can express — it validated a claim
naming the **wrong** subgroup on 11% of records and the right one on **0%**.

D08's answer to that was a **veto**: `attribution.ts` withholds a claim whose bucket splits
inhomogeneously. A veto buys silence instead of a wrong sentence. **It never produces the right
one.** D04 asks the other half — is there a region a search would have named instead?

## THE REJECTION RULE, WRITTEN DOWN BEFORE THE RUN

> D04 is rejected unless it improves correct attribution **without** raising the false-claim rate
> past the 0.02 ceiling the shipped chain already meets.

Both halves bind. A search that finds `fast AND endgame` every time and also speaks on one null
record in ten has not improved the product — it has moved the failure from *"says the wrong thing
sometimes"* to *"says a thing when there is nothing"*, which is the worse of the two.

**The ceiling was expected to be the hard part, and that expectation is on the record.** The six
buckets are a fixed, preregistered family. A search over conjunctions considers hundreds, chosen
*because* they looked good on the data. The honest expectation was that an uncorrected search blows
through 0.02.

## THE DESIGN, WHICH IS WHAT RESCUED IT

The same discipline the shipped chain uses. **The search runs on the derivation half only**, its top
candidate is **frozen**, and the frozen region is judged on games the search never saw — at the
shipped `SEPARABILITY_K = 3.75` and `MIN_BUCKET_N = 30`, with the shipped Bessel-corrected standard
error of the gap difference. Nothing is judged on softer terms than what ships.

Three choices that decide whether the measurement means anything:

**The target is the calibration gap, not accuracy.** The first version searched `accurate`, and its
winning region was `confidence < 5` — a restatement of the target dressed as a finding. Confidence
is half the gap, so it is also **not a selector**; the six shipped bucketings exclude it for the
same reason.

**The candidate vocabulary is fixed, not derived from the record.** `create_selectors` would invent
cuts from this record's own quantiles, making every candidate a function of the data it is about to
be tested on. The cuts are the product's own thresholds, so the search space can be stated in
advance.

**On-target is set overlap, not a name.** Q4's `on-target` was `selected == target` — two names. A
search names a region, so the comparison has to be between two sets of decisions:
`Jaccard(found, planted) >= 0.60` on the validation half, **declared before the run**. If the search
recovers `fast AND endgame` exactly, Jaccard is 1; if it recovers `fast` alone — the mistake the
shipped chain already makes — Jaccard is the endgame share of fast decisions, around 0.2–0.3. Any
line between those separates "found the conjunction" from "found one of its parts".

## THE RESULT

400 records per plant, 400 per null world, 40 games each, 20 to derive.

| | depth 1 | depth 2 |
| --- | --- | --- |
| **false-claim rate**, 4,000 null records | **0.0008** (95% CI 0.0003–0.0022) | **0.0010** (0.0004–0.0026) |
| shuffled-label control, 1,800 planted records | 0.0006 | 0.0006 |
| `interaction-only` on-target | 0.2225 (median J 0.841) | **0.3350** (median J **1.000**) |
| `proxy-correlated` on-target | 0.0550 | 0.0100 |
| `clean-middlegame` on-target | 0.6275 | 0.4000 |
| `clean-fast` on-target | 0.1725 | 0.0650 |
| `sparse-low-clock` on-target | 0.5550 | 0.3950 |

**The region depth 2 names on `interaction-only` is `phase==2 AND seconds<45.0`** — the planted
region exactly, median Jaccard 1.000, on games the search never saw. The shipped chain names it on
0% of records.

**Both halves of the rule are met.** Correct attribution goes from 0% to 33.5% on the world D04
exists for, and the false-claim rate is an order of magnitude under the ceiling — 0.0010 against
0.02, upper CI 0.0026.

**The shuffled-label control is the reason the rest can be read at all.** Permuting the gap *within*
each record destroys any relation between a decision's context and its calibration and leaves
everything else — the record, the search, the freeze, the judge — untouched. 0.0006. A pipeline
still validating on shuffled labels would be leaking the validation half into the search, and every
number above would be an artefact of the harness. This is `GATE-SHUFFLE`'s discipline, run on the
harness instead of the detector.

## WHAT THE RESULT COSTS, SAID PLAINLY

**Depth is a trade and it is not resolved here.** Depth 2 buys `interaction-only` (0.2225 → 0.3350)
and loses the clean plants (`clean-fast` 0.1725 → 0.0650, `clean-middlegame` 0.6275 → 0.4000):
searching conjunctions when the truth is a single cut over-specifies, and the extra term costs power
on the half the search never needed. **Choosing a depth is choosing which world to be right about**,
and nothing measured here says which one a real record resembles. A shipped search would have to
answer that, and it cannot be answered from planted worlds.

**Two inexpressible worlds stayed at zero.** `one-game-only` and `every-game-first-moves` are
0.0000 on-target at both depths, because the vocabulary has no `game` or `ply` selector. D04 does
not solve inexpressible regions — it solves the ones its vocabulary can express, and widening the
vocabulary is a new multiplicity question, not a free improvement.

**The clean-plant numbers are not a comparison with the shipped chain.** This harness is a narrower
pipeline: one frozen candidate judged directly, with no attribution veto and no protocol matching.
Testing one pre-frozen region carries a *lighter* multiplicity burden than testing six — which is
why `PREREGISTERED_SEPARABILITY_K` is 3.25 and `SEPARABILITY_K` is 3.75. Reading these rows as
"better than the product" would be comparing two different pipelines.

## WHAT WOULD REVERSE IT

- **The false-claim rate on a real corpus exceeding 0.02.** Null worlds are generated by a model;
  a real record's dependence structure is not that model, and this is the number that decides.
- **A depth that cannot be chosen without seeing the outcome.** If the trade above can only be
  settled by looking at the records being judged, D04 is a knob rather than a method, and a knob
  tuned on its own evidence is what this whole chain refuses.
- **A ported implementation disagreeing with `pysubgroup`.** `PORT_AFTER_EQUIVALENCE` is the mode a
  port would take, and equivalence would have to be differenced case by case, as D01 and D03 were.
- **Jaccard ≥ 0.60 turning out to be doing the work.** The full distribution is in
  `results/q7_candidate_search.json`; if the on-target rates move sharply with the threshold, the
  line was a choice and not a separation.

## WHAT IS EXPLICITLY NOT DECIDED

That the search ships. E3 permits a candidate for porting and nothing more, and D06 (stability
selection) is now unblocked by exactly this result — a candidate search exists to be resampled.
Neither is opened here.
