# D08 — can anything tell the named region from a bucket that merely overlaps it?

**Mode:** `DEFER` — the test is built and measured; it is not wired into the claim path, and the
trigger that would wire it in is written down below.
**Evidence level:** E3 — it passes the planted harness. It has never seen a real record.
**Depends on:** `shared/discovery/attribution.ts`, `research/discovery-oracle/q5_attribution.py`,
`docs/discovery-v2/M0_AUDIT.md` §Q4.

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

## REVERSAL CONDITION

Any one of these turns it on, or reopens the design:

1. **A record reaches 60 validation games.** That is the measured point where the veto stops a fifth
   of misattributions for a 1.3% cost, and it is a fact about a record rather than a judgement — the
   condition can be evaluated automatically.
2. **The vocabulary gains conjunctions** (D04). If `fast AND endgame` becomes expressible, the
   misattribution this node exists for largely stops happening, and what remains is a different
   question about a different search.
3. **A real record shows the false-veto rate above the 10% ceiling.** The clean plants are
   simulated; a real player whose weakness genuinely spans a whole bucket may still look
   heterogeneous inside it for reasons the worlds do not model.
4. **The chain starts showing claims without the prospective step.** Attribution is measured *after*
   the judge, on validated claims. Without that stage the population it runs on is a different one
   and every number here has to be re-measured.
