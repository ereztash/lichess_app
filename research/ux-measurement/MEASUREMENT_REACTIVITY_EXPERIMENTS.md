# Measurement reactivity: the experiment backlog

Only experiments that can change a decision. An experiment whose every outcome leaves the same
architecture in place is not on this list.

**Clarity and reactivity are not the same test and are not run on the same participants.**
Comprehension asks whether a person can reconstruct what happened. Reactivity asks whether the act
of asking changed what happened. A participant who says *"the confidence question made me look
again"* has produced a hypothesis; a participant who says *"I did not notice it"* has produced
nothing, because the effects at issue are the kind people do not notice. Both directions of
self-report are weak, and neither settles anything here.

---

## X-0 -- Record the exposures. Prerequisite for every experiment below.

`REPO`, and it is the only row on this page that is not itself an experiment.

**The problem.** Of the six conditional surfaces in the evidence window, the record stores the arm
of exactly one.

| surface | conditional on | stored? |
| --- | --- | --- |
| the counterfactual probe | `probe.assignment` | **yes**, per decision |
| the confidence question | `confidenceIsAsked` | re-derivable from `purpose`, `gameId`, `fen`, `ply` |
| the read chips | `readsAreAsked` | re-derivable, same inputs |
| `.commitment-tension` | the player's own answers | **no** |
| `.context-loop`'s grading sentences | whether a claim existed at that moment | **no** |
| `.context-why`'s body | whether they pressed `למה?` | **no** |

The bottom three cannot be reconstructed after the fact, so a decision that saw a tension and one
that did not are one population -- the same finding
`docs/decisions/D21-feedback-exposure.md` reached for reveals and claims:
*"Decision #1 and decision #200 are one population."*

**What X-0 is.** Store the exposure. Not a new measurement, not a new question, not a change to any
rendered surface: a boolean or a small enum on the atom saying which conditional surfaces were on
screen while this decision was being produced.

**Why it is first.** Every experiment below needs to stratify on exposure, and three of them cannot
be analysed at all without it. **Running X-1 or X-3 before X-0 produces a number nobody can
interpret.**

**What it must not become.** A second classifier, a subjective field, or anything the reveal reads.
It is provenance, like `reveal_timing` and `protocol_version` beside it. `GATE-EXPOSURE-CONTEXT`
sits unregistered waiting for exactly this, and D21 records the three candidate schemas with the
asymmetry that decides between them.

---

## X-1 -- `declaredTensions`: does the question change the answers it is about?

The strongest measurement/intervention collision in the window, measured in the ledger at C17: a
question derived from the player's own answers, addressed at the variable being measured, rendered
between the last answer and the commit, while every one of those answers is still changeable.

**Hypothesis.** Exposure to a tension question changes at least one of: the committed move, the
stated confidence, the number of candidate moves placed, `seconds_taken`, or the rate at which an
answered step is reopened and changed.

**Design.** Within-player, decision-level, pinned rather than drawn. Both arms see a draft that
*would* produce a tension; one renders it and one does not.

| | arm SHOWN | arm SILENT |
| --- | --- | --- |
| `declaredTensions` computed | yes | yes |
| rendered | yes | no |
| exposure recorded | yes | yes |

**The eligibility trap, and it is the whole design.** A tension only exists on drafts that state
one, and those drafts are not a random sample of decisions -- they are the confident-beside-an-
unknown ones. Comparing tension-exposed decisions with all others compares two populations that
differ in the thing being measured. **Both arms must be drawn from decisions that satisfy the
tension predicate**, which is why the rule has to be evaluated in both arms and only the render
suppressed.

**Outcomes, in order of what they would decide.**

| observation | decision |
| --- | --- |
| the committed move changes at a rate above chance | C17 leaves the evidence window regardless of anything else, and every decision recorded with it exposed is a separate population |
| confidence changes but the move does not | the calibration gap is measured on a treated variable. C17 moves to the reveal, where D already proposes to put it |
| `seconds_taken` changes | a detector axis is being treated. Same conclusion, and the retrospective analysis has to stratify |
| nothing moves at any of them | C17 stays, and the ledger's HIGH reactivity rating is lowered to LOW with this experiment as its evidence |

