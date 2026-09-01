# The design system

What every token means, and what it may paint. The authority for *why* is
[`docs/design-council/03-ART-DIRECTION-CONTRACT.md`](design-council/03-ART-DIRECTION-CONTRACT.md);
this file is the reference a person reaches for while writing a rule.

**There is no token pipeline and no package.** One stylesheet, `client/src/index.css`, whose
declarations carry their own reasons and their own measurements. That was a deliberate refusal
before this pass and it stands.

---

## The layers

```
PRIMITIVE   a colour, a size, a distance.        --ink  --blue  --chip  --s4  --panel-body
    ↓
SEMANTIC    a job.                               --action  --machine  --focus  --measure
    ↓
COMPONENT   a rule, which names the job.         .commitment-submit { background: var(--action) }
```

A component rule reaches for a **semantic** token. It reaches for a primitive only where the
primitive *is* the meaning: `--ink` for text, `--light-square` for a light square.

---

## Colour

### The rule that governs the whole palette

> **The machine's colour is never something a player can press.**
> **Every surface the engine owns paints in it.**

Both directions are asserted by `GATE-TWO-HANDS` (`scripts/two-hands-scan.ts`), with a positive
control that reddens twice.

### Semantic tokens

| token | resolves to | may paint | may never paint |
| --- | --- | --- | --- |
| `--canvas` | `--paper` | the page | anything raised |
| `--surface` | | a card, a region | the page |
| `--surface-raised` | `--raise` | **the object this mode's contract names central. One per screen** | anything else |
| `--surface-recessed` | | a well the player writes into | a card |
| `--surface-machine` | | the engine's column, its evaluation, its disclosure | anything the player made |
| `--machine` | `--blue` | the engine's arrow, evaluation, depth, identity | **any control, chip, focus ring, link or the brand** |
| `--on-machine` | `--on-blue` | text on the machine's own colour | |
| `--hand` | `--chosen` | the player's mark **on the board** | a page element |
| `--action` | `--ink` | the one primary act | a second act on the same screen |
| `--on-action` | `--cream` | text on it | |
| `--action-hover` | | the primary act, hovered | |
| `--selected` | `--ink` | a token the player has chosen | the primary act |
| `--on-selected` | `--cream` | text on it | |
| `--focus` + `--focus-halo` | `--ink` + `--paper` | the focus indicator | anything static |
| `--warn` | | **a failure** | an unfinished field, an unfinished commitment, a standing condition, silence |

### The three systems this does not govern

1. **The board.** `--light-square`, `--dark-square`, `--chosen`, `--last-move`, the piece rings.
   The board is a third material; the two hands meet on it, and its marks are measured where they
   are.
2. **The chart palette.** `--c-white-edge`, `--c-black-edge`, `--c-sev-1…3`. Validated at ΔE 26.1
   normal-vision and 20.2 protan, re-stepped for dark. Untouched.
3. **Engine failure states**, which keep `--warn` because they are failures.

### The surface ladder

| | relative luminance | ΔL from the page |
| --- | ---: | ---: |
| `--canvas` | 0.783 | — |
| `--surface-machine` | 0.709 | 0.075 (cool, and below the page) |
| `--surface` | 0.898 | 0.115 |
| `--surface-raised` | 0.964 | **0.181** |

It used to run canvas 0.783 → **raise 0.818** → surface 0.898: the token spent on a mode's central
object was darker than an ordinary card and 0.035 from the page behind it.

---

## Type

Seven ranks. Values, floor and reasons unchanged by this pass.

| token | px | job |
| --- | ---: | --- |
| `--panel-display` | 28 | the one largest thing on a screen, and there is one |
| `--panel-heading` | 22 | a heading that owns a region |
| `--panel-title` | 18 | a block's own heading; never smaller than the body under it |
| `--panel-data` | 16 | a reading: a move, a confidence digit, an evaluation |
| `--panel-body` | 14 | prose; the floor for anything that is a sentence |
| `--panel-label` | 12 | a label, a legend, a chip, a toggle; never a sentence |
| `--panel-fine` | 11 | kickers, counters, provenance, board coordinates; never load-bearing |

**Two families.** Noto Sans Hebrew for anything a person reads. DM Mono for anything that is a
**reading** — SAN, FEN, PV, evaluations, depths, counts, clocks, usernames.

**DM Mono is Latin-only and has no bold.** Its `@font-face` carries a Latin `unicode-range`, so
every Hebrew string in a mono class falls through to the system monospace and then to a Hebrew
face. Do not rank anything by mono weight: `700` on DM Mono is browser synthesis, and the
stylesheet says so at the declaration.

