# The visual baseline

What the built product looks like at `b9a228c`, measured rather than described, before anything in
this pass changed. Every number below came out of Chromium driving the production build over a
static server, the same way `tests/layout/` does; nothing was read off the stylesheet.

**Viewports:** 1440×900, 1024×768, 390×844, 844×390.
**Also captured:** dark, `prefers-reduced-motion: reduce`, `forced-colors: active`, and a 32px root
(the 200% zoom proxy the repository already uses).
**Screens reached for real:** a decision committed, a reveal presented, the record read back.

---

## The one measurement this document exists for

`MODE_CONTRACT.REVEAL.central` is *"the one thing this decision showed"*. Measured on the built app
at 1440×900, as area × luminance distance from the page ground:

| object on `REVEAL` | size | fill | ΔL | **squint mass** |
| --- | --- | --- | ---: | ---: |
| `.reveal-one-thing` — **the contract's central object** | 330×132 | `--raise` `#efe9dc` | 0.040 | **1,757** |
| `.evaluation-track` — the engine's evaluation bar | 20×596 | `--ink` `#17221f` | 0.763 | **9,100** |
| `.primary-control` — the next action, filled `--blue` | 330×44 | `--blue` `#1e5b72` | 0.688 | **9,989** |

The two heaviest objects on the screen after the board are **the machine's number** and **a button
painted in the machine's own colour**. The thing the product's own contract names central is one
fifth of either.

That is not a hierarchy defect in the sense the previous audit fixed — the *type* ranks are correct
and tested. It is the product thesis inverted in the material: on the one screen where the boundary
between what the player recorded and what the machine returned is the whole point, the machine has
the highest-contrast object, the largest saturated area, and the colour of the only thing you can
press.

---

## Colour roles as painted

50 `var(--blue)` call sites, and they carry **nine different jobs**:

| # | job | call sites (sample) |
| --- | --- | --- |
| 1 | the machine's voice on the board | `.board-vectors line`, `.board-vectors circle`, `.cloud-score` |
| 2 | **the player's own hand on the board** | `.selected-square`, `.legal-square::before` |
| 3 | primary action | `.primary-control`, `.commitment-submit`, `.drawer-confirm`, `.boundary-reload`, `.reveal-failure-next`, `.blitz-control--again`, `.import-search` |
| 4 | selection among options | `.read-chip.selected`, `.color-toggle .selected`, `.depth-row .selected`, `.review-tabs button[aria-selected]`, `.move-cell.active` |
| 5 | focus | `:focus-visible`, `.board-square:focus-visible` |
| 6 | liveness / progress | `.review-progress i`, `.loop-step.live`, `.material-track i`, `.opponent-thinking` |
| 7 | link / disclosure affordance | `.context-why summary`, `.boundary-trace summary`, `.layer-action`, `.suggestion-button`, `.personal-load`, `.context-loop-goto` |
| 8 | **evidence authority** | `.evidence-mark[data-authority="tested"]` |
| 9 | brand | `.brand-mark` |

Jobs 1 and 2 paint on the same board in the same state. Captured at `ANSWER_INSTRUMENT`: the
player's chosen square carries the gold `--chosen` ring **and** a `--blue` legal-move dot inside it.

24 `var(--warn)` call sites, carrying **four** jobs: a real failure (`.import-failure`,
`.reveal-failure`, `.self-check-row.fail`, `.layer-error`), an unfinished field (`.required-mark`),
an unfinished commitment (`.commitment-submit.not-ready`, `.commitment-summary`), and a **valid
storage mode** (`.record-mode.session-only`).

6 `var(--chosen)` call sites. The token the stylesheet's own comment calls the reason one mark
cannot mean both the player's guess and the machine's answer is used on **two squares, one marker,
one panel edge and one badge**, and nowhere else.

---

## Everything paints in one luminance band

| token | value | relative luminance |
| --- | --- | ---: |
| `--surface` | `#f7f3e9` | 0.885 |
| `--raise` | `#efe9dc` | 0.818 |
| `--paper` | `#e9e4d8` | 0.783 |
| `--chip` | `#e0d6c0` | 0.694 |

Four surface roles inside 0.19 of luminance. `--raise`, the token spent on *the object a mode
contract names central*, is 0.035 from the page it sits on. On the screenshots that reads as one
continuous beige field with hairlines drawn on it, and it is why the board — the only object in the
product with real value contrast — looks placed on the page rather than part of it. In the dark
theme the same structure produces the opposite complaint and the same cause: a neutral cold shell
with one warm saturated object in the middle of it.

---

## There is no measure

| # | measured at 1440×900 | value |
| --- | --- | ---: |
| C1 | `.context-loop` on `DECIDE`, first in reading order, full bleed | **116 characters on one line**, 1392px |
| C2 | `.record-page-payoff` on `ARRIVE` | **104 characters on one line**, 736px |
| C3 | paragraphs over 90 cpl on `REFLECT` | **6 of 31**; worst 123 cpl at 11px (`.value-provenance`) |
| C4 | `max-width` declarations in 5,861 lines | 18, of which 4 are in `ch`, none product-level |

