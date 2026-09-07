# Five interaction architectures, and what would tell them apart

Phase 4 and Phase 5 in one document, in that order: the alternatives are described in full before
the scoring framework, and the framework is stated in full before any score.

The question none of them is allowed to answer by assertion:

> **While evidence is still mutable, minimise cognitive intervention. Once the window closes,
> maximise the learning the evidence actually justifies.**

## Two hard constraints every alternative is checked against

Not preferences. Both are already enforced and an architecture that breaks either is not on the
table.

**K1 -- reachability.** `GATE-REACHABILITY` requires the front door to reach a **scored** decision.
Scoring requires a stated confidence, so the first decision of a session cannot be move-only.
`shared/confidence-asked.ts` puts `first` in `ALWAYS` for exactly this reason and records what
happened when it did not: *"a front door whose success rate is one in four is not a front door."*

**K2 -- no self-selected instrument.** Whoever skips the confidence question skips it because of how
they feel about the position, which curates the sample on the measured variable. Sampling may be by
a hash; it may never be by the player. Any architecture that makes an instrument optional is
rejected on this ground alone, not on taste.

---

## A -- Current architecture plus surface cleanup

**Flow.** Unchanged. `DECIDE → COMMIT → [counterfactual, 35%] → REVEAL`, with `stepsFor` deciding
which of four steps a decision asks for.

**What changes.** Only the four `REPO-CERTAIN` contradictions from the ledger:

- C3 -- `.commitment-intro` names steps the state does not offer, on ~6 ordinary decisions in 7.
- C6 -- the two read steps carry `חובה` on a `first` decision, which `draftProblems` does not require.
- D8 -- `.board-note` tells a first-time arrival they came back to a game they never played.
- F1 -- `WhatThisIs` describes the loop as always move → reads → confidence.

**Evidence captured.** Identical to today. Move, reads (sampled), confidence (sampled),
candidates, seconds, probe (35%).

**What the player must understand.** Which steps this decision asks for -- correctly stated, for
the first time. Why the engine waits. That placing a move on the board records it.

**Hidden / deferred.** Exactly as today: the engine, every reading of the record except the loop
position, the toolbox, the evaluation bar.

**Reveal.** Unchanged: limits, one thing, evidence class, basis, next question, accumulation, one
continuation control.

**Accumulation.** Unchanged: a per-kind count once `n ≥ 2`.

**Measurement risks.** None introduced. The window keeps every `TEST` row in the ledger:
the ribbon's record reading (B1-B3), the option menus (C12-C13), the confidence question (C16),
the tension question (C17), the candidate disclosure (C9-C10).

**Learning risks.** The reveal's transferable half stays as thin as it is: on a silence branch
`nextQuestion` asks about **this** position, and `revealAccumulation` counts a kind without naming
what two instances have in common.

**Implementation cost.** Small. Four copy and predicate changes, four tests.

**Reversibility.** Complete. Every change is a string or a boolean.

**What would falsify it.** A cold player who, with the copy correct, still cannot say what they are
being asked to do; or evidence that one of the `TEST` rows moves a measured variable.

---

## B -- Minimal instrument

**Flow.** `DECIDE (move + confidence) → COMMIT → [counterfactual] → REVEAL`. The two read steps are
removed from the product entirely.

**The argument for it, and it is a real one.** `shared/detector.ts` never reads `known` or
`unknown`. `read-options.ts` says so in its own header. The only consumer is
`vocabulary-reading.ts`, which measures **the menu** -- which options get tapped, what gets typed
beside them -- rather than the answer. So on the ~15% of decisions that carry them, two of three
steps feed no claim, no bucket and no gate. `confidence-asked.ts` already halved their reach for
this reason and recorded the report that forced it: *"the move is blocked, it asks me to fill in
forms."*

**Evidence captured.** Move, confidence (sampled), candidates, seconds, probe. No reads.

**What the player must understand.** Two things instead of four. Why the engine waits.

**Hidden / deferred.** As A, plus the read vocabulary, permanently.

