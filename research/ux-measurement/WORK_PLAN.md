# Work plan, by authority

Every task carries exactly one of three labels, and the label decides who may close it.

| authority | decided by | what may be done |
| --- | --- | --- |
| `REPO-CERTAIN` | the code and the contracts alone | implement |
| `RESEARCH-GATED` | a plausible mechanism, no evidence on the implementation | prototype, flag, harness, document. **Never** change production behaviour |
| `FIELD-GATED` | only a person using the product | run the protocol. Reasoning may not substitute |

Order is fixed: `REPO-CERTAIN → RESEARCH-GATED → FIELD-GATED`, and the third is where the authority
already sits (`runtime/handoffs/HANDOFF-LICHESS-FIELD-001.json`).

---

# 1. `REPO-CERTAIN` -- done in this change

Each is a statement this build makes that this build contradicts. Every one carries evidence, a
reason, the affected state, the measurement impact, and a test that has been shown red under its own
defect.

## R1 -- the first decision no longer asks for what nothing requires

| | |
| --- | --- |
| **Evidence** | On `purpose: "first"`, `confidenceIsAsked` is true and `readsAreAsked` is false. `stepsFor` consulted only the first, so both read steps rendered with `חובה` while `draftProblems({move, confidence}, first)` returned `[]` and the submit read `רשמו את ההחלטה`. Measured on `2390b35`. |
| **Reason** | `shared/confidence-asked.ts` states the exemption and its reason; `draftProblems` and `decisionAtomSchema` implement it; the screen did not. `stepsFor`'s `readsAreAsked` call was dead code, because that predicate is false wherever `confidenceIsAsked` is. |
| **Affected state** | `DECIDE`, `purpose: "first"` only -- the front door's username handoff, and the opening decision of every new game (`firstDecisionPly` initialises to `0`). |
| **Measurement impact** | The two read fields are no longer offered on a `first` decision. `decisionAtomSchema` already accepts their absence there and `readVocabulary` already counts an unanswered read as `unrecorded` rather than as a zero. What stops being collected is a **self-selected** subsample -- nothing required those fields, so whoever filled them chose to -- which is the one bias `confidence-asked.ts` says the whole design exists to avoid. Not `NONE`, and stated rather than rounded to it. |
| **Not fixed by** | Marking them optional. A visibly-optional read is the same self-selection with a truer label, and it is what K2 forbids. |
| **Test** | `tests/client/a-screen-that-asked-for-what-it-did-not-need.test.tsx`. Not a step-list assertion: for every purpose in `DECISION_PURPOSES` and both draw outcomes, the rendered steps and the set `draftProblems` refuses must be **the same set**. Screen and validator cannot drift again without it going red. |
| **Control** | Old `stepsFor` restored: 5 red, all on `first`. Restored: 27 green. |

## R2 -- the intro names the steps this decision has

| | |
| --- | --- |
| **Evidence** | `.commitment-intro` was a constant reading *"בחרו מהלך על הלוח וסמנו את הקריאה שלכם"*. `ASK_RATE = 0.15`, so on ~6 ordinary decisions in 7 the rendered step list is `["המהלך שבחרתם"]` alone. It also never named the confidence step, in any state. |
| **Reason** | An instruction naming a step that is not on screen cannot be followed. `docs/VALUE_CLARITY.md` Lens 4 and the `lichess-org/lila` `No mistakes found` precedent both name copy exceeding its measurement as a defect. |
| **Affected state** | `DECIDE`, every purpose. |
| **Measurement impact** | **NONE.** No field is added, removed or reordered; no draw changes. Only which steps the sentence names. |
| **Test** | Same file: the instruction half per purpose, the reason half asserted present in **every** state, and `instructionFor` unit-tested on the Hebrew list join. `tests/client/why-the-engine-waits.test.tsx` continues to hold the reason clause unchanged. |
| **Control** | Constant intro restored: 3 red. Restored: green. |

## R3 -- the board does not claim a return that did not happen

