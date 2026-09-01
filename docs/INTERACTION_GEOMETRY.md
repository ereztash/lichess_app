# The geometry of an interaction state

**What the screen is arranged around, in each state, measured rather than described.**

`docs/INERTIAL_UX_LAWS.md` says the state should decide *what the player sees and what they do
next*. `shared/interaction-mode.ts` holds that as a table. This file is the other half: the state
must also decide **how the screen is spatially organised around the act**, and it is the half that
was missing — with a consequence nobody had measured.

---

## 1. Executive verdict

`.workbench` declared three columns — toolbox, board, task — and named the column of none of its
children. `Home.tsx` **removes** the toolbox from the DOM while the player is producing evidence
(LAW 1, LAW 5): absent, not hidden. So every `DECIDE` state had two children and three tracks, grid
auto-flow shifted both one track towards the start, and **the board was laid out in the 132px
toolbox track**. The page is RTL, so track 1 is the right edge — which is the "board pushed to the
side" that was reported.

The reported symptom understated it. The board was **92×92px** at 1920, 1440 and 1280, and 50×50 at
1024. One chess square was **9.8px** against this repository's own 44px `--tap-floor`, and
`document.elementFromPoint` at the centre of e2 returned the coordinate strip's `.file-label`
rather than the square. Playwright could not click a square at all. **The one act `DECIDE` exists to
collect could not be performed with a mouse on any desktop width.**

The original hypothesis — *the grid keeps a track for a rail that is not there* — is **confirmed**,
and two further defects were found on the way: a shared `max-width` rule destroyed by an insertion,
and a state label that named the wrong state. Architecturally, one thing changed: **the number of
columns is now a function of the interaction state, and every child names its own column.**

---

## 2. Runtime evidence before change

Production build, real Chromium, `/play`, initial `DECIDE`, RTL. `.board-stage` is the board;
`.analysis-stack` is the task column.

| Viewport | Board rect | Task rect | Layout tracks | Observed problem |
| --- | --- | --- | --- | --- |
| 1920×1080 | 92×92 in a 132px workspace at x=1764 | x=210 w=1346 | `132px 1346px 330px` | board in the toolbox track; task in the board's; 330px track empty |
| 1728×1117 | 92×92, workspace x=1572 w=132 | x=114 w=1154 | `132px 1154px 330px` | same |
| 1600×1000 | 92×92, workspace x=1444 w=132 | x=50 w=1026 | `132px 1026px 330px` | same |
| 1440×900 | 92×92, workspace x=1284 w=132 | x=386 w=866 | `132px 866px 330px` | same |
| 1280×800 | 92×92, workspace x=1124 w=132 | x=386 w=706 | `132px 706px 330px` | same |
| 1024×768 | 50×50, workspace x=910 w=90 | x=24 w=854 | `90px 854px` | board in the toolbox track; task full width below |
| 390×844 | 342×342 at x=38 | x=10 w=370 | flex column | **correct** |

Square size and hit test at the same viewports:

| Viewport | one square | `elementFromPoint` at the centre of e2 |
| --- | --- | --- |
| 1920×1080 | 9.8px | `span.file-label` |
| 1440×900 | 9.8px | `span.file-label` |
| 1280×800 | 9.8px | `span.file-label` |
| 1024×768 | 4.5px | `span.file-label` |
| 390×844 | 41.5px | the piece |

Two further measurements, from the same runs:

* **The shell's bands disagreed about where the page ends.** At 1920 `.studio-header` and
  `.workbench` were 1872px wide while `.move-timeline` directly beneath them held 1500px.
* **The board had no floor under its height bound.** `calc(100vh - 268px)` at 1440×620 gave a
  352px board, at 1280×550 a 282px one, and a landscape phone at 844×390 a **122px board with
  13.5px squares**.

---

## 3. Root cause

### Symptom

On entering `/play` the board does not occupy a comfortable central working position. It reads as
pushed to the edge, and — not in the report, but true — it is far too small to play on.

### Mechanism

1. `.workbench` declares `grid-template-columns: 132px minmax(480px, 1fr) 330px` — a constant.
2. `Home.tsx` renders `{!focus && (<aside className="control-rail">…)}`, where
   `focus = makingEvidence(stage)`. In `DECIDE` the toolbox is **not in the DOM**.