**The 11px floor is a Hebrew decision.** Hebrew has no ascenders or descenders, so the x-height
carries the whole of the discrimination.

---

## Measure

| token | value | job |
| --- | --- | --- |
| `--measure` | `62ch` | body prose |
| `--measure-wide` | `78ch` | a lead sentence, read once |

Measured from rendered Hebrew rather than assumed: line count from `Range.getClientRects()`, text
length divided by it. Before: 116, 104 and 123 characters on a line. After: nothing above 78.

**A measure gives prose a line count, and a line count is a thing that can change.** Giving these
columns a width is what exposed the font swap: a Hebrew line that fits in two lines of Noto Sans
Hebrew takes three in the fallback, so `/play` painted its context ribbon 88px tall and dropped it
to 65px at 60ms, moving the board 23px up (CLS 0.0023 → 0.0137). The face is now preloaded in
`client/index.html`, which removes the reflow rather than reserving space for it.

---

## Spacing

`--s1: 4px` · `--s2: 6px` · `--s3: 8px` · `--s4: 12px` · `--s5: 18px` · `--s6: 28px`

One step inside a group, two between groups, three between regions. Unchanged.

---

## Shape

| token | value | job |
| --- | --- | --- |
| `--radius-card` | 12px | a region on the page |
| `--radius-control` | 8px | anything inside a region |

Plus two shapes that are not radii: `999px` for a pill, `50%` for a circle. Six rectangular radii
became two.

---

## The action grammar

| role | treatment | how many |
| --- | --- | --- |
| **primary** | filled `--action`, no edge, `--radius-control` | **one per screen.** `LAW 2` and `GATE-ONE-PRIMARY-ACTION` decide which |
| **secondary** | transparent ground, 1px solid `--edge`, ink text | as many as the screen needs |
| **quiet** | no ground, no edge, ink text, underlined | leaving, explaining, disclosing |

**`--edge` and nothing else.** Six edges were doing this job — `rgba(--ink-rgb, 0.2)`, `0.25`,
`--hairline`, `--hairline-strong`, `--edge-soft`, `currentColor` and `--ink`. Composited on
`--surface`, five of the six measure under the 3:1 WCAG 1.4.11 asks of a control boundary;
`--edge` measures **3.22:1**.

**Dashed means one thing: not yet.** `.commitment-submit.not-ready` is the only dashed control.

**Selected is not pressed.** A selected token keeps its chip ground and takes an `--ink` edge and
weight 600; the state separation measures 11.4:1, up from 5.21:1 when it was a filled hue.

---

## Icons

| size | job |
| ---: | --- |
| 16 | an icon that is a control |
| 14 | an icon inline with text |

One stroke weight. Two 44px marks on the error and 404 screens are drawings, not icons.

Five rendered sizes across five pixels became two. A one-pixel step ranks nothing.

---

## Focus

```css
outline: 2px solid var(--focus);
outline-offset: 2px;
box-shadow: 0 0 0 2px var(--focus-halo);
```

An ink ring alone measures 2.34:1 against a dark board square and 1:1 against the ink-filled
primary — invisible in exactly the two places the loop runs through. The halo sits in the offset
and carries 5.6:1 against a dark square. Both tokens flip with the theme, so the indicator inverts
by itself.

---

## Motion

None. Zero live animations under `prefers-reduced-motion`, and none added.

---

## Forced colours

Four opt-outs, and everything else obeys the reader: the two square colours and the two piece
colours, because `light`/`dark` and `white`/`black` are how a position is *stated*. Four marks are
re-stated in system colours instead: `.last-square` (`LinkText`), `.selected-square` (`Highlight`),
and the loop strip's ticks (`GrayText` / `Highlight`).

---

## Adding something

1. Does a semantic token already name the job? Use it.
2. Is it a **new job**? Add a semantic token, point it at a primitive that exists, and write why at
   the declaration. A token with no call site is how a palette grows without a reason.
3. Is it the **engine** speaking? Add the selector to `MACHINE_SURFACES` in
   `scripts/two-hands-scan.ts`, or the gate will not know.
4. Is it a **control**? It is one of the three roles. If it is none of them, that is the finding.
5. Does it paint on `DECIDE` or `ANSWER_INSTRUMENT`? Read the bump rule at
   `CURRENT_PROTOCOL_VERSION` in `shared/measurement-protocol.ts` before you change it. Visual-only
   is not measurement-neutral.