| | |
| --- | --- |
| **Evidence** | Chromium, fresh context, no prior storage, entering through `עמדה מהסט המשותף`: `.board-note` read `חזרתם למשחק שהייתם בו — 21 חצאי־מהלכים.` |
| **Reason** | Both front-door routes hand a position over through the same store the board restores from, so a first arrival is indistinguishable from a resumption. `savedAt` cannot separate them and neither can `gameId`. It is a claim about the player's history that the build manufactured a second earlier, in the first sentence under the board in the first state of the window. |
| **Affected state** | `DECIDE`, on mount, on both entry routes. |
| **Measurement impact** | **NONE.** `.board-note` is a notice; nothing reads it and no recorded field changes. |
| **Change** | `StoredPosition.handover: PositionHandover \| null`, set by the two handoff writers and null on the board's own write-back. Optional at parse, so a position stored by an earlier build reads as `null`, which is correct: the player was on it. The sentence itself is `restoreNotice` in `client/src/lib/adopt-position.ts`, beside the assignment it describes -- `Home.tsx` is held to 2,400 lines by `tests/client/the-file-that-only-ever-grew.test.ts`, which went red at 2,433 and is the reason this is not inline. Home is now 2,398, one line **below** where this work found it. |
| **Test** | Same file, three branches plus the half-move count on all of them. |
| **Control** | Handover-blind notice restored: 1 red. Restored: green. |

## R4 -- the help screen promises the ordering, not a fixed set of questions

| | |
| --- | --- |
| **Evidence** | `WhatThisIs`: *"קודם אתה בוחר מהלך, מסמן מה אתה קורא בעמדה ומה אתה לא מצליח להעריך, ואומר כמה אתה בטוח"* -- the four-step loop, as though it ran on every decision. It runs on about one in seven, and never in full on a `first` decision. |
| **Reason** | Same class as R2, one layer out. What is invariant is the **ordering**; which questions are asked is a fixed draw per position. |
| **Affected state** | The help overlay, reachable in every state. |
| **Measurement impact** | **NONE.** Behind a press, describes the protocol, changes no field. |
| **Added** | That the draw is per position and explicitly **not the player's choice** -- the one property that makes the sample worth anything, and the thing a player most plausibly mis-assumes. |
| **Test** | Same file: the ordering survives, the four-step clause is gone, the draw and the *"לא לפיך"* clause are present. |
| **Control** | Old paragraph restored: 2 red. Restored: green. |

## R5 -- a step head the sticky submit was covering, with four pixels to spare

| | |
| --- | --- |
| **Evidence** | Measured on the built app at 1440x900, with the `known` step open the way a multi-select leaves it: the confidence step head at y=833, `.commitment-submit` (`position: sticky; bottom: 8px`) at y=847. Ten pixels below the head's top is 843, which cleared the button by **four pixels**. R2's corrected intro wrapped one more line, the head moved to y=854, and `elementFromPoint` at that coordinate returned `.commitment-submit`. |
| **Reason** | The overlap is not new. `tests/layout/a-press-the-hand-can-feel.layout.test.ts` already carried a comment recording the same collision at centre-aim and worked around it with a constant offset -- which is what the four pixels were being spent on. A copy change consumed them and the suite went red for a reason that was not about press feedback. |
| **Affected state** | `DECIDE`, once the panel is taller than the viewport. |
| **Measurement impact** | **NONE.** One CSS property and one test aim; no field, no draw, no threshold. |
| **Change** | `scroll-margin-block-end` on `.commitment-step`, so every scroll that targets a step -- the panel's own auto-advance on `scrollIntoViewRespectingMotion`, and a keyboard walk -- lands it above the sticky control rather than under it. And the layout test's aim is **derived** now: it walks the element's own box for the first point hit-testing resolves to it. Strictly stronger than the constant, because a control covered at every point still finds nothing and still fails. |
| **Not fixed by** | Shortening the intro back under the four pixels. That would have restored a margin nobody knew was being spent and hidden the finding. |
| **Test** | `tests/layout/a-press-the-hand-can-feel.layout.test.ts`, unchanged in what it asserts. |

## R6 -- the bundle budget, raised with the measurement on the record

| | |
| --- | --- |
| **Evidence** | `npm run bundle:budget` fired: entry raw 688.8 kB against 688, initial download 778.6 against 778. Measured against the tree immediately before the repair by stashing exactly the ten changed source files and rebuilding: entry raw 687.8 -> 688.8 (+1.0), gzipped 215.7 -> 216.0 (+0.3), initial 777.6 -> 778.6 (+1.0). |
| **Reason** | `scripts/check_bundle_budget.ts` states the rule: *"If the growth is intended, raise the constant in the same commit that causes it, so the decision is on the record."* Every byte is on the entry route by construction -- the commitment screen and the board's own restore -- so there is no chunk to defer it into. |
| **Measurement impact** | **NONE.** |
| **Change** | `ENTRY_RAW_KB` 688 -> 690, `INITIAL_RAW_KB` 778 -> 780, with the before/after table and what caused it, in the file's own format. 689 would have left 0.2 kB, and a ceiling a whitespace change can cross teaches people to re-run the check rather than read it. |
| **Recorded, not raised** | The gzip ceiling did **not** fire, at 216.0 against 216, so by this file's convention it keeps its number -- and it is now at **zero headroom**. That is the number a person on a slow link actually waits for, and it has run out of room first. Written into the file so the next raise reads it as a standing warning. |

