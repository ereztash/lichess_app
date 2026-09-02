# The repo-native product constitution

Written before any external design agent, design system or stylistic reference was read, and that
ordering is the only thing that makes the rest of this directory worth anything. A visual language
proposed for Decision Lab before Decision Lab has been read is a visual language proposed for
something else.

**Base:** `b9a228c` (`main` at the start of this pass).

Every row below is one repository finding in the format the brief fixes: where it came from, what
kind of evidence it is, what it establishes, what it implies for art direction, what it forbids,
and what it does **not** establish. The last line of each is the load-bearing one. This repository
has been wrong twice in public by letting an observation walk into an inference, and both times the
correction was recorded rather than the claim quietly withdrawn.

---

## 0. What was read, and what was deliberately not

**Read in full:** `README.md`, `docs/VALUE_CLARITY.md`, `docs/VALUE_CLARITY_FIELD_PROTOCOL.md`,
`docs/ACQUISITION_EVIDENCE.md`, `docs/INERTIAL_UX_LAWS.md`, `docs/INTERACTION_GEOMETRY.md`,
`docs/VISUAL_ARCHITECTURE_AUDIT.md`, `docs/FRONTEND_EXCELLENCE_AUDIT.md`,
`docs/decisions/D21`–`D25`, `shared/interaction-mode.ts`, `shared/measurement-protocol.ts`,
`shared/promise.ts`, `client/src/index.css`.

**Read for the sections that can change a visual decision:** `docs/MEASUREMENTS.md`,
`docs/FINDINGS.md`, `docs/MASTER_PRODUCT_DEBT.md`, `docs/PRODUCTION_READINESS_LEDGER.md`,
`docs/research/TIME_REPRESENTATION_RESULTS.md`, `docs/research/ENGINE_PARITY_RESULTS.md`.

**Not crawled:** `research/**`. It was opened once, against one question that a visual decision
actually turned on — *should elapsed time become a visual metaphor* — and the answer is R-B2 below.
Reading it in case something useful is in there is how a design pass acquires a hundred pages of
evidence it cannot act on.

---

## 1. The product thesis, reconstructed

The brief proposes a thesis and asks for it to be **falsified before it is accepted**. It is:

```
POSITION → HUMAN DECISION → COMMITMENT
══════════ EVIDENCE BOUNDARY ══════════
MACHINE REVEAL → OBSERVATION → WHAT THIS CAN AND CANNOT SUPPORT
```

### The falsification attempt

Four ways this could have been wrong, each checked against the tree rather than against the brief.

| attempt | what would have shown the thesis false | what the repository says |
| --- | --- | --- |
| The ordering is a UI convention, not the product | the engine could run before commitment behind a flag, or one screen could be exempted | `engineMayRun` is false in all three `producingEvidence` modes; the type system makes a commitment event carrying an evaluation unbuildable; the engine is a dynamic import so it cannot appear in the network tab before a decision is recorded. Three independent enforcements, none of them discipline |
| The boundary is one of several equal rules | it would sit in a list with other constraints | `README.md` calls it **"the rule everything rests on"** and derives the interface adaptation constraint from it. `MODE_CONTRACT` is that rule as a table |
| The product is really a chess-strength tool | a claim about improvement would exist somewhere | *"It does not claim it improves chess. There is no such measurement."* The only supported claim is a calibration gap in recorded decisions |
| The distinction does no work at the Reveal | the Reveal would be one undifferentiated output | `ONE_THING_EVIDENCE` labels each branch by which evidence it rests on, and an **ablation** test proves the labelling: strip `candidatesConsidered` and `confidence` and every `process` branch stops firing while every `engine` branch is unchanged |

**Verdict: the thesis survives.** It is not an interpretation laid over the repository; it is the
repository's own stated rule, enforced three ways and tested by ablation.

### The one correction the falsification forced

The brief calls the sequence *"the product's deepest visual identity"*. That is a claim about a
person's perception and the repository cannot support it. What the repository supports is narrower
and enough:

> The boundary is the product's deepest **structural** fact. Whether making it perceptible changes
> what a player understands is `FIELD-REQUIRED`, and `VALUE_CLARITY_FIELD_PROTOCOL.md` Arm B is
> already the instrument that would answer it.

