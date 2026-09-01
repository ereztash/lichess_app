# The Art Direction Contract

Frozen after one round of independent critique
([`04-ADVERSARIAL-REVIEW.md`](04-ADVERSARIAL-REVIEW.md) §1) and one revision. It governs
`client/src/index.css` and the component grammar; it does not govern product logic, copy,
measurement, or anything the mode contract already decides.

---

## THESIS

**The page is the notebook the player writes in. The machine's evidence arrives on a plane of its
own, only after the entry is closed, and it is never something you can press.**

---

## SIGNATURE — two hands on one page

Everything the player recorded is on the page: the page's ink, the page's surfaces, the board's own
wood for a mark on the board. Everything the engine returned arrives on **one recessed cool plane
that appears nowhere else in the product and holds nothing the player made**, and on that plane the
engine's readings are in the engine's own colour.

Where the engine has not spoken — `DECIDE`, `ANSWER_INSTRUMENT`, `TEST`, a running game — the plane
is simply not on the page. That absence is `engineMayRun` visible as a property of the screen
rather than as a sentence about a rule.

**The rule that makes it checkable, in both directions:**

```
the colour the machine SPEAKS IN is never something a player can press
the ground the machine WRITES ON is never something the player made
```

`GATE-TWO-HANDS` (`scripts/two-hands-scan.ts`) asserts both, with a positive control that reddens
twice. A one-directional check would be satisfied by deleting the colour, and could not fail in the
direction the design actually fails — which is the engine's own output drifting into the page's
material. It had: `.evaluation-track`, the machine's largest object, was drawn in `--ink`.

**The rule contradicted itself in its first draft, and a critic found it.** It read *"the machine's
colour is never something you can press"* with `--surface-machine` inside the forbidden set — while
`MACHINE_SURFACES` required that same token on `.reveal-secondary`, which is a `<details>`. The gate
demanded and forbade one declaration on one selector, and could see neither, because `details` was
in none of the scanner's lists. **A ground is not a voice.** The plane is where the engine writes; a
disclosure that opens the engine's own numbers is a control sitting on that ground, and that is
allowed. What is never allowed is a control drawn *in* the engine's hue.

**And what the second direction cannot do**, stated because a gate whose limits are unwritten gets
trusted past them: `MACHINE_SURFACES` is a hand-kept list of eight selectors. It proves everything
named there is on the plane. It cannot notice a ninth surface nobody added. No property of a
selector says "this is the engine speaking", so the list is a fact about the product written down
as one, and adding a surface means adding it there.

### Why it is a plane and not only a hue

The critic's finding, and it is the reason this contract is not the draft that went into critique.
This stylesheet already states the house rule where it matters most: *"Move classification ALWAYS
ships its label as text: colour never carries it alone."* Provenance is the most load-bearing
distinction the product makes, and a distinction carried by hue on 11px Noto Sans Hebrew is 1.4.1
waiting to happen. **A ground is pre-attentive, it survives grayscale, and it survives being wrong
about colour.** The hue is the second half of the signal, not the whole of it.

### What the signature is not allowed to become

- **A label.** `VALUE_CLARITY_FIELD_PROTOCOL` Arm B asks a player, with no options and no branch
  named, *what did you get here that was not already in the game and an engine analysis*. The
  interface may make the distinction **perceptible**; annotating it is answering the interview
  question in advance.
- **A ranking.** Different provenance is visually distinguishable. Different *value* is not
  fabricated: the machine's plane is neither better nor worse than the page, and no Reveal branch
  is drawn as a better outcome than another.
- **A branch signal.** The machine's colour marks the machine's *surfaces*. It never marks an
  inline number inside a Reveal sentence, because a process branch and an engine branch must stay
  typeset identically (Lens 4), and colouring the numbers one of them happens to cite would install
  exactly the difference that lens forbids.

---

## SYSTEM

### Colour — the semantic layer

Every token below points at a primitive that was already in the file. Nothing here is a new hue.
What is new is that a call site names a **job**, and a job has one appearance.

| role | token | value (light / dark) | what it may paint |
| --- | --- | --- | --- |
| canvas | `--canvas` → `--paper` | `#e9e4d8` / `#14181a` | the page |
| surface | `--surface` | `#f7f3e9` / `#1b2124` | a card, a region |
| raised | `--surface-raised` → `--raise` | `#fdfbf4` / `#2a3438` | **the object a mode contract names central. At most one per screen** |
| recessed | `--surface-recessed` | `#ded7c6` / `#141a1c` | a well the player writes into |
| chip | `--chip` | `#e0d6c0` / `#2e393e` | a token's own ground, and a disabled control |
| **machine plane** | `--surface-machine` | `#d8dcda` / `#1e2a2f` | the engine's column, evaluation and disclosure. **Nothing else, ever** |
| machine | `--machine` → `--blue` | `#1e5b72` / `#5fb3d4` | the engine's arrow, its evaluation, its readings |
| on-machine | `--on-machine` → `--on-blue` | `#fff` / `#0d1416` | text on the machine's own colour |
| player's hand | `--hand` → `--chosen` | `#8a5a12` / `#e0a458` | the player's mark **on the board** |
| action | `--action` → `--ink` | `#17221f` / `#e7e3d8` | the one primary act |
| on-action | `--on-action` → `--cream` | `#f7f3e9` / `#1d2326` | text on it |
| action hover | `--action-hover` | `#23302c` / `#d2cec3` | a warming, never a lightening |
| selected | `--selected` → `--ink` | | a token the player has chosen |
| focus | `--focus` + `--focus-halo` | ink + paper | the indicator, on every ground |
| failure | `--warn` | `#a8412c` / `#e08a7a` | **something failed. Nothing else** |