## R7 -- the probes

`research/ux-measurement/probes/`. Not part of `npm test` and not a gate, kept whole so the ledger
can be re-measured rather than believed, on the model of `docs/neta/harness/`. They pin the
counterfactual arm and print which one, and their visibility predicate is `checkVisibility()` after
the first version produced a finding that was an instrument artefact.

## R8 -- a row that can say which screen produced it

| | |
| --- | --- |
| **Evidence** | `VITE_QUIET_EVIDENCE_WINDOW_ENABLED` is a build flag. Two deployments of one commit put two different screens in front of two players while agreeing on `gitSha`, `CURRENT_PROTOCOL_VERSION` and every other field a row carries. `features.ts` said in a comment that turning the arm on required a protocol bump; a comment is not an invariant, and the mechanism could not have worked -- the constant lives in `shared/`, which may not read a `client/` build value. |
| **Reason** | The mission's rule: a measurement stimulus may not change without the resulting evidence carrying enough lineage to distinguish the populations. `session-position.ts` records the same failure already happening once, to `reveal_timing`, on a reload. |
| **Change** | `shared/quiet-window.ts` derives **one** exposure. `ContextRibbon` renders nothing iff it is `context-ribbon-suppressed`; `buildCommitEvent` stamps exactly what it returns, as a **required** parameter with no default. `quiet_window_exposure` on the atom, the wire schema, both stores, the server and the column. |
| **Measurement impact** | **NONE while the arm is off**, and that is the point: an OFF row and an ON row now differ in exactly one field, measured in `PROTOCOL_LINEAGE.md` §3.4. `null` is a third value meaning *no condition recorded*, and `producedUnderQuietWindow` returns `null` for it rather than `false`. |
| **Not fixed by** | Deriving the version from the flag (architecturally impossible), or keeping the arm out of the record (lineage would live in deployment state rather than beside the observation). The options and why B won: `PROTOCOL_LINEAGE.md` §3.2. |
| **Test** | `tests/shared/a-row-that-cannot-say-which-screen-produced-it.test.ts` round-trips both arms through the real wire schema, service and store. |
| **Control** | Two predicates, each blind to the other's defect. `GATE-QUIET-WINDOW-LINEAGE` red on a second suppression path (2 findings) and on a hard-coded arm at the write (1). The test red when `record-service` stops passing the field through -- **where the gate is green**. |
| **Found by the repo's own law** | Stamping the exposure made `onCommit` read `stage`, and `a-stale-closure-fabricates-an-observation` went red on the missing dependency. `stage` is now declared. Every evidence stage returns the same exposure, so the value would not have differed -- which is exactly the silent coupling that law exists to refuse. |

## R9 -- the gzip ceiling, and what came out to pay for it

| | |
| --- | --- |
| **Evidence** | `npm run bundle:budget` fired on the compressed ceiling for the first time in this file's history: 216.1 kB against 216. Measured by stashing the whole branch and rebuilding on `dcfa580`: entry raw 688.8 -> 689.3 (+0.5), gzipped 216.0 -> 216.1 (+0.1), initial 778.6 -> 779.1 (+0.5). |
| **Reason** | R6 recorded that the gzip ceiling was at **zero headroom** and wrote the warning into the file for the next reader. This is the next reader. |
| **Change** | `ENTRY_GZIP_KB` 216 -> 217, with the before/after table and its cause. Raw and initial did not fire and keep their numbers. |
| **What came out** | `Opponent` moved from `Home.tsx` to `lib/opponent.ts`, where `OpponentDepth` already lived. It had two definitions of one shape -- the component's, and `session-position.ts`'s inline copy in the stored-session parse -- either of which could have drifted while both kept compiling. A JSDoc block documenting `loadLichessGame` was sitting forty lines above it, over `runGameReview`; it now sits over the function it describes. `Home.tsx` is 2,395 lines, below both the 2,400 ceiling and the 2,398 this work found. |
| **Measurement impact** | **NONE.** |

## The version the repairs cost

`REPO-CERTAIN` answers *"is the build contradicting itself?"*. It does **not** answer *"did the
conditions of observation change?"*, and R1-R3 turn out to be both.

