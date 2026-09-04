# Pre-human UX, pass 1: the product answers the hand

Run with `ereztash/Product-Perception-Sensemaking-Architect` at `5344852` (v0.2 assurance) as the
method, against the built app at both viewports. Neta is the microscope here and nothing else: no
Neta file was changed, and the output is Lichess App.

**Quoting.** Every Hebrew string below is the product's own text or the owner's own words, verbatim.

---

## 1. Diagnosis

The owner's signals, as given, treated as raw signal and not as diagnosis:

> התוכן מרגיש מבולגן · קשה להבין מה חשוב · כפתורים לעיתים לא מרגישים מגיבים · העיצוב מרגיש מיושן /
> "Windows XP" · המוצר מרגיש פחות מתקדם מהטכנולוגיה שהוא מכיל · התמורה מכל החלטה עדיין מקומית מדי

`Windows XP` is a metaphor and it is explicitly not treated as a mechanism. What follows is what was
measured after it.

### The measurement that decided this pass

Five control classes were held down in Chromium on the built app, and every computed visual property
was compared at rest, at hover, and while the mouse was down.

| control | hover | press |
| --- | --- | --- |
| `.ghost-control`, the front door entry that needs no account | none | **none** |
| `.read-chip`, synchronous and stays mounted | background | **none** |
| `.step-head`, a commitment step | none | **none** |
| `.commitment-submit`, the commit | none | **none** |
| `[data-square]`, a board square | none | **none** |

Not one control in this product changed appearance when it was pressed. The whole stylesheet carried
**two** `:active` rules in 90 kB, and `aria-busy` appeared **zero** times.

And the commit press, sampled at 50 ms on the built app:

```
+61 ms     the commitment panel is gone, the text length drops
+3293 ms   the engine's sentence arrives
```

Across that whole interval: `aria-busy` on zero elements, spinners zero, and `animationName !== "none"`
on **zero elements on the page**. Nothing moved for 3.2 seconds after the most consequential press in
the product. There was one sentence, `המנוע מחשב את העמדה שהחלטת עליה…`, at 14px weight 400 and
`opacity: 0.75`. The one thing on screen with something to report was the one thing being dimmed.

---

## 2. Mechanism map

Three mechanisms, and they are not the same defect.

| | mechanism | what it explains | what it does not | discriminator |
| --- | --- | --- | --- | --- |
| `M-A` | no control has a pressed state | why a chip that resolves in one frame feels as dead as a three-second commit | the 3.2 s gap itself | press a synchronous control and read the computed style. **Run: no change on 5/5.** |
| `M-B` | real work runs with nothing indicating it | why the commit specifically feels broken rather than slow | why synchronous controls also feel dead | sample `aria-busy` and running animations across the wait. **Run: zero and zero.** |
| `M-C` | salience does not agree with priority | "מבולגן", "קשה להבין מה חשוב" | the press feeling, which is present on a screen with only one control | rank rendered elements by area × weight × contrast. **Run: below.** |

`M-A` and `M-B` are addressed in this pass. `M-C` is measured here and mostly **not** acted on, for
reasons in §7.

### `M-C`, measured

Ranked by area × weight × contrast, which is a proxy for competition and not for attention.

| screen | what ranks first | where the primary action ranks |
| --- | --- | --- |
| front door, 1440×900 | seven paragraphs of prose | the first button is **8th** |
| deciding, 1440×900 | five controls within 1.5% of each other | no single primary; board squares at 43% of top |
| reveal, 1440×900 | the boilerplate that is identical on every reveal | `לעמדה הבאה` ranks **6th** |
| reveal, 390×844 | the **privacy notice** | **nothing from the reveal's four blocks is in the first viewport** |

---

## 3. Changes implemented

### The press layer

`button:not([data-square])`, `summary`, `[role=button]`: a state layer and a one-pixel translate on
`:active`, and a `:focus-visible` ring. One selector rather than the forty-line tap-floor family,
because this is a claim about all controls and a rule cannot drift out of step with a list.

The board is excluded on purpose: a square already answers a press with a selection ring, and a
second acknowledgement on the one surface where the decision is made is not a clarification.

`GATE-TWO-HANDS` caught the first version, which rang in `var(--blue)`, the engine's own hue, on
every control a player can press. That is exactly the rule the gate holds. The ring uses `--focus`,
the token this file already rings with in two other places.

### The wait says it is working

