# Next human experiment — blocked until the pre-human gates pass

**Study D — detection → action on RC-06 items, with order counterbalanced.**

**STATUS: SPECIFIED, NOT YET ADMISSIBLE.**

Do not recruit participants until both upstream gates in
[`PRE_HUMAN_GATES.md`](PRE_HUMAN_GATES.md) pass:

1. **Gate A — action-set validity**: the RC-06 signature must survive a set-valued decision analysis,
   not only the binary question of whether the single engine-best move satisfies B.
2. **Gate B — exchangeability / minimal functional twins**: the T+/T− contrast must survive item
   balancing and a stronger minimal-pair test.

Study D is therefore the **next human study**, not the next overall step.

---

## Why the order changed

An earlier version of this file made Study D the immediate next experiment because the rule-class
screen found one usable action signature: `RC-06 answer-the-mate-threat`.

The subsequent third rule-class round screened **15 rule classes across 8 families and 3 selection
strategies** and left RC-06 as the only eligible candidate under the current screen. More importantly,
it retracted the design story derived from the previous batch: choosing new candidates from the
`noise-cell-first` hypothesis was enough to reverse the correlation pattern that motivated it.

What survives is narrower:

- RC-06 is an observed survivor under the current binary action signature;
- no rule for predicting a usable rule class is currently supported;
- true chess knowledge need not imply one unique best action;
- RC-06 still has max |SMD| **0.573** between T+ and T− items.

That makes a human study premature until the action model and item comparison survive direct attack.

---

## What Study D will ask if the gates pass

> On positions where a mate threat exists, does a player's **detection** of that threat predict a
> **rule-consistent action**, over and above general playing strength, and how much does asking about
> the threat itself change the subsequent action?

This is the open arrow left by the chess literature and by the repo's measurement work:

```text
TRIGGER RECOGNITION  →  ACTION SELECTION
```

Validated chess paradigms found by the literature search measure whether the player saw/detected the
relation. They do not establish that the detection governed the move without the measurement itself
becoming part of the task.

---

## NULL / ALTERNATIVE

- **H₀:** once strength and item are controlled, detection adds no predictive information about
  rule-consistent action. The barrier is downstream of recognition.
- **H₁:** detection predicts rule-consistent action. Recognition/focality is a plausible barrier.

Neither result is interpreted as learning. This is construct validation for a later learning study.

---

## UNIT OF ANALYSIS

The **item within participant**.

Planned model: mixed-effects logistic model of rule-consistent action, with random intercepts for
participant and item, detection as the focal predictor, and strength band as a covariate. Item-level
properties from Gate A/B remain in the analysis rather than being discarded after item construction.

---

## ORDER MANIPULATION / REACTIVITY ESTIMATE

| condition | sequence |
| --- | --- |
| **DETECT-FIRST** | "is there a mate threat here?" → choose a move |
| **MOVE-FIRST** | choose a move → "was there a mate threat?" |

Assigned within participant and counterbalanced across items/pairs.

Asking about the threat before the move is a cue. The difference between orders is therefore an
estimate of **measurement reactivity**, not a nuisance to be explained away.

If feasible under the minimal-twin bank produced by Gate B, prefer assigning the move response and
the explicit detection response to opposite members of a twin pair, counterbalanced across
participants, so the primary natural-action observation is not preceded by the detection prompt.
The DETECT-FIRST arm then exists specifically to estimate reactivity.

---

## BASELINES

- **Per-item chance rate:** share of legal moves satisfying B; the old RC-06 screen averaged `.317`
  on T+ items. Carry the item-specific value rather than one global constant.
- **Trigger-negative behaviour:** false application is reported separately, never folded into a
  single accuracy score.
- **Unaided historical player behaviour:** pooled trigger-positive rule-consistent action `.716`
  [.696, .735], approximately `.63 → .83` across the existing rating bands. This is a headroom and
  recruitment constraint, not a causal baseline for the new study.
- **Domain-value baseline:** replace the old binary `B_valid` interpretation with the Gate-A
  action-set quantities once available (`V_B`, `V_notB`, action-set advantage, regret, robustness).
