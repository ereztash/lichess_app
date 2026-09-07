# Every surface on screen while the evidence is still mutable

Companion to [`CURRENT_STATE.md`](CURRENT_STATE.md) and
[`OBSERVATION_LEARNING_BOUNDARY.md`](OBSERVATION_LEARNING_BOUNDARY.md). Measured on `2390b35`.

**This is the audit, not the current screen.** Every row describes the build as it was found. The
four rows marked **REWORD** -- C3, C6, D8 and F1 -- have since been repaired; what they claimed
and what was measured is kept verbatim, because a ledger rewritten to match the fix cannot be
checked against anything. [`WORK_PLAN.md`](WORK_PLAN.md) §1 carries the repairs, their tests and
the control that showed each test red.

## How this was measured, and what that buys

The inventory is a paint fact, not a props fact. `research/ux-measurement/probes/pre-evidence-surfaces.mjs`
serves `dist/public`, walks the built app from the front door to the reveal in Chromium at
1440x900, and at each state dumps every element that paints its own text or accepts a press, with
its class, geometry, type size and weight.

Three properties of the instrument, because two of them already changed a finding:

- **The counterfactual arm is pinned, not drawn.** `assignProbe` takes `draw` and
  `decision-session.ts` defaults it to `Math.random`, so an unpinned walk silently chooses between
  two code paths. `docs/neta/harness/README.md` records two passes lost to exactly this. Both arms
  were walked and are reported separately.
- **Visibility is `checkVisibility()`, not the bounding rect.** A closed `<details>` gives its
  children `content-visibility: hidden`; they keep the geometry of their last layout and still
  report `display: block` and `visibility: visible`. The first version of this probe reported the
  context ribbon's disclosure body as painted during DECIDE, and it is not. See D4 in
  `CURRENT_STATE.md`.
- **The walk reached the `anchor` purpose**, because that is the route a stranger with no account
  takes. The `first` purpose needs a username and a network call to Lichess, so its rows below are
  from a component-level render (`@testing-library/react`) rather than from the browser, and say so.

Reproduce:

```bash
npm run build
node research/ux-measurement/probes/pre-evidence-surfaces.mjs probed
node research/ux-measurement/probes/pre-evidence-surfaces.mjs unprobed
node research/ux-measurement/probes/tension-and-disclosure.mjs
```

## The window this ledger covers

From the position appearing to the moment `runReveal` is entered with every field written. That is
**later than the commit** on the probed arm: see the boundary document. The states are

```
DECIDE (deciding)  →  DECIDE (committing)  →  DECIDE (committed, probe open)  →  REVEAL
                                              ^ 35% of eligible decisions
```

`committed` is `DECIDE` in `MODE_OF_STAGE` and `makingEvidence("committed") === true`. Everything
below is on screen in at least one of the first three.

## Classification vocabulary

| code | meaning |
| --- | --- |
| `ACTION-NECESSARY` | the required action cannot be performed without it |
| `SEMANTIC-NECESSARY` | needed for the player to understand what they are being asked, well enough to answer honestly |
| `MEASUREMENT-EXPLANATION` | explains how or why the instrument measures |
| `LEARNING-INTERVENTION` | helps the player understand the decision, see a pattern, or reconsider |
| `DECORATIVE / NAVIGATIONAL` | not part of the measurement |

**Every `MEASUREMENT-EXPLANATION` and `LEARNING-INTERVENTION` inside this window carries an explicit
justification below, or it is a finding.**

---

## A. Page chrome, present in every state of the window

| # | Surface | State | Trigger | User intent | Required action | Variable touched | Why before close | Class | Reactivity | Authority | Candidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | `.brand-lockup` `♞ DECISION LAB` | all | always | deciding | navigates to the record | the whole decision, if pressed | it is the site mark | `DECORATIVE / NAVIGATIONAL` | LOW | REPO | KEEP |
| A2 | `.brand-lockup` sub-line `COMMIT · THEN REVEAL` | all | always | deciding | none | none | states the protocol's ordering | `MEASUREMENT-EXPLANATION` | LOW | REPO | KEEP |
| A3 | `.icon-control` `מה נמדד כאן` (help) | all | always | deciding | opens `WhatThisIs` | none unless opened | Nielsen 10: findable at the moment of confusion | `MEASUREMENT-EXPLANATION` | LOW closed / **UNKNOWN open** | REPO | KEEP · see F1 |
| A4 | `.icon-control` `בדיקה עצמית של הדפדפן` | all | always | deciding | opens `SelfCheck` | none | a diagnostic behind a menu is one nobody runs | `DECORATIVE / NAVIGATIONAL` | LOW | REPO | KEEP |
| A5 | `.icon-control` `הפוך את הלוח` | all | always | deciding | flips orientation | none | orientation is a reading aid | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| A6 | `.icon-control` theme | all | always | deciding | switches theme | none | accessibility | `DECORATIVE / NAVIGATIONAL` | LOW | REPO | KEEP |

