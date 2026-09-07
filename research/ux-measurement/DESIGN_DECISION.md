# Decision record: interaction architecture

Written after [`DESIGN_ALTERNATIVES.md`](DESIGN_ALTERNATIVES.md) and before any change to a
measurement-bearing surface.

---

## 1. Decision before

The default this work started from, and it was a real default rather than an absence of one:

> Keep the current architecture. `docs/VALUE_CLARITY.md` closes all five lenses at
> **REPO-CLEAR / FIELD REQUIRED**; `docs/PRE_RELEASE_STATE.md` reports that no repository check
> produced a gap on the audited candidate; `docs/INERTIAL_UX_LAWS.md` LAW 9 holds the three
> instrument surfaces behind an experiment. The next authority is a player.

That default was **correct about the boundary and wrong about the tree**. It rested on a premise --
that the repository half is clean -- which is true for every check the repository runs and false
for four things none of them looks at.

---

## 2. Evidence added

### 2.1 Four contradictions, measured

| id | what the build claims | what the same build does | measured how |
| --- | --- | --- | --- |
| D1 | two read steps carry `חובה` on a `first` decision | `draftProblems` requires neither; the submit reads `רשמו את ההחלטה` with both unanswered | component render + both predicates, over all six purposes |
| D2 | `.commitment-intro`: *"choose a move on the board and mark your read"* | on a sampled-out decision the step list is `["המהלך שבחרתם"]` alone -- ~6 in 7, at `ASK_RATE = 0.15` | Chromium on `dist/public` and component render |
| D5 | `.board-note`: *"you came back to the game you were in -- 21 half-moves"* | fresh browser context, first arrival, a game the player has never seen | Chromium, clean profile |
| F1 | `WhatThisIs`: the loop is move → reads → confidence | true on ~15% of decisions and never on a `first` one | source, cross-checked against the two predicates |

None of these was reachable by the existing suite. `why-the-engine-waits.test.tsx` exercises
`purpose: "anchor"` only, which is the one purpose where the intro is accurate.

### 2.2 The window is larger than the commit, and it is a draw

`PROBE_PROBABILITY = 0.35`. On the probed arm the evidence is still mutable at `PROBE_STAGE`, and
the counterfactual answer is written after the commit. Measured on both arms.

### 2.3 The record is read back inside the window, and updates on the player's own commit

| state | `.context-loop-basis` |
| --- | --- |
| DECIDE, before any move | `0 מתוך 0 שנרשמו נספרות בחיפוש הזה` |
| `committed`, counterfactual question open | `0 מתוך 1 שנרשמו נספרות בחיפוש הזה` |

`GATE-DECISION-FOCUS` matches component names and `ContextRibbon` is not in `RECORD_READINGS`;
`nothing-to-read-while-you-decide.test.tsx` matches seven selectors and `.context-ribbon` is not
among them. **The rule is not being evaded. It was written over components and this is a string.**

### 2.4 The same twenty-one non-instrument surfaces, in every state

Measured, non-board painted or pressable elements: 40 at DECIDE, 38 ready-to-commit, 25 at the
counterfactual. The instrument accounts for 19, 17 and **4** of them. The remaining **21 are the
same twenty-one every time** -- so at the counterfactual stage the question being asked is
outnumbered five to one on its own screen.

### 2.5 One candidate refuted by its own measurement

`.context-why`'s body, which names the detector's own variables, is **not** painted while closed.
`checkVisibility()` returns false and `innerText` omits it. The first probe's rect-plus-computed-style
predicate was wrong. Kept in `CURRENT_STATE.md` as D4 because the artefact will recur.

### 2.6 The scoring, and what it settled

| architecture | weighted total |
| --- | ---: |
| D -- quiet window, rich reveal | **77.0** |
| E -- explicit observe / learn separation | 73.0 |
| B -- minimal instrument | 63.5 |
| A -- current plus surface cleanup | 58.0 |
| C -- progressive instrumentation | 55.0 |

