# Seven mechanisms, and what each one would have to be true for

**The rule this file follows:** a mechanism is listed with the strongest evidence found for it, the
**moderator that decides whether it applies here**, and a prediction that could come back wrong.
A mechanism with a large literature and no local prediction is not evidence for a design; it is a
citation.

**Verification.** Five of the eight sources below were checked against the publisher record in this
pass; three were taken from the brief and are marked `UNVERIFIED`. The distinction is kept because
an unverified citation that later turns out to say something else takes the design with it.

---

## The frame this sits inside, and why it is not optional

`docs/measurement/` ran a falsification programme on the adjacent question — whether a behavioural
transfer measurement could be built — and returned **NO-GO** for the construct as stated. Two of its
conclusions bind everything below:

> **Phase 7 is score validation. Phase 8 is learning validation, and Phase 8 is explicitly blocked
> behind Phase 7.** — [`ANALYSIS_PLAN.md`](../measurement/ANALYSIS_PLAN.md)

> **A rise in *d′* is not learning.** The criterion, not the sensitivity, is what orders rating
> bands. And simulation with a zero true effect produces **+0.2 *d′*** from practice alone. —
> [`GO_NO_GO.md`](../measurement/GO_NO_GO.md)

So a study of the seven mechanisms below cannot use *d′* on the refuted construct as its outcome,
and cannot use pre/post improvement as evidence of anything. Both constraints are load-bearing in
[`EXPERIMENT.md`](EXPERIMENT.md).

---

## 1. Retrieval practice

**Evidence.** Pan & Rickard (2018), *Psychological Bulletin* 144(7), 710–756. 192 transfer effect
sizes from 122 experiments and 67 articles, N = 10,382, forty years of research. Transfer relative
to a non-testing reexposure control: **d = 0.40, 95% CI [0.31, 0.50]**. `VERIFIED`

**The moderator that decides whether it applies here: response congruency.** The meta-analysis names
it as one of three factors that strongly influence whether transfer happens at all — alongside
elaborated retrieval practice and initial test performance. Transfer is best when the response
demanded at test resembles the response practised.

**What that says about this product.** The shipped retrieval test asks for **two different
responses at once**: type your rule from memory, and play a move. `record-service.ts` requires both
for a success. If response congruency is the active moderator, a retrieval step whose practised
response is *typing a sentence* is poorly matched to a criterion whose response is *choosing a
move*, and the current design is on the wrong side of the strongest moderator in the literature.

**Prediction that could come back wrong.** Practising retrieval by choosing a move on a diagnostic
position produces more rule-consistent action later than practising by reproducing the rule as
text. If the two are indistinguishable, response congruency is not the binding constraint here and
this mechanism is not the place to spend.

---

## 2. Contrastive / interleaved practice

**Evidence.** Brunmair & Richter (2019), *Psychological Bulletin*. 59 studies, 238 effect sizes
nested in 158 samples. Interleaved over blocked presentation: **g = 0.42**. `VERIFIED`

**The moderator, and it is in the title.** *Similarity matters.* The advantage is largest where the
categories are similar and hard to tell apart, and it is not uniform across materials.

**What that says about this product.** This is the closest fit of the seven, because the problem is
not "learn what X is" but "tell a position where the rule applies from one where it looks like it
applies and does not". `docs/measurement/` already has the material: on the corpus it scanned,
**14.2%** of trigger-positive items carry a competing tactical explanation and **36.6%** of
trigger-negative captures are materially sound. Those are the near-misses a contrast set is made of,
and they exist in the tree today.

**Prediction that could come back wrong.** Practice that pairs a positive item with its nearest
negative produces fewer false applications than practice on positives alone. If false-application
rates are the same, the discrimination was never the difficulty.

---

## 3. Scaffolded self-explanation

**Evidence.** *Contemporary Educational Psychology* 79 (2024), "Effects of self-explaining feedback
on learning from problem-solving errors". A 2 × 2 between-subjects design crossing feedback
(standard / redesigned) with self-explanation (yes / no). Prompting learners to explain their errors
supported **error correction and near transfer**; scaffolding raised the quality of the explanations;
**changing the layout of the feedback did not affect learning**. Far transfer was not improved.
`VERIFIED`

**What that says about this product, and it is uncomfortable.** The redesign arm is the closest
published analogue of the last several waves of work on how a finding is presented, and it did
nothing. That is one study on one task and it does not transfer automatically to a chess reveal —
but it is the only direct evidence available on the trade, and it points away from presentation and
towards what the reader is asked to *do*.

**Prediction that could come back wrong.** Asking the player to state, before the reveal, what they
would want to notice earlier produces more rule-consistent action later than showing them the same
finding better. If not, the presentation work was the right spend after all.