Characters per line was counted from the rendered text: `Range.getClientRects()` grouped by top
edge, text length divided by line count. Not estimated from a font metric.

---

## Icons: one role, five ranks

Rendered `<svg>` box sizes at 1440×900, all at `stroke-width: 2px`:

| state | distinct sizes |
| --- | --- |
| `DECIDE` | 13, 16, 17, 18 |
| `REVEAL` | 13, 14, 16, 17, 18 |

Five sizes across five pixels is the type-scale defect in another material: one-pixel steps rank
nothing, and every icon therefore reads as equally important.

---

## State by state

Fields are the brief's. "Visual centre" is the largest coherent perceptual mass; "first / second
visual mass" are the two heaviest painted objects in the first viewport.

### `ARRIVE` — `/`, empty record

```
PRIMARY TASK          start the first decision
FIRST VISUAL MASS     section.first-decision            43,368  (361,695px², ΔL 0.12)
SECOND VISUAL MASS    input.import-input                 1,369
VISUAL CENTER         the card, by 32x over the action inside it
ACTION SALIENCE       .primary-control mass 623 — 1.4% of the card that contains it
PERCEIVED DENSITY     low: 18 text runs, 6 type sizes, well ranked
TYPE CHARACTER        Noto Sans Hebrew throughout; DM Mono on one label; ranks correct
SURFACE CHARACTER     one card, 12px radius, one hairline; nothing raised; no shadow
COLOR ROLES           paper, surface, ink, muted, blue (action AND selected toggle), chip
BOARD RELATIONSHIP    there is no board. A chess product's front door shows no chess
CHESS IDENTITY        none rendered. The word "עמדה" carries it alone
INSTRUMENT IDENTITY   strong in copy, absent in form
GENERIC SAAS CUES     the segmented control + text field + filled button is the canonical
                      connect-your-account row, and it is the only structure on the page
GENERIC AI CUES       none
EVIDENCE-AUTHORITY    none rendered; nothing on this screen carries a grade
```

Also true and not a taste question: **no header, no brand, no way back.** `/play` has all three.
`docs/VISUAL_ARCHITECTURE_AUDIT.md` §10.1 calls this the clearest remaining coherence gap and
classes it `FIELD-REQUIRED`, because the front door is the acquisition funnel's first stage.

### `DECIDE` — `/play`, nothing committed

```
PRIMARY TASK          commit a decision
FIRST VISUAL MASS     the board, 32 dark squares at 4,051 each ≈ 129,632
SECOND VISUAL MASS    section.commitment-screen         22,974
VISUAL CENTER         the board — correct, this is the mode's subject
ACTION SALIENCE       the submit is NOT READY here, so its ground is --surface with a dashed
                      --warn edge: the single most saturated colour on the screen is the failure
                      hue, on the one control that has not failed
PERCEIVED DENSITY     87 text runs; 34 at 11px (16 of them board coordinates)
TYPE CHARACTER        the task question at 22px is the loudest text — correct and tested
SURFACE CHARACTER     one card + one raised step; 14 borders; radii 14, 10, 9, 50%
COLOR ROLES           board wood, blue (step index, legal dots, selected square, focus), warn
BOARD RELATIONSHIP    632px, centred; at 900px viewport height its last rank is 20px BELOW
                      the fold
CHESS IDENTITY        strong, and it is the only place the product has any
INSTRUMENT IDENTITY   the four numbered steps, the required marks, the summary count
GENERIC SAAS CUES     none
GENERIC AI CUES       none
EVIDENCE-AUTHORITY    none, correctly: LAW 1 forbids a reading of the record here
```

### `ANSWER_INSTRUMENT` — the confidence question open

```
PRIMARY TASK          answer the question
FIRST VISUAL MASS     the board (unchanged)
SECOND VISUAL MASS    the commitment card
VISUAL CENTER         the board, not the question — the contract names the question
ACTION SALIENCE       same dashed --warn box, now reading "choose a confidence level"
PERCEIVED DENSITY     102 runs, 38 at 11px
TYPE CHARACTER        the 1–7 confidence row is the best-ranked component in the product
SURFACE CHARACTER     24 borders — the highest count of any state
COLOR ROLES           --chosen ring on the played squares AND a --blue legal dot inside it
BOARD RELATIONSHIP    ~560px of empty column under the question (recorded as P2-6)
CHESS IDENTITY        strong
INSTRUMENT IDENTITY   strong
GENERIC SAAS CUES     none
GENERIC AI CUES       none
EVIDENCE-AUTHORITY    none, correctly
```

### `REVEAL` — the decision just committed