**C scored below the baseline**, and it was the mission's own named candidate. The reason is not
taste: an unlock threshold puts a population split at a point that correlates with experience and
persistence, and `docs/decisions/D21-feedback-exposure.md` already establishes that the record
cannot separate populations it has not recorded.

---

## 3. Verdict

> ### `NO WINNER -- FIELD REQUIRED`
>
> **for the architecture. `A` ships now, as a floor, and is not the winner.**

Two claims, and they are different claims.

**On the architecture: D leads E by 4 points out of 100, and the whole of E's deficit is in
Reversibility and Implementation simplicity, which carry 10 between them.** The one row that is
`FIELD REQUIRED` in every cell -- learning transfer after the reveal -- carries 15. A two-point
error there in E's favour flips the order. Nothing in this repository can settle a two-point
difference in a dimension where no participant has ever been observed. **Locking D over E now would
be pseudo-precision dressed as a decision.**

**On the floor: `A` is not a competing architecture. It is the set of things this build says that
this build contradicts,** and those are settled by the code alone. They ship, not because A won,
but because a false statement is not an option among alternatives.

### The reason the floor cannot wait for the field

`docs/VALUE_CLARITY_FIELD_PROTOCOL.md` Arm B sits a cold player with the product, says only
*"תשחקו כרגיל"*, and codes what they reconstruct after the first reveal. D1 and D5 both land inside
that window:

- D1 is on the **first screen a `first`-purpose participant meets**, and it presents two fields as
  mandatory that are not. A participant who fills them because they were told to has produced a
  reading of a defect. A participant who is confused by them has produced a comprehension datum
  about a bug.
- D5 tells a stranger, in the first sentence under the board, that they are resuming something.

The protocol's own stop condition is *"a participant cannot reach a first decision at all on either
route. That is a liveness defect and the trial pauses until it is fixed; it is not a comprehension
finding."* D1, D2 and D5 are the same class one notch below the stop threshold: they do not block a
first decision, they corrupt what a first decision means. **Running the trial over them buys data
that has to be discarded.**

---

## 4. Why the leader leads, on constraints rather than elegance

Recorded so a later reader can check the reasoning rather than the ranking.

**D's advantage is that it changes no instrument.** LAW 9 holds the confidence question, the
sampled reads and the counterfactual probe behind an experiment. D touches none of them. What it
moves is the twelve non-instrument surfaces, and moving a surface out of the window cannot
contaminate what was recorded before it moved.

**D's cost is a protocol version, and it is real.** `measurement-protocol.ts`: a protocol whose
rules change is two populations, and LAW 1's own decision-focus change bumped it for exactly this
reason. That is why D is a **prototype behind a flag** below and not a merge.

**E's advantage is the only one that addresses the moat.** `README.md` states the distinction: not
a better engine explanation, but a record of how this player decides, tested for what recurs.
`revealAccumulation` counts a kind; nothing names what two instances of a kind have in common. E is
the only alternative with a surface where that could live. **E is also the only one whose failure
mode is on the mission's own prohibited list** -- the dashboard becoming the product.

**B's case is real and its cost is one-way.** It is the second-best measurement-validity score and
the only alternative that reduces reactivity surface by deletion. It also deletes the one field
written in the player's own language, and a deleted recorded field cannot be un-deleted.

---

## 5. What remains uncertain

Every row is `FIELD REQUIRED` or `EXPERIMENT REQUIRED`. None is resolvable by more reading of this
tree.