**Reveal.** Loses `nextQuestion`'s strongest branch, which quotes the player's stated unknown back
at them: *"you wrote that you cannot evaluate: 'X'. Does the engine's line answer that, or does it
simply not go there?"* That branch is the clearest `process` evidence the reveal produces on a
decision the engine agrees with. Also loses `.reveal-echo`.

**Accumulation.** Unchanged in mechanism, poorer in material: the record loses the one field that
is in the player's own language.

**Measurement risks.** Removes C12/C13 attentional cueing entirely -- the strongest single
reduction in reactivity surface available. Costs the vocabulary reading, and costs the only join
between what a player could name and how calibrated they were on that same position, which
`confidence-asked.ts` describes as the reason the two draws were coupled in the first place.

**Learning risks.** High. The reads are the only place the player's own words enter the record, and
the reveal's `process` class leans on them.

**Implementation cost.** Medium: schema, atom, server enum, vocabulary reading, several tests, and
a migration decision for existing rows.

**Reversibility.** **Poor.** Deleting a recorded field is not a flag flip, and rows recorded after
the change are permanently different from rows before it. `measurement-protocol.ts`'s own rule
applies: a protocol whose rules change is two populations.

**What would falsify it.** Evidence that the read chips change the move or the confidence would
support it. Evidence that players who state a read reconstruct the reveal better than those who do
not would kill it.

---

## C -- Progressive instrumentation

**Flow.**

```
decision 1     move + confidence            (2 steps; K1 satisfied)
REVEAL 1       full reveal
decision 2..k  move + confidence            reads and probe still closed
first payoff   the player has seen what a reveal is
decision k+1.. sampled reads open; probe arm opens
```

**The argument for it.** Instrument literacy is paid before any payoff exists. Today a stranger's
first screen has four steps, three of them labelled `חובה`, before they have seen a single reveal.
C's claim is that the same total burden is cheaper when it arrives after the player knows what it
buys.

**Evidence captured.** Eventually identical. Early decisions carry no reads and no probe.

**What the player must understand.** At first, almost nothing: a move and how sure they are.

**Hidden / deferred.** The reads and the probe, until a threshold.

**Reveal.** Identical. Early reveals cannot use the `chose-past-it` branch as richly, because the
candidate list is still recorded but the probe is not.

**Accumulation.** Slower to a claim on the vocabulary side; the calibration side is unaffected,
because confidence is asked from decision 1.

**Measurement risks.** **The unlock threshold becomes a covariate.** Decisions before and after it
are two populations, and unlike today's hash-based draw the boundary correlates with experience,
session length and persistence -- exactly the things that also predict accuracy.
`docs/decisions/D21-feedback-exposure.md` already found the record cannot separate pre- and
post-exposure decisions; C makes that gap worse by putting a real discontinuity there.

**Learning risks.** Low, and possibly negative: the reveal is unchanged and arrives sooner.

**Implementation cost.** Medium. `confidence-asked.ts` gains a record-size input, which today it
deliberately does not have -- every input is a fact about the decision, not about the player.

**Reversibility.** Medium: the rule is one module, but the recorded population is split at the
threshold and cannot be un-split.

**What would falsify it.** Cold-user evidence that the four-step first screen is **not** where
people stop. If abandonment is flat across step count, C's whole premise is gone.

---

## D -- Quiet window, rich reveal

**Flow.** Unchanged. The instrument is untouched, honouring LAW 9. What changes is everything in
the window that is **not** the instrument.

**What leaves the production phase:**

| leaves | goes to | why |
| --- | --- | --- |
| `.context-loop` / `.context-loop-basis` reading of the record (B1-B3) | the reveal, and the record screen | LAW 1's carve-out permits it; nothing requires it here |
| `.context-reorientation` (B6) | `RESUME`, where `MODE_CONTRACT` already permits prior evidence | it serves a returning player, not a deciding one |
| `.loop-strip` (B7) | the reveal | same |
| the `DECIDE` / `REVEAL` badge (D1) | nowhere | it is Decision Lab vocabulary with no chess content |
| `.commitment-tension` (C17) | **the reveal**, as a retrospective | see below |

**The tension question is the interesting move.** Today it asks about a draft the player can still
change, which is what makes it an intervention. Moved after closure it becomes an observation:
*"you stated 7 of 7 beside 'I do not know this position'"* -- the same juxtaposition, now with no
power to alter what it describes, and available to sit beside the engine's answer. It stops being
the product's only pre-commit metacognitive prompt and becomes a second `process` branch in the
reveal.