Art direction may make the structure visible. It may not claim the visibility worked.

---

## 2. "Before the machine speaks" is not a slogan this pass invented

```
SOURCE:            shared/promise.ts; client/src/pages/Record.tsx, rendered at `/`
EVIDENCE TYPE:     PRODUCT CONTRACT
WHAT IT ESTABLISHES:
  The front door's h1, measured in Chromium at 1440x900, is
  "מה קרה בהחלטה, לפני שהמנוע דיבר" — what happened in the decision, before the engine spoke.
  PROMISE.mechanism says the same in the sentence under it. Both are imported from one module
  and held by `tests/client/the-link-someone-was-sent.test.ts` against the static copies.
WHAT IT IMPLIES FOR ART DIRECTION:
  The phrase the brief offers as a design hypothesis is already the product's own first sentence.
  A visual language built on it is making the existing promise legible rather than adding a claim.
WHAT IT FORBIDS:
  Restating it as decorative copy anywhere else. `GATE-SAID-ONCE` exists because two lists saying
  the same sentence is a defect this repository has already shipped once.
WHAT IT DOES NOT ESTABLISH:
  That a player reads the h1, or that they connect it to what happens on `/play`. Arm A.
```

---

## 3. The three evidence channels the palette currently conflates

```
SOURCE:            client/src/index.css, measured across its 50 `var(--blue)` call sites
EVIDENCE TYPE:     OBSERVED (source), MEASURED (rendered in Chromium at BASE_SHA)
WHAT IT ESTABLISHES:
  One hue carries nine jobs:
    1  the machine's voice on the board     .board-vectors line / circle, .cloud-score
    2  the player's own hand on the board   .selected-square, .legal-square::before
    3  primary action                       .primary-control, .commitment-submit, 5 more
    4  selection among options              .read-chip.selected, .color-toggle .selected, 3 more
    5  focus                                :focus-visible, .board-square:focus-visible
    6  liveness and progress                .review-progress i, .loop-step.live, .material-track i
    7  disclosure and link affordance       .context-why summary, .layer-action, 5 more
    8  EVIDENCE AUTHORITY                   .evidence-mark[data-authority="tested"]
    9  the brand mark                       .brand-mark
  Jobs 1 and 2 paint on the same board in the same state: at `ANSWER_INSTRUMENT` the legal-move
  dot inside the player's own chosen square is the engine's colour.
WHAT IT IMPLIES FOR ART DIRECTION:
  The repository already refused exactly this collision once, and wrote down why. `--chosen`'s
  declaration: *"Deliberately not --blue: blue is the engine's arrow, and one mark meaning both
  'your guess' and 'the machine's answer' would erase the difference."* That argument was applied
  to two squares and to nothing else. Applying it consistently is not a new idea; it is the
  repository's own idea, finished.
WHAT IT FORBIDS:
  Solving this by adding hues until each job has one. Nine hues is not a palette.
WHAT IT DOES NOT ESTABLISH:
  That any player has ever been confused by it. No such measurement exists.
```

```
SOURCE:            client/src/index.css, 24 `var(--warn)` call sites
EVIDENCE TYPE:     OBSERVED + MEASURED
WHAT IT ESTABLISHES:
  The failure hue also carries: an unfinished field (.required-mark), an unfinished commitment
  (.commitment-submit.not-ready, .commitment-summary), and a VALID STORAGE MODE
  (.record-mode.session-only, which fires when the browser blocks persistent storage and the loop
  continues in tab memory). On a cold `DECIDE` at 1440x900 the only saturated colour on the screen
  is `--warn` #a8412c, on a dashed box, reading "חסר: בחרו מהלך על הלוח".
WHAT IT IMPLIES FOR ART DIRECTION:
  The first thing the eye meets in the pre-commit panel is an alarm about something the player has
  not yet had the chance to do.
WHAT IT FORBIDS:
  Removing the notice. It is required: `GATE-REACHABILITY`'s positive control is a door that
  produces a decision with no confidence, and "what is required has to be knowable before the
  click" is a tested behaviour. What may change is which colour says it.
WHAT IT DOES NOT ESTABLISH:
  That the red slows anybody down, or changes a commitment. That is `FIELD-REQUIRED`, and it is
  also why the change below is treated as protocol-relevant rather than cosmetic.
```