**`--warn` lost three of its four jobs.** It was also carrying an unfinished field
(`.required-mark`), an unfinished commitment (`.commitment-submit.not-ready`,
`.commitment-summary`), and a **valid storage mode** (`.record-mode.session-only`, which fires when
the browser blocks persistent storage and the loop continues in tab memory). On a cold `DECIDE` it
was the only saturated colour on the screen. `WARNING ≠ FAILURE`, `SILENCE ≠ ERROR` and
`UNCERTAINTY ≠ WEAKNESS` are three of the distinctions this product's constitution rests on, and
the pre-commit screen is where they matter most.

**Three colour systems this contract does not govern**, named so the claim is not larger than it
is:

1. **The board's own marks** — `--light-square`, `--dark-square`, `--chosen`, `--last-move`, the
   piece rings. A board is a third material, neither page nor plane, and the two hands meet on it.
2. **The chart palette** — `--c-white-edge`, `--c-black-edge`, `--c-sev-1…3`, validated at ΔE 26.1
   normal-vision and 20.2 protan against the surface, and re-stepped and re-validated for dark.
   Nothing in this pass overturns that work.
3. **The engine's own failure states**, which keep `--warn` because they are failures.

So "one saturated colour on the page" is **false**, and was corrected out of the draft. The true
statement is narrower: *in the interface layer, one hue means the machine and nothing else.*

### Typography

**Unchanged.** Seven ranks, the values and the 11px Hebrew floor and the reasons at each
declaration. Two families: Noto Sans Hebrew for anything a person reads, DM Mono for anything that
is a **reading**.

One rule added, and it is scoped by the critic's finding: **DM Mono ships Latin only.** Every
Hebrew string in a mono class already falls through to the system's monospace and then to a Hebrew
face, and DM Mono has no bold at all — so a plan to rank readings by mono weight would be ranking
browser synthesis. The mono/sans split therefore applies to what it can actually reach: SAN, FEN,
PV, evaluations, depths, counts, clocks, usernames.

### Material and surfaces

| what | treatment | why |
| --- | --- | --- |
| flat | the page | it is the ground |
| raised | one step lighter, hairline | the mode contract's central object, one per screen |
| recessed | one step darker | the player writes here |
| machine plane | cool, recessed, no border | the engine wrote here |
| border | only where removing it makes something less understandable | the ground and the whitespace do the grouping |
| shadow | **none added.** The board keeps its own; the brand mark keeps its hard offset | elevation is not decoration |
| texture | the existing grain, on its own layer, unchanged | it is measured where it is |

**The ladder ran backwards and now does not.** Measured in Chromium: `--surface` 0.898,
`--raise` 0.818, `--paper` **0.778** — so the token spent on a mode's central object was *darker*
than an ordinary card, and the ΔL a raised object travelled from the page was **0.040**. One value
moved: `--raise` `#efe9dc` → `#fdfbf4`. Canvas 0.778, surface 0.898, raised 0.964, and the same
object now travels **0.186**, measured on `.reveal-one-thing` by the same probe both times.