`role="status" aria-busy="true"` on the waiting line, its `opacity: 0.75` dimming removed, and a
two-pixel indeterminate sweep beneath it. Indeterminate because the engine reports no progress and a
bar implying otherwise would be inventing a number the product does not have.

**Nothing about the wait itself moved**: not its duration, not its text, not when the reveal renders,
not one recorded event.

### Bundle

`773 → 774 kB` raw initial download, attributed in `check_bundle_budget.ts`. The entry chunk did not
move at all, which is the check that says this is stylesheet and not JavaScript.

---

## 4. Before and after, measured on the built app

| | before | after |
| --- | --- | --- |
| front door entry, on press | no change | `box-shadow`, `transform` |
| reading chip, on press | no change | `box-shadow`, `transform` |
| commitment step, on press | no change | `box-shadow`, `transform` |
| commit, on press | no change | `box-shadow`, `transform` |
| board square, on press | no change | no change, deliberately |
| `aria-busy` during the wait, desktop | 0 | 1 |
| `aria-busy` during the wait, handset | 0 | 1 |
| elements animating during the wait | 0 | 1 |
| waiting line opacity | 0.75 | 1 |

Two of these numbers were wrong the first time they were taken. The press probe aimed at each
control's centre and the sticky `.commitment-submit` sits over the step heads at exactly that point,
so a step head that had never been pressed was recorded as unchanged; the probe now asserts
`matches(":active")` and names what it actually hit. And the animation probe read
`getComputedStyle(el)` only, which cannot see an `::after`, and it reported zero against a moving page.
Both instruments are corrected and both errors are in the test's own comments.

---

## 5. Gate and positive controls

`tests/layout/a-press-the-hand-can-feel.layout.test.ts`, three cases, run against the built app.

Four deliberate breaks, each red for its own reason:

| break | what went red |
| --- | --- |
| the `:active` rule matches nothing | `the front door entry did not change while it was held down` |
| the wait stops declaring itself busy | `the engine was working and nothing on the page declared itself busy` |
| it declares itself busy and nothing moves | `the page declared itself busy and showed nothing moving` |
| the press layer swallows the board too | `a board square grew a press layer it is not supposed to have` |

The wait case had to be rebuilt to be evidence at all. Its first version polled once per 50 ms after
a single commit, and passed under three of its own breaks while failing on the restored tree: by the
third case in the file the wasm is compiled and the reveal can arrive inside one sample, so the test
was measuring the runner's cache. It now polls at 10 ms and takes up to three decisions through the
continuation, and reports **failure to reach the state** rather than passing over it.

Not registered in the 35-gate runner. It is a layout test in the main suite, which CI runs.

---

## 6. Verification

3,047 tests pass. 35 gates pass. Bundle within budget. Measurement semantics unchanged: no event, no
denominator, no protocol rule and no eligibility criterion was touched, and `ACQUISITION_PROTOCOL_V1`
§1 through §6 are untouched.

---

## 7. What was deliberately not done

**`M-C`, the salience inversion.** The measurement is solid and the fix is not mine to choose. Which
control is primary on the front door is product intent, and the stylesheet documents a deliberate
decision that `--blue` means "act" and that the bank entry is a `ghost-control`. Changing that is an
`OWNER` claim, not a `REPO` one.

**The reveal's position on a handset.** Nothing from its four blocks is in the first viewport, and
that is `F-1`. `ACQUISITION_PROTOCOL_V1` §6 says in as many words that this is a field question and
not a licence to reorder. Moving it would be changing the measurement protocol as part of a
redesign, which the brief forbids and which would need a protocol version.

**Accumulation.** The owner's strongest wish, that each decision build a cumulative picture, is
pass 3 and is not in this pass. It is a build, not a polish, and it deserves its own measurement of
what the record can already say before anything new is recorded.

---

## 8. Field questions this pass does not touch

Unchanged, and none of them is closer: `F-1` whether the reveal is read where it is put, `F-2`
whether the evidence vocabulary lands, `F-3` whether the first payoff is worth continuing for.

A pressed state cannot be argued into any of them. What it can claim, and all it claims, is that a
press now produces a visible change where measurement showed there was none.

---

## 9. Stopping decision for this pass

`M-A` and `M-B` are closed: both were `REPO` claims at `R3`, both were measured, both are fixed and
held by a gate with four red controls.

`M-C` is measured and open, and its resolution authority is `OWNER` for the front door and `FIELD`
for the reveal's geometry. No further technical work reduces that uncertainty, which is the authority
ceiling for this pass.

Accumulation is the next pass and is a different kind of work.