**A2 justification.** `COMMIT · THEN REVEAL` is three words of ordering with no content about the
position and no content about the player. It is the cheapest possible statement of the one rule
that makes the measurement mean anything, and `docs/VALUE_CLARITY.md` Lens 3 requires the reason to
be present pre-commit.

**A3 justification.** Closed, it is one icon. Its cost is one glyph; its benefit is that a confused
player has somewhere to go that is not "abandon the decision". What is behind it is F1, and F1 is a
finding.

---

## B. The context ribbon and the loop strip, present in every state of the window

| # | Surface | State | Trigger | User intent | Required action | Variable touched | Why before close | Class | Reactivity | Authority | Candidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | `.context-loop` headline, counting case: `עוד 60 החלטות מדודות עד שאפשר לומר משהו... ייבוא משחקים שכבר שיחקת יכול לקצר את זה` | all | record read returns | deciding | none; the goto control is suppressed under `focus` | confidence, time | LAW 1 carve-out: where in the loop the record is | `MEASUREMENT-EXPLANATION` | **MEDIUM** | REPO + FIELD | **TEST** |
| B2 | `.context-loop` headline, grading cases: `יש השערה. דריל הוא הדבר היחיד שיכול לדרג אותה.` · `הטענה הופרכה ונשמרת.` · `הטענה שרדה דריל.` · `יש מספיק החלטות, ואף דפוס לא עבר את הסף.` | all | `claimGrade` non-null, or enough scored | deciding | none | confidence | **no stated reason** | **`LEARNING-INTERVENTION`** | **HIGH** | REPO (ambiguous) + FIELD | **TEST** · finding D3 |
| B3 | `.context-loop-basis` `0 מתוך 1 שנרשמו נספרות בחיפוש הזה` | all | with B1/B2 | deciding | none | confidence | names the denominator behind B1 | `MEASUREMENT-EXPLANATION` | MEDIUM | REPO | TEST with B1 |
| B4 | `.context-why` summary `למה?` | all | always | deciding | opens a disclosure | none closed | LAW 6: the instrumentation stays behind it | `MEASUREMENT-EXPLANATION` | LOW | REPO | KEEP |
| B5 | `.context-why` body: device facts and `המסך לא מסתכל על מהירות ההחלטה, על שלב המשחק ועל השעון — אלה הדברים שהגלאי מודד` | all, **only when pressed** | press | curiosity | none | **speed, phase, clock: the detector's own axes** | it answers "why is this sentence here" | `MEASUREMENT-EXPLANATION` | **HIGH if opened** | REPO | **TEST** |
| B6 | `.context-reorientation` `חזרת אחרי כ־N ימים. יש N החלטות ברשומה, מתוכן N ממתינות לחשיפה.` + `.context-dismiss` `הבנתי` | all, on a return after `RETURN_GAP_DAYS` | gap ≥ 3 days and record non-empty | re-orienting | dismiss | confidence | re-orientation after an absence | `MEASUREMENT-EXPLANATION` | MEDIUM | REPO | **DEFER** to reveal |
| B7 | `.loop-strip` four steps `החלטות · מה חוזר · בדיקה · תשובה` with `כאן` | all | record read returns | deciding | none | none identified | LAW 1 carve-out | `MEASUREMENT-EXPLANATION` | LOW | REPO | KEEP |

**B1 justification, and why it is still `TEST`.** LAW 1 explicitly permits *"where in the loop the
record is -- how many decisions exist, what is blocking a claim"*, and B1 is exactly that. What it
also carries is an **instruction**: *"importing games you already played can shorten this"*. The
navigation control is correctly suppressed while `focus` is true, so the player cannot act on it,
but a suggestion they cannot act on during a decision is a suggestion competing with the decision.