**What stays in the window.** The board, the steps `stepsFor` asks for, the candidate list and its
note, the move notice, the storage notice, the timeline, the submit. Plus A's four fixes.

**Evidence captured.** Identical to today.

**What the player must understand.** The steps, and why the engine waits. Nothing about loops,
thresholds, claims or grades until after a decision is finished.

**Reveal.** Richer, and by relocation rather than invention: it gains the loop position, the
tension as an observation, and the re-orientation, on top of what it already has.

**Accumulation.** Unchanged in mechanism. Better placed: the loop position now renders in the one
state where *"another decision is what tests whether this repeats"* is the sentence the player is
already reading.

**Measurement risks.** Moving a surface **out** of the window cannot contaminate what was measured
before it moved, but it does change the stimulus, so it is a protocol change:
`CURRENT_PROTOCOL_VERSION` must increment, exactly as LAW 1's own decision focus did. Decisions
before and after are two populations by the repository's own rule, and that is a cost, not a
detail. It is also the reason D is a **prototype behind a flag** and not a merge.

**Learning risks.** Low. Nothing is deleted; three things are relocated to a state that permits them.

**Implementation cost.** Medium: conditional rendering in `Home.tsx` and `ContextRibbon`, a new
reveal block, a protocol-version bump, and gate/test updates so `.context-ribbon` and `.loop-strip`
enter the surfaces the focus test knows about.

**Reversibility.** Good. Every change is a render condition, and a flag can carry both arms.

**What would falsify it.** Evidence that the ribbon's loop position is what stops a player being
lost during a decision. If removing it raises abandonment inside `DECIDE`, D is wrong and B1 is
`ACTION-NECESSARY` after all.

---

## E -- Explicit observe / learn separation

**Flow.** Two named phases the player can see, and a third surface that does not exist today.

```
OBSERVE   the board, the steps, the submit. Nothing else. No loop, no counts, no questions
          about the answers. The product is a recorder.
              ↓ closure
LEARN     the reveal as today, plus: the tension as a retrospective, the loop position, and a
          "what would you do differently" prompt that is now safe because nothing is mutable.
              ↓ any time, from the record
REVIEW    a pass over past decisions grouped by what recurred, which is where a distinction is
          allowed to be named at all.
```

**The argument for it.** D moves surfaces. E moves the *idea*: the player is told, once, that there
is a phase in which the product only watches and a phase in which it teaches. Instrument literacy
is paid once, at the level of the contract, instead of continuously at the level of each surface.

**Evidence captured.** Identical to today in `OBSERVE`.

**What the player must understand.** One sentence: *first you decide and we only record; then we
tell you what we saw.* That sentence is already on the brand lockup as `COMMIT · THEN REVIEW`.

**Hidden / deferred.** Everything D defers, plus any metacognitive prompt anywhere in `OBSERVE`.

**Reveal.** As D, plus an explicit invitation into `REVIEW` once the record can support one.

**Accumulation.** The only architecture that gives accumulation a **home**. `REVIEW` is a surface
whose whole job is repeated observation, which is where the Accumulation Contract's
`observation → repeated observation → pattern candidate → calibrated claim` can actually be
rendered without a single reveal pretending to be a pattern.

**Measurement risks.** Same protocol bump as D. Plus a new one: naming the phases teaches the
player the model, and `docs/VALUE_CLARITY_FIELD_PROTOCOL.md`'s Arm B rule is *"say only
תשחקו כרגיל"* -- a product that explains its own design before use makes the comprehension arms
uninterpretable, because the thing being measured is whether they can reconstruct it unprompted.

**Learning risks.** The `REVIEW` surface is the largest new thing in any alternative, and its
failure mode is named in the mission's own list: **the dashboard becoming the product.**

**Implementation cost.** **Large.** A new surface, a grouping the record does not currently
support, and the exposure schema D21 deliberately did not choose.

**Reversibility.** Poor once `REVIEW` exists and players use it.