**And the confound that has to be designed around.** A self-explanation prompt is simultaneously an
intervention and a measurement. `docs/decisions/D21-feedback-exposure.md` is about exactly this
class of contamination, and [`F7`](../measurement/FALSIFICATION_REGISTER.md#f7) records that whether
the instrument trains the behaviour is **untested**.

---

## 4. If–then (implementation-intention) format

**Evidence.** *European Review of Social Psychology* 36(1), 2024,
`10.1080/10463283.2024.2334563`. **642 independent tests**; effective across cognitive, affective
and behavioural outcomes, **.27 ≤ d ≤ .66**. Effects were larger when the plan had a **contingent
if–then format**, when motivation was high, and **when the plan was rehearsed**. `VERIFIED`

**What that says about this product.** The structure already exists: `LearningRule` carries
`trigger`, `missed_signal`, `action_rule`, `exception_rule`, `predicted_outcome` and
`refutation_condition`. The product is already storing an if–then plan with an exception clause.
**What is missing is the third moderator — rehearsal.** A plan authored once and then only tested
after 1, 3, 7 and 21 days is a plan that is never rehearsed, and rehearsal is one of the three
things the meta-analysis says raises the effect.

**Prediction that could come back wrong.** Rules whose if–then form is rehearsed at authoring
produce more rule-consistent action than rules authored in the same fields and not rehearsed. If
not, the fields were doing the work and the rehearsal is ceremony.

---

## 5. Guidance fading

**Evidence.** Springer, *Educational Psychology Review* (2025), `10.1007/s10648-025-10071-x`, on
worked examples and the fading of guidance. `UNVERIFIED — taken from the brief and not checked
against the publisher record in this pass.`

**What it would say about this product.** The current drill states in advance what is under test and
keeps the refutation condition in view for the whole run. That is correct for an audit and it means
the drill can only ever demonstrate **cued** application — [`L1`](../measurement/ECOLOGICAL_EXTRAPOLATION_GAP.md)
on the ladder that document already defines. It cannot be the terminal test of learning, and the
ladder says so independently of any fading literature.

**Why it is not in the first study.** Fading is a schedule over several sessions. It cannot be
isolated in a design that has not yet established that any single component moves the outcome.

---

## 6. Spacing

**Evidence.** Adopted in the product already: `RETRIEVAL_INTERVAL_DAYS = [1, 3, 7, 21]`.

**The honest position.** The spacing literature is large and the schedule is defensible, but **this
product has never observed a single completed schedule**, because no player has used this build. The
interval is not the uncertain part. What is uncertain is what is being tested at each interval, and
that is question 1 and question 7, not this one.

---

## 7. Representative transfer, and what "uncued" has to mean

**Evidence.** Barnett & Ceci (2002) for transfer distance and Dhami, Hertwig & Hoffrage (2004) for
representative design are both already at **tier A** in
[`EVIDENCE_MANIFEST.json`](../measurement/EVIDENCE_MANIFEST.json). Einstein & McDaniel's
monitoring / spontaneous-retrieval distinction is cited there for what "uncued" means. `UNVERIFIED`
for the specific prospective-memory source in the brief (`PMC4868976`); the distinction itself is
already adopted in the tree.

**What it says about this product, measured rather than argued.**
[`ECOLOGICAL_EXTRAPOLATION_GAP.md`](../measurement/ECOLOGICAL_EXTRAPOLATION_GAP.md) places the
current design at **L2, aspiring to L3, and not reaching L3 today** — because the obvious item
source, the Lichess puzzle bank, is selected by an engine-uniqueness rule with no counterpart in
ordinary play.

**Which means the sixth outcome anyone would want — did it show up in a real blitz game — is L5,
four rungs above where the instrument stands.** It is not a metric this study can carry.

---

## What the observational chess result does and does not license

Southwick, Harwell, Wright, Olsen & Ogles (2026), "Not All Practice Is Created Equal: Longitudinal
Evidence From Over 40,000 Chess Players", *Psychological Science*, `10.1177/09567976261452568`.
N = 44,213 with time-stamped activity and performance; **more than 90% of player time was games**,
and deliberate-practice-aligned activity was associated with a **3.61×** learning-efficiency
advantage over gameplay. `VERIFIED`

**It licenses a hypothesis about where time should go. It does not license 3.61 as a coefficient.**
The design is a longitudinal cohort, not a randomised trial: players who choose puzzles and analysis
differ from players who only play, in motivation and in everything correlated with it. The number
belongs in the motivation section of a study and nowhere in its arithmetic.

**What it does support is a change of role rather than a change of amount:** if blitz is where 90%
of the time already goes, blitz is the cheapest place to *observe* whether something survived, and
the most expensive place to try to teach. That is a design consequence, and it is the one claim from
this paper carried into [`EXPERIMENT.md`](EXPERIMENT.md).

---

## The ranking, and what it is a ranking of

Not "which mechanism is most effective". **Which is testable first at the lowest cost against
machinery that already exists**, with a result that would change what gets built:

| rank | mechanism | why first | what already exists |
| --- | --- | --- | --- |
| **1** | retrieval **response congruency** | tests the strongest moderator of the largest meta-analysis, against a shipped retrieval step that is on the wrong side of it | `RETRIEVAL_INTERVAL_DAYS`, the transfer runner, the withheld rule |
| 2 | contrastive near-miss practice | the near-miss items are already measured and in the tree | the corpus scan in `research/measurement/` |
| 3 | if–then **rehearsal** | the plan structure ships; only the rehearsal is missing | every field of `LearningRule` |
| 4 | scaffolded self-explanation | largest design change, and doubles as a measurement — needs the reactivity question answered first | the reflection draft |
| 5–7 | fading, spacing, representative transfer | schedules and item banks; all blocked behind an outcome that moves at all | — |