**B2 has no justification and that is the finding.** `הטענה הופרכה ונשמרת` is a verdict on a claim
about this player's own decisions. `אף דפוס לא עבר את הסף` is a null finding about their record.
Both are produced by `loopPosition` from the same surface that produces the permitted counts, so
neither `GATE-DECISION-FOCUS` (which matches component names, and `ContextRibbon` is not in
`RECORD_READINGS`) nor `tests/client/nothing-to-read-while-you-decide.test.tsx` (whose
`FEEDBACK_SURFACES` map does not list `.context-ribbon`) can see them. **The rule is not being
evaded. It was written over components and this is a string.**

Measured, arm pinned `probed`:

| state | `.context-loop-basis` |
| --- | --- |
| DECIDE, before any move | `0 מתוך 0 שנרשמו נספרות בחיפוש הזה` |
| `committed`, counterfactual open | `0 מתוך 1 שנרשמו נספרות בחיפוש הזה` |

The ribbon updates on the player's own commit **while the probe answer is still mutable**, and what
it tells them is that the decision they just made does not count.

**B5 justification.** It exists to keep the ribbon honest: it says the ribbon does not read the
detector's variables. But saying so **names them**: decision speed, game phase, clock. A player who
opens it learns which of their behaviours are measured, in the state where they are producing that
behaviour. It is behind a press, so exposure is self-selected and countable, and self-selected
exposure to a measurement explanation is precisely the thing a reactivity experiment needs to
stratify on. Nothing records that the press happened.

**B6 justification, and why `DEFER`.** Re-orientation after an absence is real and B6 does it well.
But it renders during DECIDE, it contains record counts, and the state it serves -- a returning
player working out where they are -- is `RESUME`, which is a mode with no open decision.
`MODE_CONTRACT.RESUME` permits prior evidence; `MODE_CONTRACT.DECIDE` does not. This is one of the
few rows where the repository's own table already answers the question.

---

## C. The commitment screen, `DECIDE`

