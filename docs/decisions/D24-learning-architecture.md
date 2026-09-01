# D24 — can the Insight → Action → Uncued Transfer layer be evaluated at all?

**Verdict: `NARROW`.** Stated in full at the foot of this file.

> **This node reached `MEASUREMENT-BLOCKED` first, and changed within the hour.**
> [`docs/measurement/RULE_CLASS_SEARCH.md`](../measurement/RULE_CLASS_SEARCH.md) merged into `main`
> while this research was being written, and it found the thing the blocked verdict said did not
> exist: a rule class in which the prescribed act identifies rule use. The first verdict is left
> recorded rather than deleted, because **how it failed is the useful part** — it predicted that a
> null would mean *the item definition is the blocker, not the domain*, and that is exactly what
> turned out to be true.

**Evidence level:** E0 for the layer — an idea, nothing built, nobody measured. E1 for the
mechanisms, which have external implementations and verified literature.
**Supersedes:** [D23](D23-insight-to-action.md)'s choice of first experiment, and corrects two
factual errors in it.
**Depends on:** [`docs/learning-v2/`](../learning-v2/), all of [`docs/measurement/`](../measurement/),
`shared/learning-record.ts`, `shared/recall-score.ts`, `shared/record-service.ts`,
`shared/evidence-authority.ts`, `client/src/components/FindingCard.tsx`, `LearningRuleComposer`.

## CLAIM UNDER EXAMINATION

> After receiving valid evidence and an intervention, when a new situation occurs in which the
> learned trigger is genuinely present, the player independently recognizes its relevance and
> changes their decision process in the direction of the learned rule, without a rule-specific cue
> from the system. When the trigger is absent, the behaviour does not appear merely because the
> player was trained to perform it.

Both halves are required. The second half is not a caveat on the first; it is half the construct.

## WHERE EVERY EXISTING MEASUREMENT SITS ON THE LADDER

| measurement in the repo | highest level it can support |
| --- | --- |
| `scoreRecall` lexical floor | **L0** — and weakly: its own docblock says it is *"not a memory measure"*, it has **no reliability coefficient**, and a generic sentence with no rule knowledge beats **2 of 8** realistic rules |
| `accurateDecision` on a transfer position | **L4 at most**, and only if the act were rule-specific, which F3 refuted |
| transfer `successes` = recall floor **AND** accuracy | **L0 ∧ L4**, which is not L5 and is not a conjunction anyone validated |
| `grade: replicated` (2 of 3, on two separate days) | a **pass rate with no null model** |
| the drill | **L4** — it states in advance what is under test |
| blitz play | nothing. There is no hook |

**Nothing in the repository measures above L4, and the target is L5–L6.**

## TWO CORRECTIONS TO D23

1. **`replicated` is not reached 47–81% of the time from base rates.** That is the **one-sitting**
   figure. The grade requires **two separate passing days**, so the null is P(pass)² — **9–65%**
   across the same range. D23 overstated the defect by a factor of 1.5–5.
2. **The recall scorer is materially better than D23 described** — stop-list, Hebrew normalisation,
   a two-word absolute floor beside the ratio, an `isScoreable` guard, symmetric refutation, and
   unseen non-opening stride-spread transfer positions. The repo had already measured its own
   adversarial rate and cut it from 6/8 to 2/8.

**The corrected picture is narrower and worse:** the instrument is more careful than D23 said and
still cannot reach the construct. The defect is not sloppiness. It is that the thing being measured
is not the thing that matters.

## WHAT CHANGED THE VERDICT

**A signature exists, for one rule class.** `RC-06 answer-the-mate-threat`: `B_valid` **.968** on
trigger-positive items against **.200** on trigger-negative, separation **+0.768** against the
refuted incumbent's +0.600; the prescribed act is the engine's own best move on **242 of 242** items
where the rule prescribes anything; following it costs a **median +1 cp** and loses ≥100 cp on
**2.9%**, against 14–15% for the incumbent. Its *d′* orders rating bands monotonically for the first
time in this programme.

That answers **H14**. **H16** is answered in the corpus too — the screen is built on a
trigger-negative cell — though not in the product, which never shows a player a position where their
rule does not apply.

### One sentence in that paragraph does not survive being checked

*"Its* d′ *orders rating bands monotonically"* is true, and it is the half of the pair that flatters
the rule class. **The criterion moves too, from +0.257 to −0.113, and it moves more.** Of the
**+19.8** points of trigger-positive hit rate between the bottom and top bands, freezing *c*
reproduces **+8.1** and freezing *d′* reproduces **+12.3** — an ordering that holds at all three
anchor choices. The false-alarm rate **rises** across the bands, .199 → .236.

`RULE_CLASS_SEARCH` states the hedge in one sentence and does not quantify it, so nothing there is
wrong. **What is wrong is the reading a reader supplies** — that stronger players *see* the threat
better. Mostly they are readier to answer it.

### ...and then that correction was itself wrong

