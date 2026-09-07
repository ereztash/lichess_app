# Current state, frozen before the interaction work

This is the baseline the rest of `research/ux-measurement/` is measured against. Nothing in this
directory changed product behaviour before this file existed.

## What this programme is for

> **While evidence is still mutable, minimise cognitive intervention.
> Once the evidence window closes, maximise the learning the evidence actually justifies.**

Two vocabularies the rest of the directory uses without redefining them:

**Instrument literacy** -- what a player must learn about Decision Lab in order to use it: its
terms, its ordering, why it asks. It is a cost, and the target is zero.

**Decision literacy** -- what a player learns about their own reading, confidence and choice from
having used it. It is the product, and the target is as much as the evidence supports.

The goal is not less friction. Some of this product's friction *is* the instrument, and
`docs/INERTIAL_UX_LAWS.md` LAW 9 already holds three such surfaces behind a research gate.

## Revisions

| what | sha |
| --- | --- |
| `main` at the start of this work | `f1315d7bc7b1994006bc7171247ac198b8d64439` |
| working branch `claude/lichess-interaction-design-xsgtm6`, and the tree every measurement below was taken on | `2390b3510f798cd40e5ae5fd21573edb5e965181` |

The branch is ten commits ahead of `main` and carries unmerged research and documentation work.
Every number below is from `2390b35`, not from `main`, and a re-measurement on `main` would not
necessarily reproduce them.

## Baseline, measured rather than cited

Run in this container, Node `v22.22.2`. `package.json` declares `engines.node: 24.x`, so the
container is **below** the declared runtime; nothing below failed for that reason, but a green
result here is not a green result on the declared runtime and should not be quoted as one.

| command | result |
| --- | --- |
| `npm run check` | **pass** (exit 0) |
| `npm run build` | **pass** (exit 0) |
| `npm test`, before a build exists | 2,986 passed · 189 skipped · **20 files failed** |
| `npx vitest run tests/layout`, after `npm run build` | 24 files · 175 tests · **all pass** |
| `npm run gates` | **35 of 35 pass**, 0 fail, 0 not-measured |

**The 20 failures are one cause and it is not a defect.** Every one is in `tests/layout/` and every
one is `dist/public is not built. Run 'npm run build' before the layout tests.` They pass after a
build. Recorded because a future run that sees 20 red files should recognise this and not go
looking for a regression.

## Invariants this work is bounded by

Stated where they already live, not restated as new rules.

| invariant | where | what it forbids here |
| --- | --- | --- |
| R3 / LAW 1 -- measurement before intervention | `docs/INERTIAL_UX_LAWS.md`, `makingEvidence`/`engineMayRun` in `client/src/lib/decision-session.ts` | any reading of the record, or engine output, while the player is producing evidence |
| LAW 9 -- instrument friction is research-gated | `docs/INERTIAL_UX_LAWS.md` | changing the confidence question, the sampled reads or the counterfactual probe because they are annoying |
| LAW 8 -- never fabricate measured input | `docs/INERTIAL_UX_LAWS.md` | pre-selecting a confidence, a read or an answer to save a press |
| LAW 6 -- details never carry the main meaning | `docs/INERTIAL_UX_LAWS.md` | moving what happened, or what to do, behind a disclosure |
| the sampling rule | `shared/confidence-asked.ts` | letting the *player* decide whether the confidence question is put; that curates the sample on the measured variable |
| the reveal's order | `shared/reveal.ts` | putting a finding before what cannot be inferred from it |
| copy may not exceed the measurement | `docs/VALUE_CLARITY.md` Lens 4 | a sentence that claims more than the branch that produced it |

## Frozen documents

`docs/VALUE_CLARITY_FIELD_PROTOCOL.md` says of itself *"Frozen before the first participant"* and
lists the conditions that retire data if it changes. It is **not edited by this work**. Additional
observations go in the companion, `FIELD_COMPANION_PROTOCOL.md`, which adds arms and never rewords
an existing one.

`docs/ACQUISITION_PROTOCOL_V1.md` states its route is frozen rather than tuned. Untouched.

`docs/VALUE_CLARITY.md`, `docs/INERTIAL_UX_LAWS.md` and `docs/INTERACTION_GEOMETRY.md` are not
declared frozen, but they are the canonical statements this work reasons from. Where this work
disagrees with them it says so here rather than editing them.

## Existing field protocols

| protocol | question it answers | status |
| --- | --- | --- |
| `docs/VALUE_CLARITY_FIELD_PROTOCOL.md` | can a cold player reconstruct the problem, the difference, the reveal and the reason to continue? | ready to run, **no participant yet** |
| `research/mechanism/FIELD_PROTOCOL_TEMPLATE.md` | does the frozen instruction reduce the error in future games? | prospective, not run |

`docs/PRE_RELEASE_STATE.md` names `F-HUMAN-CORE` as a P1 blocker whose authority is **FIELD** and
records that no repository check produced a gap on the audited candidate. That is the same boundary
this work runs into, from a different direction.

## Prior UX passes that must not be re-discovered