| # | Surface | State | Trigger | User intent | Required action | Variable touched | Why before close | Class | Reactivity | Authority | Candidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | `.commitment-kicker` `החלטה` | deciding | always | deciding | none | none | names the unit | `SEMANTIC-NECESSARY` | LOW | REPO | KEEP |
| C2 | `.screen-heading` `מה העמדה הזו דורשת?` | deciding | always | deciding | none | the move | it is the question being answered | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| C3 | `.commitment-intro` first clause `בחרו מהלך על הלוח וסמנו את הקריאה שלכם` | deciding | **always, in every state** | deciding | names the steps | none | tells the player what to do | `ACTION-NECESSARY` | LOW | **REPO** | **REWORD** · finding D2 |
| C4 | `.commitment-intro` second clause `המנוע לא ידבר לפני שההחלטה נרשמה, כי אחרי שהוא דיבר כבר אי אפשר להפריד...` | deciding | always | deciding | none | none | Lens 3 requires the reason pre-commit | `MEASUREMENT-EXPLANATION` | LOW | REPO | KEEP |
| C5 | `.step-head` / `.step-index` / `.step-legend` per step | deciding | per `stepsFor` | deciding | opens the step | the step's field | the steps are the instrument | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| C6 | `.required-mark` `חובה` on every step but the move | deciding | `id !== "chosenMove"` | deciding | none | reads, on `first` | claims the field is required | `SEMANTIC-NECESSARY` | LOW | **REPO** | **REWORD** · finding D1 |
| C7 | `.step-answer`, the answer echoed on the collapsed head | deciding | step answered | reviewing | none | none | lets a collapsed step be checked without reopening | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| C8 | `.commitment-move` `בחרו מהלך על הלוח` / the move | deciding | always | choosing | none | the move | it is the answer field | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| C9 | `.commitment-candidates` list + `.candidates-label` `מהלכים שהנחתם על הלוח` | deciding | ≥1 candidate placed | choosing | none | **candidate count** | Lens 3: the record's asymmetry must be stated where candidates are shown | `SEMANTIC-NECESSARY` | **UNKNOWN** | REPO + FIELD | **TEST** |
| C10 | `.candidates-note` `נרשמים כחלק מההחלטה... הרשומה יכולה להראות שמהלך היה מולכם, אף פעם לא שהוא לא היה` | deciding | with C9 | choosing | none | **candidate count** | it is the only place the asymmetry can be stated truthfully | `MEASUREMENT-EXPLANATION` | **UNKNOWN** | REPO + FIELD | **TEST** with C9 |
| C11 | `.read-hint` `בחרו כמה שרוצים` | deciding | reads asked | answering | none | reads | says the field is multi-select | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| C12 | `.read-chip` x10 `KNOWN_OPTIONS` | deciding | reads asked | answering | taps | **reads, and possibly the move** | the read must be stated before the engine | `ACTION-NECESSARY` + latent `LEARNING-INTERVENTION` | **HIGH** | REPO + FIELD | **TEST** |
| C13 | `.read-chip` x8 `UNKNOWN_OPTIONS` | deciding | reads asked | answering | taps | **reads, and possibly the move** | same | `ACTION-NECESSARY` + latent `LEARNING-INTERVENTION` | **HIGH** | REPO + FIELD | **TEST** |
| C14 | `.read-write-toggle` `להוסיף במילים שלכם`, textarea, `.commitment-count` | deciding | reads asked | answering | types | reads | a menu bounds what can be said | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| C15 | `.step-next` `הבא` | deciding | reads asked | answering | advances | none | LAW 10: multi-select does not auto-advance | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| C16 | `.commitment-confidence` 7 buttons `1 ניחוש` … `7 ודאי` | deciding | `confidenceIsAsked` | answering | selects | **confidence, and possibly the move** | the calibration gap does not exist without it | `ACTION-NECESSARY` + latent `LEARNING-INTERVENTION` | **HIGH** | REPO + FIELD | **TEST** |
| C17 | `.commitment-tension` question + `.commitment-tension-basis` + `לא חוסם רישום` | deciding | a stated tension | answering | none; never blocks | **confidence, reads, the move, time** | none stated beyond "the reveal is one position too late" | **`LEARNING-INTERVENTION`** | **HIGH** | REPO + FIELD | **TEST** |
| C18 | `.commitment-error` + `פרטים טכניים` | blocked | write failed | recovering | retry | none | R2: a failed write must not look like a success | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| C19 | `.commitment-submit` `רשמו את ההחלטה` / `חסר: …` | deciding | always | committing | commits | the whole decision | it is the one act of the state | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| C20 | `.commitment-summary` `חסרים N פרטים. החלטה חלקית לא נרשמת — זה הכלל, לא תקלה.` | deciding | not committable and pressed | committing | none | none | a refusal that does not say why is a bug | `SEMANTIC-NECESSARY` | LOW | REPO | KEEP |

### C3 -- measured

`.commitment-intro` is unconditional. `stepsFor` is equivalent to
`confidenceIsAsked ? ALL_STEPS : ["chosenMove"]`, and `ASK_RATE = 0.15`, so on roughly six ordinary
decisions in seven the rendered step list is `["המהלך שבחרתם"]` alone while the intro says
*"choose a move on the board **and mark your read**"*. The instruction names a step that is not
there. The reason clause, C4, is correct in every state and is not the defect.

### C6 -- measured

| purpose | `confidenceIsAsked` | `readsAreAsked` | steps rendered | `.required-mark` on the two read steps | `draftProblems({move, confidence})` |
| --- | --- | --- | --- | --- | --- |
| `first` | true | **false** | all four | **`חובה`** | `[]` |
| `anchor`, `drill`, `transfer` | true | true | all four | `חובה` | requires both |
| `play`/`import`, draw passed over | false | false | move only | n/a | `[]` |

On `first` the screen claims two fields are required that the same build does not require, and the
submit reads `רשמו את ההחלטה` with both still unanswered. `first` fires on the front door's handoff
**and** on the opening decision of every new game, so this is a high-traffic path and it is a cold
player's first impression. `shared/confidence-asked.ts` documents the exemption and its reason;
the validator and the atom schema implement it; the screen does not.

### C9 / C10 -- why they stay `TEST` rather than `KEEP`