---

## 4. The five value-clarity lenses, as visual constraints

`docs/VALUE_CLARITY.md` is `REPO-CLEAR / FIELD REQUIRED` on all five. Art direction inherits the
constraints and may not spend the clearance.

| lens | the visual constraint it imposes | the thing it forbids |
| --- | --- | --- |
| 1 Problem legibility | the chess problem outranks the research construct in DOM order **and** in visual weight | making "calibration" or "confidence" typographically prominent on any acquisition surface |
| 2 Differentiated promise | the difference is *information recorded before the engine spoke*, so it has to be an **informational** distinction on screen, not an assertion of uniqueness | any visual device that says "special" without saying what the information difference is |
| 3 Action → payoff causality | commitment-before-reveal must read as necessary, so the pre-commit screen must look like it is **recording** | any evaluative colour, tick, score or grade before commitment |
| 4 Reveal salience and boundary | process evidence and engine evidence must be **distinguishable by provenance** | drawing one as success and the other as failure; both classes already typeset identically on purpose |
| 5 Continuation economics | one stable proposition, identical across all five Reveal outcomes | streaks, counters, progress bars, unlock mechanics, digits used as motivation |

**The strongest single constraint in the file**, and it governs this entire pass:

> A product that is fully understood and still unwanted is a valid result, and it is the result
> this build exists to be able to observe.

A visual language tuned to make the product *wanted* destroys the trial. One tuned to make it
*legible* does not.

---

## 5. Acquisition evidence: what a rendered state may and may not store

```
SOURCE:            docs/ACQUISITION_EVIDENCE.md §4 "Events deliberately absent"
EVIDENCE TYPE:     PRODUCT CONTRACT
WHAT IT ESTABLISHES:
  The funnel is promise → expectation → first action → unique payoff → continuation, and the
  ledger records only what happened. `unique_value_delivered`, `user_understood`, `insight_found`
  do not exist as fields, on purpose.
WHAT IT IMPLIES FOR ART DIRECTION:
  A rendered state is the same kind of object as a ledger row. It may show that a Reveal occurred
  and which branch it was. It may not draw the branch as an achievement.
WHAT IT FORBIDS:
  Success colour on a Reveal. Celebration on a commitment. Any visual difference between a Reveal
  that found something and one that did not, beyond the provenance label that already exists.
WHAT IT DOES NOT ESTABLISH:
  Anything about what a player takes from either.
```

```
SOURCE:            docs/VALUE_CLARITY_FIELD_PROTOCOL.md, three arms
EVIDENCE TYPE:     PRODUCT CONTRACT
WHAT IT ESTABLISHES:
  Message comprehension, first-Reveal comprehension and natural use are separated so the product
  cannot teach the answer it is about to be tested on. Arm B asks "what did you get here that was
  not already in the game and an engine analysis" with no options and no branch named.
WHAT IT IMPLIES FOR ART DIRECTION:
  The interface may make the human/machine distinction PERCEPTIBLE. It may not ANNOTATE it.
  A visual difference in provenance is a property of the material. A label reading "this is the
  part an engine could not give you" is the interview question, pre-answered.
WHAT IT FORBIDS:
  Pre-highlighting the correct reading of a Reveal. Explanatory copy added to raise a field score.
WHAT IT DOES NOT ESTABLISH:
  Where the line between perceptible and taught is. That is a judgement, and this pass records
  where it drew it (§8 of the Art Direction Contract) so a later reader can disagree with it.
```

---

## 6. R-B2: the time result, and what it forbids the design from becoming

```
SOURCE:            docs/research/TIME_REPRESENTATION_RESULTS.md; README's blitz section
EVIDENCE TYPE:     RESEARCH-SUPPORTED, with its own negative controls
WHAT IT ESTABLISHES:
  200 qualifying rated blitz games, 197 contributing, 4,459 eligible decisions (2,190 derivation /
  2,269 held-out). Winner: lichess encoding buckets, held-out spread 8.27pp against a
  random-boundary null95 of 4.35pp. Raw seconds: 0.00pp. Negative controls behaved.
  AND: most of the effect collapses within `phase × standing`; only `middlegame/winning` clearly
  survives. Three of seven cells, all middlegame. No threshold moved.
WHAT IT IMPLIES FOR ART DIRECTION:
  Elapsed time is a real covariate and an unproven mechanism. It may appear as context, metadata
  or measurement evidence, at the metadata rank.
WHAT IT FORBIDS:
  A clock as a visual metaphor. A speed dial. A fast/slow identity. Any composition in which
  duration is the largest object. The product may not look like a think-time coach.
WHAT IT DOES NOT ESTABLISH:
  That thinking time is irrelevant. `OBSERVATION ≠ CAUSALITY`, and the product's visual authority
  has to stop at the same place the result does.
```