*(An earlier draft of this section said 0.783 and 0.035. That was arithmetic; the numbers above are
the browser's, and the difference is why the arithmetic is not the record.)*

**`--paper` was moved and put back**, and the reason is on the record: deepening the canvas would
also have closed the gap between the page and the board's light squares from 1.14:1 to 1.09:1. The
board is the visual centre of `DECIDE` *because* it stands off this page. Every contrast ratio
pinned in this stylesheet's comments is measured against that exact value.

### Shape

Two radii, from six. `--radius-card: 12px` for a region on the page; `--radius-control: 8px` for
anything inside a region. Plus **two shapes that are not radii**: `999px` for a pill and `50%` for
a circle, both of which the stylesheet already argues for functionally (*"a chip is a token you
pick, not a field you fill, and the two should not be the same shape"*).

### Measure

`--measure: 62ch` for body prose, `--measure-wide: 78ch` for a lead sentence read once. Tuned
against **rendered Hebrew**, not assumed from the `ch` metric: measured by counting rendered lines
with `Range.getClientRects()` and dividing the text by them. Before: 116, 104 and 123 characters on
a line. After: nothing above 78.

### Iconography

Two ranks: **16px inside a control, 14px inline with text**, one stroke weight. Down from five
rendered sizes across five pixels — a one-pixel step ranks nothing, which is the type scale's
defect in another material. The two 44px marks on the error and 404 screens are drawings, not
icons, and are named as the exception.

### Motion

**Unchanged, and none added.** Zero live animations under `prefers-reduced-motion`, before and
after.

### Density

**Unchanged.** Whether there is too much on these screens is `FIELD-REQUIRED` and this pass does
not answer it by taste. What changed is the measure, which is the reading half of "tiring" and is
not a preference.

---

## RISK

**The primary action is the page's own ink, filled — not a hue.**

The obvious solution is a reserved accent for the action. That is what the product had, and the
accent it reserved was the engine's. Making the action ink says the act belongs to the player: it
is made of what the player writes with.

**What it costs, stated rather than discovered later.** `--ink` is the maximum-luminance-distance
fill this palette can produce, so the primary control's squint mass goes *up*: measured on `REVEAL`
at 1440×900, **9,989 → 11,085**. That is accepted, and the reason is that the metric this pass is
answerable to was never "is the button quiet" — `LAW 2` wants exactly one primary act and wants it
findable. It is **machine-authored mass against the mode contract's central object**, and that is
the ratio that moved:

| measured on `REVEAL`, 1440×900 | before | after |
| --- | ---: | ---: |
| `.reveal-one-thing`, the contract's central object | 1,757 | **8,131** |
| `.evaluation-track`, the machine's largest object | 9,100 | **6,428** |
| the machine's biggest object **as a multiple of the central one** | **5.2×** | **0.79×** |
| `.primary-control` | 9,989 | 11,085 |

**And the second cost.** A near-black filled primary on warm paper is the canonical neutral product
surface of the last decade. This direction accepts that the *component* is unremarkable and puts
the expressive force where the brief says to put it: in the signature, which no CRM has.

---

## RESTRAINT — what this direction refuses to do

- **No success colour.** No positive counterpart to `--warn` is added. There is no state in this
  product that means *you did well*, and `docs/ACQUISITION_EVIDENCE.md` §4 lists the fields that do
  not exist for the same reason.
- **No visual difference between a Reveal that found something and one that did not**, beyond the
  provenance label the product already computes and the ablation test already proves.
- **No celebration, flash, confetti, zoom or motion at the commitment boundary.** The transition is
  consequential; it is not theatrical.
- **Nothing added to a screen where evidence is being produced.** The empty column under the
  counterfactual question stays empty; filling it would be adding a stimulus to a measurement.
  **One thing WAS added, and this list did not reach it:** the front door gained a third,
  secondary route — a short game — because `/blitz` had no door on a first visit at all
  (`00-REPO-NATIVE-CONSTITUTION.md` §10a). `ARRIVE` is an acquisition surface, not a
  `producingEvidence` mode. It is a change to the funnel, and it is disclosed here and in the final
  report rather than left covered by a restraint that does not cover it.
- **No new font, no new dependency, no new library.**
- **No change to measurement wording, question order, control position, sampling, timing,
  thresholds, eligibility, scoring or schema.**
- **No change to the front door's promise sentences or their order**, which are frozen by
  `shared/promise.ts` and a field protocol that has not run.
- **No design-system package.** `docs/DESIGN_SYSTEM.md` and a stylesheet, not a token pipeline.
- **`EXPLORE` is not flattened.** It is legitimately the densest state and inherits the system
  without being separately tuned.

---

## The subject-swap test

> If every word of Decision Lab's content were replaced by a CRM, a fintech dashboard or an AI
> assistant, would the visual system still make equal sense?

| part of the system | survives a swap? | |
| --- | --- | --- |
| the type scale, the spacing scale, the measure | **yes** | craft, and it should survive |
| two radii, two icon ranks, one action grammar | **yes** | craft |
| warm paper, ink, hairlines | **yes** | this is the part that is not distinctive, and the RISK section says so |
| board wood participating in the page's family | no | there is no board in a CRM |
| a recessed neutral plane holding a second author's output | **yes, and this is the correction** | that is what an assistant's answer panel is. As a *component* the plane is the most transplantable thing in the pass |
| **the plane measuring literally zero pixels until a boundary is crossed** | **no** | `DECIDE` and `ANSWER_INSTRUMENT` contain 0px of it and 0px of the machine's hue. A product with one author has nothing to withhold |
| **the rule that the machine's colour is never pressable** | **no** | it is meaningless without a machine that speaks second |
| `--warn` restricted to failures, `--hand` on the board | no | both exist because this product distinguishes a failure from an incomplete entry, and a player's mark from an engine's |

**PASS, and by one row rather than four.** The first draft counted the plane and the
not-pressable rule as two ideas; a critic reading this table against the rendered screens pointed
out that they are one fact stated twice, and that a recessed grey read-only panel is the current
convention for an AI assistant's answer. What survives is the **timing**: a ground that measures
literally zero pixels until the player has committed, and that appears only afterwards. Everything
else here is craft or hygiene, and the table now says so rather than claiming four.

---

## What this contract does not decide

- **Whether the palette is liked.** OWNER.
- **Whether the density is right.** FIELD.
- **Whether the boundary becomes understandable to a player.** FIELD — Arm B is the instrument.
- **Whether the front door should carry the brand.** FIELD, unchanged from
  `docs/VISUAL_ARCHITECTURE_AUDIT.md` §10.1. This pass did not touch it.
