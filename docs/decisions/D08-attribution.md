# D08 — can anything tell the named region from a bucket that merely overlaps it?

**Mode:** `DEFER` — the test is built and measured; it is not wired into the claim path, and the
trigger that would wire it in is written down below. Its second reversal condition has now fired,
been measured and been closed: the veto's cost and catch are unchanged, and what a search changes is
the ceiling on what the veto is worth.
**Evidence level:** E3 — it passes the planted harness. It has never seen a real record.
**Depends on:** `shared/discovery/attribution.ts`, `research/discovery-oracle/q5_attribution.py`,
`research/discovery-oracle/q10_veto_after_search.py`, `docs/discovery-v2/M0_AUDIT.md` §Q4.

## CLAIM

M0 Q4 measured the shipped chain over 11,600 records. Against "nothing is there" it is close to
perfect: **0 validated false claims in 8,000 null records**, upper 95% CI 0.00048 against a 0.02
ceiling. On `interaction-only` — a world whose true effect lives in `fast AND endgame`, a region no
bucket can express — it **validated a claim naming the wrong subgroup on 11% of records**.

The judge cannot catch that, and this is not a defect in the judge. Validation asks whether the
frozen bucket separates on games that did not suggest it, and `fast-under-45s` genuinely does: the
true region is a *subset* of it, and drags the bucket's mean along. Every step behaves correctly and
the player is still told the wrong thing — distrust yourself when you play fast — which they will
apply to fast middlegame moves where nothing is wrong.

So the claim under examination was: *the chain needs a test that separability cannot provide —
whether the difference is a property of the named bucket or of something inside it.*

## ALTERNATIVES

1. **Tighten `SEPARABILITY_K`.** Does not touch it: the bucket really does separate.
2. **Homogeneity within the claimed bucket.** Split it by each other bucketing; if some division
   carries the whole gap, the name is too wide.
3. **Rename the claim to the narrower region** the split found.
4. **Widen the vocabulary** so `fast AND endgame` is expressible, and let the search find it.
5. **Report the interaction to the player** and let them judge.

## WHY 2, AND WHY NOT 3

Alternative 3 is the tempting one and it is forbidden by the same rule that makes the freeze worth
anything: it chooses a region *after* seeing the outcome, on the very data the claim is being judged
against. That is the post-hoc choice R5 exists to prevent, and doing it inside the validation step
would quietly convert the one prospective test into a second search.

So attribution **withholds and names**. The claim is not validated as stated, and the report says
which division of the bucket broke it — so a *later* pre-registration can name that region in
advance and test it properly. Alternative 4 is the real long-term answer and is D04's business, not
this node's; alternative 5 asks the player to do the data analysis, which is the thing this product
exists not to do.

## EXTERNAL IMPLEMENTATIONS

Subgroup-discovery libraries (`pysubgroup`, pinned in `environment.lock` and imported by nothing)
solve the *search* half of this — finding a narrower region — and none of them solves the half that
matters here, which is refusing to trust a region that was already chosen. The test implemented is
an ordinary two-sample contrast on the gap, reusing `summarise` and `gapDifferenceStandardError`
unchanged, so no rule this node depends on has a second definition.

## MEASUREMENT

`q5_attribution.py`, 3,600 records over nine planted worlds, choice rule declared before the run:
the smallest `k` whose worst false-veto rate over the clean plants stays inside a 10% ceiling.

| k | worst false veto | mean caught |
| --- | --- | --- |
| 1.5 | 0.3556 | 0.3944 |
| 2.0 | 0.1222 | 0.2528 |
| **2.5** | **0.0556** | **0.0917** |
| 3.0 | 0.0102 | 0.0000 |

*False veto* is measured on plants whose region IS a bucket, where a veto is wrong. *Caught* is
measured on `interaction-only` and `proxy-correlated`, where the validated claim names something too
wide and a veto is the point.

**At the record size the product actually sees, this is a wash**: 7% of misattributions caught for
6% of true claims withheld, on a chain Q4 already measured as silent more than half the time.