**What would falsify it.** Evidence that a player who has seen one reveal already understands the
ordering without being told -- which would make the naming pure cost. Arm A of the frozen protocol
measures exactly this and has not been run.

---

# Discrimination

## The framework, frozen before any score

Weights are the mission's, unmodified. Scores are 0-10 per dimension. Weighted total is out of 100.

| dimension | weight | what a 10 means |
| --- | ---: | --- |
| Measurement validity | 25 | nothing on screen during production can move a recorded variable, and every exposure that remains is recorded so it can be stratified out |
| Action clarity | 20 | at every moment the state nearly dictates the next action, with no Decision Lab vocabulary required |
| Cognitive quietness during evidence production | 15 | nothing competes for attention with the decision except the instrument itself |
| Learning transfer after Reveal | 15 | the player leaves with a distinction that applies to a different position |
| State continuity / intention preservation | 10 | no path destroys pending evidence or replaces the player's intention |
| Claim / evidence lineage clarity | 5 | the player can say what came from them, what came from the engine, what the system inferred, what is still open |
| Reversibility / experimentability | 5 | the change can be run as an arm and withdrawn without splitting the recorded population |
| Implementation simplicity | 5 | small, local, testable |

**A rule this framework is bound by.** Weights are not adjusted after seeing which alternative
wins. If the framework turns out to be the wrong frame, that is recorded as a finding about the
frame, with the reason, and the scoring is redone from the top.

## Authority ceiling per dimension

Before the numbers, what the numbers can be worth.

| dimension | highest authority available in this repository | what that means for the score |
| --- | --- | --- |
| Measurement validity | **REPO** for surface presence and for whether exposure is recorded; **FIELD** for whether any surface actually moves a variable | scores below are about *exposure surface area*, which is repo-measurable. They are **not** claims about realised bias |
| Action clarity | **REPO** for contradictions; **FIELD** for whether a person can act | scores are about statements the build contradicts, nothing more |
| Cognitive quietness | **REPO**: element counts and geometry are measured | scores are defensible |
| Learning transfer | **FIELD only** | scores are structural: does the architecture *have a place* for a transferable distinction |
| State continuity | **REPO** | defensible |
| Lineage clarity | **REPO** | defensible |
| Reversibility | **REPO** | defensible |
| Implementation simplicity | **REPO** | defensible |

## Measured input to the scores

From `probes/pre-evidence-surfaces.mjs`, 1440x900, arm pinned `probed`. "Non-board" excludes board
squares, pieces, rank and file labels, the move rail and its cells, and the screen-reader announcer.
"Instrument" is every element of the commitment panel or the counterfactual question:
`.commitment-*`, `.step-*`, `.required-mark`, `.screen-heading`, `.read-*`, `.counterfactual-probe__*`.

| state | painted or pressable | non-board | the instrument | everything else |
| --- | ---: | ---: | ---: | ---: |
| `02 DECIDE`, before any move | 151 | 40 | 19 | **21** |
| `06 DECIDE`, ready to commit | 151 | 38 | 17 | **21** |
| `08 committed`, counterfactual open | 139 | 25 | 4 | **21** |

**The same twenty-one surfaces are on screen in every state of the window**, and at the
counterfactual stage they outnumber the question being asked five to one: four elements are the
question, twenty-one are the brand lockup, the four header controls, the ribbon and its disclosure,
the mode badge, the loop strip's five, the storage notice, the board note, the FEN control and the
timeline heading.

## Scores

Each cell is `score` with its evidence in the notes below. `FR` marks a cell where no evidence in
this repository discriminates between the alternatives and the difference is **FIELD REQUIRED**;
those cells are scored on structure only and the structural basis is stated.

| dimension | w | A | B | C | D | E |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Measurement validity | 25 | 5 | 7 | 4 | 7 | 7 |
| Action clarity | 20 | 7 | 8 | 8 | 8 | 7 |
| Cognitive quietness | 15 | 4 | 6 | 5 | 9 | 9 |
| Learning transfer after Reveal | 15 | 4 `FR` | 3 `FR` | 4 `FR` | 6 `FR` | 8 `FR` |
| State continuity | 10 | 8 | 8 | 7 | 8 | 6 |
| Lineage clarity | 5 | 7 | 6 | 7 | 8 | 8 |
| Reversibility | 5 | 10 | 3 | 5 | 8 | 3 |
| Implementation simplicity | 5 | 10 | 5 | 5 | 6 | 2 |
| **weighted total** | **100** | **58.0** | **63.5** | **55.0** | **77.0** | **73.0** |