| # | uncertainty | why the repository cannot close it | what would |
| --- | --- | --- | --- |
| U1 | **confidence reactivity** -- does eliciting a confidence change the process, or only record it? | the record has no arm without the question; every scored decision has one | a within-player design that varies *when* the question is put, holding the position sample fixed |
| U2 | **known/unknown attentional cueing** -- do ten positional chips direct attention to features the player would not have looked at? | `read-options.ts` establishes nothing downstream reads the answers; that is about contamination of the *answer*, not about the menu as a checklist for the *eye* | an arm with the chips withheld until after the move is placed, comparing move quality, `seconds_taken` and candidate count |
| U3 | **`declaredTensions` behavioural effect** -- does the question change the committed move, the confidence, or the time? | exposure is recorded nowhere; a decision that saw a tension and one that did not are one population | record the exposure first, then a pinned-arm comparison |
| U4 | **candidate disclosure reactivity** -- does showing the placed-move list change how many get placed? | the count is both the disclosure and the measurement | withhold the list on a pinned arm, compare `candidate_moves_considered` |
| U5 | **record-state exposure** -- does the ribbon's reading, mid-window, move the confidence stated after it? | `.context-loop` renders in every state and its content is a function of the record, not of the decision | D behind a flag, comparing confidence distributions |
| U6 | **learning and retention** -- does a reveal leave a distinction that survives to another position? | no participant has ever been observed. `docs/VALUE_CLARITY.md` Lens 4's field half is REQUIRED | Arm B of the frozen protocol, plus the transfer question in the companion |
| U7 | **whether instrument literacy is the binding cost at all** | the whole premise of C, and of half of D, is that the four-step screen is where people stop. Nothing measures that | Arm C's ledger: `abandonment_by_state` |

**U7 is the one that could invalidate the frame.** If cold players do not stop at the commitment
screen, the quietness dimension is worth less than 15 and the ranking is built on sand.

---

## 6. Reversal conditions

Stated as observations, in the shape `docs/decisions/` uses.

| observation | consequence |
| --- | --- |
| removing `.context-loop` from `DECIDE` raises abandonment inside the deciding state | B1 is `ACTION-NECESSARY`, not `MEASUREMENT-EXPLANATION`. D is wrong and the ledger row is wrong |
| cold players do not abandon at the commitment screen | quietness is over-weighted; rescore from the top with the reason recorded |
| withholding the read chips until after the move changes move quality or `seconds_taken` | C12/C13 are interventions, not inputs. B moves ahead of D and the reads' future becomes a measurement question rather than a burden question |
| the tension question, exposed on a pinned arm, changes the committed move or the stated confidence | C17 must leave the window regardless of any other decision, and every decision recorded with it exposed is a separate population |
| Arm B participants reconstruct the reveal but cannot name anything they would carry to another position | the reveal's `nextQuestion` is doing the wrong job; E's `REVIEW` surface becomes the priority and its cost is worth paying |
| a participant cannot reach a first decision on either route | liveness defect. The trial pauses, the authority moves back to REPO, and this document is superseded |
| `GATE-EXPOSURE-CONTEXT` is registered with a chosen schema | the Accumulation Contract's missing clause becomes enforceable and accumulation may widen |

---

## 7. Neta / R&D execution record

Phase 6, reported against the contract in force rather than paraphrased.

**Repository:** `ereztash/product-perception-sensemaking-architect` @ `9a24d738aa036ca6267d47075b23e26774ffb41f`, cloned read-only.

### Contract checks: EXECUTED, all PASS

| script | result |
| --- | --- |
| `scripts/check_contract.py` | `Neta Assurance v0.2 contract: PASS`, positive controls 9/9 correctly failed, prompt baseline frozen at `339b9a1be2fd0f1f6f6c7960e5be58e5566d3691` |
| `scripts/check_canonical_state.py` | `CANONICAL-STATE CONTRACT: PASS`, 6/6 controls red |
| `scripts/check_live_adapters.py` | `LIVE ADAPTER CONTROLS OK` -- prompts, routing payloads and semantic shapes validated **offline** |
| `scripts/check_rnd_contract.py` | `R&D CONTRACT OK` |
| `scripts/check_research_contract.py` | `RESEARCH-CONTRACT: PASS`, 5/5 controls red |