## THE FINDING IS NOT ABOUT `k`

Holding the derivation half at 20 games and growing **only** the validation half:

| validation games | false veto (k=3.0) | caught (k=3.0) |
| --- | --- | --- |
| 20 | 0.0472 | **0.0000** |
| 60 | 0.0130 | **0.2283** |
| 140 | 0.0150 | **0.4729** |

The test is not weak. **The record is small.** At 60 validation games it stops a fifth of the
misattributions for a 1.3% cost; at 140, nearly half. The bottleneck is the same one Q4 found one
level up — a bucket is a fraction of the record and each split halves it again.

## DECISION

`DEFER`. The test is implemented, gated and measured. It is **not** called from `currentClaim` or
from any validation path, because at 20 validation games it would make an already-silent product
quieter in exchange for almost nothing.

`ATTRIBUTION_K = 2.5`, set by the declared rule on the main block. It was **not** re-chosen after
the size block, although that table would support 3.0: choosing a threshold from the sweep that
flatters it afterwards is the same post-hoc move this node refuses in alternative 3.

## REVERSAL CONDITION 2, EVALUATED

`research/discovery-oracle/q10_veto_after_search.py`. D04's trigger has fired — a search now
recovers `phase==endgame AND seconds<45` exactly on a third of `interaction-only` records — so the
condition below that reads *"the vocabulary gains conjunctions"* can be measured instead of waited
for. 400 records per world, 40 games each, 20 to derive, **both pipelines on the same records**: the
shipped chain through the TypeScript bridge, and D04's search through Q7's own `run_record`, at both
of D04's depths because D04 left depth an open trade.

Both halves reproduce first, which is what makes the rest readable: the chain validates a claim on
**12.25%** of `interaction-only` records against Q4's 11%, and the search is on target on **32.75%**
at depth 2 against D04's 33.5%.

### The condition as written is not what happened

It reads: *if `fast AND endgame` becomes expressible, the misattribution this node exists for
largely stops happening.* **It does not stop happening at all.** The chain validates a wrong name on
12.25% of records before the search exists and 12.25% after, because the search is a separate
pipeline and does not touch the chain. The sentence conflated *the product can express the region*
with *the shipped chain stops naming the wrong one*, and only a ported, wired-in search produces the
first.

What changes is the **set of outcomes available on a record where the chain has already gone wrong**,
and that is worth more than the prediction was.

### The four cells, on the records where the chain validated a claim

Pooled over `interaction-only` and `proxy-correlated`, where the planted region is not a bucket and
therefore **every** validated claim names something too wide — 61 claims from 800 records:

| depth | search on target, no veto | on target, **vetoed** | off target, **vetoed** | off target, no veto |
| --- | --- | --- | --- | --- |
| 1 | 28 | 4 | 6 | 23 |
| 2 | 30 | 5 | 5 | 21 |

- **The veto silences 8.2% of wrong names** (5/61 at depth 2; 9.8% at depth 1) — the same wash D08
  already measured, unchanged by the search, as it must be: the veto never sees the search.
- **On 57% of them a right name now exists** (35/61 at depth 2; 32/61 at depth 1). Before D04 the
  only alternative to a wrong sentence was silence. On more than half of these records it is no
  longer.
- **21 wrong names survive with no right name available.** That 34% is what the veto's remaining
  job is actually bounded by.
- **5 were vetoed on records where the search had the right region.** Under this node's design that
  is still correct — attribution withholds and does not rename — but it is the first measured case
  of the veto and the search disagreeing about the same record.

**The false-veto control is unchanged**: on `clean-middlegame` and `clean-fast`, where the planted
region *is* the claimed bucket, **16 of 239 true claims are withheld — 6.69%**, against Q5's 5.6%
worst-case at `ATTRIBUTION_K = 2.5`. The veto costs what it always cost.

**And the search finds regions the chain never claimed at all**: on `interaction-only` it is on
target on a further 24.25% of records where the chain said nothing. That is D04's gain and it is
counted apart, because folding it into the cells above would let the search's benefit be read as the
veto's.