The candidate list is the one thing on this screen that shows the player a measurement **of their
own behaviour, live, while that behaviour is still being produced**. `candidate_moves_considered` is
a recorded field, and `theOneThing`'s `chose-past-it` branch fires off it. Telling somebody that
the moves they place on the board are counted is honest and is required by Lens 3. It is also, on
its face, a reason to place more of them or fewer. Nothing in the repository establishes which.

### C12 / C13 -- why the option lists are not neutral inputs

`shared/detector.ts` never reads `known` or `unknown`, and `read-options.ts` says so, so nothing
downstream is contaminated by the *answers*. That is not the risk. The risk is that a list of ten
positional features shown before a move is chosen is a **checklist of things to look at**. The
options are deliberately positional rather than evaluative, which makes them better prompts, not
worse ones. `read-options.ts`'s own rule -- *"Nothing is preselected. A default here would be the
machine putting a read in the player's mouth"* -- names the mechanism and stops one step short of
it: the menu is a set of defaults for **attention**, if not for the answer.

### C16 -- why the confidence question is both variable and treatment

The calibration gap is `stated confidence − realised accuracy`. Stating a confidence is also a
metacognitive act. `docs/INERTIAL_UX_LAWS.md` LAW 9 already holds this surface behind an experiment
and names what would release it. Nothing here proposes to move it.

### C17 -- the strongest collision on the screen

Measured with three unknowns tapped, including `לא מכיר את העמדה הזו`, and confidence 7 of 7:

```
role="status"  aria-label="שאלה על ההצהרה שלך"
question  סימנת "לא מכיר את העמדה הזו", ולצידה ביטחון 7 מתוך 7.
          על מה מבוסס הביטחון כאן — על העמדה, או על המהלך?
basis     ביטחון 7/7 מול "לא מכיר את העמדה הזו" · לא חוסם רישום
geometry  y=605, h=115, 16px/400   submit at y=732   tension is ABOVE the submit
submit    enabled, "רשמו את ההחלטה"
```

So: a question derived from the player's own answers, addressed at the variable being measured,
rendered in the reading path between the last answer and the commit, while every one of those
answers is still changeable.

`declared-tensions.ts` is careful in every way that can be checked from code. It asks rather than
rules. It never blocks. It reads nothing the detector measures -- and the module comment records
that this guarantee was **already breached once**: `fast-certainty` fired only on drafts under ten
seconds old, and `secondsTaken` is a detector variable, so a question was being shown to one arm of
the population the screen exists to measure, with the exposure recorded nowhere. That rule is gone.

What remains true after the repair: the exposure is **still** recorded nowhere. A decision that saw
a tension and a decision that did not are one population in the record, exactly as
`docs/decisions/D21-feedback-exposure.md` found for reveals and claims. Whether the question
changes anything is unknown; whether an analysis could tell is not: it could not.

---

## D. The board region, `DECIDE` and `committed`

| # | Surface | State | Trigger | User intent | Required action | Variable touched | Why before close | Class | Reactivity | Authority | Candidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | `.workspace-meta` mode badge `DECIDE` | all | `focus` | deciding | none | none | the state, named | `MEASUREMENT-EXPLANATION` | LOW | REPO + FIELD | **TEST** |
| D2 | `<h1>` `11. O-O-O` | all | a move exists | orienting | none | none | which position this is | `SEMANTIC-NECESSARY` | LOW | REPO | KEEP |
| D3 | `.turn-reading` `תור / שחור` | all | always | orienting | none | none | whose move it is | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| D4 | `ChessBoard` squares, pieces, `.last-square`, legal targets | all | always | choosing | the move | the move, candidates | it is the position | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| D5 | board mark for the player's own proposal | deciding | a candidate is chosen | choosing | none | the move | acknowledgement without evaluation, per Lens 3 | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| D6 | `.sr-only.board-announcer` `נבחרה b5, רגלי שחור. 1 יעדים חוקיים.` | all | selection changes | choosing | none | **the move** | a board nobody could hear is not usable | `ACTION-NECESSARY` | **MEDIUM** | REPO | **TEST** |
| D7 | `.record-mode` storage notice | all | server not usable | deciding | none | none | R2: never pretend a write happened | `MEASUREMENT-EXPLANATION` | LOW | REPO | KEEP |
| D8 | `.board-note` `חזרתם למשחק שהייתם בו — 21 חצאי־מהלכים.` | deciding, first arrival | `readPosition()` returns | orienting | none | none | none: **the claim is false for a stranger** | `SEMANTIC-NECESSARY` | LOW | **REPO** | **REWORD** · finding D5 |
| D9 | `.board-note` other notices: `b5b4 נבחר. אפשר עדיין לשנות עד לרישום.` · `ההחלטה נרשמה. שאלה אחת לפני שהמנוע מדבר.` | all | state change | orienting | none | none | says what just happened and what is still changeable | `SEMANTIC-NECESSARY` | LOW | REPO | KEEP |
| D10 | `העתק FEN` | all | always | exporting | copies | none | a position a player can take away | `DECORATIVE / NAVIGATIONAL` | LOW | REPO | KEEP |
| D11 | `.opponent-thinking` `היריב חושב…` | deciding, live game | engine move pending | waiting | none | none | a board that changes nothing while something happens is a hang | `SEMANTIC-NECESSARY` | LOW | REPO | KEEP |
| D12 | `MoveTimeline`: `מסילת מהלכים`, 4 controls, every move cell, `11 / 11` | all | always | orienting | navigates the game | **the position under decision** | the game's own history | `ACTION-NECESSARY` | MEDIUM | REPO | **TEST** |

