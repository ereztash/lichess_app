# D23 — is there a teaching step between an insight and a change in what the player does?

> **SUPERSEDED IN PART BY [D24](D24-learning-architecture.md), AND CORRECTED ON TWO POINTS.**
> The finding that no teaching step exists stands. Two things below are wrong:
> **(1)** the `47–81%` figure is the probability of passing **one sitting**; `replicated` requires
> **two separate passing days**, so the null is P(pass)² — **9–65%**.
> **(2)** the recall scorer is materially better than described — stop-list, Hebrew normalisation,
> a two-word absolute floor beside the ratio, an `isScoreable` guard, symmetric refutation, and
> unseen non-opening transfer positions.
> D24 also supersedes this node's choice of first experiment: Study 0 is a well-designed study of
> the wrong question. See [`docs/learning-v2/`](../learning-v2/).


**Mode:** `DEFER` — the layer does not exist, one study that would earn the first component is
specified, and the condition that would say the current design is fine is written into it.
**Evidence level:** E1 — external implementations exist and are evidenced in the literature; nothing
has been prototyped here and no person has been measured. E1 permits a research prototype and
nothing more.
**Depends on:** `shared/learning-record.ts`, `shared/record-service.ts`, `docs/learning/`,
`docs/measurement/GO_NO_GO.md`, `docs/measurement/ECOLOGICAL_EXTRAPOLATION_GAP.md`,
`docs/decisions/D21-feedback-exposure.md`.

## CLAIM

The product is built as an instrument for **measuring** a player and not for **teaching** one, and
the gap is structural rather than presentational. `FindingCard` says what may be believed;
`LearningRuleComposer` collects the player's own if–then rule; `formLearningRule` files it and
schedules a retrieval test. **Between the authoring step and the test there is no step that teaches
anything**, so the question *"how do we present an insight better"* is being asked in the place
where the missing thing is not presentation.

## WHAT WAS FOUND WITHOUT MEASURING A PERSON

Three defects in the existing layer, each settled by reading the tree or by arithmetic, and each
recorded in [`docs/learning/FALSIFICATION_REGISTER.md`](../learning/FALSIFICATION_REGISTER.md):

**The transfer bar has no null model.** `TRANSFER_POSITION_COUNT = 3`,
`TRANSFER_MINIMUM_SUCCESSES = 2`. At per-item rates the components plausibly produce, the grade
`replicated` arrives **9–65%** of the time whether or not anything was learned *(corrected — the original 47–81% was the one-sitting figure)*. Nothing in the
repository estimates the base rate, so nothing subtracts it.