- **The move-blind floor, which is the baseline the *instrument* has to beat.** An agent picking
  uniformly among legal moves scores hit **.317**, false alarm **.101** — and therefore *d′* **0.80**
  and *c* **+0.88** — on RC-06's own predicate sizes. **More than half of the lowest rating band's
  measured *d′* of 1.180 needs no knowledge of chess.** Any sensitivity this study quotes is reported
  against that floor, never against zero
  ([H22](FALSIFICATION_REGISTER.md#h22), [`CRITERION_CHANNEL.md`](CRITERION_CHANNEL.md)).

---

## OUTCOMES

Primary behavioural quantities are reported separately:

1. trigger-positive rule-consistent action;
2. trigger-negative rule-consistent action / false application;
3. sensitivity only, reported against the move-blind floor — **not criterion, and on RC-06 this is
   not a judgement call.** The two cells score different acts (a hit is *"no mate in one"*, a false
   alarm is *"no check at all"*), so no response criterion is identified and none may be reported.
   This is a **declared deviation** from `ANALYSIS_PLAN.md` §1.2, whose stated reason for trusting
   the criterion — *"the corpus audit found the criterion gradient cleaner than the sensitivity
   one"* — is what [H22](FALSIFICATION_REGISTER.md#h22) undermines;
4. reactivity from order / prompt exposure;
5. action-set regret / harm for the move actually chosen.

**Accuracy alone is never the outcome.**

A headline improvement that raises both hits and false alarms is **not** to be called a criterion or
bias shift on this rule class — on RC-06 no such parameter is identified
([H22](FALSIFICATION_REGISTER.md#h22)). Report it as **both cells moved**. What that would mean is
that the procedure changed behaviour on trigger-negative positions too, which is a reactivity and
harm finding and is damaging enough on its own without borrowing a name it has not earned.

---

## HARM

The old binary screen measured RC-06 rule-following as a ≥100 cp loss on 2.9% of T+ items and 34.0%
of T− items. Those numbers are retained as historical diagnostics but do not substitute for Gate A's
set-valued action analysis.

The harm question is primary:

> Did the procedure increase a useful conditional discrimination, or merely make the player more
> willing to perform B everywhere?

**On RC-06 that question cannot be answered as posed**, because "perform B" is not one act across the
two cells. It is answerable on a **method-shaped** rule class, where `B` is a property of the move
rather than of a threat's survival — which is the cheapest open item in the programme, needing no
corpus, no participants and no product change ([H23](FALSIFICATION_REGISTER.md#h23)).

---

## TRANSFER LEVEL ACTUALLY TESTED

At most **L3–L4 construct validation**. The position is presented and the task is experimental.

Study D does **not** establish:

- delayed transfer;
- spontaneous/uncued recognition in ordinary play;
- ecological Blitz transfer;
- transfer of a player-authored rule;
- that an instructional intervention caused anything.

---

## WHAT IS DELIBERATELY NOT CLAIMED

- RC-06 generalises to player-authored rules. Fourteen of fifteen researcher-designed candidates
  failed the current rule-class screen.
- The old binary best-move signature is domain-complete. Gate A exists because that is unresolved.
- T+ and T− are exchangeable. Gate B exists because they are not yet.
- A forced detection response is equivalent to spontaneous detection in a game.
- A detection→action association identifies the best teaching mechanism by itself.

---

## SAMPLE DESIGN — ONLY AFTER GATES A/B

- **Participants:** 8–30, within-participant design; no conventional between-groups efficacy trial.
- **Strength:** prioritise 1200–1600 for the first construct-validation pass because the historical
  miss cell is materially larger there than at 1800+; report exact distribution rather than treating
  the band as homogeneous.
- **Items:** use the Gate-B bank, retaining pair identity and action-set diagnostics from Gate A.
- **Item provenance:** every item records whether it is natural-matched or a minimally transformed
  twin and exactly what transformation generated it.

---

## STOP RULE

Before the first participant:

- freeze item bank;
- freeze twin transformations;
- freeze model specification;
- freeze hypotheses and interpretations;
- freeze the reactivity comparison.

No interim look used to redesign the item bank or outcome.

---

## FALSIFICATION CRITERIA

- **Gate failure before recruitment:** Study D does not run.
- **H₀ retained:** detection adds no useful information about action once strength/item are in the
  model.
- **Reactivity dominant:** asking first changes action by an amount comparable to or larger than the
  detection association; prompt-based measurement is not a neutral instrument.
- **Criterion dominant:** hits and false applications move together; the procedure changes response
  bias rather than discrimination.
- **Item dominant:** item/pair effects explain the apparent relationship better than person-level
  detection; return to the item paradigm rather than interpreting a player construct.
- **Harm dominant:** rule-consistent action increases where Gate-A regret says B is costly; the
  procedure teaches compliance, not conditional control.

---

## INTERPRETATION IF RUN

| result | permitted reading | next research object |
| --- | --- | --- |
| detection predicts action, low reactivity | recognition/focality is a plausible bottleneck | contrast / focal-trigger intervention |
| detection does not predict action | barrier is downstream of seeing | action selection / if–then compilation |
| large order effect | the prompt is part of the causal system | nonreactive/process measurement |
| hits and false alarms rise together | criterion shift | boundary / T− discrimination, not more T+ practice |
| item effects dominate | instrument measures items | redesign task / process evidence |
| harm rises | rule-consistent compliance is not learning | strengthen content-safety gate |

---

## COST

The human component remains small: 8–30 participants, one sitting each, repeated items.

But **zero participants are the correct cost until Gate A and Gate B are finished**. The existing
15-class corpus and RC-06 positions should absorb the next uncertainty first.