The paragraph above read the criterion as a **willingness** — stronger players being readier to play
the mate-answering move — and built a harm argument on it. Checking that reading is
[`CRITERION_CHANNEL.md`](../learning-v2/CRITERION_CHANNEL.md), and it comes back against it.

**`_threat_satisfies` is the only predicate of the twelve that branches on the trigger.** On T+ it
asks *"does the opponent still have mate in one"*; on T− it asks *"does the opponent still have any
check at all"*. A hit and a false alarm are **different acts**, so the pair is not a
signal-detection contrast and *c* is not a response bias. Three measurements say so:

| | |
| --- | --- |
| a **move-blind** agent picking uniformly among legal moves scores | *d′* **0.80**, *c* **+0.88** |
| across the twelve rule classes, move-blind *c* predicts observed *c* at | **r = +0.72** (52%) |
| `RC-09` vs `RC-11` — same trigger, same corpus, same noise cell, outcome vs method — moves *c* by | **+0.524** |

That last one is the controlled experiment, and it was already in the data. **Same players, same
positions; only the sentence changed.** It moves the criterion further than the entire rating-band
shift did.

**What survives:** the arithmetic. Bootstrapped, P(criterion term > sensitivity term) = **1.000**;
*A′* and *B″_D* agree with the parametric pair. **What is withdrawn:** that any of it describes a
player's willingness. And **H19's harm mechanism goes with it** — it needed the two cells to be the
same act. The 34.0% / ≥100 cp figure is the cost of *following the rule* on T− items, not the cost
of that false-alarm cell, and D24 used it as though it were the second.

**More than half the bottom band's *d′* of 1.180 is available to an agent that knows no chess.**
Corrected for that floor, sensitivity still orders the bands — 0.380 → 0.866, a **2.3×** span rather
than 1.41× — so [H17](../learning-v2/FALSIFICATION_REGISTER.md)'s headroom finding is unaffected.

See [H18, H19, H20, H21](../learning-v2/FALSIFICATION_REGISTER.md); arithmetic in
[`headroom.py`](../../research/learning/headroom.py) and
[`criterion_channel.py`](../../research/learning/criterion_channel.py).

**And the headroom is real but band-dependent.** Unaided players already answer the threat on
**.716** [.696, .735] of trigger-positive positions — **.63** at 1200–1400, **.83** at 1800+. The
objection *"players already do this"* is wrong at the bottom of the range and close to right at the
top, which makes it a recruiting constraint on Study D rather than a reason not to run it (H17).

**What did not change, and it is why the verdict is `NARROW` and not `PROCEED`:**

1. **RC-06 is expert-screened. The product is not.** Nine of ten candidate rule classes, *designed
   by a researcher*, scored below a rule class already known to be uninterpretable. The product
   accepts whatever a novice types into six free-text fields. **The gap between 2.9% and 15% is what
   screening is worth, and the product performs none.**
2. **RC-06's signature is a cued one.** The target is *uncued*. The screen's own literature search is
   blunt about the gap: validated paradigms exist for check, mate and threat detection, and
   **"every one measures whether the player SAW it. None measures whether the seeing governed the
   move."**
3. **Exchangeability is not solved.** max |SMD| between T+ and T− is **0.573**, and
   `negative-controls.ts::itemDifficultyConfound` shows a zero-discrimination agent producing a large
   *d′* on unbalanced items.
4. **The base rate is 1.24%.** RC-06 fires on 2,080 of 180,000 not-in-check positions, so a
   within-person design needs constructed items — which reopens representativeness.

## AND ONE FINDING THAT REORDERS THE ARCHITECTURE

`mayPrescribe` is true for exactly one authority level, `tested`. It is enforced in **exactly one
place**: `FindingCard.tsx:135`, deciding one line of card copy. **It never reaches the rehearsal
path.** `formLearningRule` files a player-authored rule at `hypothesis` and schedules retrieval for
the next day; the grade settles only after up to 21 days of rehearsal.

The product therefore has a prescription gate in its vocabulary, applies it to a sentence, and does
not apply it to the mechanism that makes a rule stick. **FSRS's authors say their scheduler cannot
assess content quality and was never designed to.** A teaching layer is an amplifier, and this one
would run before the sign is known.

## SEQUENCING

| | sequence | verdict |
| --- | --- | --- |
| A | insight → teach → test | **rejected.** Rehearses before the sign is known; H13 |
| B | insight → test → teach | **circular here.** The test that would validate the rule is the same behavioural measurement H14 says does not exist |
| C | insight → content-validity gate → teach → behavioural test → ecological test | **preferred, and now partly buildable.** The gate is engine adjudication of the prescribed act — which the rule-class screen has just demonstrated at scale. The behavioural stage is buildable for a screened rule class. The ecological stage is not |

**C is preferred, and the screen showed what its first stage looks like in practice.** Stages 1–3
are buildable for a screened rule class; stage 4 is not, and no product audited has ever built it.