**A graded success is not rule use.** `record-service.ts` scores one as *word-overlap recall floor
cleared* **and** *move accurate*. The repo already documents the first as "not a memory measure";
the second is what an unaided player of that strength does anyway. It is the substitution
[F3](../measurement/FALSIFICATION_REGISTER.md#f3) refuted one level down, in a weaker form — and
`applied_rule`, the only term in the record that is actually about the rule, is collected and then
excluded from the grade.

**Efficacy is not obviously good here, and this is new.** The rule is `authored_by: "player"`, filed
at `grade: "hypothesis"`, and rehearsed from day one; the grade moves to `replicated` or `refuted`
only after retrieval has been running for up to 21 days. On the cleanest rule class the measurement
programme could find, the prescribed act **loses ≥ 100 cp on 15.0% of the items where the rule says
to act**. A layer that makes rules stick, applied to a rule that is wrong, makes a mistake stick.
The current layer is partly protected by its own weakness, and strengthening it removes that
protection.

## ALTERNATIVES

1. **Keep improving how the finding is presented.** The closest published analogue —
   *Contemporary Educational Psychology* 79 (2024), a 2 × 2 crossing feedback redesign with
   self-explanation — found that **changing the layout did not affect learning** while the
   self-explanation prompt did. One study, one task, and the only direct evidence on the trade.
2. **Build the whole six-stage sequence** (contrast → self-explanation → if–then → retrieval →
   fading → spacing) and evaluate it as a bundle. A positive result would name no component, and
   each component costs a different amount.
3. **Run the four-arm cumulative comparison the brief proposed.** Needs ~446 participants to see a
   0.3 difference; eight to thirty are available.
4. **Isolate the single component that is testable against machinery that already ships**, and let
   its result decide whether the rest is worth buying.
5. **Fix the instrument first** — give the transfer bar a null model and score on rule-consistent
   action — and defer every intervention question behind it.

## DECISION

**4, with 5 folded into it, and 1 explicitly deprioritised.**

The study is [`docs/learning/EXPERIMENT.md`](../learning/EXPERIMENT.md): **response congruency in the
retrieval step**, as a within-participant multiple baseline across rules. It is chosen because it
tests the strongest moderator of the largest relevant meta-analysis (Pan & Rickard 2018, transfer
d = 0.40 [0.31, 0.50], moderated by response congruency) against a shipped retrieval step that
demands the *text* response while the criterion is a *move*; because the manipulation is subtractive,
so a positive result cannot be extra effort; and because it needs **no new measurement machinery** —
the outcome is scored from the rule text and the move, both already in the record.

**The instrument fix is not a separate project.** Scoring on rule-consistent action with the corpus
base rate as a covariate *is* the outcome definition, so alternative 5 is satisfied by running the
study rather than by preceding it.

**Nothing ships on a positive result.** E1 permits a research prototype. A component that separates
earns the right to be proposed, which is its own decision.

**And the framing was corrected.** The brief asked for a study that would show the current loop is
inferior. This one is symmetric, and the outcome that says *the current design is fine* — no
separation once base rate is in the model — is declared before the run and is the outcome the design
estimates best.

## WHAT IS EXPLICITLY NOT DECIDED

That micro-training beats the current loop. Nothing here measured a person.

That the observational chess result is a coefficient. Southwick et al. (2026), N = 44,213, found
**3.61×** learning efficiency for deliberate-practice-aligned activity over gameplay, with >90% of
time spent on games. It is a longitudinal cohort: players who choose puzzles differ from players who
only play, in motivation and in everything correlated with it. It motivates a change in **the role**
of blitz — the cheapest place to observe whether something survived, the most expensive place to
teach — and it enters no arithmetic.

That five of the six outcomes anyone would want are available. Trigger sensitivity, false
application, uncued transfer and ecological transfer are each blocked upstream, and the reason is
recorded per outcome in [`EXPERIMENT.md`](../learning/EXPERIMENT.md).

## REVERSAL CONDITION

Any one of these reopens it:

1. **The study returns no separation.** Then response congruency is not the binding constraint here,
   the text step stays, and the next candidate is contrastive near-miss practice — for which the
   items already exist in `research/measurement/` (14.2% of trigger-positive items carry a competing
   explanation; 36.6% of trigger-negative captures are materially sound).
2. **The harm series rises with the headline series.** Then the component works and must not ship,
   L8 is the finding, and the question becomes whether a player-authored rule may be rehearsed at
   all before it is graded.
3. **`docs/measurement/`'s Phase 7 completes and an item bank exists.** Then trigger sensitivity,
   false application and L3 transfer become measurable, and this study's outcome is a narrow
   substitute for a better one rather than the only one available.
4. **A real player uses the build.** Every number in `docs/learning/` is arithmetic over the code
   and over published effects. The base rates that decide whether the transfer bar clears chance
   are properties of players, and none has been observed.
5. **The reactivity question is answered.** [F7](../measurement/FALSIFICATION_REGISTER.md#f7) and
   D21 both record that whether the instrument is itself an intervention is untested. Until it is,
   the self-explanation mechanism — the one with the most directly relevant published result —
   cannot be studied here without contaminating its own baseline.