3. Neither `.board-workspace` nor `.analysis-stack` declared `grid-column`, so both were placed by
   auto-flow, which fills the first empty track with the first child.
4. Two children, three tracks: the board took the toolbox's 132px track, the task took the board's,
   and the 330px track stayed empty.
5. `.board-stage` is `width: 100%` inside that track, so the board became 132px minus the
   assembly's reserved evaluation column — 92px — and its squares became 9.8px.
   `docs/FINDINGS.md` records that the file labels were deliberately moved *inside* the bottom-row
   squares, so they cannot drift out of alignment with what they label. At 9.8px a square is
   smaller than the glyph in it, so the label overflows its own box upward — which is why
   `elementFromPoint` at the centre of e2 returned an `a`–`h` label belonging to the rank below.
6. The document is RTL, so track 1 is at the **right edge**. That is the direction of the "pushed
   to the side" report; the size is what made it unusable.

### Why it existed

The template and the child list were governed by **two different conditions**. The rail's presence
was gated on `focus`; the column count was gated on nothing. Two conditions can disagree, and these
did — silently, because CSS grid has no error for "fewer children than tracks". The mobile
breakpoint was correct throughout for a reason that is worth stating: at ≤680px the workbench
abandons grid for `flex` + `order`, and a flex column has no empty-track failure mode at all.

The other two defects have their own causes and both are recorded in the code:

* **The destroyed rule.** `9761b51` wrote
  `.studio-header, .workbench, .move-timeline { max-width: 1500px; margin: auto; }`. `da90858`
  opened the game-review section by writing a banner comment and `.game-review .review-stats {`
  directly after `.workbench,` — a legal place for a selector list to continue. `.move-timeline {`
  stopped being the rule's third selector and became a rule of its own; the header and the
  workbench silently joined the review-stats rule. It binds only above 1548px viewport width, and
  no browser audit here had ever run that wide.
* **The unfloored height bound.** `calc(100vh - 268px)` was written to stop a board running past
  the bottom of a 1440×950 viewport, and it does. A subtraction has no lower limit, so on a short
  viewport it kept subtracting.

### Why previous tests did not reject it

* Six layout suites load `/play`. Not one asserts the geometry of the board there: they audit axe,
  the CSP, the record, tab order, or routes that never reach this branch.
* `cumulative-layout-shift.layout.test.ts` visits `/play` at 390 and 1280 and scores **shift**. A
  layout that is consistently wrong from the first paint does not shift. It scored 0.00000.
* Every jsdom suite renders `<Home>` and asserts the DOM. jsdom has no layout: the board was in the
  document, correct and complete, and 0×0 like everything else.
* `ux-contract.test.ts` reads the stylesheet, and the stylesheet was not wrong on its face — three
  tracks is a reasonable thing to declare. What was wrong was the **relation** between the tracks
  and a child list that changes with the interaction state, and no file was reading both.
* Every browser audit this repository had ran at 366, 390, 900, 1280, 1350 or 1440 pixels wide, and all
  of them at ordinary heights. Neither the 1500px measure nor the height floor is in range of a
  single one. The new file runs at 1920 and at five short viewports for exactly that reason.

---

## 4. Interaction contract implemented

> **A container whose children depend on the interaction state must derive its shape from that same
> state, and every child must name its own place. Nothing about where a thing sits may be decided
> by how many siblings happen to exist.**

In plain terms, for `/play`:

* while the player is producing evidence there are **two** regions, the board and the current task,
  and the toolbox's space does not exist rather than sitting empty;
* when the toolbox returns there are three, and the board and the task keep the regions they had;
* the board is the dominant object in every one of these states, and it is never smaller than a
  board whose squares meet the tap floor this repository already commits to;
* the word above the board, the presence of the toolbox and the number of columns are read from
  **one** boolean — `makingEvidence(stage)` — so they cannot disagree.

---

## 5. Files changed