## THE NEXT STEP

[`docs/learning-v2/EXPERIMENT.md`](../learning-v2/EXPERIMENT.md) — **Study D**: on RC-06 items, does
**detection** of the mate threat predict **rule-consistent action**, once strength is controlled?
Order is counterbalanced, and the difference between orders **is** the reactivity estimate — a
quantity this repository has never had and which gates the whole self-explanation branch.

It is selected because both outcomes point at different products: if detection predicts action the
barrier is recognition and trigger focality is the intervention; if it does not, the barrier is
action selection and if–then compilation is. **Choosing an intervention before that is known is
aiming at a guess.**

It carries **four amendments made after it was designed**, all from checks run against it rather
than for it: the unaided human baseline is now stated in the design rather than absent from it;
recruitment is constrained to 1200–1600, where the miss cell is 37% rather than 17%; a third
falsification criterion covers hits and false alarms moving together; and **the study may no longer
report a criterion for RC-06 at all**, because on this rule class there is none to report.

**Study D was never a criterion study**, which is why H20 does not sink it — it asks whether
*detection* predicts *action*, and both of those are measured on trigger-positive items where the
predicate is well defined. What H20 removes is the secondary reading D24 had started to hang on it.

**It replaces D23's Study 0**, which remains a well-designed study of the wrong question: response
congruency is already the settled convention in the largest chess-learning product, its outcome is
L4, and it addresses none of the top barriers.

## STRONGEST PERMITTED CLAIM

> **Permitted:** *Decision Lab can state what a record justifies believing, can elicit a
> player-authored if–then rule with an exception clause and a falsifier, can withhold that rule and
> ask for it back after 1, 3, 7 and 21 days, and can score whether the returned text lexically
> overlaps the original and whether the move played was accurate.*
>
> **Permitted, newly, and only for a screened rule class:** *for `RC-06`, whether a player's move
> satisfies the rule can be checked against an engine-validated prescription, and the same check on
> trigger-absent items gives a false-application baseline.* That is a **cued conditional
> discrimination** measurement (L3–L4).
>
> **Refused:** *that any of this measures whether a rule was recognised unprompted, or whether
> anything transfers to ordinary play.* No claim at L5 or L6 may be made from any measurement in
> this repository. **No L3–L4 claim may be made for a player-authored rule**, because the screening
> that makes RC-06 measurable is exactly what player authoring omits.

## SOURCE STANDARD

Source hierarchy 1–7 as the mission defines it. **Thirteen load-bearing sources verified** against
publisher, DOI index or official documentation; **five marked `UNVERIFIED` or inherited** and
carrying no claim. Ledger: [`THEORY_EVIDENCE.md`](../learning-v2/THEORY_EVIDENCE.md). No effect size
is transposed into chess. No marketing copy is cited as validation. Tier-6 user signal is used to
generate hypotheses and never as effectiveness evidence.

## REVERSAL CONDITION

1. **Study D finds detection predicts action.** Then the barrier is recognition, trigger focality
   becomes the first intervention, and the composer gains a constraint it does not have.
2. **Study D finds a large order effect.** Then prompt-based measurement is inadmissible here, D21's
   exposure problem becomes primary, and the self-explanation branch closes.
3. **A player-authored rule is screened and passes.** The whole `NARROW` hinges on RC-06 being
   expert-designed. A screening step applied to player rules — engine adjudication of the prescribed
   act, which now demonstrably scales — would widen the claim back towards the product's actual
   content. **This is the most valuable follow-up and it is buildable.**
4. **Someone measures whether seeing governs the move.** V15 says nobody has. If that changes, the
   experiment below is superseded by better evidence than it can produce itself.
5. **The chance-corrected criterion is measured across the eleven non-branching rule classes.**
   That needs no corpus, no participants and no product change — the data is already collected —
   and it is the only way to find out whether a criterion channel exists at all once predicate
   geometry is subtracted. **This is the cheapest open question in the programme.**
6. **The construct is renamed rather than widened.** A cued-discrimination claim on a screened rule
   class is legitimate and defensible — it is simply not *transfer*, and calling it that would be the
   substitution everything here exists to prevent.

---

# `NARROW`

The construct survives, and the narrowing changes what the product would be.

**It survives as:** *cued conditional discrimination on an expert-screened, severity-protected
defensive rule class.* That is measurable today, on RC-06, with an engine-checkable prescription and
a real trigger-negative baseline.

**It does not survive as:** *delayed, unprompted, context-appropriate transfer of a player-authored
rule.* Three things stand in the way and each is now specific rather than vague — the screening the
product omits, the uncued measurement nobody in the field has built, and an item base rate of 1.24%
that forces constructed items.

**Do not build the learning layer yet, and the reason has changed.** It is no longer *"the
instrument would return a number about something else"*. It is that **one measurement decides which
layer to build** — whether the barrier is seeing it or acting on it — and that measurement takes one
sitting with eight to thirty people and no product change at all.