**Power.** The confident-beside-an-unknown draft is a small fraction of decisions; the arm has to
run long enough that `n` per arm clears `MIN_BUCKET_N` on each side, or the result is an
uninterpretable null.

**Prerequisite:** X-0.

---

## X-2 -- confidence elicitation: does asking change the process?

**Hypothesis.** Stating a confidence is not only a measurement of a belief; it is a metacognitive
act that changes the decision it is attached to.

**Why this is the hardest one on the page.** There is no arm without the question. Every scored
decision has one by construction, because a decision with no stated confidence is not scored and
does not enter a bucket. So the comparison cannot be *asked* against *not asked* on the same
quantity.

**Design: vary the timing, hold the sample fixed.**

| | arm BEFORE | arm AFTER-MOVE |
| --- | --- | --- |
| the confidence question | before the move is placed | after the move is placed, before the commit |
| when the answer is written | at commit | at commit |
| what is compared | move quality against the engine, `seconds_taken`, candidate count | same |

Both arms produce a confidence written before the engine speaks, so R3 holds in both and neither is
a protocol violation. What differs is whether the player had stated a probability before choosing.

**The rule this must not break.** Confidence stays **required where it is asked** in both arms.
Making it optional in either arm reintroduces the self-selection at the top of
`shared/confidence-asked.ts` and would make both arms unreadable.

**Outcomes.**

| observation | decision |
| --- | --- |
| move quality differs by arm | the question is a treatment and the calibration gap is measured on a treated decision. This is the finding that would most change the product |
| `seconds_taken` differs but quality does not | the burden is real and the process is not. Sampling stays; `ASK_RATE` becomes a burden question rather than a validity one |
| nothing differs | LAW 9's hold on the confidence question can be released, with this as the release evidence it already asks for |

**Prerequisite:** X-0. **Note:** LAW 9 names *"a preregistered UX/measurement experiment"* as the
release condition for the scale itself. This is that experiment's smaller sibling and does not
license changing the scale.

---

## X-3 -- known/unknown: is the menu a checklist for the eye?

`read-options.ts` establishes that nothing downstream reads the answers. That is about
contamination of the **answer**. This is about the **menu**: ten positional features shown before a
move is chosen is a list of things to look at.

**Hypothesis.** Presenting the option vocabulary before the move changes attention, and therefore
the move, the time, or the candidate count.

**Design.**

| | arm BEFORE | arm AFTER-MOVE |
| --- | --- | --- |
| the chips | visible from the start, as today | the step opens only once a move is on the board |
| both reads still required | yes | yes |
| exposure recorded | yes | yes |

**Why AFTER-MOVE rather than a no-chips arm.** A no-chips arm changes what is recorded, so the two
arms would not produce the same field and could not be pooled. Order changes only when the
vocabulary is seen.

**Outcomes.**

| observation | decision |
| --- | --- |
| move quality or candidate count differs | the chips are an intervention, not an input. Architecture B moves ahead of D in the scoring and the reads' future becomes a measurement question |
| the tapped-option distribution differs but the move does not | the menu shapes the *answer* and not the *decision*. `vocabulary-reading` inherits a caveat; the ledger's HIGH goes to MEDIUM |
| nothing differs | C12/C13 drop to LOW with evidence, and B's main argument is gone |

**Prerequisite:** X-0.

---

## X-4 -- candidate disclosure: does counting change what gets counted?

`candidate_moves_considered` is both the disclosure and the measurement. `theOneThing`'s
`chose-past-it` branch -- the reveal's clearest `process` evidence -- fires off it.

**Hypothesis.** Showing the placed-move list back, with the note that it is recorded, changes how
many moves get placed.

**Design.**

| | arm SHOWN | arm SILENT |
| --- | --- | --- |
| `.commitment-candidates` list and note | rendered | not rendered |
| candidates recorded | yes | yes |