**D1 justification, and why it is `TEST`.** `DECIDE` and `REVEAL` are Decision Lab's vocabulary in
Latin script on a Hebrew page. They are the clearest instrument-literacy cost in the window: a
player has to learn what they mean, and knowing what they mean changes nothing about the move. The
badge is deliberate and `Home.tsx` records that `focus` rather than `deciding` is the right
predicate for it, so this is not a defect. It is a candidate for the field question *"did anything
here have to be explained to you?"*

**D6 justification.** Screen-reader-only, so it costs a sighted player nothing. For a screen-reader
user it is the only channel that carries the board, and it announces the legal-target count, which
sighted players read off the board. Marked MEDIUM because the two populations are receiving
measurably different stimuli and the record cannot separate them.

**D12 justification.** The timeline is how a player checks what led here. It also lets them leave
the position under decision. `boardAuthorityFor` governs what the board accepts per stage, so
evidence cannot be produced on the wrong position, but the *attention* cost is real.

---

## E. The counterfactual probe, `committed` -- after the commit, before the reveal

The move, the reads and the confidence are already written. `probe.alternative` is not.

| # | Surface | State | Trigger | User intent | Required action | Variable touched | Why before close | Class | Reactivity | Authority | Candidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | `.counterfactual-probe__question` `אם לא היית עושה את זה, מה כן היית עושה?` | committed | probed arm, ~35% | answering | names an alternative | **the alternative** | the move is locked and the engine has not run: this is the only window where the answer is the player's own | `ACTION-NECESSARY` | **UNKNOWN** | REPO + FIELD | **TEST** |
| E2 | `.counterfactual-probe__committed` `המהלך שנרשם: b5b4` | committed | with E1 | answering | none | the alternative | the question is relative to it | `SEMANTIC-NECESSARY` | LOW | REPO | KEEP |
| E3 | `.counterfactual-probe__how` `שחקו על הלוח את המהלך שהייתם עושים במקום זה.` | committed | with E1 | answering | none | the alternative | the answer is a gesture, not a text field | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| E4 | `.counterfactual-probe__same` `זה אותו מהלך שנרשם...` | committed | alternative equals the move | answering | none | the alternative | a refusal that does not say why is a bug | `SEMANTIC-NECESSARY` | LOW | REPO | KEEP |
| E5 | `.counterfactual-probe__confirm` `רשמו X כחלופה` | committed | an alternative named | answering | records | the alternative | it is the act | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| E6 | `.counterfactual-probe__none` `לא היה לי מהלך אחר` | committed | always | answering | records null | the alternative | "none" is an answer, not an escape | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| E7 | `.counterfactual-probe__error` | committed | write failed | recovering | retry | none | R2 | `ACTION-NECESSARY` | LOW | REPO | KEEP |