`docs/neta/PRE_HUMAN_UX_PASS_1..5.md` are five completed passes with a runnable harness at
`docs/neta/harness/`. Two of their methodological findings are load-bearing here and are adopted
rather than re-derived:

1. **A walk that answers the counterfactual silently draws a 0.35 arm and changes the code path
   under test.** Three passes disagreed about a count for this reason. Every probe in this
   directory pins `Math.random` before page scripts run, and reports which arm it pinned.
2. **A gate that went red before a fix and green after has not yet been shown to discriminate.**
   The check is to revert the rule into the tree and re-run.

## Defects established here, with the evidence

Six candidates were opened. **One was refuted by its own measurement and is kept**, because the
refutation is the more useful record, and one was found by a test rather than by looking.

### D1 -- the first decision shows two required fields that nothing requires

`REPO-CERTAIN.` Measured with `@testing-library/react` against `CommitmentScreen` at `2390b35`.

`stepsFor` in `client/src/components/CommitmentScreen.tsx`:

```ts
confidenceIsAsked(context)
  ? ALL_STEPS
  : ALL_STEPS.filter((step) => step === "chosenMove" || readsAreAsked(context))
```

`readsAreAsked` returns `false` whenever `confidenceIsAsked` returns `false`, so the filter in the
second branch can never keep anything but `chosenMove`, and the first branch never consults
`readsAreAsked` at all. The call is dead and the function is equivalent to
`confidenceIsAsked ? ALL_STEPS : ["chosenMove"]`.

The one purpose where the two predicates disagree is `first`:

| purpose | `confidenceIsAsked` | `readsAreAsked` |
| --- | --- | --- |
| `first` | **true** | **false** |
| `anchor`, `drill`, `transfer` | true | true |
| `play`, `import` (draw passed over) | false | false |

Rendered, on `purpose: "first"`:

```
step 1  המהלך שבחרתם          required marker: no    state: done
step 2  מה אתם קוראים בעמדה    required marker: חובה  state: open
step 3  מה אתם לא יכולים להעריך required marker: חובה  state: todo
step 4  כמה אתם בטוחים          required marker: חובה  state: todo
```

and `draftProblems({move, confidence}, first) === []`. The submit reads `רשמו את ההחלטה` with both
"required" steps still unanswered.

`shared/confidence-asked.ts` states the exemption and its reason in as many words: *"IT IS ALSO THE
ONE DECISION ALLOWED TO ARRIVE WITHOUT THE TWO READ FIELDS"*, and *"a wall of required fields is
their whole first impression -- a rule nobody has been taught is a toll rather than discipline."*
The validator and the atom schema implement it. The screen does not.

**Reach.** `firstDecisionPly` initialises to `0` and `isFirstDecision` is
`currentPly + 1 === firstDecisionPly`, so `first` fires on the front door's username handoff **and**
on the opening decision of every new game against the engine.

### D2 -- the commitment intro instructs a step that is not on screen

`REPO-CERTAIN.` `.commitment-intro` is unconditional:

> בחרו מהלך על הלוח **וסמנו את הקריאה שלכם**. המנוע לא ידבר לפני שההחלטה נרשמה...

On a `play` or `import` decision the draw passed over, the rendered step list is
`["המהלך שבחרתם"]` and nothing else. `ASK_RATE = 0.15`, so this is the state of roughly
**six ordinary decisions in seven**. The sentence tells the player to do something the state does
not offer.

The second half of the sentence, the reason the engine waits, is asserted by
`tests/client/why-the-engine-waits.test.tsx` and is correct in every state. Only the instruction
half is state-blind. That test exercises `purpose: "anchor"` only, which is why this was never red.

### D3 -- the record is read back to the player mid-window, and updates on their own commit

`RESEARCH-GATED`, not repo-certain, and the reason is that LAW 1's own carve-out is ambiguous here.

Measured in Chromium on `dist/public`, 1440x900, arm pinned `probed`:

| state | `.context-loop` / `.context-loop-basis` |
| --- | --- |
| DECIDE, before any move | `עוד 60 החלטות מדודות עד שאפשר לומר משהו. ייבוא משחקים שכבר שיחקת יכול לקצר את זה...` · `0 מתוך 0 שנרשמו נספרות בחיפוש הזה` |
| `committed`, counterfactual question open | `... 1 נמדדו ונקראות בחלק אחר של הרשומה...` · `0 מתוך 1 שנרשמו נספרות בחיפוש הזה` |

So while the player is answering *"if you hadn't played that, what would you have played instead?"*
-- an instrument question whose answer is still mutable evidence -- the ribbon reads the record back
to them, updates on the decision they just made, and tells them it does not count.

LAW 1 permits *"where in the loop the record is -- how many decisions exist, what is blocking a
claim"*. It forbids *"a finding, verdict, rate or recommendation about the player's OWN past
decisions"*. `loopPosition` can produce both from the same surface: the counts above are the
permitted kind, and `הטענה הופרכה ונשמרת`, `הטענה שרדה דריל` and
`יש מספיק החלטות, ואף דפוס לא עבר את הסף` are not obviously the permitted kind.