**The honesty constraint, and it is why this arm has an expiry.** `docs/VALUE_CLARITY.md` Lens 3
requires the record's asymmetry to be stated **where candidates are shown**. The SILENT arm shows
none, so the sentence has nowhere to go and nothing is misrepresented while the arm runs. But a
SILENT arm that shipped as the default would record a behaviour it never disclosed. **This arm may
be run and may not be shipped**, whatever it finds; a difference sends the disclosure to a
different place, never to nowhere.

**Outcomes.**

| observation | decision |
| --- | --- |
| candidate count differs by arm | every `chose-past-it` verdict inherits a caveat and the reveal must carry it. The disclosure moves, it does not disappear |
| nothing differs | C9/C10 drop to LOW and the disclosure stays exactly where it is |

**Prerequisite:** X-0.

---

## X-5 -- record-state exposure: does reading the record back move the confidence?

This is architecture D's own hypothesis, run as an arm instead of shipped.

**Hypothesis.** `.context-loop` and `.context-loop-basis`, on screen during production and updating
on the player's own commit, change the confidence stated after them.

**Design.** D behind a feature flag. One arm renders the ribbon during `focus` as today; the other
renders it only at `REVEAL` and `RESUME`, which is what `MODE_CONTRACT` already permits.

**The flag is built and off:** `QUIET_EVIDENCE_WINDOW_ENABLED` in `client/src/lib/features.ts`,
read only by `ContextRibbon` through a `producingEvidence` prop. Off, the two states render
identical markup, asserted in `tests/client/an-arm-that-ships-nothing.test.tsx`. Turning it on
requires a `CURRENT_PROTOCOL_VERSION` bump, which is deliberately not made: bumping for an arm
nobody has run would split the record for nothing.

**Measured:** the confidence distribution, `seconds_taken`, abandonment inside `DECIDE`, and
`backtrack_rate` -- the four metrics `docs/INERTIAL_UX_LAWS.md` already names under *"success is
not fewer clicks"*.

**Outcomes.**

| observation | decision |
| --- | --- |
| the confidence distribution differs | B1-B3 leave the window. D's central move is evidenced rather than argued |
| abandonment inside `DECIDE` **rises** in the quiet arm | the ribbon is `ACTION-NECESSARY` after all. The ledger row is wrong, D is wrong, and this is the reversal condition `DESIGN_DECISION.md` records |
| nothing differs | the choice between A and D is aesthetic, and A wins on reversibility |

**Note.** This is the one experiment that can go against the leading architecture, which is why it
is on the list.

---

## X-6 -- does the reveal transfer?

**FIELD, not an experiment.** Listed so the backlog is not mistaken for the whole of what is
missing.

`docs/VALUE_CLARITY.md` Lens 4's field half is REQUIRED and no participant has been run.
`FIELD_COMPANION_PROTOCOL.md` Arm D's question D-iii is the cheapest available probe:
`about_my_decision` versus `about_the_tool`.

---

## What none of these may do

- **Change production behaviour before the arm concludes.** Every one is a flag, a pinned draw, or
  a prototype route.
- **Be read as a comprehension result.** *"The player liked it"* is not validity, and
  *"the player did not notice"* is not the absence of reactivity.
- **Be pooled across builds.** `measurement-protocol.ts`: a protocol whose rules change is two
  populations. Every arm records the build's `gitSha` and `protocol_version`.
- **Be run without X-0**, except X-5, whose exposure is the flag itself.
- **Substitute for the frozen field trial.** `runtime/handoffs/HANDOFF-LICHESS-FIELD-001.json` is
  open, its authority is FIELD, and its `must_not_infer` list includes *"do not substitute
  automated, model-generated or retrospective data for a participant."* Nothing on this page is a
  participant.

## Order

```
X-0  record the exposures                REPO, prerequisite for four of the five
  ├─ X-1  declaredTensions               highest reactivity risk, cheapest arm
  ├─ X-3  known/unknown ordering         decides between architectures B and D
  ├─ X-4  candidate disclosure           may be run, may not be shipped
  └─ X-2  confidence timing              hardest, and the one that would change the most
X-5  record-state exposure               independent of X-0; can falsify the leading architecture
X-6  transfer                            FIELD, and it is already handed off
```