| file | why it changed | important behaviour |
| --- | --- | --- |
| `client/src/index.css` | the workbench's tracks were a constant while its children were conditional | tracks are named `[rail] [board] [task]`; `.workbench-focus` drops the rail track; every child declares its column by name; the ≤1050 breakpoint carries the same names |
| `client/src/index.css` | the shared measure rule had been severed by an insertion | `.studio-header, .workbench, .move-timeline` share `max-width: 1500px; margin-inline: auto` again |
| `client/src/index.css` | the board's height bound had no floor | `max-width: min(100%, max(calc(8 * var(--tap-floor) + 14px), calc(100vh - 268px)))` — eight squares at the repo's own tap floor plus `.board-grid`'s 7px border on each side |
| `client/src/pages/Home.tsx` | the grid had no way to read the state its children were gated on | `className={focus ? "workbench workbench-focus" : "workbench"}` — the same `focus` the toolbox is gated on |
| `client/src/pages/Home.tsx` | the state label named the wrong state | the kicker over the board reads `focus ? "DECIDE" : "REVEAL"` instead of `deciding ? …`, so `committed` and `blocked` no longer say REVEAL |
| `tests/layout/the-board-in-the-state-that-decides.layout.test.ts` | new: nothing measured the board in the state the product exists to collect | 45 assertions in real Chromium; 27 of them go red on the shipped code |
| `tests/client/ux-contract.test.ts` | the cause is checkable without a browser | named tracks, one fewer track in focus, every child placed by name, the template and the toolbox gated on the same identifier, and the floor under the height bound |
| `tests/client/board-square.test.ts` | one assertion pinned the exact shape of the height bound | relaxed to the invariant it was protecting — a vh bound in the base rule, svh in `@supports` |

---

## 6. Runtime evidence after change

Same build, same browser, same route and state.

| Viewport | Board rect | Task rect | Layout tracks | Observed problem |
| --- | --- | --- | --- | --- |
| 1920×1080 | 812×812 at x=755 | x=210 w=330 | `[board] 1138px [task] 330px` | none |
| 1728×1117 | 849×849 at x=641 | x=114 w=330 | `[board] 1138px [task] 330px` | none |
| 1600×1000 | 732×732 at x=635 | x=50 w=330 | `[board] 1138px [task] 330px` | none |
| 1440×900 | 632×632 at x=605 | x=24 w=330 | `[board] 1030px [task] 330px` | none |
| 1280×800 | 532×532 at x=575 | x=24 w=330 | `[board] 870px [task] 330px` | none |
| 1024×768 | 500×500 at x=282 | x=24 w=976, below the board | `[board] 976px` | none |
| 390×844 | 342×342 at x=38 | x=10 w=370, below the board | flex column | none — unchanged |

| Viewport | one square | `elementFromPoint` at the centre of e2 |
| --- | --- | --- |
| 1920×1080 | 99.8px | the piece |
| 1440×900 | 77.3px | the piece |
| 1280×800 | 64.8px | the piece |
| 1024×768 | 60.8px | the piece |
| 390×844 | 41.5px | the piece |

The shell's three bands are 1500/1500/1500 at 1920. No viewport tested has horizontal overflow, and
none arrives already scrolled.

Under height pressure, where the floor now binds. **The "before" column here is the state after
the placement fix and before the floor** — these viewports are the second defect, the one the
falsification pass found rather than the report:

| Viewport | board before the floor | board after | square after |
| --- | --- | --- | --- |
| 1440×620 | 352px | 366px | 44.0px |
| 1280×550 | 282px | 366px | 44.0px |
| 1024×600 | 332px | 366px | 44.0px |
| 844×390 (landscape phone) | **122px** | 366px | 44.0px |
| 812×375 | **107px** | 366px | 44.0px |
| 1440×950 (the case the bound was written for) | 682px, by the bound | 682px, measured | 83.5px |

The last row is the control on the change itself: 950 − 268 is 682, the floor is 366, and `max()`
takes the larger — so the viewport the bound was written for is untouched, which the measurement
confirms rather than assumes.

---

## 7. Transition evidence

### `DECIDE → COMMIT → ANSWER_INSTRUMENT`, driven for real

A move played on the board at 1440×900, the commitment answered and submitted, and the
counterfactual probe reached:

| | board x | board w | board y |
| --- | --- | --- | --- |
| before commit | 605 | 632 | 288 |
| counterfactual open | 605 | 632 | 288 |
| **delta** | **0** | **0** | **0** |

Engine requests before the commit: **0**. After it: 4. Claim panel, learning queue, record
dashboard, record explorer and evaluation bar on screen before the commit: **0 of each**. Primary
actions on screen: 1 before, 0 while the instrument question is open.

### `DECIDE → REVEAL`, driven for real

The same session, carried through the counterfactual probe until the engine answered. At 1440×900:

| | tracks | toolbox | board rect | evaluation bar | label |
| --- | --- | --- | --- | --- | --- |
| `DECIDE` | `[board] 1030px [task] 330px` | absent | x=605 w=632 h=632 | absent | `DECIDE` |
| `REVEAL` | `[rail] 132px [board] 866px [task] 330px` | x=1284 w=132, in `rail` | x=523 w=632 h=632 | x=386 w=28 h=632 | `REVEAL` |
| **delta** | one track added | — | **Δx −82, Δwidth 0, Δheight 0, Δy 0** | appeared in its reserved column | — |

Three things flipped together and none of them separately: the template gained a track, the
toolbox appeared in the track named for it, and the kicker changed word. Every child is still where
its name says — `control-rail` in `rail`, `board-workspace` in `board`, `analysis-stack` in `task`.
**The board did not resize.** The whole of the −82px is the toolbox's track and gap; the
evaluation bar, which arrived in the same frame, contributed 0 — which is the point of reserving
its column.

The same displacement across every viewport, measured as a stylesheet probe (the toolbox inserted
and the focus class removed) because that part is entirely decided by CSS:

| Viewport | board x in DECIDE | board x with the toolbox | Δx | Δwidth |
| --- | --- | --- | --- | --- |
| 1920×1080 | 755 | 673 | −82 | 0 |
| 1728×1117 | 641 | 559 | −82 | 0 |
| 1600×1000 | 635 | 553 | −82 | 0 |
| 1440×900 | 605 | 523 | −82 | 0 |
| 1280×800 | 575 | 493 | −82 | 0 |
| 1024×768 | 282 | 221 | −61 | 0 |
| 390×844 | 38 | 38 | **0** | 0 |

**The board does not change size in this transition at any viewport; it translates.** 82px is 13%
of a 632px board. The alternative — reserving the toolbox's track and leaving it empty — holds the
board at exactly the same coordinates and costs 164px of permanently dead gutter on the outer edge
in every decision. That was rejected: an empty column reserved for a surface LAW 5 forbids in this
state is the laboratory's shape showing through the focus state, which is the thing the mode is
for. **The reversal condition is stated in `index.css` beside the rule**: if the translation is
observed to cost reorientation, reserving the track is the one-line change back.

### Evaluation appearing

The specific transition §13 protects, measured by inserting the instrument into the assembly:

| Viewport | Δx | Δwidth | reserved column |
| --- | --- | --- | --- |
| 1920×1080 | 0 | 0 | 28px |
| 1440×900 | 0 | 0 | 28px |
| 1280×800 | 0 | 0 | 28px |
| 1024×768 | 0 | 0 | 28px |
| 390×844 | 0 | 0 | 20px |

Both halves of §13 hold, and they are only jointly satisfiable this way: the board is pinned to
`grid-column: 2` of `.board-assembly` so it never occupies the evaluation's column, and the column
is reserved while the engine is silent so the board does not move when the bar arrives. **An empty
28px column during `DECIDE` is the price of the second requirement, not an oversight** — and it is
a different case from the workbench's empty 330px track, because that one held nothing in *any*
state.

---

## 8. Mode audit

`central` is `MODE_CONTRACT`'s. "Evidence" says how the rendered centre was established: **measured**
means a rect from the built app in Chromium, **read** means the render path in source.