**E1 justification.** `Home.tsx` states it: the move is locked so naming an alternative cannot turn
into choosing one, and the engine has not run so the answer is the player's own candidate rather
than a reading of the engine's. Both halves are true and both are load-bearing. The reactivity that
remains is **not about this decision**: being asked, on one decision in three, to name what else you
might have played is training in generating alternatives, and the next decision is measured.
`PROBE_PROBABILITY = 0.35` is stored per decision as `probe.assignment`, so this is the one
instrument in the window whose exposure the record **can** separate. That is a real asset and the
experiment backlog uses it.

**Everything in section B, C and D above is on screen during `committed` too**, except the
commitment screen itself. That includes B2. See D3 in `CURRENT_STATE.md`.

---

## F. Reachable from inside the window, behind a press

| # | Surface | State | Trigger | User intent | Required action | Variable touched | Why before close | Class | Reactivity | Authority | Candidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | `WhatThisIs` overlay, incl. `קודם אתה בוחר מהלך, מסמן מה אתה קורא בעמדה ומה אתה לא מצליח להעריך, ואומר כמה אתה בטוח` | all | press A3 | confused | closes | confidence, reads | help must be reachable at the moment of confusion | `MEASUREMENT-EXPLANATION` | **MEDIUM** | **REPO** | **REWORD** |
| F2 | `WhatThisIs` `למה זה לוקח זמן` (`MIN_BUCKET_N * 2` decisions) | all | press A3 | confused | none | confidence | states the threshold honestly | `MEASUREMENT-EXPLANATION` | LOW | REPO | KEEP |
| F3 | `WhatThisIs` `מה זה לעולם לא יגיד לך` and `מה שעדיין לא נבדק` | all | press A3 | confused | none | none | the product's declared limits | `MEASUREMENT-EXPLANATION` | LOW | REPO | KEEP |
| F4 | `SelfCheck` drawer | all | press A4 | diagnosing | closes | none | a diagnostic behind a menu is unrun | `DECORATIVE / NAVIGATIONAL` | LOW | REPO | KEEP |

**F1 is the same defect class as C3, one layer out.** It tells the player the loop is always
move → reads → confidence. On six ordinary decisions in seven it is move alone, and on a `first`
decision the reads are exempt. The sentence is wider than the measurement, which is the failure
`docs/VALUE_CLARITY.md` Lens 4 and the Lichess `No mistakes found` precedent both name. It is
behind a press and it describes the protocol rather than the state, so it is the mildest of the
three; it is still a claim this build does not honour.

---

## G. Run states, `TEST` mode -- evidence produced inside a pre-registered set

| # | Surface | State | Trigger | User intent | Required action | Variable touched | Why before close | Class | Reactivity | Authority | Candidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | `.drill-prereg` `נרשם מראש, לפני העמדה הראשונה` + `drill.refutation_condition` | drill running | a drill | deciding | none | **the move, confidence** | R5: what would disprove this, before the first position **and throughout** | `MEASUREMENT-EXPLANATION` | **HIGH, and accepted** | REPO | KEEP · justified |
| G2 | `.drill-progress` `הוכרעו k/n` | drill running | a drill | deciding | none | none | run progress is not a reading of the record | `SEMANTIC-NECESSARY` | LOW | REPO | KEEP |
| G3 | `.drill-abandon` + `.drill-abandon-note` | drill running | a drill | leaving | abandons | none | Nielsen 3: a set with no exit is a trap | `ACTION-NECESSARY` | LOW | REPO | KEEP |
| G4 | `.transfer-progress` `עמדה k מתוך n · נדרשות m הצלחות` | transfer running | a transfer | deciding | none | the move | the run's own bound | `SEMANTIC-NECESSARY` | MEDIUM | REPO | KEEP |
| G5 | `לפני החשיפה: מהו כלל הפעולה שאתם זוכרים?` free text | transfer running | a transfer | answering | types | **the move, confidence** | recall after the engine speaks is answered by the outcome | `ACTION-NECESSARY` | **HIGH, and it is the measurement** | REPO | KEEP · justified |
| G6 | `ולפני החשיפה גם: האם אתם מיישמים אותו בהחלטה הזו?` yes/no, **and the commit is refused until it is answered** | transfer running | a transfer | answering | selects | **the move** | same | `ACTION-NECESSARY` | **HIGH, and it is the measurement** | REPO | KEEP · justified |
| G7 | `SilentGame` panel: `המנוע שותק עד סוף המשחק.` + `נרשמו N החלטות במשחק הזה.` | deciding, deferred timing | the player chose it | deciding | none | none | it replaces the readings rather than joining them | `SEMANTIC-NECESSARY` | LOW | REPO | KEEP |