| Fix | seen while evidence is produced? | action? | field? | salience/timing? | bump? |
| --- | --- | --- | --- | --- | --- |
| R1 first decision stops asking for the reads | **yes**, two step heads and the chip menu | **yes** | **yes** | **yes** | **forces it** |
| R2 the intro names the steps that exist | **yes**, every purpose | no | no | **yes** | **forces it** |
| R3 the board stops claiming a return | **yes**, `.board-note` | no | no | no | **forces it** |
| R4 the help screen | no, behind a press | no | no | no | no |
| R5 the step register clears the submit | **yes**, conditionally, on auto-advance | no | no | **yes** | contributes |

`CURRENT_PROTOCOL_VERSION` **4 → 5**. Three of the five are on the versioning rule's own
forced-bump list, and the v4 exemption had already expired by its own terms -- production is
serving a build that stamps 4. Full reasoning, the three claims about v4 kept apart, and the
health-endpoint evidence: [`PROTOCOL_LINEAGE.md`](PROTOCOL_LINEAGE.md) Parts 1 and 2.

## Verified, on the declared runtime

Run on the tree this change produces, on **Node `v24.20.0`**, which is what `engines.node: "24.x"`
and the three workflows' `node-version-file: package.json` resolve to. The earlier round of this
work was verified on `v22.22.2` and said so; that is no longer a caveat here, and the difference was
not cosmetic -- Node 24 caught an extensionless ESM import in `drizzle/schema.ts` that `tsc` and
`vite build` both accepted and that would have failed the serverless entry in production.