### Where the veto points when it fires — a description, and no rule is read off it

No threshold was declared for this and none is derived from it. It is here because attribution and
the search are the same act from two directions — attribution names **which division** of the
claimed bucket broke it, the search names **a region** — and one of them runs in TypeScript inside
the product while the other is a Python oracle that does not.

On `interaction-only`, all 8 vetoes name a division the search's vocabulary could describe, and the
claim they veto is `phase-endgame` **every time** — recorded rather than inferred, because `splitBy`
is the *dividing* bucket and is never the claimed one. Six of the eight are split by
`fast-under-45s`; the other two by `clock-under-1m`. At **depth 2, 5 of those 8 name the same cut the
search's region is built from**: the chain claims the endgame, attribution says it breaks on the fast
decisions inside it, and the search independently names `phase==2 AND seconds<45.0` — the planted
region. **The cheap in-product test names the missing conjunct.**

The false vetoes come from somewhere specific too, and it is worth writing down because it is
actionable in a way a rate is not. Seven of the fourteen on `clean-middlegame` split by
`slow-over-2m` — a bucket the search's vocabulary cannot express at all and which R-18 measured as
nearly dead on a blitz record. Both on `clean-fast` split by `clock-under-1m`, and clock and think
time are near-duplicates, so the "division" is close to a restatement of the claim. Neither is a
threshold problem, which is the same thing this node said about `ATTRIBUTION_K` from the other
direction.

At **depth 1 the agreement is zero, in every world.** A depth-1 search names one term of the
conjunction and the veto names the other, so the two point at complementary halves of the same
truth and never at the same one. That is not a defect in either; it is what a single-term search
does to a two-term region, and it is the clearest reading yet of why D04's depth is an open trade.

### What this does and does not change

**It does not turn the veto on.** The turn-on trigger below is 60 validation games and this run says
nothing about record size. At 8.2% of wrong names caught for 6.69% of true claims withheld, on a
chain that is silent most of the time, D08's own verdict — *at the record size the product actually
sees, this is a wash* — survives its own reversal condition being met.

**It bounds the veto's value from above.** Once a search exists, silence is the best available
outcome on only the 34% of wrong claims the search cannot name. The veto was designed when silence
was the only alternative to a wrong sentence, and it no longer is.

**It puts a design option on the table that this node did not have.** `splitBy` is currently an
output for a human to pre-register next. On the world this node exists for, it agrees with a
depth-2 search's second term on 5 of 8 firings — so it is also a candidate *input*: a cheap,
in-product, single-comparison suggestion of where a search would look, produced by code that already
ships. Nothing is built on that here, and it is written down rather than acted on.

## REVERSAL CONDITION

Any one of these turns it on, or reopens the design:

1. **A record reaches 60 validation games.** That is the measured point where the veto stops a fifth
   of misattributions for a 1.3% cost, and it is a fact about a record rather than a judgement — the
   condition can be evaluated automatically.
2. ~~**The vocabulary gains conjunctions** (D04). If `fast AND endgame` becomes expressible, the
   misattribution this node exists for largely stops happening, and what remains is a different
   question about a different search.~~ — **fired, evaluated and closed above.** The misattribution
   does not stop happening; what changes is that on 57% of the wrong claims a right name now exists
   somewhere. The condition's replacement is 5 below.
3. **A real record shows the false-veto rate above the 10% ceiling.** The clean plants are
   simulated; a real player whose weakness genuinely spans a whole bucket may still look
   heterogeneous inside it for reasons the worlds do not model.
4. **The chain starts showing claims without the prospective step.** Attribution is measured *after*
   the judge, on validated claims. Without that stage the population it runs on is a different one
   and every number here has to be re-measured.
5. **A search is ported into the product.** Then the 57% of wrong claims a search can name stop
   being hypothetical, the veto's remaining job is the other 34%, and the question becomes whether a
   withheld claim should be replaced by the search's region rather than by silence — which is
   alternative 3 arriving from a direction this node did not consider, and needs its own
   pre-registration rather than this node's answer.