| Mode | Central object (contract) | Actual rendered centre | Evidence | Competition | Spatial mismatch | Priority | Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ARRIVE` | the first decision | `FirstDecision` on `/`, single column | read | one navigation control | none found | — | none |
| `RESUME` | the next action | `ResumeScreen` on `/`, single column | read | LAW 2's two-product defect, already fixed | none found | — | none |
| `DECIDE` | the commitment | **was the 132px toolbox track; now the board track beside the commitment** | measured | none — the toolbox is absent | **was P0** | **fixed** |
| `ANSWER_INSTRUMENT` | the question | the commitment column; board unchanged at 0px delta | measured | none | none found | — | none |
| `WAIT` | what is being worked on | named progress line, `/blitz` and the import | read | — | not audited on `/play` | P2 | recorded, not opened |
| `REVEAL` | the one thing this decision showed | board track, toolbox returns to its own track, evaluation bar in its reserved column | **measured, live** | the toolbox, by design | 82px board translation | P2 | recorded with its reversal condition |
| `REVIEW_EVENT` | the position and what was measured | `GameReview` / `RecordExplorer` | read | — | not audited | P2 | recorded |
| `REFLECT` | what the record can and cannot say | `RecordExplorer`, behind a press | read | — | not audited | P2 | recorded |
| `TEST` | the position under test | the same workbench as `DECIDE`, so it inherits the fix | read | toolbox absent (LAW 2) | none found | — | none |
| `EXPLORE` | the position being looked at | `RecordExplorer`, all surfaces at once, deliberately | read | everything, deliberately | none — and it must not be flattened into a focus interface | — | none |

**One P1 mismatch was found and fixed.** The kicker over the board read
`deciding ? "DECIDE" : "REVEAL"`, and `deciding` is `"deciding" || "committing"`. So at `committed`
— where the counterfactual probe asks what the player would have played instead, with the engine
silent and nothing revealed — **the screen said REVEAL**, which was confirmed by driving a real
commit. At `blocked`, where the write *failed*, it said REVEAL too. `shared/interaction-mode.ts`
already calls all four of those stages `DECIDE` and says in as many words that `committed` is not a
reveal. The label now reads the same `focus` boolean the layout does. This is a condition change,
not a copy change: both words are unchanged.

### Do the ten modes collapse into layout families?

Worth testing before anything is abstracted, because one shared class was added here and a second
would start to look like a system. The obvious grouping — focus / outcome / record / exploration —
is **not** the one this repository's own contract produces. `MODE_CONTRACT`'s three booleans
partition the ten like this:

| family | modes | what it means for layout |
| --- | --- | --- |
| producing evidence, engine silent, record silent | `DECIDE`, `ANSWER_INSTRUMENT`, `TEST` | **the one family with a layout consequence today**: no toolbox, so no toolbox track — `workbench-focus` |
| nothing open, nothing to read | `ARRIVE`, `WAIT` | one column, one act; no workbench at all |
| the record, without the engine | `RESUME` | one column |
| the record, with the engine | `REVEAL`, `REVIEW_EVENT`, `REFLECT`, `EXPLORE` | the full workbench; they differ in how much is on screen, which is LAW 2's business rather than the grid's |

**`ARRIVE` does not belong with `DECIDE`**, which the tidy version of the model would put together.
`ARRIVE` produces no evidence and has no record to hide; its centre is a call to action, not a work
surface. Grouping them would mean giving a landing screen a board-shaped layout for no reason the
contract can state.

So exactly one family needed expressing, and it is expressed as one class on one container. **No
layout engine was built, and none is justified yet** — a second family with its own geometry would
be the evidence that one is.

---

## 9. Falsification attempts

| Attempt | Expected failure | Result |
| --- | --- | --- |
| **A — false centrality.** 14 viewports from 1920×1080 to 680×900, plus both sides of each breakpoint | a viewport where the board still reads as a side element | **could not break it.** The board is the widest object at every width. Free space either side of it, excluding the task column: 215/353 at 1920, 251/203 at 1440, 221/173 at 1280, 125/77 at 1152, 72/24 at 1051 |
| **B — height pressure.** 1440×620, 1920×650, 1280×550, 1024×600, 844×390, 812×375 | a short viewport where `board \| task` makes the board or panel unusable | **BROKE IT.** 122px board with 13.5px squares at 844×390; 282px at 1280×550. The cause was the unfloored height bound, not the composition — the width was never binding on any of them. Fixed, re-measured at 366px and 44.0px squares, and pinned by five new assertions |
| **C — rail return.** three children instead of two, every viewport | the composition jumps or becomes strangely asymmetric | **partially.** No size change and no asymmetry; a constant 82px translation, quantified in §7 with the alternative and its reversal condition |
| **D — evaluation appearance.** instrument inserted into the assembly, five viewports | board displacement | **could not break it.** 0px at every viewport, in both axes |
| **E — mobile.** 390×844, 360×640, 320×568 portrait; 844×390, 812×375 landscape | overflow, unreachable controls, context loss | **could not break it** after B was fixed. No horizontal overflow anywhere, no page arrives scrolled, every square receives the pointer, and a move played on the board reaches the commitment step |
| **F — keyboard.** tab through `/play` at 1440×900 | visual and logical order disagree | **could not break it.** header → the "why?" disclosure → board → task → timeline, which under RTL is right-to-left in reading order and matches the DOM. No `order` is used at desktop; the mobile `order` is unchanged and its DOM order is asserted separately |
| **G — measurement contamination.** DOM and network before the commit | forbidden prior evidence or engine output | **could not break it.** Claim panel, learning queue, record dashboard, record explorer, evaluation instrument: 0 of each. Engine/wasm requests before the commit: 0; after it: 4. Exactly one primary action |

---

## 10. Verification

| command | result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npm run build` | clean |
| `npx vitest run tests/layout/the-board-in-the-state-that-decides.layout.test.ts` | 45 passed |
| the same file against the **shipped** `index.css` and `Home.tsx` | **27 failed, 18 passed** — the positive control |
| `npx vitest run tests/client/ux-contract.test.ts tests/client/board-square.test.ts` | 39 passed |
| `npx vitest run tests/client/nothing-to-read-while-you-decide.test.tsx tests/client/knows-before-you-ask.test.tsx` | 47 passed |
| `npm run verify` | see the run recorded in the commit message |