### Notes, per cell that is not obvious

**Measurement validity.** A scores 5: it leaves all fourteen `TEST` rows in the window and records
the exposure of none of them. B scores 7: it deletes the two highest-reactivity-risk rows (C12,
C13) outright, and loses nothing the detector reads. C scores 4 -- **below the baseline** -- because
its unlock threshold introduces a discontinuity that correlates with experience and persistence,
which is worse than a hash-based draw that correlates with nothing. D and E score 7: they remove
six rows from the window (B1, B2, B3, B6, C17, D1) without deleting any recorded field, and the one
they relocate rather than delete, C17, becomes observable at the reveal where it can also be
counted. **None scores above 7**, because in every alternative the confidence question, the option
menus and the candidate disclosure remain, and their exposure remains unrecorded.

**Action clarity.** A gains 2 points over today purely from the four contradiction fixes. B and C
and D reach 8 by having fewer things to explain or by fixing the same contradictions. E drops back
to 7 because it adds a concept -- two named phases -- that a player has to learn before the concept
helps them.

**Cognitive quietness.** Directly measured. A leaves all twenty-one non-instrument surfaces in the
window. D and E remove ten of them -- the ribbon's three, the loop strip's five, the mode badge and
the re-orientation line -- and relocate the tension question, taking the counterfactual stage from
four instrument surfaces against twenty-one to four against eleven. B leaves all twenty-one and
removes two instrument steps instead, which is quieter than A without being quiet. C is A during
the early decisions and A-with-fewer-steps later.

**Learning transfer, every cell `FIELD REQUIRED`.** No evidence in this repository establishes that
any reveal produces a carried distinction; `docs/VALUE_CLARITY.md` marks Lens 4's field half
REQUIRED and no participant has been run. The scores are **structural**: does the architecture have
a place to put a transferable distinction? A and C do not add one. B removes the reveal's richest
`process` branch. D relocates the tension into the reveal, which adds a second `process`
observation. E adds a surface whose entire purpose is repetition. **The ranking here is an argument
about capacity, not a prediction about people, and it must not be read as one.**

**State continuity.** E loses 2: a third surface is a third place to be, and `REVIEW` is the kind of
thing LAW 4 exists about. C loses 1: an instrument that changes shape between decision 5 and
decision 6 is a state change the player did not ask for.

**Reversibility.** A is 10 -- strings and booleans. B is 3 -- a deleted recorded field cannot be
un-deleted and splits the population. C is 5. D is 8 -- render conditions, flag-able, but it does
bump the protocol version. E is 3.

**Implementation simplicity.** A is 10. D is 6. E is 2.

## What the scoring does and does not settle

**It settles the ordering of the top two only weakly.** D at 77.0 and E at 73.0 differ by 4 points,
and E's entire margin of loss is in Reversibility and Implementation simplicity, which together
carry 10 of 100. If the Learning-transfer row -- the one row that is `FIELD REQUIRED` in every cell
-- is off by two points in E's favour, the order flips. **So: D over E is not established. The gap
between D and E is FIELD REQUIRED.**

**It settles that C is not the answer**, and that is the most useful thing the framework did,
because C was the mission's own named candidate and it scores below the baseline. The reason is not
UX: it is that progressive unlocking puts a population split at a point that correlates with
persistence, and the repository already knows from D21 that it cannot separate populations it has
not recorded.

**It settles that B's case is real but its cost is one-way.** B is the second-best measurement-validity
score and it is the only alternative that reduces reactivity surface by deletion rather than
relocation. It is also irreversible, and it deletes the only field written in the player's own
language.

**It does not settle whether any of this matters.** Every dimension above except Cognitive
quietness is a statement about the artefact. Whether a cold player can act, whether the surfaces
move a variable, and whether a reveal transfers, are three field questions and the framework cannot
substitute for them.