### Canonical live run: `FAILED_EXECUTION`

Attempted, not reasoned about:

```
$ python3 runtime/calibration_loop/run.py fixtures/calibration-valid-task.json \
      --config runtime/calibration_loop/openai-config.example.json --strict

{
  "runtime_version": "0.1",
  "rnd_telos_version": "0.2-candidate",
  "final_state": "FAILED_EXECUTION",
  "failure": "RND adapter failed: {\"adapter_error\": \"OPENAI_API_KEY is required for live adapter execution\"}"
}
```

`FAILED_EXECUTION` is the runtime's own verdict, in its own vocabulary. The cause is a missing
credential in this environment, so the resource state is `PENDING_RESOURCE`.

**What was not done, and would have been a contract violation.** The runtime ships `--mock`
adapters. Running them and reporting the output as an R&D diagnosis would be simulating the peer.
No mock run was performed and nothing in this directory is attributed to Neta or to R&D.
`docs/neta/harness/README.md` and `CLAUDE.md` both name same-model agreement as candidate reasoning
rather than independent triangulation; this analysis is one model's, and is labelled
**BEST-EFFORT, single-agent** throughout.

### The prior canonical output that this decision is bound by

`runtime/handoffs/HANDOFF-LICHESS-FIELD-001.json` is a live handoff already issued **to FIELD** for
`F-HUMAN-CORE`:

- `current_claim_state: INSUFFICIENT_REALITY`
- `resolution_authority: FIELD`
- `why_peer_is_needed:` *"The instrument is runnable and the candidate is deployed, so the only
  thing still missing is people. No test, automation, model run or retrospective record can supply
  it."*
- `must_not_infer:` *"A rendered reveal is not a read one, and a clean DOM is not comprehension."*
- `must_not_infer:` *"Do not substitute automated, model-generated or retrospective data for a
  participant."*

and `runtime/execution_traces/DEL-LICHESS-FIELD-INSTRUMENT-002.json` closes with
`stop_or_continue: STOP` and `next_move:` *"FIELD recruits the first cohort... No further repository
work on this claim."*

`research/lichess-prerelease/FIELD_RUN_SHEET_TRIAL1.md` is written and carries **zero participant
rows**.

**This decision does not overturn that.** It says something narrower and compatible: the four
contradictions above are not the `F-HUMAN-CORE` claim, they are defects that would corrupt the
evidence the handoff is asking FIELD to produce. Fixing them is preparation for the handoff, not
repository work in place of it. Everything else stays behind the field gate.

---

## 8. What ships from this decision

| ships now | authority |
| --- | --- |
| the four contradiction fixes and their tests | `REPO-CERTAIN` |
| a step head the sticky submit was covering, and a layout test whose aim is derived rather than a four-pixel coincidence | `REPO-CERTAIN` |
| `QUIET_EVIDENCE_WINDOW_ENABLED`, **off**: the one arm that can falsify the leading architecture | `RESEARCH-GATED`, as an arm |
| a test that pins `stepsFor` to `draftProblems` so screen and validator cannot disagree again | `REPO-CERTAIN` |
| the probes, the ledger, the boundary, the alternatives, this record | documentation |
| `FIELD_COMPANION_PROTOCOL.md`, adding arms and rewording none | documentation |
| the experiment backlog | documentation |

| does not ship | why |
| --- | --- |
| D, E, B, C, in whole or in part | no winner; `FIELD REQUIRED`. The quiet-window flag is an arm of X-5, not a partial D: it is off, it moves one surface, and turning it on requires a protocol bump this change deliberately does not make |
| any change to the confidence question, the read chips, the probe rate, the sampling draw | LAW 9 |
| removing or relocating `.context-loop`, `.commitment-tension`, the candidate list, the loop strip | changes the stimulus; needs a protocol bump and an arm |
| a `REVIEW` surface | E is not chosen and its failure mode is on the prohibited list |
