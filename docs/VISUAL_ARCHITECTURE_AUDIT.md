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

**It is not colour.** The palette is tokenised, both themes are declared, and every colour pair in
the loop carries a measured contrast ratio in a comment beside it. Replacing it would change
nothing about the report.

**It is not component count either.** The screens the owner objects to hold roughly what their
mode contract says they may hold.

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
find the task by reading rather than by looking. That is precisely the shape of "there is too much
information" and "the next action is not obvious": the information is not excessive, it is
*unranked*.

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
* **`REVEAL`** — contract: *the one thing this decision showed*. `.reveal-one-thing` renders at
  **36,352px²**; `.reveal-limits`, the block that exists to withhold claims, renders at
  **57,539px²**. All three blocks carry an identical 1px hairline, an identical 12px radius and
  an identical 12px heading. The separation between "what this showed" and "what this cannot say"
  is one pixel of type size and 0.2 of opacity.
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
| `REVEAL` | read what the decision showed | **the one thing this decision showed** | the caveat block (57,539 vs 36,352) | three identical cards; toolbox column returns for two items | 12px headings on 12px bodies | three blocks, one visual treatment | order is right and documented; weight contradicts it | **P1** |
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

### P1-1 — `REVEAL` gives its central object less weight than its caveat

```
ID:            P1-1
State:         REVEAL
Evidence:      .reveal-limits 57,539px^2 / .reveal-one-thing 36,352px^2. Identical border, radius
               and 12px heading on all three blocks
Mechanism:     the DOM order is a documented epistemic decision ("not negotiable", D25). Weight
               was never separated from it, so first-in-order became largest-on-screen
Impact:        MODE_CONTRACT.REVEAL names "the one thing this decision showed" central; it is not
Class:         A
Intervention:  keep the order exactly; give the one-thing block a surface and a real type step;
               keep the limits first, legible, and quiet
Invariant:     limits stay FIRST and fully legible; the evaluation number stays inside the
               collapsed <details>; no epistemic claim strengthens
Wrong if:      quieting the limits reads as hiding them
Falsify:       measure both blocks' contrast after the change -- the limits must not lose AA; and
               check the ordering assertion in the reveal tests still holds
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