**G1, G5 and G6 are the carve-out, and they are the only rows in this ledger that use it.** The
Production Contract forbids coaching the process being measured *unless the intervention is
explicitly the thing the experiment measures*. A drill's refutation condition is the
pre-registration and R5 requires it visible throughout; a transfer check exists to measure whether
a rule the player wrote is being applied, so asking whether they are applying it **is** the
measurement, and asking before the reveal is what keeps the answer independent of the outcome.
`LearningTransferRunner` records the reasoning for moving G6 from after the reveal to before it.

**G1 still costs something and the ledger says so.** Showing the claim under test throughout the
test is a demand characteristic in any other field. Here it is required by R5. The two rules
genuinely conflict and R5 wins; what is missing is not a fix but an acknowledgement in the drill's
own analysis that its decisions were taken with the hypothesis on screen.

---

## H. Deliberately absent from the window, verified

| surface | how it is kept out | verified by |
| --- | --- | --- |
| `ClaimPanel`, `LearningQueue`, `RecordDashboard`, `LichessLayersPanel`, `AnalysisPanel`, `GameReview` | not rendered from `Home.tsx` at all; only from `RecordExplorer`, behind `exploring && !runInProgress` and a lazy chunk | `GATE-DECISION-FOCUS`, `GATE-TOOLBOX-OUTSIDE-FOCUS`, `nothing-to-read-while-you-decide.test.tsx` |
| `ControlRail` | `{!focus && <ControlRail …/>}` -- absent, not disabled | same test |
| `EvaluationBar` | `{stage === "revealed" && …}` | same test |
| `RevealPanel`, `.reveal-*` | the `focus ? null :` branch | same test |
| `.context-loop-goto` | `onGoTo={focus ? undefined : …}` | measured: absent in states 02-08, present at 09 |
| the engine's output, in any form | `engineMayRun(stage)`, exact complement of `makingEvidence` | `GATE-COMMIT` |

Measured confirmation from the probe: `.context-loop-goto` `ייבוא לפי שם משתמש` first appears in
state `09-REVEAL`, and `.rail-button` and `.explore-toggle` with it.

---

## Summary of what this audit changes

| candidate | rows | authority | state |
| --- | --- | --- | --- |
| **REWORD** | C3, C6, D8, F1 | `REPO-CERTAIN` -- a claim this build contradicts | **done**, see `WORK_PLAN.md` R1-R4 |
| **DEFER** | B6 | `REPO-CERTAIN` by `MODE_CONTRACT`, but it changes a rendered surface: treated as `RESEARCH-GATED` | not done |
| **TEST** | B1, B2, B3, B5, C9, C10, C12, C13, C16, C17, D1, D6, D12, E1 | `RESEARCH-GATED` or `FIELD-GATED` | B1-B3 have an arm built and off: `QUIET_EVIDENCE_WINDOW_ENABLED` |
| **KEEP** | everything else | -- | -- |
| **KEEP, justified collision** | G1, G5, G6 | the Production Contract's own carve-out | -- |

### Counted

| state | painted or pressable | non-board | the instrument | everything else |
| --- | ---: | ---: | ---: | ---: |
| `02 DECIDE`, before any move | 151 | 40 | 19 | **21** |
| `06 DECIDE`, ready to commit | 151 | 38 | 17 | **21** |
| `08 committed`, counterfactual open | 139 | 25 | 4 | **21** |

"Instrument" is `.commitment-*`, `.step-*`, `.required-mark`, `.screen-heading`, `.read-*` and
`.counterfactual-probe__*`. **The same twenty-one non-instrument surfaces are present in every
state**, so at the counterfactual stage the question being asked is outnumbered five to one on its
own screen.

**Fourteen `TEST` rows is not fourteen experiments.** They collapse into four, in the experiment
backlog: attentional cueing (C12, C13), elicitation reactivity (C16, C17), record-state exposure
(B1, B2, B3, B5, B6, D1), and behavioural disclosure (C9, C10, D6, D12, E1).