---

## 7. Engine parity: why the product should look calibrated rather than omniscient

```
SOURCE:            docs/research/ENGINE_PARITY_RESULTS.md; README
EVIDENCE TYPE:     MEASURED
WHAT IT ESTABLISHES:
  Every prior number came from a native engine the product does not ship. The two disagree:
  13.61% of decisions flip verdict, and the shipped engine flatters the player by 4.4 points
  systematically. Overall accuracy on the record is 71.6% on the shipped engine against 67.0% on
  the native one. The defect was closed by RE-MEASURING, not by relabelling.
WHAT IT IMPLIES FOR ART DIRECTION:
  Provenance is a first-class visual fact in this product, not fine print. The instrument's own
  identity ("Stockfish 18 Lite WASM, depth 14, local") is what makes its numbers readable, and it
  is currently repeated on four rows inside a collapsed disclosure.
WHAT IT FORBIDS:
  Any treatment that makes an engine evaluation look like a fact of the position rather than a
  reading from a named instrument at a named depth.
WHAT IT DOES NOT ESTABLISH:
  That a player wants provenance on screen. Weight, yes; prominence, no.
```

---

## 8. D25: the visual authority ceiling

```
SOURCE:            docs/decisions/D25-evidence-architecture.md
EVIDENCE TYPE:     PRODUCT CONTRACT
WHAT IT ESTABLISHES:
  `CONSTRUCT-UNDERIDENTIFIED`. E1 reached, E2 attempted and not reached, humans measured 0,
  production behaviour changed none. The learning surface is graded `H` (hypothesis) and is now
  opt-in, because a surface named VERIFIED shipping on by default over an underidentified
  construct was the stronger claim shipping while the weaker one was written down.
WHAT IT IMPLIES FOR ART DIRECTION:
  There is a ceiling on visual authority, and it is not a mood. The heaviest treatments in the
  product belong to the things with the most evidence, and the most evidence anything here has is
  a measured gap in recorded decisions.
WHAT IT FORBIDS:
  Giving a hypothesis the weight of a finding. Giving a finding the weight of a verified law.
WHAT IT DOES NOT ESTABLISH:
  Which weight is right for each grade. `evidence-authority.ts` already has the grades; what the
  stylesheet lacks is one declared mapping from grade to weight. That is repo-solvable and is
  taken in this pass.
```

---

## 9. What is already solved, and is not reopened

`docs/VISUAL_ARCHITECTURE_AUDIT.md` Part two and `docs/FRONTEND_EXCELLENCE_AUDIT.md` Part II closed
these with browser measurements. Nothing below is re-litigated:

- the type scale's **values and ranks** (seven steps, re-spaced, floor at 11px for Hebrew);
- the **spacing scale** (`--s1`…`--s6`, 142 call sites mapped);
- **five card languages reduced to two**;
- the commit control's ground, salience and disabled pair;
- the board's geometry in `DECIDE` (92px → 812/632/532, and the 844x390 landscape case);
- Hebrew/RTL logical properties and the 21 deliberate `dir="ltr"` sites;
- forced-colors on the board;
- the `EXPERIMENTAL_LEARNING_ENABLED` default;
- axe on five states, `prefers-reduced-motion` at zero live animations, 200% zoom with no overflow.

Also not reopened, per the brief's §24: *more minimal is better*, *fewer components is better*,
*more animation is polish*, *a dashboard is analytical*, *progress is motivation*. Previous work
established that **ranking**, not quantity, explained most of the perceived overload. Absolute
quantity remains `FIELD-REQUIRED` and is not settled by taste here.

---

## 10. What the previous passes left open that IS art direction