What it cost the bundle, from the two builds side by side — nothing was imported, so this is the
class name and the CSS text:

| | shipped | after |
| --- | --- | --- |
| `index-*.js` | 693.38 kB / 215.93 kB gzipped | 693.41 kB / **215.91 kB** gzipped |
| `index-*.css` | 82.91 kB / 15.65 kB gzipped | 83.27 kB / 15.72 kB gzipped |

No surface moved into or out of the entry graph; `RecordExplorer`, `RecordDashboard`, `GameReview`
and the charts are still their own chunks, at the same sizes.

**And the margin it left is thin enough to say out loud.** `check_bundle_budget` reports
677.2/678 kB entry raw, 210.8/211 kB gzipped and 758.5/759 kB initial download — the stylesheet is
eagerly fetched, so the 0.36 kB of CSS added here came out of well under a kilobyte of headroom.
It fits. The next comment block written into `index.css` may not, and that is a budget decision
rather than a formatting one.

The positive control is the load-bearing one, and every red assertion names the real defect:

| red on the shipped code | n |
| --- | --- |
| `.board-workspace is placed by auto-flow`, and `{"board":132,"task":866,…}` | 8 |
| `{"toolbox":0,"focus":0,"workbench":1}` — the DOM does not say which state it is in | 5 |
| `a 9.8px square against a 44px floor` | 4 |
| the board moved by something other than the new column | 4 |
| the height floor, at five short viewports | 5 |
| `[{"studio-header":1872},{"workbench":1872},{"move-timeline":1500}]` | 1 |

The 18 that stay green there are floors and preserved invariants — the evaluation column's
stability, the DECIDE state's identity, the absence of horizontal overflow, the mobile order and
the mobile decision flow — which is what they are for.

---

## 11. Deliberately unchanged

