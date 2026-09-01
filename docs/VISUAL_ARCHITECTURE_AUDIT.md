# The visual architecture audit

**What the rendered product actually looks like, measured in a browser, and why it reads as
"ugly, messy, too much information".**

`docs/INERTIAL_UX_LAWS.md` asks whether the player can correctly perform the current task.
`docs/INTERACTION_GEOMETRY.md` asks whether the screen is spatially organised around it, and
answered it for the board. This file asks the next question:

> **Does the interface make the current task perceptually obvious?**

A screen can satisfy `primaryAction === 1` and still present six competing priorities to the eye.
That is a defect for this document and for nothing else in the repository.

Base: `9c83395` (`origin/main`), production build, real Chromium, seven states, six viewport
families. Every number below was measured on the built app, not read out of the stylesheet.

---

## A. Executive diagnosis

**Colour is not the primary driver, and that is a weaker claim than the one this section made
first.** It said *"It is not colour"*, and the evidence does not reach that. What is measured here
is that the palette is tokenised, both themes are declared, and every colour pair in the loop
carries a contrast ratio in a comment beside it — which establishes that the colour is
**systematic and accessible**. It does not establish that it is **liked**.

Those are separate dimensions and the literature this task's §5 names keeps them separate on
purpose. VisAWI treats **Colorfulness** as a facet of its own, beside Simplicity, Diversity and
Craftsmanship — not as something derivable from token discipline or contrast compliance
([Moshagen & Thielsch 2010](https://www.sciencedirect.com/science/article/pii/S1071581910000777)).
Lavie & Tractinsky separate *classical* aesthetics — order, cleanliness, clarity — from
*expressive* aesthetics, and an interface can improve a great deal on the first while remaining
unattractive on the second
([2004](https://www.sciencedirect.com/science/article/abs/pii/S1071581903001642)).

So the claim this document is entitled to is: **nothing found here points at colour as the cause,
and colour was therefore not changed.** Whether the palette is *pleasant* is untested, is a
`Colorfulness` question rather than a structural one, and is listed in §10.

**Component count is not the driver either.** The screens the owner objects to hold roughly what
their mode contract says they may hold — though see the correction to M1 below, which is the same
kind of overreach and matters more.

The cause is that **this product has a typographic scale but no typographic hierarchy, and no
spacing system at all.** Three mechanisms, in order of how much of the report each explains.

### M1 — The type scale is collapsed into its bottom three steps

`--panel-fine` through `--panel-display` is a seven-step scale, and it is honoured: the stylesheet
contains exactly **one** raw font-size literal in 5,333 lines. But the *distribution across it* is
a mass at the floor:

| token | px | declarations |
| --- | --- | --- |
| `--panel-fine` | 10 | **80** |
| `--panel-label` | 11 | **79** |
| `--panel-body` | 12 | **76** |
| `--panel-data` | 14 | 12 |
| `--panel-title` | 16 | 9 |
| `--panel-heading` | 20 | 8 |
| `--panel-display` | 26 | 4 |

**235 of 258 declarations — 91% — resolve to 10, 11 or 12 pixels.** Rendered, that is 37 elements
at 10px on `DECIDE`; on `EXPLORE`, 98 at 10px, 55 at 11px and 37 at 12px — 190 of 226 text runs
inside a two-pixel band. Two more sizes exist below the scale's own floor: `9px` (×7) and a stray
`0.72em` that computes to `7.2px`.

Three steps spanning two pixels is not a hierarchy. It is below the difference an eye can rank at
reading distance, so **every text role reads as equally important**, and the reader is left to
find the task by reading rather than by looking.

**That explains a large part of "there is too much information" without settling it, and the first
draft of this paragraph overstated it.** It said *"the information is not excessive, it is
unranked"* — and only the second half of that was measured. What the numbers above establish is
that the information was **badly ranked**. They say nothing about how much of it there should be.

The two are separate questions and this document cannot answer the second. `MODE_CONTRACT` says
what a state may *permit*; permission is not a demonstration that everything permitted should be
*visible*. And this pass leaves several quantity questions open by its own account: the move
timeline is still the third-largest mass on `DECIDE` with one move on the board (§9 P2-1), the
ribbon still occupies the band above everything, four icon controls still sit at one weight in the
header, `EXPLORE` got no state-specific tuning, and the record's twelve-row *"what is still
unclear"* list is left as twelve peers (§10 Q8).

So the claim this document is entitled to is: **a substantial part of the reported overload is
explained by weak hierarchy, and the residual — whether there is simply too much on these screens —
is untested.** It is an owner judgement first and a field question after that, not something more
CSS reasoning can reach.

The upper half of the scale is nearly unused. `--panel-display` — commented "the one largest thing
on a screen, and there is one" — appears four times in the whole product and **not at all on
`/play`**.

### M2 — There is no spacing scale, so borders are doing the grouping

| | |
| --- | --- |
| spacing tokens declared | **0** |
| distinct `gap` values | **31** |
| distinct `padding` declarations | **63** |
| distinct `border-radius` values | **10** |

The gap values mix units, so `5px`, `0.35rem` (5.6px) and `6px` all exist and all read the same.
Proximity therefore cannot encode relatedness — the one job spacing has — and boxes step in to do
it instead: **24 visible borders on `DECIDE`, 63 on `EXPLORE`**.

This is the mechanism behind "it does not feel like one product". Whitespace is what makes a
layout look designed; outlines are what make it look assembled. Typography got a system and
spacing never did, so every component author reached for a border.

### M3 — Salience is assigned per component, so it contradicts the mode contract

`shared/interaction-mode.ts` names, for each mode, the one thing that may be central. Measured
against what is actually the strongest thing on screen:

* **`DECIDE`** — contract: *the commitment*. The largest non-decorative text on the page is
  `עמדת פתיחה` at 20px: the *name of the position*. The task heading `מה העמדה הזו דורשת?` is
  16px — the same size as the duplicated turn indicator and the move-timeline's label. The
  sentence that actually states the task (`בחרו מהלך וכתבו את הקריאה שלכם`) is 11px at
  **2.81:1**, the least legible text on the screen.
* **`REVEAL`** — contract: *the one thing this decision showed*. When there **is** a finding this
  is already right and tested: `.one-thing-text` renders at `--panel-display`, weight 600, and
  `what-the-first-reveal-weighs.test.tsx` holds it there. When there is **not** — every early
  reveal, and the first one any new player sees — `.one-thing-none` falls to `--panel-body` at
  `opacity: 0.82`, which is *quieter than the paragraph beside it*. Measured in that state:
  `.reveal-one-thing` 36,352px² against `.reveal-limits`' 57,539px². The state where the product
  has least to say is the state where its central object disappears. All three blocks also carry
  an identical 1px hairline, an identical 12px radius and an identical `--panel-body` heading,
  so nothing ranks them.
* **`ARRIVE`** — contract: *the first decision*. The only fully saturated control on the front
  door is `Lichess`, which is a **segmented-control option**. The primary action renders at
  `opacity: 0.45` — measured **2.85:1** — because it is disabled until a username is typed.

Each of these is locally defensible. Together they are the report.

### Two discrete defects found on the way

**D1 (P0) — the primary action of the measurement loop has no ground.** `.commitment-submit`
declares `background: var(--surface)` with the comment *"Opaque: it sits over the panel's own
content while the panel scrolls under it."* 1,552 lines later, `.commitment-submit.not-ready`
declares `background: transparent` — and `not-ready` is the panel's **default** state. Photographed
at 390×844, scrollY 400: the read-chips of step 2 render straight through
`חסר: בחרו רמת ביטחון`.

The regression test for this exact bug is green. `tests/client/ux-contract.test.ts` asserts
`background: var(--surface)` on the base block, and its own comment describes the failure that is
shipping: *"`background: transparent` was the shipped value, which over a scrolling panel would
put option chips through the middle of the button."* It reads one selector; the state that renders
is governed by another. Same shape as the `.workbench` defect — a rule and its override owned by
two places, and the check reading one.

**D2 (P1) — the contrast gate cannot see.** `.studio-shell` paints a decorative dot grid as a
`radial-gradient`. axe cannot determine a background colour behind a gradient, so on `/play` it
evaluates **1 node for contrast and returns 39 as *incomplete***, then reports zero violations.
`.board-note` — 11px, 2.81:1, and the sentence that states the task — is one of the 39.

---

## B. State by state

Measured at 1440×900 unless noted. "Actual visual centre" is the largest coherent perceptual mass
by area × luminance distance from the page ground.

| State | Primary task | Intended centre (`MODE_CONTRACT`) | Actual centre | Competing regions | Density | Grouping | Coherence | Sev |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ARRIVE` | start the first decision | the first decision | a segmented-control option (`Lichess`, mass 2,565 vs the primary action's 4,216 at `opacity .45`) | three buttons in three visual languages | 18 text runs, 5 of them 11px prose stacked under the h1 | one card, square corners, left accent bar — a language used nowhere else | **no header at all**; does not read as the same product as `/play` | **P1** |
| `DECIDE` | commit a decision | the commitment | the board (correct, 129k mass) | the ribbon is the widest bordered band on the page and sits above everything; `.move-timeline` is the second-largest single surface (11,349) | 89 text runs, 37 at 10px | 24 borders; `תור/לבן` rendered twice, 400px apart | red is the only accent on screen and it is on the not-yet-done state | **P0** (D1) |
| `ANSWER_INSTRUMENT` | answer the probe | **the question** | the board (632², vs the question card at 330×205) | ~560px of empty column under the question | low | question and board are 250px apart with nothing joining them | kicker still reads `DECIDE` | **P1** |
| `REVEAL` | read what the decision showed | **the one thing this decision showed** | the caveat block, **in the no-finding case** (57,539 vs 36,352) | three identical cards; toolbox column returns for two items | 12px headings on 12px bodies | three blocks, one visual treatment | order is right and documented; the *empty* answer has no weight | **P1** |
| `REFLECT` / `RESUME` | what the record can and cannot say | the next action | nothing — no mass above 4,216 in 2,818px of page | ~20 sections at one weight; 12 consecutive near-identical 10px rows | **127 text runs; 59 at 10px, 30 at 11px** | hairlines only; no rank between sections | two candidate actions, the louder one 700px down the scroll | **P1** |
| `EXPLORE` | move around a finished game | the position being looked at | the board | 15 headings, `h3` rendered at 11, 12 **and** 14px | **258 text runs; 190 in the 10–12px band**; 63 borders | `h4` at 11px above 12px bodies — headings smaller than what they head | legitimately dense, but its structure is not legible | **P1** |
| `WAIT` / `TEST` / `REVIEW_EVENT` | — | — | — | inherit the same type and spacing systems | — | — | — | see M1/M2 |

**`TEST`** was not reached without inventing a drill record, so it is audited structurally only: it
renders through `DrillRunner` inside the same `.analysis-stack` and inherits every finding above.

---

## C. Visual-system inventory

**Typography.** Seven tokens, one raw literal (`34px`, the brand mark), one `0.72em`. The scale is
sound; its *use* is the finding — see M1. Weights in use: 400, 600, 700, 800. Two families: Noto
Sans Hebrew for text, DM Mono for kickers and numerals. DM Mono has no bold; every `font: 700 …
"DM Mono"` in the file is synthesised, which the stylesheet already documents.

**Colour.** Tokenised, both themes, contrast measured in comments. Roles that exist: `--paper`,
`--surface`, `--raise`, `--ink`, `--muted`, `--edge`, `--blue`, `--on-blue`, `--warn`, `--chosen`,
`--chip`, plus a validated chart palette. *Missing roles:* nothing named for **evidence/success**
(the reveal has no positive counterpart to `--warn`), and nothing named for **focus**
(`:focus-visible` reuses `--blue`).

**Duplicated roles with different appearances.** Card surfaces: `.commitment-screen` (14px radius,
`--surface`, 1px border), `.reveal-block` (12px radius, no fill, 1px hairline), `.record-card`
(0 radius, 3px inline-start accent), `.context-ribbon` (0 radius, 3px inline-start accent, 1px
border), `.panel-shell` (its own). **Five card languages for one job.**

**Different roles with identical appearance.** On `REVEAL`, the block that reports the finding and
the block that withholds it are drawn identically.

**Spacing.** No tokens. 31 gaps, 63 paddings, 10 radii — see M2.

**Controls.** `.primary-control` (filled `--blue`), `.commitment-submit` (outline, currentColor),
`.ghost-control`, `.rail-button`, `.icon-control`, `.step-next`, `.read-chip`, `.explore-toggle`,
`.analysis-action`, `.layer-action`, `.suggestion-button` … a 47-selector list shares only the
tap floor. The one thing they do not share is a rule for *which is louder than which*.

---

## D. Information budget

Only where the budget is currently wrong. **Nothing is proposed for deletion**; the column is
where each thing's *salience* belongs.

| State | Item | Now | Verdict |
| --- | --- | --- | --- |
| `DECIDE` | the board, the four steps, the submit | NOW | correct |
| `DECIDE` | `תור / לבן` in the header **and** in `.workspace-meta` | NOW ×2 | **one of the two is not justified** — same fact, two places |
| `DECIDE` | `עמדת פתיחה` at 20px | NOW, loudest | SOON — it is a label on the board, not the task |
| `DECIDE` | the context ribbon's loop sentence | NOW, widest band | **ON-DEMAND salience, NOW presence** — permitted by `MODE_CONTRACT` (loop position is not a reading of the player) and must stay; its weight is the defect, not its existence |
| `DECIDE` | `.move-timeline` at 68px full width with one move on the board | NOW, 2nd-largest surface | SOON |
| `REVEAL` | `.reveal-limits` | NOW, first, largest | **NOW and first — keep. Largest — no.** Order is epistemic (D25); weight is perceptual. They are allowed to differ, and the stylesheet already makes this argument for `li` size |
| `REVEAL` | `.reveal-one-thing` | NOW, 2nd | NOW, **and central by weight** |
| `REFLECT` | 12 consecutive `עוד 30 החלטות` rows | NOW, undifferentiated | NOW, but as one group with one heading, not twelve peers |
| `ARRIVE` | licence footer | NOW | ON-DEMAND |

---

## E. Findings

### P0-1 — the sticky primary action has no ground

```
ID:            P0-1
State:         DECIDE, ANSWER_INSTRUMENT (every state where the panel is taller than the viewport)
Observed:      the read-chips of step 2 render through the text of the submit button
Evidence:      shots/MOBILE-scroll-400.png, 390x844, scrollY 400. Computed:
               background-color rgba(0,0,0,0), border 1px dashed --warn, position sticky,
               bottom 8px, z-index 2, pinned=true
Mechanism:     .commitment-submit sets `background: var(--surface)` with the comment "Opaque: it
               sits over the panel's own content while the panel scrolls under it".
               .commitment-submit.not-ready sets `background: transparent`, 1,552 lines later,
               and `not-ready` is the panel's default state
Impact:        the one control the measurement loop exists to collect is illegible during ordinary
               scrolling of the instrument
Confidence:    certain — photographed, and the computed value read back
Class:         A (SCREEN-RESOLVABLE)
Intervention:  give `.not-ready` the same painted ground; carry the state in border and text
Invariant:     still pressable when not ready (pressing it is how you find out what is missing);
               still visibly distinct from ready; --warn still the state's colour
Wrong if:      the dashed-transparent treatment is load-bearing for "this is not yet a button"
Falsify:       a browser assertion that the painted background of .commitment-submit is opaque in
               BOTH states — which is the assertion the existing source-level test could not make
```

### P0-2 — the type scale carries no hierarchy

```
ID:            P0-2
State:         every state
Observed:      "too much information"; the next action is not visually obvious
Evidence:      235 of 258 font-size declarations resolve to 10/11/12px. Rendered: DECIDE 37 runs
               at 10px; EXPLORE 98 at 10px, 55 at 11px, 37 at 12px, plus 9px and 7.2px below the
               scale's own floor. --panel-display used 4 times in the product, 0 times on /play
Mechanism:     the scale was tokenised without assigning sizes to jobs. A size became a token but
               never became a rank, so every author picked from the bottom of the scale and the
               distribution flattened
Impact:        the reader cannot rank anything by looking and must read to find the task. This is
               the largest single contributor to the report
Confidence:    high — the distribution is measured, and the effect is visible in the squint test
Class:         B (STANDARD-RESOLVABLE) — a scale needs a ratio the eye can rank; 10:11:12 is
               1.10x and 1.09x
Intervention:  assign roles, not sizes: one display per screen, one task heading that outranks its
               metadata, body at a legible size, and labels below it. Raise the floor
Invariant:     the seven tokens keep their names (nine tests name them); no measurement wording
               changes; the 44px tap floor holds
Wrong if:      raising body size pushes the commit control below the fold again -- the exact
               defect `position: sticky` was added to fix
Falsify:       re-measure the submit's y at 1393x681 and 390x844 after the change; and a
               grayscale pass -- if hierarchy survives without hue, the type is carrying it
```

### P1-1 — `REVEAL`'s central object vanishes in the case a new player meets first

**A correction to this finding's first draft, kept because the correction is the finding.** The
first pass measured `.reveal-one-thing` at 36,352px² against `.reveal-limits`' 57,539px² and read
it as a blanket weight inversion. It is not. When the reveal HAS a finding, `.one-thing-text`
renders at `--panel-display` weight 600 and is correctly the largest thing on the screen -- the
repository already did this work and `tests/client/what-the-first-reveal-weighs.test.tsx` holds it.
The 36,352 was measured in the *other* branch.

```
ID:            P1-1
State:         REVEAL, no-finding branch (every early reveal; the first one any new player sees)
Evidence:      .one-thing-text  -> --panel-display, weight 600   (correct, tested)
               .one-thing-none  -> --panel-body, opacity 0.82    (quieter than the prose beside it)
               In that branch: .reveal-limits 57,539px^2 vs .reveal-one-thing 36,352px^2.
               All three blocks share one border, one radius and a --panel-body heading
Mechanism:     the finding branch was given a rank and the empty branch was given a de-emphasis.
               "Nothing to report" was treated as an absence of content rather than as content
Impact:        the state where the product has LEAST to say is the state where its central object
               disappears -- and MODE_CONTRACT.REVEAL does not say "the finding when there is
               one", it says "the one thing this decision showed". shared/next-action.ts already
               makes this exact argument for its own `none`: "NOTHING TO PROPOSE, AND IT IS A
               FIRST-CLASS ANSWER"
Class:         A
Intervention:  raise the empty branch to --panel-data at full opacity -- a clear step above body,
               well below the display step a real finding gets, because it is not one. Give every
               reveal block a heading rank. Keep the ORDER exactly: it is epistemic (D25) and an
               ordering claim and a weight claim are different claims, which .reveal-limits li
               already says in its own comment
Invariant:     limits stay FIRST and fully legible; the finding branch keeps --panel-display and
               its test; the evaluation number stays inside the collapsed <details>; no epistemic
               claim strengthens -- "nothing here yet" is not promoted to a finding
Wrong if:      a legible empty answer reads AS a finding
Falsify:       re-run what-the-first-reveal-weighs; assert the empty branch is strictly SMALLER
               than the finding branch; measure the limits' contrast after the change
```

### P1-2 — `ARRIVE` makes a radio option louder than the primary action

```
ID:            P1-2
State:         ARRIVE
Evidence:      .primary-control at opacity 0.45 measures 2.85:1 (needs 4.5); the selected
               .ghost-control renders at full saturation. Total ink mass on the page: 6,781
Mechanism:     the action is disabled until a username is typed, and `disabled` is expressed as
               opacity, which fails contrast and reads as "off" rather than "not yet"
Impact:        the front door's one act is the least visible control on it
Class:         B -- WCAG 1.4.3 resolves the contrast half; the salience half is A
Intervention:  a disabled treatment that keeps AA; the source selector reads as a selector
Invariant:     LAW 8 -- nothing is pre-selected; the second path (the shared set) stays reachable
Wrong if:      a legible disabled control reads as pressable
Falsify:       re-measure contrast; confirm the control is still `disabled` in the DOM
```

### P1-3 — the contrast gate evaluates one node in forty

```
ID:            P1-3
State:         DECIDE (and every /play state)
Evidence:      axe color-contrast on /play: 0 violations, 1 pass, 39 incomplete, every one
               "background color could not be determined due to a background gradient".
               .board-note measures 2.81:1 at 11px
Mechanism:     .studio-shell paints a 7px dot grid as a radial-gradient. axe stops at a gradient
Impact:        the accessibility gate reports green having checked almost nothing; a genuine AA
               failure on the sentence that states the task is underneath it
Class:         B
Intervention:  give the shell a determinable ground; raise .board-note to AA
Invariant:     the grain stays if it can; axe must reach a real number either way
Wrong if:      removing the gradient flattens the "paper" quality the aesthetic depends on
Falsify:       re-run axe and count `incomplete`; if it does not fall, the mechanism was wrong
```

### P1-4 — no spacing system, so borders group instead of whitespace

```
ID:            P1-4
State:         every state
Evidence:      0 tokens; 31 gap values across two units; 63 padding declarations; 10 radii.
               24 borders on DECIDE, 63 on EXPLORE
Mechanism:     spacing was never given the treatment typography got, so proximity carries no
               signal and each component drew its own outline to compensate
Impact:        "does not feel like one product"; Gestalt grouping is performed by boxes
Class:         A for the scale; the per-component application is P2 and deliberately partial
Intervention:  add a spacing scale; consolidate the five card languages to one; remove borders
               whose relationship survives without them
Invariant:     no border disappears where its removal merges two unrelated things
Wrong if:      removing borders merges regions the reader was using them to separate
Falsify:       re-count borders AND re-run the squint test -- the three strongest masses must
               still map to the state's intended hierarchy
```

### P1-5 — `DECIDE` ranks the position's name above the task

```
ID:            P1-5
State:         DECIDE, ANSWER_INSTRUMENT
Evidence:      `עמדת פתיחה` 20px vs `מה העמדה הזו דורשת?` 16px. `תור/לבן` rendered twice, 400px
               apart. The instruction sentence 11px at 2.81:1
Mechanism:     the board's metadata header and the task panel were styled by different components
               with no rule saying which outranks which
Impact:        the largest thing on the DECIDE screen is a label
Class:         A
Intervention:  the task heading takes the display step; the position label becomes metadata; the
               duplicate turn indicator resolves to one
Invariant:     PRE-COMMIT STIMULUS -- no wording changes, no information added or removed, no
               control moves. Size and weight only. This is still a stimulus change: see G
Wrong if:      the position label is load-bearing for orientation in EXPLORE
Falsify:       the next-action test -- with all explanatory text removed, does the structure still
               point at the commit control?
```

### P1-6 — `REFLECT` has 2,818px of page and no rank

```
ID:            P1-6
State:         REFLECT / RESUME
Evidence:      127 text runs, 59 at 10px and 30 at 11px; ~20 sections separated by hairlines only;
               12 consecutive near-identical rows; no perceptual mass above 4,216 anywhere
Mechanism:     M1 and M2, at the scale of the longest page in the product
Impact:        the state whose contract is "what the record can and cannot say" says everything at
               one volume, so it says nothing
Class:         A for the type ranks; the section architecture is C -- FIELD-REQUIRED
Intervention:  four ranks -- what happened / what the record supports / what is uncertain /
               what next -- expressed in type and spacing, not new components
Invariant:     no reading is removed; no claim strengthens; D25's boundary holds
Wrong if:      ranking reads as ranking the *evidence*, which it is not
Falsify:       grayscale pass, and re-read every strengthened heading against D25
```

### P2 register — recorded, not implemented

| id | what |
| --- | --- |
| P2-1 | `.move-timeline` is the second-largest surface on `DECIDE` with one move on the board |
| P2-2 | four `.icon-control`s at equal weight in the header; three are diagnostics |
| P2-3 | the toolbox column holds two items at `REVEAL` and reserves a full track |
| P2-4 | `0.72em` on `.value-fraction` -- the last non-token size |
| P2-5 | `.reveal-secondary` metric rows repeat `Stockfish 18 מקומי · עומק 14` four times |
| P2-6 | ~560px of empty column under the counterfactual question |
| P2-7 | five card languages reduced to two here, not one |

---

## F. Targeted research questions

Only the ones the product itself raised. No broad review was performed; §5's prior was sufficient.

1. **What ratio makes a type step rankable?** Raised by M1's 10/11/12 band. Resolved from the
   standard basis rather than by taste: perceptual ranking of type size needs a step the eye
   registers as different, and modular scales converge on ≥1.2 for adjacent ranks that must be
   *ordered* rather than merely *distinguished*. 10→11 is 1.10 and 11→12 is 1.09. Applied only to
   the ranks that must be ordered; sibling roles at one rank may stay close.
2. **Does axe evaluate through a pseudo-element background?** Raised by P1-3, and it decides
   whether the grain can be kept. Repository-resolvable: run axe against both shapes and count
   `incomplete`. Answered in the implementation, not assumed.
3. **Is a salience change a protocol change?** Raised by P1-5. Resolved from
   `shared/measurement-protocol.ts`, which already answers it: *"what is on screen while the answer
   is given is the same kind of fact"* as a sampling rate. See G.

---

## G. Measurement integrity — the decision, recorded before the work

`§26` requires this to be settled before a pre-commit pixel moves.

**Pre-commit changes proposed:** P0-1 (the submit gains a painted ground), P0-2 (type ranks),
P1-3 (`.board-note` contrast), P1-4 (spacing), P1-5 (`DECIDE` ranks). All of them change
**salience**. None changes available information, wording, question ordering, the number or
position of measurement controls, sampling, timing, thresholds, eligibility, or scoring.

`CURRENT_PROTOCOL_VERSION`'s own instruction is *"BUMP THIS when anything changes about HOW a
decision is produced"*, and its 1→2 note settles the ambiguity in advance: *"IT IS THE STIMULUS
THAT CHANGED, WHICH IS WHAT THIS FIELD IS FOR. The examples … are a sampling rate and the moment a
question appears; what is on screen while the answer is given is the same kind of fact."*

A commit control that is legible where it was not, and a task heading that outranks a label where
it did not, are what is on screen while the answer is given.

> **Decision: bump `CURRENT_PROTOCOL_VERSION` 2 → 3, once, for the whole pass.**

This is not a claim that v2 rows are wrong. It is the weaker and safer claim that they are not the
same population. The alternative — treating "CSS only" as measurement-neutral — is the assumption
`§26` names and the one this repository has already been bitten by.

**Explicitly out of scope and untouched:** commitment requirements, confidence collection,
candidate collection, the counterfactual probe and its ~35% rate, sampling, reveal timing, engine
timing, thresholds, eligibility, scoring, the measurement schema, and the interpretation policy.
LAW 9's three friction points are not touched. No measurement wording is rewritten.

---

## H. The proposed system

The smallest set that resolves repeated inconsistency. Not a new palette.

**Type — ranks, not sizes.** The seven tokens keep their names and their roles get stated:

| rank | token | job | rule |
| --- | --- | --- | --- |
| display | `--panel-display` | the one largest thing on a screen | exactly one per state, and it is the *task* |
| heading | `--panel-heading` | a heading that owns a region | outranks any metadata beside it |
| title | `--panel-title` | a block's own heading | never smaller than the body under it |
| data | `--panel-data` | readings: the move, the digit | — |
| body | `--panel-body` | prose meant to be read | the floor for anything that is a sentence |
| label | `--panel-label` | labels, legends, chips | never a sentence |
| fine | `--panel-fine` | kickers, counters, provenance | never load-bearing |

**Spacing — a scale, because there is none.** `--s1`…`--s6`, one unit, used for gaps and block
rhythm. Spacing encodes grouping: one step inside a group, two between groups, three between
regions.

**Surfaces — a border must have a job.** One card language (`--surface`, one radius, one hairline)
plus one *raised* variant reserved for the central object of a state. Every other border is asked
what relationship becomes less understandable without it.

**Colour — two roles added, none replaced.** `--evidence` (a positive counterpart to `--warn`, so
the reveal can mark a finding without borrowing the engine's blue) and `--focus`.

---

## I. Implementation plan

Ordered by dependency, then ROI. §18's order is respected: hierarchy and grouping before colour.

1. **P0-1** — the submit's ground, plus a browser assertion that can see it. Independent; ships first.
2. **Type ranks (P0-2)** — the token roles, then the display/heading/title assignments.
3. **Spacing scale (P1-4)** — tokens, then the card consolidation the ranks expose.
4. **Per-state hierarchy** — `DECIDE` (P1-5), `REVEAL` (P1-1), `ARRIVE` (P1-2), `REFLECT` (P1-6).
5. **P1-3** — the shell ground and `.board-note`, once the surfaces are settled.
6. **Colour roles** — last, and only the two that are missing.
7. **Protocol bump + falsification + verify.**

No architectural refactor. `Home.tsx` is not split. No state library. No file reorganisation.

---

## J. Competitive calibration

§30, and it is calibration rather than a source of authority: a competitor's design never
overrides the mode contract. Compared on the seven axes only, not on feature breadth.

| pattern observed | why it may work | fits Decision Lab? |
| --- | --- | --- |
| **Lichess analysis** gives the board ~60% of the viewport and puts everything else in one narrow column with a single type rank for move text | one dominant object, one supporting column, no third region competing | **Yes, and already true here** — the geometry work landed this. Nothing to take |
| **Lichess** uses whitespace, not borders, between sections of its right column | the column reads as one thing with parts, not as stacked cards | **Yes** — directly addresses P1-4. Adopted as a principle, not a layout |
| **Chess.com Game Review** opens on one large verdict per move, with the numbers behind a tab | one thing is central and the instrumentation is a step away | **Conflicts in substance, agrees in form.** The verdict shape is exactly what D25 forbids us to imitate — we may not turn an observation into a diagnosis. But *one central object with the numbers behind a disclosure* is already `RevealPanel`'s documented structure; the finding is that we do not draw it that way |
| **Chess.com** colour-codes move quality as a primary signal | instantly rankable | **No.** Colour carrying a classification is exactly what this repository's chart palette note refuses (*"colour never carries it alone"*), and the classification itself would be a stronger claim than the evidence supports |
| **ChessTempo** runs dense tabular analysis at one small type size | appropriate to a reference tool | **No** — it is what `REFLECT` already does, and it is the finding |
| **Aimchess / DecodeChess** wrap findings in confident cards with scores and streaks | reads as authoritative | **No.** §29 and D25 both. An interface that looks more verified than its evidence is the specific failure this product is built against |

**Net take:** one pattern adopted (whitespace over borders as the grouping device), one confirmed
already present (board dominance), and four explicitly rejected on measurement-integrity or
evidence-boundary grounds. The aesthetic direction stays §29's: serious, precise, calm,
instrument-like, chess-first, low-noise.

---

# Part two — what was done

Written after the work, against the same instruments that produced Part one. Every number below
was re-measured on the built app in Chromium after the change.

## 1. Executive verdict

**What was wrong.** Not the palette. This product tokenised its type scale and never assigned it:
235 of 258 font-size declarations resolved to 10, 11 or 12 pixels — steps of 1.10× and 1.09×,
below what an eye can order — so every role read as equally important and the reader had to *read*
to find the task instead of looking. Spacing never got the treatment typography did at all: zero
tokens and thirty-one gap values across two units, so proximity carried no signal and borders
compensated. On top of that, three states ranked something other than their contract's central
object, and two discrete defects were live: the control that records a decision had no ground and
rendered the instrument's own chips through its text, and the accessibility gate was reporting
green having evaluated one node in forty.

**What changed.** The scale's values were re-spaced and its ranks assigned by job; a spacing scale
was added and 142 gap declarations mapped onto it; the commit control got a ground and the primary
treatment; nine headings that sat at or below their own body were raised; the reveal's central
block got a surface and its empty branch got a rank; the front door's disabled action became
legible; the shell's grain moved to a layer so contrast can be measured; the protocol version
bumped once, with its reasons.

**What deliberately did not change.** The measurement instrument: no wording, no question order,
no control positions, no sampling, no timing, no thresholds, no eligibility, no scoring, no
schema. `RevealPanel`'s DOM order — an epistemic decision, and non-negotiable. The read chips'
selected treatment, which is inside the instrument and was contrast-measured where it is. LAW 9's
three friction points. `Home.tsx` was not split; no state library; no file reorganisation. The
front door still has no product identity — see §10.

## 2. Before / after, per state

Measured at 1440×900 on the production build. "Loudest text" excludes board glyphs and the brand
mark, both of which are drawings.

| State | | before | after |
| --- | --- | --- | --- |
| **DECIDE** | loudest text | `עמדת פתיחה` — the position's *name*, 20px | **`מה העמדה הזו דורשת?` — the question, 22px** |
| | primary action, ready | cream fill, ink text, hairline (secondary language) | **filled `--blue`, `--on-blue`** |
| | primary action, not ready | `background: transparent`, chips visible through it | opaque `--surface`, dashed `--warn` |
| | squint mass of the submit | 1,578 | **9,053** (5.7×) |
| | text runs ≤ 10px | 37 | **0** |
| | the sentence stating the task | 11px at **2.81:1** | 14px at **6.9:1** |
| | `תור / לבן` | rendered twice, 400px apart | once, beside the board |
| **ANSWER_INSTRUMENT** | question rank | `--panel-title`, below the position's name | `--panel-heading`, above it |
| **REVEAL** | central block, finding branch | `--panel-display` (already correct, tested) | unchanged |
| | central block, **empty** branch | `--panel-body` at `opacity .82` — quieter than the prose beside it | `--panel-data`, full opacity, on a `--raise` surface |
| | the three blocks | one border, one radius, one `--panel-body` heading each | one surface (the central one), two ruled sections, `--panel-title` headings |
| | headings at one rank | 4 (the composer invite was a peer of the reveal's own) | 3 |
| **ARRIVE** | primary action | `opacity: .45` → **2.85:1** | `--muted` on `--chip` → **4.59:1** light / 4.80:1 dark |
| | the input, which is the act | transparent, hairline, squint mass 0 | `--raise` ground, `--edge` border, mass 1,369 |
| | card language | square corners, 3px accent bar — used here only | the product's card: `--surface`, 12px radius, one hairline |
| **REFLECT** | section headings | `--panel-fine` (10px) in `--edge` (**2.81:1**) | `--panel-title` (18px) in `--muted` |
| | block headings (`.dash-title` etc.) | 11–12px, at or below their own body | 16px |
| | text runs in the 10–11px band | 89 of 127 | 59 of 130, none below 11 |
| | runs at 14px and above | 15 | **38** |
| | sub-scale sizes (9px, 7.92px) | 8 | **0** |
| **EXPLORE** | inherits the scale and spacing changes | 190 of 226 runs in a 2px band | ranked; not separately re-tuned — see §9 |
| **WAIT / TEST / REVIEW_EVENT** | inherit the same systems | — | — |

## 3. Information removed or deferred

| what | why | where it went | why the task loses no context |
| --- | --- | --- | --- |
| the header's `תור / לבן` | the same fact rendered twice at one rank, 400px apart | nowhere — the copy beside the board survives | the reading is still on screen, once, next to the thing it describes. Not behind a disclosure |
| `.record-mode`'s border | a box around a standing notice made it a fourth surface on a screen with three | replaced by a 2px inline-start rule | the sentence is unchanged and now one rank *larger* (11 → 12px) |
| `.context-ribbon`'s frame | it was the widest bordered band on DECIDE, above the board and the task, for information that is contextual | replaced by a rule beneath it | the sentence, the basis, the "why" and the link are all unchanged and still first in reading order. `MODE_CONTRACT.DECIDE` permits it and it stays |
| the reveal blocks' frames | three identical boxes for three different jobs; a border must say what becomes less understandable without it | replaced by rules; the central block keeps a surface | the order is untouched — limits still first, still fully legible |

**Nothing was hidden to reduce a count, and nothing moved behind a disclosure.** The only element
that lost a rank is the composer invite's heading, which is itself a disclosure's summary.

## 4. Visual-system changes

**Type.** Seven tokens, same names, re-spaced: `--panel-fine` 10→11, `--panel-label` 11→12,
`--panel-body` 12→14, `--panel-data` 14→16, `--panel-title` 16→18, `--panel-heading` 20→22,
`--panel-display` 26→28. The steps that must be *ordered* are wide (label→body 1.17,
title→heading 1.22, heading→display 1.27); fine→label stays at 1.09 on purpose, because both are
things that are not sentences and are ranked against body rather than each other. The floor also
moved for a reason that is not hierarchy: this interface is Hebrew, which has no ascenders or
descenders to help letters resolve, and the old floor held 80 declarations.

Ranks assigned: `.commitment-header h2` → heading; `.workspace-meta h1` → data (it displays
`7. Bb3`, which is a reading); `.reveal-block h3`, `.claim-panel > h3`, `.learning-heading h3`,
`.what-heading h3`, `.unclear__title`, `.under-test__title` → title; `.review-moments h4`,
`.what-this-is h4`, `.dash-title`, `.outcome-summary__title`, `.profile-panel__title`,
`.counterfactual-panel__title` → data; `.section-heading` → title; `.value-triple .value-number`
→ data (it had **no** declared size and inherited).

Two sizes that were off the scale entirely are on it: `.value-fraction`'s `0.72em` (7.92px, and
`em` was missing from the unit list the stylesheet test checks), and six chart axis ticks written
as `fontSize: 9` in JSX, where no stylesheet reader could ever have seen them.

**Spacing.** New: `--s1: 4px` … `--s6: 28px`, anchored on the values already most used so most of
the 142 call sites did not move. Semantics are written at the declaration: one step inside a
group, two between groups, three between regions. Two literals survive and are named where they
are — `gap: 0` on a collapsed commitment step, and `gap: 1px` on `.calibration-split`, which is a
hairline drawn as a grid gap rather than a distance.

**Surfaces.** Five card languages reduced to two: the product's card (`--surface`, 12px radius,
one hairline) and one *raised* variant (`--raise`) spent on the object a state's contract names
central. `.first-decision`, `.record-layer` and `.review-stat` gave up their square corners and
3px accent bars; `.reveal-block` gave up its frame.

**Controls.** `.commitment-submit` moved from the secondary language to the primary one.
Disabled is now a declared pair rather than an opacity.

**Colour.** *No palette change.* No token's value moved, no hue was introduced, no dark-theme
value was touched. Two roles were re-pointed at existing tokens (`--muted` where `--edge` was
failing contrast; `--chip`/`--muted` for disabled). The `--evidence` and `--focus` roles proposed
in §H were **not** added: nothing in the implementation needed them, and adding a token with no
call site is how a palette grows without a reason.

**Layout.** `.studio-header` names its tracks. Removing the duplicate turn reading left two
children in a three-track grid — the `.workbench` defect exactly — so both children name their
column, and the ≤680px breakpoint carries the same names (without that, Chromium built implicit
tracks and reported `113.75px 0px 0px 196.25px`). Side effect: the mobile header is **67px, down
from 88**, which is 21px given back above the fold on the smallest screen.

## 5. Measurement-integrity report

**Pre-commit stimulus changes:** the commit control's ground and treatment; the type ranks on
`DECIDE` and `ANSWER_INSTRUMENT`; `.board-note` and `.record-mode` sizes and colours; the context
ribbon's frame; the spacing scale; the removal of the duplicated turn reading.

**Protocol version changed: yes. `CURRENT_PROTOCOL_VERSION` 2 → 3, once, for the whole pass.**

**Why.** `measurement-protocol.ts` settles it in its own 1→2 note: *"IT IS THE STIMULUS THAT
CHANGED, WHICH IS WHAT THIS FIELD IS FOR … what is on screen while the answer is given is the same
kind of fact"* as a sampling rate. A decision taken in front of an unreadable commit control and
one taken in front of a readable one are two measurements, and nothing in the row itself tells
them apart. Decision time is measured **to the commit**, so the legibility of the control that
ends it is not cosmetic. This is not a claim that v2 rows are wrong — only that they are not the
same population.

**What remained identical:** commitment requirements, confidence collection, candidate collection,
the counterfactual probe and its ~35% rate, sampling, reveal timing, engine timing, thresholds,
eligibility, scoring, the measurement schema, the interpretation policy, and every word of
measurement wording. LAW 9's three friction points are untouched. `deriveInteractionMode`,
`MODE_CONTRACT`, `makingEvidence`, `engineMayRun` and `next-action.ts` were not edited.

**Evidence boundary (D25).** No epistemic claim was strengthened. The one place this was close is
`.one-thing-none` — "nothing here yet" — which was raised from body rank to data rank. It is
deliberately **two** ranks below what a real finding gets, and `what-the-first-reveal-weighs`
asserts both halves: strictly larger than body, strictly smaller than `.one-thing-text`. The
argument is `next-action.ts`'s own, about its own `none`: a first-class answer, drawn as one, and
not drawn as a finding.

## 6. Falsification report

| attempt | expected failure | result | action |
| --- | --- | --- | --- |
| **Hierarchy** — does a secondary control still outrank the next action? | the composer invite, the source toggle, or the timeline outweighs the primary | READY squint: board 148,256 → panel 19,018 → timeline 11,349 → **submit 9,053**. The composer invite's heading *was* a peer of the reveal's three section headings | de-ranked the composer invite to data. Timeline recorded as P2-1 |
| **Grayscale** — does the hierarchy survive without hue? | the blue button is the only thing separating primary from secondary | passes: with `filter: grayscale(1)` the filled button is still the only solid dark block in the panel and the task heading is still the largest text | none |
| **Next action** — with every word replaced by blocks, is the next act still findable? | the structure depends on copy | passes: board, one card, one heading, four checked rows, one filled button. Captured as `BLIND-READY.png` | none |
| **Density** — did anything move behind disclosure or into memory? | information required now became a click away | nothing was hidden; two borders and one duplicate were removed. §3 lists every item | none |
| **Grouping** — did removing borders merge unrelated things? | the reveal's three blocks read as one | they read as a quiet section, a raised card, and a quiet section; the surface is the strongest grouping signal and it is spent on the central object | none |
| **Responsive** — does the clean desktop hierarchy collapse on a phone? | overflow, a clipped board, or the action below the fold | 12 viewports × 3 states: **horizontal overflow 0 everywhere**; board identical to the geometry doc's post-fix numbers at every width; the ready submit above the fold at all twelve | none |
| **Board usability** | a square becomes unhittable, as in the 92px defect | `elementFromPoint` at e2 returns the piece at every viewport where e2 is on screen; the `null` results are off-screen (e2 at y=−227 at 390×844), and scrolling it into view returns `SPAN.piece` | none |
| **Accessibility** — did quieter reduce contrast? | a de-emphasised element drops below AA | axe full ruleset: **0 violations on `/`, `/play`, `/blitz`**. `/play` incomplete 39 → 17, and all 17 are "content contains only non-text characters" (chess glyphs). Independent measurement: 0 text runs below AA on either route, down from 1 on `/` and 1 on `/play` | none |
| **Tap floor** | a rank change shrinks a control below 44px | 0 controls under 44px on `/play` at any of 12 viewports. Three on `/` are inline licence links in a sentence (55×25, 108×25, 59×25) — pre-existing, and exempt under 2.5.8's inline-in-a-sentence carve-out | none |
| **Reduced motion** | a new transition ignores the setting | 0 elements animating under `prefers-reduced-motion: reduce` | none |
| **Focus** | a re-styled control loses its ring | 12 tab stops on DECIDE, every one with a visible outline or box-shadow; order is brand → icons → disclosure → board → steps | none |
| **The new tests themselves** — can they fail? | a test that asserts nothing | reverted the stylesheet and re-ran: 5 of 7 browser assertions red, 4 of 10 hierarchy assertions red, and the rewritten source-level check red naming `.commitment-submit.not-ready`. **The first version of the hierarchy file had 4 assertions green on the baseline** because a cold page load never reaches the reveal or a populated record; it now drives a real decision first | rewrote the file to reach the states that hold the defects |
| **A false positive in the new test** | it reports inversions that are not on screen | it did: `.unclear__item` reported 16px inherited from the document while every glyph in it painted at 14 or 11 | restricted the check to elements that paint their own text, and exempted readings — a small label over a large number is the stat tile, not an inversion |

## 7. Browser evidence

Production build, real Chromium, static server, light theme unless stated.

* **Viewports:** 1920×1080, 1440×900, 1280×800, 1024×768, 390×844, 375×812, 360×740, and under
  height pressure 844×390, 812×375, 1440×620, 1280×550, 1024×600.
* **States:** `ARRIVE`, `DECIDE` (not-ready and ready), `ANSWER_INSTRUMENT` (counterfactual),
  `REVEAL`, `REFLECT`/`RESUME` with a real record, `EXPLORE`. `TEST` was not reached without
  inventing a drill record and is audited structurally only.
* **Instruments:** full element census (box, computed size, weight, colour, ground); squint test
  (area × luminance distance from the page ground, board rolled up as one object); grayscale
  pass; copy-stripped pass; independent WCAG contrast computation with alpha compositing;
  axe-core 4 full ruleset; `elementFromPoint` hit tests; tab-order and focus-ring walk;
  reduced-motion context.
* **Held afterwards by:** `tests/layout/the-control-that-records-a-decision.layout.test.ts` (7
  assertions, 2 phone widths) and `tests/layout/what-the-eye-ranks-first.layout.test.ts` (10
  assertions across 4 states, two of which are reached by committing a real decision).

## 8. Verification — every command actually run

```
npm ci                                        clean
npm run check          (tsc --noEmit)         clean
npm run build                                 clean
npm test                                      256 files, 2885 passed, 26 skipped, 0 failed
npm run gates                                 27 gates: 27 pass, 0 fail, 0 not-measured
npm run gates:controls                        27 gates: 0 pass, 27 fail -- "All implemented
                                              controls went red", which is the pass condition
npm run bundle:budget                         entry raw 677.0/678, gzip 210.9/211,
                                              initial raw 759.7/761 -- within budget
npm run verify                                the whole chain above, green
npx vitest run tests/layout/axe-on-the-built-app.layout.test.ts   3 passed, 0 violations
```

**Bundle.** `index.css` grew 83,271 → 84,638 bytes (+1,367), all of it the 142 gap declarations
becoming `var(--sN)` plus the six that define them; minification strips the comments. Gzipped —
the number a user actually downloads — moved 210.8 → 210.9 kB, because 142 references to six
strings is what a compressor is for. `INITIAL_RAW_KB` 759 → 761, raised in this commit with the
measurement and the reason recorded beside it, as `check_bundle_budget.ts` requires.

## 9. Remaining P2 — not hidden

| id | what | why not now |
| --- | --- | --- |
| P2-1 | `.move-timeline` is the third-strongest mass on `DECIDE` (11,349) with one move on the board | it is behind the board and the panel; changing it is a layout decision, not a hierarchy defect |
| P2-2 | four `.icon-control`s at equal weight in the header, three of them diagnostics | one of them is a diagnostic that must stay findable when the thing is broken; which of the four earns the weight is a product call |
| P2-3 | the toolbox reserves a full column for two items at `REVEAL` | the track is state-derived and correct; the *contents* are a product question |
| P2-4 | `EXPLORE` was not separately tuned | it inherits the scale and spacing and is legitimately dense; §22 says do not flatten it, and what its structure should be is more than a visual pass |
| P2-5 | `.reveal-secondary` repeats `Stockfish 18 מקומי · עומק 14` on four metric rows | inside a collapsed disclosure; LAW 6 puts instrumentation there and `GATE-SAID-ONCE` already watches repeated row sentences |
| P2-6 | ~560px of empty column under the counterfactual question | filling it would mean adding something to a pre-commit screen, which is the opposite of this work |
| P2-7 | five card languages became two, not one | the second is the *raised* variant, and it is doing real work |
| P2-8 | `.required-mark` still renders on answered steps | its behaviour is documented and tested ("what is required has to be knowable before the click"); removing a tested behaviour for a small salience gain is not this task's call |

## 10. FIELD-REQUIRED

Questions that cannot honestly be settled further without watching real people.

1. **Does the front door need a product identity?** `/` has no header, no brand, no way back —
   `/play` has all three. It is the clearest remaining coherence gap and it was deliberately not
   closed: the front door is the acquisition funnel's first stage, so changing it changes a
   measured conversion, and *whether* a brand mark helps or intrudes on a cold arrival is exactly
   a field question.
2. **May one hue mean both "press this" and "you chose this"?** `--blue` is the primary action and
   the selected state of a source toggle and a read chip. This repository already refused the
   analogous collision on the board (`--chosen` exists so one mark cannot mean both the player's
   guess and the engine's answer). Splitting it would touch the instrument's own chips, whose
   contrast was measured where they are. Two defensible designs; repository evidence cannot pick.
3. **Is `--panel-body: 14px` right, or merely better than 12?** The re-spacing is defensible from
   the ranking argument and from Hebrew letterform legibility. Which absolute size is right for
   this audience on their devices is a reading question.
4. **Do the internal state labels help?** `DECIDE` / `REVEAL` over the board, `החלטה` over the
   panel. They were left alone: they may be orientation or they may be architecture talking about
   itself, and §23 says do not guess.
5. **Does the ribbon's loop sentence belong on `DECIDE` at all?** Its weight was lowered; its
   presence is permitted by `MODE_CONTRACT` and was not touched. Whether a returning player reads
   it as orientation or as noise is a field question.
6. **Which path should lead on an empty front door** — connect an account, or take a position from
   the shared set? The second is the only one that works with no account, and it is currently
   second.
7. **Does `REVEAL` → `DECIDE` cause reorientation** now that the reveal has one raised surface and
   the decide screen has one filled button?
8. **Is the record page's twelve-row "what is still unclear" list legible as twelve peers**, or
   does it need grouping? They genuinely *are* twelve open bucketings; whether that reads as
   information or as a wall is not answerable from the repository.
9. **Is the palette liked?** Added after the owner's review of the merged PR, because §A's first
   draft answered this by assuming it. Everything measured here is `Simplicity` and
   `Craftsmanship` — order, ranking, one card language, one spacing scale. `Colorfulness` is a
   separate VisAWI facet, and nothing in this pass measured it: no hue moved, so there is not even
   a before-and-after to compare. A palette can be tokenised, contrast-compliant, theme-complete
   and still not pleasant, and no browser can tell us which.
10. **Is there simply too much on these screens?** Also added after review. This pass measured that
    the information was badly *ranked* and fixed that; it never measured whether the quantity is
    right. The residual is in §9's P2 list — the timeline's mass on `DECIDE`, the ribbon, four
    header controls at one weight, `EXPLORE` untuned — and every one of them is a question about
    how much, not about order.

## 11. Pre-field DOD verdict

### The verdict this section first recorded was wrong, and the way it was wrong is the point

It read `PRE-FIELD VISUAL DOD: PASS`, over a checklist of five rows — mechanical, hierarchy,
system, evidence, verification. **§41's owner-acceptance gate was not one of the five.** It was not
failed, or deferred, or noted as outstanding: it was absent, and its absence let four green rows
and a sixth that could not be self-assessed add up to a pass.

That is a scoring error of exactly the kind this repository's gates exist to prevent — a check
that reports green having never run. `tests/layout/browser.ts` refuses to skip for this reason and
says so: *"a test that passes because it did not run is the exact failure the product is about."*
A DOD that omits its one non-automatable gate is that failure in a document instead of a suite.

**It is also a gate no amount of the other rows can pay for.** 2,886 passing tests, 27 gates and a
clean axe run are evidence about mechanics and hierarchy. §41 asks a different question — *is the
owner willing for this to represent the product* — and it is non-compensatory by construction:
the whole reason it exists is that everything else can be green on a screen somebody still rejects.

### The accurate status

| | |
| --- | --- |
| Interaction mechanics | **PASS** |
| Visual hierarchy engineering | **PASS** |
| Visual owner acceptance | **PENDING** — §41, not yet performed |
| Evidence/UI reconciliation | **FAIL** — see §13 |
| Real-user validation | **NOT STARTED** |

```
PRE-FIELD VISUAL DOD: PENDING OWNER + EVIDENCE RECONCILIATION
```

The engineering half stands and is unchanged by this correction: no known repo-solvable or
browser-solvable P0/P1 remains in the visual work, and everything left of it is P2 (§9) or
FIELD-REQUIRED (§10). What changed is the arithmetic — that half was never the whole verdict.

**What would move each of the two open rows.** Owner acceptance: the owner opens the built app at
`ARRIVE`, `DECIDE` and `REVEAL` **before reading this document**, and answers one question — is
this still experienced as ugly or cluttered, or has the feeling changed. Reading the audit first
contaminates the answer, which is the whole value of it. If the answer is still *ugly*, that
reaction is **new data** and the next investigation is derived from it rather than from more
literature. Evidence reconciliation: §13.

## 12. Stop condition

**Further visual research-driven development is done, and that is narrower than "the work is
done".** No article, competitor or design pattern justifies another pass over these screens;
reasoning harder will not shorten §10, and it will not answer §41 either.

What remains is not research. It is one person looking, and one contradiction to resolve — and
neither is reached by continuing to reason about CSS.

## 13. The contradiction this pass lowered the volume on instead of resolving

**Found by the owner in review of the merged PR, verified here against the tree, and it is not a
visual finding.** It is the reason the row above reads FAIL rather than PENDING.

`docs/decisions/D25-evidence-architecture.md` opens with its verdict and its status line:

```
# CONSTRUCT-UNDERIDENTIFIED
Evidence level: E1 reached, E2 attempted and not reached.
Humans measured: 0. Production behaviour changed: none.
```

And `client/src/lib/features.ts`, in its entirety:

```ts
export const VERIFIED_LEARNING_ENABLED = import.meta.env.VITE_VERIFIED_LEARNING_ENABLED !== "false";
```

`!== "false"` means **on unless explicitly switched off**. It gates `<LearningRuleComposer>` after
every reveal in `Home.tsx` and a section of `RecordExplorer`, and `docs/VERIFIED_LEARNING.md` says
so in as many words: *"The feature is enabled by default."*

**So the product ships a surface named `VERIFIED` by default, on top of a construct its own
governing decision records as underidentified, with E2 not reached and zero humans measured.**

Three things make this worse than a naming quibble:

1. **`features.ts` is a one-line file with no comment.** In a repository where a `gap` value
   carries a fifteen-line paragraph and a colour token carries its measured contrast ratio, the
   single line that decides whether a surface called VERIFIED reaches every user is the least
   explained line in the tree. Nothing anywhere argues for the default; only how to turn it off.
2. **D25's own status line may be describing an omission rather than a state of rest.**
   *"Production behaviour changed: none"* reads as a careful refusal to act on a finding. But
   production behaviour was *already* shipping the learning surface on by default before D25
   reached its verdict, so leaving it unchanged is not neutrality — it is the stronger claim
   continuing to ship while the weaker one is written down.
3. **This visual pass touched it and made it quieter.** The rule composer's invite was de-ranked
   from `--panel-title` to `--panel-data` (§7) because it was sitting at the same heading rank as
   the reveal's own three sections. That was correct as typography and it is **not** a resolution:
   §27 of the brief asks that experimental surfaces not be drawn as more verified than the
   evidence supports, and lowering a heading by one step does not address a constant named
   `VERIFIED` that is on for everyone.

**Why it was not fixed in this pass.** Flipping that default changes what every user sees, and
§47 of the brief lists *"change learning validity"* as a non-goal — deliberately, since the visual
work was not supposed to become a licence to re-decide the instrument. Recording it as a blocker
is inside this document's remit; flipping it is a product decision and belongs to whoever owns
D25's consequences.

**What resolving it requires**, and the choice is genuinely open: whether the surface becomes
opt-in and stays named as it is, whether it keeps its default and is renamed to something the
evidence supports, or whether both. Those are different products, not different CSS. What is not
open is shipping `VERIFIED`, on by default, over `CONSTRUCT-UNDERIDENTIFIED`.