These are the open questions this pass is entitled to work on, taken verbatim from the two audits'
own registers.

| id | question | previous class | why this pass may act |
| --- | --- | --- | --- |
| VA-F2 | may one hue mean both "press this" and "you chose this"? | FIELD-REQUIRED | the measured picture is worse than the question assumed: **nine** jobs, including the engine's voice and the player's hand on the same board. That is not two defensible designs, it is a collision the repository already ruled on for `--chosen` |
| VA-F1 | does the front door need a product identity? | FIELD-REQUIRED | **stays FIELD-REQUIRED.** `/` is the acquisition funnel's first stage; changing what a cold arrival meets changes a measured conversion. This pass changes no acquisition surface's content, ordering or copy |
| FE-P2-4 | eight icon sizes for one role | deferred (aesthetic) | measured at BASE_SHA: five distinct rendered sizes on `REVEAL` alone (13/14/16/17/18). One role, five ranks, is the type-scale defect in another material |
| FE-P2-5 | nine local action looks beside three shared roles | deferred (aesthetic) | an action grammar is exactly what an Art Direction Contract is for; deferring it was correct **until** there was a contract to normalise against |
| VA-9 P2-7 | five card languages became two, not one | deferred | the second is the raised variant and is doing real work. Kept at two, and the rule for which is which is now written down |

---

## 10a. The owner-reported defect: a cold arrival cannot play a game

Reported by the owner during this pass, reproduced in Chromium at `BASE_SHA`, and it is not a
visual finding.

```
SOURCE:            client/src/App.tsx (routes), client/src/pages/Record.tsx:525,
                   client/src/components/ResumeScreen.tsx:102
EVIDENCE TYPE:     MEASURED (driven in Chromium on the production build)
WHAT IT ESTABLISHES:
  `/blitz` is linked from exactly one place in the product: `ResumeScreen`, which begins
  `if (!returning) return null;`. `returning` is `visitsOnRecord() > 1`. The other control on the
  front door that leaves it, `ללוח`, is gated on `measured > 0`.
  So on a first visit the front door offers: connect a Lichess or Chess.com account, or take a
  position from the shared bank. There is NO path to a game, and the untimed loop is one position
  rather than a game.
  The game itself is not broken. Driven directly at `/blitz`: a control starts a 3+0 game, e2e4
  is accepted, the opponent replies d7d5, both clocks run, and the confidence question is asked
  after the commit. What is missing is the door, not the room.
WHAT IT IMPLIES FOR ART DIRECTION:
  Two things, and only the second is aesthetic.
  1. A cold record needs one path to a game. It may not be a second PRIMARY action: `LAW 2` and
     `GATE-ONE-PRIMARY-ACTION` exist because this exact screen once offered two products at one
     weight, and the gate's positive control is that screen. A secondary control carrying no
     `data-primary-action` is outside what the gate forbids and inside what the law is for.
  2. `/blitz` is an orphan. Measured at 1440x900: no header, no brand, no way back, four identical
     outline controls and 800px of empty page. It is one of the product's ten modes and it does
     not look like the same product. Whatever visual identity this pass establishes has to reach
     it, or the identity is a property of two routes out of three.
WHAT IT FORBIDS:
  Promoting the game to the front door's primary act. `Record.tsx` already argues, correctly, why
  a cold record's one primary act is the first decision, and nothing measured here overturns it.
WHAT IT DOES NOT ESTABLISH:
  That players want to play a game rather than import one. The owner asked for the path to exist;
  which path a cold arrival takes is `FIELD-REQUIRED`, and the acquisition ledger already has the
  events that would answer it.
```

**Classification:** `REPO-SOLVABLE`, `P0` for reachability, `P1` for the orphan screen. Taken in
this pass.

---

## 10b. The owner-reported defect: the writing surface is at the end of the line

Reported by the owner from a screenshot of `DECIDE` after the first round shipped, reproduced in
Chromium on the built tip.