```
PRIMARY TASK          read what the decision showed
FIRST VISUAL MASS     the board
SECOND VISUAL MASS    .primary-control 9,989, then .evaluation-track 9,100
VISUAL CENTER         the machine — see the table at the top of this document
ACTION SALIENCE       high, and in the engine's own hue
PERCEIVED DENSITY     111 runs
TYPE CHARACTER        ranks correct; the empty branch sits two ranks under a real finding, tested
SURFACE CHARACTER     one raised card at ΔL 0.04 from the page; three rules; 15 borders
COLOR ROLES           blue as arrow, as button, as focus; ink as the evaluation slab
BOARD RELATIONSHIP    the engine's arrow is the most saturated mark in the product
CHESS IDENTITY        strong
INSTRUMENT IDENTITY   present but buried: "Stockfish 18 local · depth 14" repeats on four rows
                      inside a collapsed disclosure
GENERIC SAAS CUES     none
GENERIC AI CUES       none
EVIDENCE-AUTHORITY    `.one-thing-evidence` labels the branch. Correct, and typographically
                      indistinguishable from the sentence above it
```

### `REVIEW_EVENT`

**Not reached.** The drive that reaches every other state lands on `REFLECT` and finds no control
that opens one stored event from a single untimed decision; the mode's own contract describes *"a
move from a finished game"*, which is `PostGame`'s review mode on `/blitz`. Audited structurally
only, and it inherits `REFLECT`'s systems. Stated rather than implied, per this repository's
standard for a state a suite could not reach.

### `REFLECT` — `/`, with a record

```
PRIMARY TASK          what the record can and cannot say
FIRST VISUAL MASS     section.record-layer              61,767
SECOND VISUAL MASS    section.finding                   18,564
VISUAL CENTER         the record layer, by 3.3x
ACTION SALIENCE       .finding__button mass 744 — 1.2% of the first mass
PERCEIVED DENSITY     135 runs over 3,260px; 43 at 11px, 6 paragraphs over 90 cpl
TYPE CHARACTER        ranked; the 18px section headings read
SURFACE CHARACTER     14 filled surfaces, 17 borders, FIVE radii (6, 8, 10, 12, 999px)
COLOR ROLES           paper, surface, ink, muted, warn on a valid storage notice
BOARD RELATIONSHIP    none
CHESS IDENTITY        none rendered
INSTRUMENT IDENTITY   strong in copy: denominators, shortfalls, "not measurable"
GENERIC SAAS CUES     stacked full-width cards
GENERIC AI CUES       none
EVIDENCE-AUTHORITY    present and correct in words; no visual grammar carries the grade
```

### `EXPLORE`

```
PRIMARY TASK          move around a finished game
FIRST/SECOND MASS     board; then the analysis stack
PERCEIVED DENSITY     239 runs over 4,638px — legitimately the densest state
TYPE CHARACTER        inherits the scale; 77 runs at 11px
SURFACE CHARACTER     26 borders, 83 filled
EVERYTHING ELSE       inherits DECIDE and REVEAL; deliberately not separately tuned before
```

### `/blitz` — the game

Not one of the brief's seven, and it is where the largest single defect in the product is.

```
PRIMARY TASK          play a game
FIRST VISUAL MASS     button.blitz-control  352
SECOND VISUAL MASS    button.blitz-control  352  (all four are identical)
VISUAL CENTER         none. The heaviest painted object on the whole screen is 352, against
                      43,368 on ARRIVE and 129,632 on DECIDE
PERCEIVED DENSITY     one heading, one sentence, four buttons, ~800px of empty page
TYPE CHARACTER        inherits
SURFACE CHARACTER     none. No card, no header, no brand, no way back
CHESS IDENTITY        none until a game starts
INSTRUMENT IDENTITY   one sentence
```

And: **on a first visit there is no way to get here.** `/blitz` is linked once, from
`ResumeScreen`, which returns `null` unless `visitsOnRecord() > 1`. Reproduced in Chromium; recorded
in [`00-REPO-NATIVE-CONSTITUTION.md`](00-REPO-NATIVE-CONSTITUTION.md) §10a.

---

## Cross-cutting, measured

| # | finding | evidence |
| --- | --- | --- |
| B1 | `.brand-lockup` overlaps `.header-actions` at 390px | lockup x=184…380, actions x=10…204: **20px overlap**; the brand mark paints over the fourth icon control |
| B2 | six corner radii in use | 6, 8, 9, 10, 12, 14 (+ 50% and 999px for circles) |
| B3 | the board's last rank is below the fold at 1440×900 | board top y=288, side 632 → bottom y=920 in a 900px viewport |
| B4 | horizontal overflow | **none** at any of the four viewports, and none at a 32px root |
| B5 | `prefers-reduced-motion` | 0 live animations, unchanged from the previous pass |
| B6 | `forced-colors: active` | board checkerboard and piece colours survive; the previously-fixed block holds |

---

## What the baseline says the direction has to answer

1. The machine outweighs the human record on the one screen built to separate them.
2. One hue means nine things, two of which are the two sides of that separation.
3. The failure hue is the only accent on a screen where nothing has failed.
4. Four surface roles inside 0.19 of luminance, so the surface says almost nothing.
5. There is no measure, and the widest line in the product is 116 characters.
6. `/blitz` is unreachable cold, and looks like a different application when reached.

Numbers 1, 2, 3 and 6 are the direction. Numbers 4 and 5 are craft that the direction pays for
anyway.