| command | result |
| --- | --- |
| `npm run check` | pass |
| `npm run build` | pass |
| `npm test` | **3,180 passed · 0 failed · 36 skipped**, 299 files. Baseline before this work was 2,986 |
| `npm run gates` | **36 of 36 pass** |
| `npm run gates:controls` | **36 of 36 controls red**, which is the pass |
| `npm run bundle:budget` | within budget: 689.3/690 raw, 216.1/**217** gzip, 779.1/780 initial |

The four failures Node 24 surfaced that Node 22 did not, all fixed here rather than worked around:

| failure | cause | fix |
| --- | --- | --- |
| `serverless-entry` -- `ERR_MODULE_NOT_FOUND` on `shared/quiet-window` | `drizzle/schema.ts` imported it without `.js`, against the convention of the twelve imports around it. Real Node ESM refuses; the bundler did not | the extension, as the file's other imports have |
| `the-file-that-only-ever-grew` -- 2,402 against 2,400 | R8's one argument at the commit site | R9: `Opponent` moved out, and it was a shape defined twice |
| `a-stale-closure-fabricates-an-observation` -- `onCommit` holds `stage` | stamping the exposure made the callback read the stage | `stage` declared. See R8's last row: the value would not have differed, which is the point |
| `the-toll-on-the-opening-move` -- three schema assertions | a fixture predating the new field | `quiet_window_exposure: null`, which is what a row from before the field says |

And the two repairs that are paint facts were re-measured in Chromium on the rebuilt artefact rather
than inferred from the diff:

```
.commitment-intro   בחרו מהלך על הלוח, סמנו את הקריאה שלכם ואמרו כמה אתם בטוחים. המנוע לא ידבר...
.board-note         עמדה מהסט המשותף — 21 חצאי־מהלכים.
```

The first now names all three steps the anchor purpose asks for, including the confidence question
the old constant never mentioned in any state. The second no longer tells a stranger they came back.

The quiet-window arm was measured the same way, on two builds of one commit rather than reasoned
about: `PROTOCOL_LINEAGE.md` Part 4.

---

# 2. `RESEARCH-GATED` -- prototype only, no production change

Ordered by what unblocks what.

## G0 -- the quiet-window exposure `[X-5 prerequisite]` -- **done**

Not on this list when it was written, and it turned out to be the one row-level exposure that could
not wait: the arm is a build flag, so it can change the stimulus without changing anything a row
records. `PROTOCOL_LINEAGE.md` Part 3 has the design, the options that lost, and the two controls.
It does **not** discharge G1 below -- that is four other surfaces, and their exposure is still
unrecorded.

## G1 -- record the conditional exposures `[X-0]`

The prerequisite for four of the five experiments. Three of the six conditional surfaces in the
window cannot be reconstructed after the fact, so a decision that saw a tension and one that did not
are one population. `GATE-EXPOSURE-CONTEXT` is unregistered waiting for this and
`docs/decisions/D21-feedback-exposure.md` records the three candidate schemas without choosing one.

**Permitted:** a schema proposal, a migration sketch, a test harness. **Forbidden:** shipping a
schema without the D21 decision, and any reveal that reads the field.

## G2 -- `declaredTensions` behind a pinned arm `[X-1]`

The strongest collision in the window, measured at C17 in the ledger: y=605, above the submit at
y=732, on a draft where every answer is still changeable. Build the SHOWN/SILENT arm with the rule
evaluated in both and only the render suppressed, so both arms draw from the same eligible drafts.

**Forbidden:** removing it because it looks like coaching. LAW 9, and the null result is worth
having.

## G3 -- architecture D behind a flag `[X-5]` -- **the ribbon half is built**

**Built, off by default.** `QUIET_EVIDENCE_WINDOW_ENABLED` in `client/src/lib/features.ts`, read
by `ContextRibbon` alone, via a `producingEvidence` prop `Home.tsx` fills from `focus`. Off, the
ribbon is byte-identical in both states, which
`tests/client/an-arm-that-ships-nothing.test.tsx` asserts as markup rather than by eye. The flag is
`=== "true"`, so a misspelt or absent value fails closed -- `features.ts`'s own rule, after
`VERIFIED_LEARNING` shipped default-on against a verdict that did not support it.

This is the one arm that can **falsify** the leading architecture: if a quiet window raises
abandonment inside `DECIDE`, the loop position is `ACTION-NECESSARY` and the ledger's row B1 is
wrong. An arm that could only confirm would not be worth a flag.

**Not built, deliberately:** the loop strip, the mode badge, the re-orientation line, and the
relocation of `.commitment-tension` to the reveal. Each is a separate stimulus change and the arm
is only interpretable if one thing moves.

**Lineage, and this replaced a plan that would not have worked.** The original note said turning
the arm on would require a `CURRENT_PROTOCOL_VERSION` bump. A build flag moves without a commit, so
both arms would have carried the same version. Every decision now stamps `quiet_window_exposure`,
derived from the same expression that suppresses the ribbon: see G0 above and
`PROTOCOL_LINEAGE.md` Part 3.

**Forbidden:** shipping it as the default. `DESIGN_DECISION.md` records `NO WINNER -- FIELD
REQUIRED` and D leads E by 4 points out of 100 with a 15-point `FIELD REQUIRED` row between them.

## G4 -- extend the focus surfaces the gate and the test can see

`RECORD_READINGS` in `scripts/inertia-scan.ts` matches component names; `FEEDBACK_SURFACES` in
`nothing-to-read-while-you-decide.test.tsx` matches seven selectors. Neither can see a **string**
produced by `loopPosition` that is a verdict rather than a loop position.

**Why this is not `REPO-CERTAIN`.** It requires deciding whether
`הטענה הופרכה ונשמרת` and `אף דפוס לא עבר את הסף` are readings under LAW 1, and LAW 1's own
carve-out is genuinely ambiguous: *"where in the loop the record is ... is not one"*, and the loop's
last step is literally `grade`. **The owner decides what the law means. Then it is repo-certain.**

## G5 -- a gate for the Production Contract's third clause

No surface inside `makingEvidence` may take `secondsTaken`, `phase` or `clockMsRemaining` as an
input. `declaredTensions` obeys this **by rule**, stated in its module comment after a rule that
fired only on drafts under ten seconds old had to be deleted. Nothing enforces it.

**Permitted:** write the scanner and its positive control. **Forbidden:** registering it before its
control has been shown red under the deleted rule reverted into the tree -- the repository's own
standard, and `PRE_HUMAN_UX_PASS_5` records two falsifiers that went red and still did not
discriminate.

## G6 -- known/unknown ordering `[X-3]`, candidate disclosure `[X-4]`, confidence timing `[X-2]`

Per `MEASUREMENT_REACTIVITY_EXPERIMENTS.md`. All three are LAW 9 surfaces and all three change
through an experiment or not at all. X-4 **may be run and may not be shipped**: a SILENT arm that
became the default would record a behaviour it never disclosed.

## G7 -- a transferable distinction in the reveal `[Phase 13]`

See section 5. The gap is question 4 of five, and it is the only one the reveal does not answer
structurally.

---

# 3. `FIELD-GATED` -- only a person can close these

The authority is already handed off. `runtime/handoffs/HANDOFF-LICHESS-FIELD-001.json`:
`current_claim_state: INSUFFICIENT_REALITY`, `resolution_authority: FIELD`, and
`must_not_infer` includes *"a rendered reveal is not a read one, and a clean DOM is not
comprehension"*. `research/lichess-prerelease/FIELD_RUN_SHEET_TRIAL1.md` carries **zero participant
rows**.

| # | question | protocol |
| --- | --- | --- |
| F1 | can a cold player reach a first decision with no assistance and no explanation? | companion Arm D, D-1/D-2/D-8 |
| F2 | which sentence causes the hesitation? | companion Arm D, D-3 |
| F3 | do they describe what they did as being about their decision, or about the tool? | companion Arm D, D-iii |
| F4 | does the reveal leave a distinction that applies elsewhere? | frozen Arm B, plus D-iii |
| F5 | is the friction accepted after the payoff? | frozen Arm C's ledger |
| F6 | does anything asked before the result change how they thought while deciding? | companion Arm E, **hypothesis-generating only** |
| F7 | do they explain a second decision as another independent observation? | frozen protocol, Lens 5 |

**Run the frozen arms first, unchanged.** The companion adds Arms D and E and rewords nothing.

---

# 4. Change map

| file / area | current role | proposed change | authority | measurement risk | tests | gate |
| --- | --- | --- | --- | --- | --- | --- |
| `client/src/components/CommitmentScreen.tsx` | the instrument | `stepsFor` per-step; `instructionFor` derives the intro | `REPO-CERTAIN` | `first` reads no longer collected (stated in R1); intro none | new file, 27 assertions, 4 controls shown red | none new |
| `client/src/lib/session-position.ts` | the board's memory | `handover` field, optional at parse | `REPO-CERTAIN` | none | same | none |
| `client/src/pages/Home.tsx` | the loop | handoff-aware restore; `handover: null` on write-back | `REPO-CERTAIN` | none | same | `the-file-that-only-ever-grew` |
| `client/src/lib/adopt-position.ts` | how a stored position becomes the board | `restoreNotice`, beside the assignment it describes | `REPO-CERTAIN` | none | same | none |
| `client/src/pages/Record.tsx`, `client/src/lib/bank-handover.ts` | the front door | stamp `handover` | `REPO-CERTAIN` | none | same | none |
| `client/src/components/WhatThisIs.tsx` | help | ordering promised, question set stated as a draw | `REPO-CERTAIN` | none | same | none |
| `client/src/index.css` `.commitment-step` | the step register | `scroll-margin-block-end` clears the sticky submit | `REPO-CERTAIN` | none | `a-press-the-hand-can-feel` | none |
| `tests/layout/a-press-the-hand-can-feel.layout.test.ts` | press feedback | the aim is derived, not a constant | `REPO-CERTAIN` | none, it is the instrument | itself | none |
| `client/src/lib/features.ts`, `client/src/components/ContextRibbon.tsx` | the quiet-window arm | `QUIET_EVIDENCE_WINDOW_ENABLED`, off by default; the guard reads `quietWindowExposure` rather than the flag | `RESEARCH-GATED` as an arm, `REPO-CERTAIN` for its lineage | none while off, asserted; measured on two builds in `PROTOCOL_LINEAGE.md` Part 4 | `an-arm-that-ships-nothing` | `GATE-QUIET-WINDOW-LINEAGE` |
| `client/src/lib/declared-tensions.ts` | pre-commit tension | **none now.** Arm behind a flag | `RESEARCH-GATED` | **HIGH** | X-1 harness | G5 later |
| `client/src/components/ContextRibbon.tsx`, `client/src/lib/loop-position.ts` | loop position | **none now.** Grading strings out of `focus`, behind a flag | `RESEARCH-GATED` | **MEDIUM** | X-5 arm | G4 |
| `client/src/lib/read-options.ts` | the read vocabulary | **none.** Ordering arm only | `RESEARCH-GATED` | **HIGH** | X-3 | none |
| `shared/confidence-asked.ts` | the sampling rule | **none.** Timing arm only | `RESEARCH-GATED` | **HIGH** | X-2 | LAW 9 |
| `shared/counterfactual.ts` | the probe | **none** | `RESEARCH-GATED` | UNKNOWN, and the exposure is already stored | -- | LAW 9 |
| `shared/quiet-window.ts` | **new.** The one expression the ribbon and the write both read | `quietWindowExposure`, `producedUnderQuietWindow` | `REPO-CERTAIN`, lineage | none: the value is derived from the condition on screen | `a-row-that-cannot-say-which-screen-produced-it` | `GATE-QUIET-WINDOW-LINEAGE` |
| `shared/decision-atom.ts` | the record | `quiet_window_exposure`, nullable. **The four other conditional exposures are still G1** | `REPO-CERTAIN` for this one; the rest `RESEARCH-GATED` | additive and nullable; `null` reads as *no condition recorded*, never as the control | same, plus ~38 fixtures | `GATE-ISO`, `GATE-QUIET-WINDOW-LINEAGE` |
| `shared/measurement-protocol.ts` | the protocol version | `CURRENT_PROTOCOL_VERSION` 4 -> 5, with the three grounds | `REPO-CERTAIN` | it asserts the populations differ, which is the weaker claim | `prereg`, `said-once` | none |
| `drizzle/schema.ts`, `drizzle/migrations/0019_*` | durable storage | the column, as a nullable enum | `REPO-CERTAIN` | none, additive | `drizzle-store` | `GATE-ISO` |
| `client/src/lib/opponent.ts`, `client/src/lib/session-position.ts` | the other side | `Opponent` moves out of `Home.tsx`, where it was one of two copies of one shape | `REPO-CERTAIN` | none | `the-file-that-only-ever-grew` | none |
| `shared/reveal.ts` | what the reveal may say | **none now.** Transferable distinction is G7 | `RESEARCH-GATED` | none if additive after closure | G7 | `GATE-GRADE` |
| `scripts/inertia-scan.ts` | the focus gate | **none now.** Widening is G4 | `RESEARCH-GATED` | none | control must go red | `GATE-DECISION-FOCUS` |
| `scripts/check_bundle_budget.ts` | the entry-chunk ceiling | +2 kB raw, then +1 kB gzip, each with its measured delta and its cause | `REPO-CERTAIN` | none | `bundle:budget` | itself |
| `research/ux-measurement/probes/` | measurement | added | `REPO-CERTAIN` | none, outside the build | not in `npm test` | none |
| `docs/VALUE_CLARITY_FIELD_PROTOCOL.md` | frozen | **none** | frozen | -- | -- | -- |

---

# 5. Reveal quality, against Phase 13's five questions

Measured on the built app, `09-REVEAL`.

| question | answered by | verdict |
| --- | --- | --- |
| 1. What happened? | `.reveal-one-thing`: a branch of `theOneThing`, or the silence sentence with the basis that produced it | **yes** |
| 2. What evidence supports this? | `.one-thing-evidence` (`process` / `engine`, proved by ablation) plus `.one-thing-basis` | **yes** |
| 3. What can we not infer? | `.reveal-limits`, **first**, before any number, plus `.reveal-build-limit` | **yes**, and the ordering is deliberate |
| 4. What distinction should I carry into another decision? | `OneThing.note` on three branches; `nextQuestion` otherwise | **partial** |
| 5. What would another observation tell us? | `.accumulation-lead` and `.accumulation-next` | **yes** |

**Question 4 is the gap, and it is narrower than it looks.** Three `OneThing.note` strings already
carry a transferable distinction:

- `chose-past-it` -- *"כאן הקושי לא היה למצוא את המהלך, אלא לבחור בינו לבין האחר"*: finding versus
  choosing, which applies to any position.
- `confident-and-wrong` -- *"זה על הביטחון, לא על המהלך"*.
- `trusted-it-too-little` -- *"ייתכן שידעת כאן יותר ממה שסמכת על עצמך"*.

`outplayed` and **silence** do not. Silence is the common case for a cold player, and there
`nextQuestion` produces a question about **this** position: *"בחרת את b5b4, וזה גם המהלך של המנוע.
מה היה הנימוק שלך?"* True, useful, and local.

**What G7 may and may not do.** It may name a distinction the *measurement* supports on the silent
branch -- for instance that a decision inside evaluation noise is a decision the record cannot
separate from a good one, which is a fact about the instrument the player can carry. It may not
invent a coaching sentence. The old `AnalysisPanel` ended every position with the same hardcoded
line about the centre, and `shared/reveal.ts` opens by naming that as the defect it exists to
prevent: *"a fixed template rendered as insight is manufactured certainty -- replacing it with a
more fluent generator would be the same defect with better prose."*

---

# 6. Accumulation, against Phase 14

> `observation → repeated observation → pattern candidate → calibrated claim`

| stage | exists? | where |
| --- | --- | --- |
| observation | yes | `theOneThing`, one decision |
| repeated observation | yes | `revealAccumulation`, per-kind count, suppressed below `n = 2` |
| pattern candidate | yes | `detect` at `MIN_BUCKET_N` per side and `SEPARABILITY_K = 3.75` standard errors, both set by the shuffled-label control |
| calibrated claim | yes | `GATE-GRADE`: every claim renders at its grade with its `n`; the population baseline separates predictive from personal |

**The chain is complete and no single reveal pretends to be a pattern.** `ACCUMULATION_LEAD` is a
constant, there is no countdown, no streak and no digit as a reason to continue, and Lens 5's
invariance test holds the proposition identical across all five outcomes.

**What is missing is not a stage. It is the join.** `ACCUMULATION_KIND_LABEL` counts five kinds. A
player who receives `chose-past-it` twice on materially different positions is told it happened
twice and is not told what the two have in common -- because the record does not hold that, and the
detector's buckets are clock, phase and time rather than anything the player said.

**And the join is blocked by D21, not by design work.** Until exposure is recorded, an accumulation
across decisions accumulates over a population mixing decisions taken before and after the player
saw a finding. `GATE-EXPOSURE-CONTEXT` is unregistered for exactly this reason. **G1 is the
accumulation work.** It looks like plumbing and it is the moat.

---

# 7. Do not change, and why

| held | why | what would release it |
| --- | --- | --- |
| the 1-7 confidence scale, and whether the question is put | LAW 9. Replacing it could move latency, the distribution and the meaning of the scale | X-2, preregistered |
| `ASK_RATE = 0.15` and `drawForDecision` | a hash-drawn sample; any player-facing alternative reintroduces self-selection. The finalising mix was measured for run length, not only for rate | a burden/claim-latency curve on the shuffle harness |
| `PROBE_PROBABILITY = 0.35` and the probe's position at `committed` | the move is locked and the engine has not run: the only window where the answer is the player's own candidate. A skip button produces self-selection | a burden/reactivity study |
| `KNOWN_OPTIONS` / `UNKNOWN_OPTIONS` content and order | changing the menu changes the vocabulary reading's own denominator | X-3 |
| `declaredTensions` **as it renders today** | LAW 9 by extension: it is metacognitive friction inside the window | X-1 |
| the candidate list and `.candidates-note` | Lens 3 requires the asymmetry stated where candidates are shown. It may move; it may not disappear | X-4, and only to relocate it |
| the reveal's limits-first ordering | it protects the reader from a finding they cannot generalise. The frozen protocol's limits-order question decides it, and *"the incumbent is the one that protects the reader"* | Arm B, on both questions, and only if value comprehension improves while limitation comprehension does not weaken |
| `docs/VALUE_CLARITY_FIELD_PROTOCOL.md`, `docs/ACQUISITION_PROTOCOL_V1.md` §1-6 | frozen. Editing retires every measurement taken before the edit | a v2 with a statement of which trial-1 numbers stay comparable |
| `MIN_BUCKET_N`, `SEPARABILITY_K`, `ACCURATE_CP_LOSS`, the detector | none of this work touched a threshold, and none of it produced evidence about one | a measurement, not a UX finding |
| the reveal's `silence` branch | *"זו תוצאה תקינה, לא מסך ריק"* is the product's credibility. Filling it would be the defect `shared/reveal.ts` opens by naming | nothing |

---

# 8. Stop condition

**Repository work on this question is misallocation from the moment the following are true:**

1. R1-R7 are merged, the quiet-window arm is in the tree and off, and the suite, the gates,
   the gate controls, the bundle budget and the layout tests are green.
2. `MEASUREMENT_REACTIVITY_EXPERIMENTS.md` and `FIELD_COMPANION_PROTOCOL.md` exist and are frozen.
3. Nothing on the `REPO-CERTAIN` list remains open.

**All three are true as of this change.**

Everything still open needs one of two things the repository does not contain: an **arm**, which
needs decisions from people; or a **participant**, which needs people. The one piece of work that
is neither -- G1, recording the exposures -- is blocked on the D21 schema decision, which is the
owner's and is deliberately open.

The canonical R&D runtime reached this boundary before this work did, on a different question and
from a different direction. `DEL-LICHESS-FIELD-INSTRUMENT-002.json` closes with
`stop_or_continue: STOP` and `next_move: "FIELD recruits the first cohort... No further repository
work on this claim."`

**What this work adds is not a reason to reopen it.** It is the observation that four sentences on
the way to a first decision were false, and that running a comprehension trial over them would have
produced comprehension data about defects. Those are fixed. The handoff stands.

**The next move is a participant.** `research/lichess-prerelease/FIELD_RUN_SHEET_TRIAL1.md`, Arm A
5-8, Arm B 5-8, Arm C 8-15, plus the companion's Arms D and E on the Arm B sessions.

**What would reopen the repository as an authority:** a participant who cannot reach a first
decision on either route. That is the frozen protocol's own stop condition, it is a liveness defect
rather than a comprehension finding, and it moves the authority back here.