```
SOURCE:            client/src/index.css `.workbench`, client/src/pages/Home.tsx (child order),
                   client/index.html (`dir="rtl"`)
EVIDENCE TYPE:     MEASURED (element rects read in Chromium on the production build)
WHAT IT ESTABLISHES:
  `.workbench` declared `grid-template-columns: [rail] 132px [board] minmax(480px, 1fr)
  [task] 330px`, and the document runs right to left. Track 1 is therefore the RIGHT edge, and the
  task column, declared last, landed at the left. Measured at 1440x900 on `DECIDE`:
  `.commitment-screen` at x=24..354, `.board-workspace` at x=382..1416.
  The surface a player WRITES INTO is at the end of the reading line. In `REVEAL` the toolbox
  holds the reading start instead.
  This is a direction fact, not a taste one, and no measurement this pass had made could catch it:
  contrast, size, rank, measure and displacement were all measured, and none of them asks which
  end of the line the language starts at.
WHAT IT IMPLIES FOR ART DIRECTION:
  1. Track 1 belongs to the surface that receives what the player has to say. The DOM order has to
     move with it, or the tab order and the eye disagree and the fix has traded one defect for a
     worse one.
  2. The direction may not be pinned in the stylesheet. If a physical side decides a layout, the
     layout is correct in exactly one language, and the same defect returns the first time the
     interface language changes.
WHAT IT FORBIDS:
  A repair by `order:` or `tabindex`. Both would leave the DOM order saying one thing and the
  screen saying another, on the two screens where a keyboard walk and a visual walk have to be the
  same walk.
  Also forbidden: reading "we need to allow switching between the languages" as a licence to
  translate. The interface is Hebrew in 931 strings across 115 files, and on `DECIDE` and
  `ANSWER_INSTRUMENT` the copy IS the stimulus -- a translation is a protocol change. The owner
  scoped this himself: "חוק פריסה בלבד, עכשיו".
WHAT IT DOES NOT ESTABLISH:
  That the product will ever ship a second interface language, or which one. The rule derives the
  direction from the language rather than asserting a language exists.
```

**Classification:** `REPO-SOLVABLE`, `P1`. Taken in this pass.

---

## 11. Measured baseline facts that no previous document holds

Four things measured in Chromium at `b9a228c` for this pass, none of which appear in the earlier
audits because nothing before now was looking for them.

| # | measurement | value at BASE_SHA |
| --- | --- | --- |
| C1 | characters per line, `.context-loop` on `DECIDE` at 1440 | **116 cpl on one line, 1392px wide** — the widest band on the page and first in reading order |
| C2 | characters per line, `.record-page-payoff` on `ARRIVE` at 1440 | **104 cpl on one line, 736px** |
| C3 | paragraphs over 90 cpl on `REFLECT` at 1440 | **6 of 31**, worst 123 cpl at 11px (`.value-provenance`) |
| C4 | `.brand-lockup` against `.header-actions` at 390 | lockup x=184…380, actions x=10…204: **20px of overlap**, and the brand mark paints over the fourth icon control |

C1–C3 are one defect: **there is no measure.** 18 `max-width` declarations exist in 5,861 lines and
four of them are in `ch`; none is a product-level rule. A column with no measure is the reading
half of "it is tiring", and unlike density it is not a preference: 45–75 characters is the range
every typographic authority converges on, and 116 is not near it.

C4 is a layout defect at the narrowest supported width, and it is the kind `tests/layout` exists to
catch.

---

## 12. The authority order this pass ran under

```
1  runtime reality                  the built app in Chromium, at BASE_SHA and after every pass
2  measurement integrity            measurement-protocol.ts's own bump rule, applied literally
3  repo-native product contracts    MODE_CONTRACT, the inertial laws, shared/promise.ts, D21-D25
4  repo-native empirical evidence   the audits' browser measurements; R-B2; engine parity
5  repo-native research             consulted once, against one question
6  accessibility / normative        WCAG 2.2 AA, the repo's own 44px tap floor
7  general empirical HCI            the measure range; Hebrew letterform legibility
8  Hebrew / cultural evidence       every pass rendered in Hebrew before it was accepted
9  mature design-system precedent   token taxonomy only
10 competitor precedent             docs/COMPETITIVE_BENCHMARK.md, as a thing to be unlike
11 open-source design-agent advice  docs/design-council/SOURCES.md, with what was rejected
12 designer taste                   last, and named as taste wherever it decided anything
```

For identity preference the owner outranks every agent. For questions about actual use, a player
outranks everyone including the owner. Both are gates this pass cannot close, and it does not
claim to.