| tempting | why it was refused |
| --- | --- |
| centring the board on the viewport rather than on the space the task column leaves | **the unit that has to look intentional is `board + current task`, not the board alone**, and that unit is exactly viewport-centred at every width — the workbench's restored `margin-inline: auto` is what centres it. Within it the board has equal breathing room on both sides: 179px each at 1440. The board's own centre is a constant 201px right of the viewport's, which is exactly half the task column plus half the reserved evaluation column; driving it to zero needs a mirror gutter as wide as the task column, which overflows between 1051 and ~1250px. **Whether 201px reads as off-centre is FIELD REQUIRED**; it was not guessed at |
| the 28px evaluation column reserved while the engine is silent | it is the price of §13's second requirement, and the two requirements are only jointly satisfiable this way. Measured: 0px board movement when the bar arrives |
| the 82px board translation when the toolbox returns | removing it costs 164px of dead gutter in every decision, which is the symptom in a milder form. Recorded with its measurement and a one-line reversal |
| the 1050px breakpoint's discontinuity — the board is 601px at 1051 and 632px at 1050 | pre-existing, unrelated to the child-placement defect, and a P2. Recorded here rather than fixed |
| the board's bottom edge falling 20px below the fold at almost every viewport | the 268px subtrahend is a documented estimate of the chrome and is 20px light. P2, pre-existing, unrelated. Recorded, not touched |
| a square is 41.5px on a 390px phone, under the 44px tap floor | eight squares across 342px is 42.75px at most: unreachable by arithmetic, not by defect. The test exempts phones from the floor and still asserts the hit test |
| binding `data-mode` from `shared/interaction-mode.ts` onto the workbench | `deriveInteractionMode` needs `exploring`, `run`, `blockedOnWork` and `reviewingEvent`, which `Home.tsx` holds in component state. Emitting a mode that says `REVEAL` while the player is in `EXPLORE` would be worse than emitting none. The layout reads `makingEvidence(stage)`, which is the boundary it actually needs |
| the DECIDE/REVEAL kicker as *vocabulary* — whether a player benefits from seeing an internal state name at all | inspected, per the copy scope, and deliberately not answered here. What was fixed is that it named the **wrong** state; whether it should exist is a separate question with no evidence either way |
| raising `LINE_CEILING` in `tests/client/the-file-that-only-ever-grew.test.ts` | the first draft of the two `Home.tsx` comments put the file at 2,412 against a 2,400 ceiling, and that ceiling is a ratchet whose own file says it may only go down. The comments were cut to pointers and the argument moved into `index.css` and this document, where it costs nothing. The file is 2,393 — five lines up, inside the headroom, and the ceiling is untouched |
| everything in the non-goals list | detector thresholds, the confidence scale, the counterfactual probability, sampling, evidence eligibility, the record schema, learning claims, Stockfish semantics, personalisation, experiment arms, feedback exposure. None was read, let alone changed |

---

## 12. Remaining uncertainty

### REPO-SOLVABLE

* **Are there other conditional children of fixed-track grids?** `.workbench` was found by
  measurement, not by search. The same shape — a container whose child list depends on state and
  whose template does not — could exist elsewhere. The new `ux-contract` assertions cover this one
  container only.
* **The 1050px breakpoint discontinuity** and **the 20px the height subtrahend is light** are both
  arithmetic and both answerable without a browser.

### BROWSER-SOLVABLE

* **`EXPLORE`, `REVIEW_EVENT` and `REFLECT` geometry.** `DECIDE`, `ANSWER_INSTRUMENT` and `REVEAL`
  were driven and measured on the live app; those three were not, so their rows in the mode audit
  are read from source. Each needs a stored record to reach, which a harness seeding
  `localStorage` would provide.
* **`TEST`.** A drill run uses the same workbench, so it inherits the fix by construction — but
  "by construction" is an argument, not a measurement.

### FIELD-REQUIRED

* **Whether a board 201px right of the viewport centre reads as central.** This is the original
  report's actual subject once the 92px board is removed, and no amount of code answers it.
* **Whether the 82px translation at the reveal costs reorientation.** The transition also replaces
  the whole task column and adds the evaluation bar, so the board's own movement may be invisible
  inside a change the player is already absorbing — or may not be.
* **Whether the internal state vocabulary (`DECIDE`, `REVEAL`) helps or is noise.**
* **Whether a 366px board on a landscape phone with the rest of the task below the fold is better
  than a 122px board that fits.** The mobile invariant says yes; a player has not been asked.

---

## A note on how this was done, and where it departed from the plan