`GATE-DECISION-FOCUS` cannot see this: `RECORD_READINGS` in `scripts/inertia-scan.ts` is a list of
seven component names and `ContextRibbon` is not one of them.
`tests/client/nothing-to-read-while-you-decide.test.tsx` cannot see it either: its
`FEEDBACK_SURFACES` map lists seven selectors and `.context-ribbon` and `.loop-strip` are not among
them. **The rule is not being evaded; it was written for components and this is a string.**

### D4 -- REFUTED: the disclosure that names the detector's variables is not painted while closed

The first version of the surface probe reported `.context-why`'s body on screen during DECIDE:

> המסך לא מסתכל על מהירות ההחלטה, על שלב המשחק ועל השעון -- אלה הדברים שהגלאי מודד, וממשק שמגיב
> עליהם היה משנה את מה שנמדד.

If that were painted unpressed it would be a serious finding: the screen would be naming the
detector's own measured variables to a player who is producing measurements of exactly those
variables.

**It is not painted.** Measured:

```
details.context-why   open: false
small                 rect h=390  display: block  visibility: visible
                      checkVisibility(): FALSE
.context-ribbon innerText: does not contain the sentence
after clicking למה?   innerText: contains it
```

A closed `<details>` gives its children `content-visibility: hidden`; they keep the geometry of
their last layout and still report `display: block` and `visibility: visible`. The probe's
predicate was rect plus computed style, which is not sufficient. It now uses `checkVisibility()`,
which agrees with `innerText`, which is what a person reads.

**Every "on screen" claim in `PRE_EVIDENCE_SURFACE_LEDGER.md` was re-measured after this fix.** The
finding is kept because the instrument artefact is more likely to recur than the finding was.

### D5 -- a stranger is told they came back to a game they never played

`REPO-CERTAIN.` Measured in Chromium, fresh browser context, no prior storage, entering through
`עמדה מהסט המשותף` on the front door:

```
.board-note   חזרתם למשחק שהייתם בו — 21 חצאי־מהלכים.
```

*"You came back to the game you were in -- 21 half-moves."* The player has never seen this game.
`Home.tsx` restores from `readPosition()` on mount and phrases every restore as a return; the front
door's own handoff writes that position a moment earlier, so the first arrival reads as a
resumption. This is the first sentence under the board in the first state of the evidence window.

### D6 -- the sticky submit was covering a step head, with four pixels to spare

`REPO-CERTAIN`, and found by a test rather than by looking.

Measured on the built app at 1440x900, with the `known` step left open the way a multi-select
leaves it:

| | y | height |
| --- | ---: | ---: |
| confidence step head | 833 | 44 |
| `.commitment-submit`, `position: sticky; bottom: 8px` | 847 | 45 |

`tests/layout/a-press-the-hand-can-feel.layout.test.ts` aims ten pixels below a control's top, and
its own comment records why: *"`.commitment-submit` is `position: sticky` and sits over the step
heads at exactly the coordinate a centre-aimed press lands on."* So the aim was 843 and the button
started at 847. **The suite was passing by four pixels.**

D2's corrected intro wraps one more line on a fully instrumented decision. The head moved to 854,
`elementFromPoint` at the aim returned `.commitment-submit`, and the test went red.

The overlap is not new and the correct repair is not to shorten the copy back under the margin.
Recorded here because a four-pixel margin nobody knew about is a finding about the suite as much as
about the layout.

## Open hypotheses carried into the next phase

| id | hypothesis | authority |
| --- | --- | --- |
| H-CONF | eliciting confidence changes the decision process, not only records it | FIELD / experiment |
| H-MENU | the ten `KNOWN_OPTIONS` and eight `UNKNOWN_OPTIONS` cue attention to features the player would not have looked at | FIELD / experiment |
| H-TENSION | `declaredTensions` changes the committed move, the confidence, or the time taken | FIELD / experiment |
| H-CANDIDATES | showing the candidate list back changes how many moves get placed on the board | FIELD / experiment |
| H-RIBBON | the record's state, read back mid-window, changes the confidence stated after it | FIELD / experiment |
| H-TRANSFER | a reveal produces a distinction a player carries into a later decision | FIELD |
| H-COLD | a cold player reaches a first decision without the product being explained | FIELD |

## Evidence authorities

| authority | what it can settle | what it cannot |
| --- | --- | --- |
| **REPO** | contradictions between two parts of this build; copy that names an absent action; a claim wider than the branch that produced it | whether any of it matters to a person |
| **RESEARCH** | whether a mechanism is plausible and what would discriminate it; what an experiment must control | which arm wins |
| **FIELD** | comprehension, reactivity, transfer, continuation | nothing about the code |

Nothing in this directory converts a REPO finding into a FIELD conclusion, and nothing converts an
absence of FIELD evidence into a licence to change the instrument.

## Reproducing the measurements

```bash
npm run build
node research/ux-measurement/probes/pre-evidence-surfaces.mjs probed
node research/ux-measurement/probes/pre-evidence-surfaces.mjs unprobed
node research/ux-measurement/probes/tension-and-disclosure.mjs
```

The probes serve `dist/public` themselves, so they measure the built artefact. They pin the
counterfactual arm and print which one they pinned.