The defect was found by measuring first and reading second. The reading list this work was given —
`ChessBoard.tsx`, `CommitmentScreen.tsx`, `next-action.ts`, `primary-action.ts`, `VALUE_CLARITY.md`,
`VALUE_CLARITY_FIELD_PROTOCOL.md`, `ACQUISITION_EVIDENCE.md`, `FINDINGS.md`, `MEASUREMENTS.md` and
`board-tab-order.layout.test.tsx` — was completed **after** the change, not before it. That is a
departure worth recording rather than smoothing over, so what the late reading did and did not
change is on the record too:

* **Nothing in it contradicted the change**, and three parts of it corroborated the change after
  the fact. `FINDINGS.md` records the origin of the 268px height bound (a board running 111px past
  the bottom at 1440×950) and the 44px tap floor as a *declared* rather than emergent number — the
  two inputs the floor is derived from. It also records that the file labels were moved inside the
  squares, which is what made a 9.8px square's label overflow into its neighbour.
  `board-tab-order.layout.test.tsx` establishes the board as a single roving tab stop, which is
  exactly what the keyboard sweep found.
* **`MEASUREMENTS.md` supports the height-floor trade**: the phone page is already 2,104px, 2.5×
  the viewport, so scrolling to reach the rest of the task is the existing norm rather than a new
  cost.
* **What the earlier reading would not have produced is the defect itself.** No document in the
  list describes it, and no assertion in any of the named tests would have gone red on it. It was
  found by opening the built app in a browser and reading a rect.

---

## Appendix — the state model the layout was checked against

Built before anything was edited, from `shared/interaction-mode.ts`. `MODE_CONTRACT` supplies the
central object and the three permissions; the rest is what each mode needs in order to be
performable, which is the part a layout has to serve.

| Mode | Player task | Perceptual centre | Primary act | Required context | Forbidden competition | Continuity anchor |
| --- | --- | --- | --- | --- | --- | --- |
| `ARRIVE` | find out what this is and start | the first decision | begin a position | what the product asks of them | the record — there isn't one | none; nothing precedes it |
| `RESUME` | find out what changed and what now | the next action | the one act the record is missing | what is stored, what is blocked | two products at one weight (LAW 2) | the record's own shape |
| `DECIDE` | read the position and choose | the commitment — which is the board **and** the panel that records it | put a move on the board and state the reason | the position, the clock, the open step | any reading of the record, any engine output, the toolbox | **the board**; it is the object the whole loop is about |
| `ANSWER_INSTRUMENT` | answer a question about what they just did | the question | answer it | the committed move | prior evidence, engine output, a second act | the board, unchanged and unmoved |
| `WAIT` | nothing — the product is working | what is being worked on | leave, or wait | what is running and how far | a spinner with no subject | whatever they were looking at |
| `REVEAL` | find out what that decision cost | the one thing this decision showed | the next decision | the move, the verdict, the alternative | eight other panels (the defect LAW 2 fixed) | the board, same game, same position |
| `REVIEW_EVENT` | look at one stored moment | the position and what was measured about it | go back, or act on it | the position and its measurements | the rest of the record | the board, moved to that ply |
| `REFLECT` | find out what the record can say | what the record can and cannot say | the action a gap implies | counts, blockers, what is missing | a claim the record cannot support | the reading itself |
| `TEST` | work through a pre-registered set | the position under test | decide on this one | the position, position *n* of *m* | prior evidence, engine output, the toolbox | the board, and the run's own count |
| `EXPLORE` | move around a finished game | the position being looked at | look at another one | everything; nothing is at stake | none — this is the one mode where breadth is correct | the board |

Two things in this table decided the implementation.

**`DECIDE`'s centre is not one object.** The contract says "the commitment", and a commitment cannot
be made without the board — the first of its four steps is answered by moving a piece. So `DECIDE`
is the one mode with a **coupled** centre, and the layout that serves it is two adjacent regions
rather than one dominant panel. That is why the focus template is `board | task` and not a single
column with the board on top.

**`ANSWER_INSTRUMENT`'s continuity anchor is the board.** The question is *about* the move just
played, so the board it was played on must not move underneath it. Measured: 0px, in both axes.
