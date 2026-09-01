# Frontend excellence audit — what the built app measures, before anything is changed

**Base:** `BASE_SHA = 5ecc58e6eaf521eec1320871b67752f8e2538b60` (`origin/main`)
**Visual base:** `VISUAL_BASE_SHA = e2ee63181ceaf0308c73cb532736494f8278edc1` (#55 merged)
**Evidence base:** `D25_SHA = f83220a0adf8ad2682dc151cf3383646c01b254f`

Every number below was read off the built app in Chromium 1194 at a named viewport, or off
`dist/public/assets/index-*.css`. Nothing here is a stylesheet reading offered as a screen reading,
and nothing here is a preference offered as a finding. Where a question is a preference, it is filed
under **OWNER-REQUIRED**; where it needs a person using the product, **FIELD-REQUIRED**.

[#56](https://github.com/ereztash/lichess_app/pull/56) withdrew #55's `PRE-FIELD VISUAL DOD: PASS`
and left two things open: the `D25` ↔ UI contradiction, which it recorded and deliberately did not
resolve, and the density question, which it named and did not measure. Both are answered here.

---

## A. Executive diagnosis

**What prevents this frontend from feeling excellent is no longer hierarchy, and it is not colour.**
#52 fixed the board's placement and #55 ranked the type. Both hold under re-measurement: zero
horizontal overflow at all thirteen viewports, the tap floor intact across the decision loop, dark
theme clean under axe, reduced motion fully honoured, lab-LCP 152–232 ms and CLS 0.0023.

Four things are left, and three of them are one thing seen from different sides.

**1. The accessibility evidence is scoped narrower than it reads.** `axe-on-the-built-app` audits
three routes in their **cold** state: `/`, `/play`, `/blitz`. It never reaches `REVEAL` and never
reaches `/` **with a record on it**. Run against those two states, axe returns **27 serious
colour-contrast failures** and two `heading-order` violations. The suite is green because it does
not go where the failures are — the same shape of defect `tests/layout/browser.ts` refuses to skip
for, and the same shape #56 found in a document.

**2. Explanatory prose was demoted to the provenance rank, which made it both too small and too
pale.** On `REFLECT` **58 of 127** visible text runs paint at 11 px, and **27 of those are sentences
of six to twenty-six words**. 11 px is `--panel-fine`, whose declaration in this repository reads
*"kickers, hints, counters, provenance; **never load-bearing**"*, and the scale names
`--panel-body: 14px` as *"the floor for anything that is a sentence"*. The sentences sitting there
include the terminal ones — *"no clock was saved on these decisions, so this split will never fill,
no matter how much more you play"* — which is the most load-bearing sentence on the page, because
it is the one that tells a player to stop waiting. It renders at 11 px and **4.27:1**. Findings 1
and 2 are the same elements: the contrast failures and the rank misuse are one root cause.

**3. The heaviest control in the product is a disabled button on the least-supported claim.**
`.learning-save` paints `--ink` — the darkest value in the palette — at `font-weight: 700`, 296×44,
while `.primary-control` beside it paints `--blue` at weight 400. It is the composer that saves a
learning rule, and `D25` is `CONSTRUCT-UNDERIDENTIFIED`. It also fades itself with `opacity: 0.45`
when disabled, which is the exact pattern #55 removed from `.first-decision-form
.primary-control:disabled` for compositing the foreground into whatever is behind it.

**4. And the one genuinely new P0 is the one #56 wrote down and left.** `VERIFIED_LEARNING_ENABLED`
is `!== "false"` — on unless switched off — over a decision that reads `CONSTRUCT-UNDERIDENTIFIED`,
`Humans measured: 0`. #56 correctly called flipping it a product decision rather than a documentation
one. That decision has since been taken: the owner's brief for this pass names the direction
explicitly, `EXPERIMENTAL_LEARNING_ENABLED` with `=== "true"` opt-in.

**And one thing the interface does to its own subject.** Under `forced-colors: active` every one of
the 64 board squares computes `rgb(255, 255, 255)` and every piece computes `rgb(0, 0, 0)`. The
checkerboard and the black/white distinction both vanish; the position becomes unreadable. There is
no `forced-colors` block anywhere in 5,666 lines of stylesheet.

---

## B. Frontend excellence matrix

Maturity is an **estimate on a 1–5 scale**, stated as an estimate. "Max defensible pre-field" is the
ceiling reachable from repository, browser and standards evidence alone — above it the next
improvement's direction is better learned from a person than from code.

| Layer | Current evidence | Observed defects | Class | Conf. | Now | Max pre-field | Blocker |
|---|---|---|---|---|---|---|---|
| Semantic / epistemic trust | `features.ts`, `D25`, composer copy read | `VERIFIED_LEARNING_ENABLED` default-on over `CONSTRUCT-UNDERIDENTIFIED`; heaviest fill in product on that surface | PRODUCT | High | 2 | 4 | P0-1, P1-4 |
| Interaction mechanics | 13 viewports measured; tap floor probed | none new; `.explore-toggle` 36 px inside the loop | PRODUCT | High | 4 | 4.5 | P2-3 |
| Spatial composition | board 100→38 px across matrix; zero overflow | none; #52 holds | PRODUCT | High | 4.5 | 4.5 | — |
| Action salience | fills enumerated per state | `--blue` means *primary action* and *selected toggle* on the same screen | PRODUCT+EMP | High | 3 | 4 | P1-5 |
| Information hierarchy | text runs ranked per state | holds post-#55; biggest text is the right text on all four states | PRODUCT | High | 4 | 4.5 | — |
| Information density | 11 px sentence count per state | 27 sentences at the "never load-bearing" rank on `REFLECT` | PRODUCT | High | 2.5 | 4 | P1-1 |
| Typography | scale honoured; distribution measured | rank misuse above; scale itself sound | PRODUCT | High | 3 | 4.5 | P1-1 |
| Spacing / rhythm | `--s1`–`--s6` in use | no defect found this pass | PRODUCT | Med | 4 | 4.5 | — |
| Component grammar | 3 shared roles vs 9 local inventions | `layer-action`, `finding__button`, `explore-toggle`, `learning-save`, … each invent an action look | PRODUCT | High | 2.5 | 3.5 | P1-4, P1-5 |
| Color / theming | tokenised; both themes axe-clean | contrast failures are *rank* failures, not palette failures; palette pleasantness untested | PRODUCT / OWNER | High / — | 3.5 | 4 (accessible) | OWNER Q1 |
| Art direction | contract absent | no written contract exists; identity is implicit | OWNER | — | 2 | 3 | OWNER Q2 |
| Motion / feedback | reduced-motion probed | 0 live transitions under `prefers-reduced-motion` | STD+PRODUCT | High | 4 | 4.5 | — |
| Hebrew / RTL | built CSS grepped; bidi measured | 11 physical-direction declarations vs 26 logical; one Hebrew sentence in an LTR rail with the period on the wrong side | STD+PRODUCT | High | 3.5 | 4.5 | P2-2 |
| Responsive | 13 viewports | zero overflow anywhere; 200 % zoom and 24 px root both clean | PRODUCT | High | 4.5 | 4.5 | — |
| Accessibility | axe on 5 states incl. 2 never audited | 27 serious + 2 moderate in unaudited states; forced-colors erases the board | STD | High | 2 | 4 | P1-1, P1-2, P1-3 |
| Perceived performance | lab LCP/FCP/CLS | none; LCP 152/232 ms, CLS 0.0000/0.0023 | PRODUCT | High | 4.5 | 4.5 | — |

---

## C. State-by-state map

Measured at 1440×900 unless stated.

| | `ARRIVE` (`/` cold) | `DECIDE` (`/play`) | `REVEAL` | `REFLECT` (`/` with a record) |
|---|---|---|---|---|
| Primary task | start the first decision | commit a move + a read | read what the decision showed | read what the record can and cannot say |
| Primary object | the username field | the board | the verdict | the finding |
| Primary action | `קחו אותי לעמדה` | `.commitment-submit` | `.reveal-continue` | `העמדה הבאה` |
| Density class (prior) | FOCUS | FOCUS | COMPACT | RICH |
| Density class (measured) | FOCUS — 18 runs | FOCUS — 87 runs, 0 fine-rank sentences | COMPACT — 128 runs, 5 | **RICH, but mis-ranked** — 127 runs, **27** |
| Visual centre | the field (773×44) | the board (77 px squares) | the board, verdict beside it | the finding headline (18 px) |
| Competing regions | the selected source toggle carries `--blue` | — | `.learning-save` carries `--ink`/700 | 27 sentences at the provenance rank |
| Information issue | — | — | composer invite at the fine rank | prose demoted to provenance |
| Visual-system issue | two meanings for one fill | — | fourth action look (`learning-save`) | fifth and sixth (`finding__button`, `layer-action`) |
| RTL issue | — | `.empty-moves` period on the wrong side | — | — |
| Accessibility issue | — | forced-colors erases the board | `heading-order`; 4 unlabelled fields *(see note)* | **27 serious contrast**, `heading-order` |
| Performance | LCP 152 ms, CLS 0.000 | LCP 232 ms, CLS 0.0023 | — | — |

> **Note on the four unlabelled fields.** Two `<textarea>` and two `<input>` on `REVEAL` return no
> `textContent`, `aria-label` or `title` in a raw DOM probe, and they are the two largest interactive
> masses on the screen (18,352 px² each). **axe does not flag them**, which means they take their
> name from a wrapping or associated `<label>` that the raw probe did not follow. They are recorded
> here as *checked and not a defect*, so that the next reader does not re-open them.

---

## D. Information budget

Per state, for the items this pass actually adjudicated. `NOW` = must be visible and salient now.

**`DECIDE`** — nothing reclassified. 0 fine-rank sentences; the board is the visual centre; the four
commitment steps are the task. The mode contract's `central: "the commitment"` is honoured.

**`REVEAL`** — `NOW`: the verdict, the continue action. `SOON`: the composer invite. `ON-DEMAND`:
everything behind `.explore-toggle`. **Reclassified:** `.learning-save`'s *visual weight* moves from
`NOW` to `SOON` — the button stays exactly where it is and keeps its label; what changes is that it
stops out-weighting the primary action. No information is removed.

**`REFLECT`** — `NOW`: the finding, the terminal "this will never fill" sentences, the primary
action. **Reclassified:** the 27 fine-rank sentences move from the *provenance* rank to the *body*
rank. **This adds no items and removes none.** It is a rank correction, not a density cut.

**`NOT-JUSTIFIED`: none found this pass.** The honest answer to #56's Q10 — *is there simply too much
on these screens* — is that the counts measured here do not establish it. `REFLECT`'s 127 runs are
not obviously excessive for a mode whose contract is *"what the record can and cannot say"*, and
choosing between two defensible densities is what a person using the product decides. **Q10 stays
FIELD-REQUIRED and is not resolved by this pass.**

---

## E. Visual grammar inventory

**Typography.** Seven ranks, `--panel-fine` 11 → `--panel-display` 28. Honoured: the built
stylesheet contains one raw `font-size` literal. **Distribution is the defect**, per §A.2.

**Spacing.** `--s1` 4 → `--s6` 28. No defect found.

**Controls — three shared roles and nine local inventions.** Shared: `primary-control` (8 uses),
`ghost-control` (8), `icon-control` (4). Invented: `learning-save`, `layer-action`, `finding__button`,
`finding__action`, `explore-toggle`, `rail-button`, `analysis-action`, `blitz-control__again`,
`counterfactual-panel__control`. Nine components each answered *"what does an action look like"*
locally.

**Fills, on `REVEAL`, every filled control:** `--blue` → the primary action (1). `--ink` → the
disabled composer save (1). The board's two square colours. **On `ARRIVE`, with the field filled:**
`--blue` → the primary action **and** the selected source toggle. One fill, two roles.

**Icons.** 36 lucide glyphs at **eight** sizes: 12, 13, 14, 15, 16, 17, 18, 44. 36 uses at 14, then
a tail of 13/15/17 — steps of 1 px, which is below what an eye ranks. This is the icon-scale
analogue of the type defect #55 fixed. Filed **P2**, not fixed here.

**Feedback states.** `disabled` is expressed two ways: a declared token pair
(`.first-decision-form .primary-control:disabled`) and `opacity: 0.45` (`.learning-save:disabled`).
#55 established the first as correct and removed the second in one place only.

---

## F. Hebrew / RTL report

`<html lang="he" dir="rtl">`. RTL is the product's native direction, not a flip.

**Logical properties.** The built stylesheet carries **26** logical declarations
(`border-inline-start` ×9, `padding-inline-start` ×8, `text-align: start` ×5, `margin-inline-*` ×4)
against **11** physical ones (`border-left` ×5, `margin-right` ×2, `border-right` ×1, bare
`left`/`right` ×3) plus one `text-align: left`. The physical ones were read at their call sites;
several are legitimate — a `left: 2px` positioning a decoration inside an already-mirrored box is not
a direction claim. None was found to invert a meaning. **No P0/P1.**

**Mixed script.** Nine mixed Hebrew+Latin runs on `DECIDE`; eight carry `unicode-bidi: isolate` and
render correctly: `Stockfish בעומק 4`, `0 נמדדו מתוך 0 שנרשמו`, `העתק FEN`. `dir="ltr"` is applied
deliberately and correctly at 21 sites — PV lines, FEN, PGN, usernames, SAN, CPL numbers, chart
frames.

**One defect.** `.empty-moves` — *"הלוח מוכן למהלך הראשון."* — is a pure-Hebrew sentence rendered
inside `.moves-rail`, which is `dir="ltr"` because it holds chess notation. Measured with Range
rects: the first character `ה` paints at **x = 273**; the final period paints at **x = 283**, ten
pixels to its **right**. In a right-to-left sentence the period belongs at the left end. It renders
before the first word. **P2-2.**

**Chronology.** The move rail runs left-to-right and is not reversed by the RTL page. Correct: it is
a time sequence in a notation system that is itself LTR.

---

## G. Art-direction diagnosis

**What the interface communicates today, read off the built page rather than intended:** a warm
paper ground (`#e9e4d8`), deep desaturated ink, a single reserved blue, a wood-toned board, one
serifless Hebrew face and a mono for readings. It reads as **a quiet instrument on paper** — closer
to a laboratory notebook than to a chess site, and deliberately far from Chess.com and Lichess.

Two things undercut it, and both are structural rather than chromatic: nine local action looks, and
one fill carrying two meanings.

**No art-direction contract exists in the repository.** Writing one is not a measurement, and the
five desired / five forbidden adjectives the brief proposes are hypotheses about the owner's taste,
not findings. **A contract is drafted in the post-implementation report and marked
OWNER-REQUIRED**; Claude may document it and may not ratify it.

---

## H. Evidence / UI reconciliation

`D25` reads `CONSTRUCT-UNDERIDENTIFIED`, `E1` reached, `E2` attempted and not reached, `Humans
measured: 0`.

`client/src/lib/features.ts`, in its entirety, is one line with no comment:

```ts
export const VERIFIED_LEARNING_ENABLED = import.meta.env.VITE_VERIFIED_LEARNING_ENABLED !== "false";
```

It gates `LearningRuleComposer` after every reveal (`Home.tsx:2296`) and `LearningQueue` inside
`RecordExplorer` (`:157`). `docs/VERIFIED_LEARNING.md` states the default plainly.

**What is not wrong.** The *copy* is careful and was checked line by line: the composer's button says
`שמירת כלל כהשערה` — save the rule **as a hypothesis** — its heading says *"formulate a refutable
rule"*, the confirmation says *"saved as a hypothesis"*, and `OutcomeSummary` already carries a note
about a hypothesis rendered with the authority of a replicated finding. `shared/learning-record.ts`
starts every rule at `grade: "hypothesis"` and requires two distinct dates in either direction. The
vocabulary does not overclaim.

**What is wrong is the default and the weight.** A constant named `VERIFIED` reaching every user by
default, over a decision that says the construct is underidentified, is the stronger claim shipping
while the weaker one is written down — #56's phrasing, verified here. And the surface it gates
carries `--ink` at weight 700, the heaviest treatment in the product, which is §Layer 1's
*"visual salience must not manufacture certainty"* in its most literal form.

**Claim classification of the learning surface:** `H` (hypothesis). It currently renders with the
visual authority of `I` (supported inference). Both halves are addressed in this pass: the default
becomes opt-in, and the weight is brought under the primary action.

**No stored data is deleted and no learning theory is invented.**

---

## I. P0 / P1 / P2 register

| ID | Layer | State | Symptom (measured) | Class | Pri | Resolution |
|---|---|---|---|---|---|---|
| **P0-1** | Semantic trust | all | `VERIFIED_LEARNING_ENABLED` on-unless-disabled over `D25 = CONSTRUCT-UNDERIDENTIFIED` | PRODUCT | P0 | REPO |
| **P1-1** | Density / typography / a11y | `REFLECT` | 27 sentences at `--panel-fine`, the rank declared "never load-bearing"; 27 serious contrast failures on the same elements (4.27, 3.17, 2.83 : 1) | PRODUCT + STD | P1 | REPO |
| **P1-2** | Evidence integrity | — | axe audits 3 cold routes; `REVEAL` and `/`-with-data never audited, and hold the failures | PRODUCT | P1 | REPO |
| **P1-3** | Accessibility | `DECIDE` | `forced-colors: active` → all 64 squares `#fff`, all pieces `#000`; position unreadable | STD | P1 | REPO |
| **P1-4** | Semantic trust / grammar | `REVEAL` | `.learning-save` = `--ink` @700, heaviest fill in product, on the `H`-grade surface; `opacity: 0.45` when disabled | PRODUCT + EMP | P1 | REPO |
| **P1-5** | Salience / grammar | `ARRIVE` | `--blue` is both *primary action* and *selected toggle* on one screen | PRODUCT + EMP | P1 | REPO |
| **P2-1** | Accessibility | `REVEAL`, `REFLECT` | `heading-order`: `.reveal-limits > h3`, `.finding__headline` | STD | P2 | REPO |
| **P2-2** | Hebrew / RTL | `DECIDE` | `.empty-moves` period paints 10 px right of the first character | STD | P2 | REPO |
| **P2-3** | Interaction | `REVEAL` | `.explore-toggle` 36 px tall against a declared 44 px loop floor | PRODUCT | P2 | REPO |
| **P2-4** | Iconography | all | 8 icon sizes (12–18) for one role; 1 px steps rank nothing | EMP | P2 | deferred |
| **P2-5** | Component grammar | all | 9 locally-invented action looks beside 3 shared roles | PRODUCT | P2 | deferred |

P0-1 and P1-1…P1-5 are implemented in this pass. P2-1, P2-2 and P2-3 are small, local and carried
with them. P2-4 and P2-5 are **deferred deliberately**: both are consolidations whose end state is an
aesthetic choice, and §20 forbids building a design-system package for it.

---

## J. OWNER-REQUIRED register

1. **Is the palette liked?** (#56 Q9.) Tokenised, both themes declared, contrast measured — that is
   *systematic and accessible*, not *liked*. No hue moved in #55 or here, so there is not even a
   before/after to compare.
2. **Is the art-direction contract right?** The five desired / five forbidden adjectives are a
   hypothesis about the owner's taste. Claude may draft; only the owner may ratify.
3. **Does the product have enough character, or is "quiet instrument on paper" too austere?**
4. **Is `EXPERIMENTAL_LEARNING_ENABLED` the right resolution**, versus keeping the default and
   renaming the surface? Both were open in #56; this pass takes the direction the brief names.

## K. FIELD-REQUIRED register

1. **Is there simply too much on these screens?** (#56 Q10.) §D says the counts do not establish it.
2. **Does 14 px read better than 11 px for these sentences in Hebrew**, beyond the contrast
   requirement that forces the change anyway?
3. **Is the reveal understood as a hypothesis rather than a verdict?**
4. **Do players find the next action without reading the whole screen?** The grayscale, blur and
   copy-stripped diagnostics below approximate this; they do not measure it.
5. **Does opt-in learning leave returning players stranded**, having seen the composer before?

## L. Targeted research needs

**None.** Every remaining question is either measured here, OWNER-REQUIRED or FIELD-REQUIRED. Per
§28: no research is proposed that cannot name the decision it would change.

## M. Implementation plan

Small falsifiable batches, in this order, each verified before the next:

1. **PHASE 0** — P0-1: `EXPERIMENTAL_LEARNING_ENABLED`, opt-in, no data deleted.
2. **PHASE 2/5** — P1-1: sentences to the body rank, with a contrast pair that clears 4.5:1.
3. **PHASE 4** — P1-4, P1-5: the two grammar collisions.
4. **PHASE 10** — P1-3, P1-2, P2-1: forced colors, then extend the axe suite to the states that
   hold the failures.
5. **PHASE 3** — P2-2: the bidi isolate.
6. **PHASE 9** — P2-3: the tap floor.
7. Tests locking each relationship; then falsification; then owner review.

No architecture change. No new dependency. No design-system package. `Home.tsx` is not rewritten.

---
---

# Part II — after: what changed, and what it cost

Everything below was re-measured on the built app after the change, by the same probes that
produced Part I. Where a number did not move, it says so.

## 1. Executive verdict

**Three of the four things in §A were one defect, and it is closed. The fourth was a decision, and
it has been taken.**

The contrast failures, the rank misuse and the "least-supported claim wearing the heaviest ink"
were not three problems. They were a stylesheet that expressed *recession* by **fading** — an
`opacity` on text, or `rgba(var(--ink-rgb), α)` as a text colour — in a file that had already
written down, twice, why that does not work: *"an alpha composites into whatever is behind it and
stops being a number anyone can check."* It was right about borders and it was right about text.
Recession is now the type scale, which has seven ranks and all of them are legible.

The fourth was `VERIFIED_LEARNING_ENABLED`. It is `EXPERIMENTAL_LEARNING_ENABLED` now, `=== "true"`,
off unless a deployment asks. Nothing stored moved.

**What did not change, and is the honest headline: the product does not look different.** No hue
moved. No layout moved. No panel was reorganised, nothing went behind a disclosure, and nobody who
knows this interface would notice most of this pass from a screenshot. What changed is that eight
classes of text became readable, one board survives a reader's own palette, one full stop is at the
right end of one sentence, and a suite that reported green now goes where the failures were.

## 2. Layer scorecard

**These are estimates, and they are labelled as estimates.** No instrument here produces a maturity
number; the column is a judgement about how much further repository, browser and standards evidence
could take each layer, and it is offered so the ceiling is visible, not so the number is believed.

| Layer | Before (est.) | After (est.) | What moved |
|---|---|---|---|
| Semantic / epistemic trust | 2 | **4** | opt-in flag; heaviest ink off the `H`-grade surface |
| Interaction mechanics | 4 | **4.5** | `.explore-toggle` joins the declared tap floor |
| Spatial composition | 4.5 | 4.5 | nothing; #52 holds under re-measurement |
| Action salience | 3 | **4** | one fill, one role; primary is now the largest mass on `REVEAL` |
| Information hierarchy | 4 | **4.5** | two heading-order defects closed; one sub-heading un-inverted |
| Information density | 2.5 | **3.5** | prose off the floor rank; the 12 px question left open |
| Typography | 3 | **4** | 17 sub-body paragraphs on `REFLECT` → 6, all of them legitimately fine-rank |
| Spacing / rhythm | 4 | 4 | untouched |
| Component grammar | 2.5 | **3** | one local invention removed; eight remain |
| Color / theming | 3.5 | **4** | no hue moved; every pair now measurable rather than composited |
| Art direction | 2 | 2 | a contract is *drafted* below and is not ratified |
| Motion / feedback | 4 | 4 | 0 live animations under reduced motion, before and after |
| Hebrew / RTL | 3.5 | **4.5** | the one measured bidi defect closed |
| Responsive | 4.5 | 4.5 | 0 overflow at 26 viewport/route pairs, before and after |
| Accessibility | 2 | **4** | 28 violations in unaudited states → 0, and the states are now audited |
| Perceived performance | 4.5 | 4.5 | LCP 148/256 ms, CLS 0.0000/0.0023 |

## 3. State-by-state, before → after

| | `ARRIVE` | `DECIDE` | `REVEAL` | `REFLECT` |
|---|---|---|---|---|
| Visible text runs | 18 → **18** | 87 → **87** | 128 → **111** | 127 → **127** |
| axe violations | 0 → 0 | 0 → 0 | 1 → **0** | 28 → **0** |
| Controls wearing `--blue` | 2 → **1** | 1 → 1 | 1 → 1 | 1 → 1 |
| Strongest non-board control, copy stripped | primary | primary | 3rd → **primary** | primary |
| `<p>` below the body rank | 2 → **1** | 6 → **3** | 6 → **2** | 17 → **6** |

`REVEAL` is the one state that lost content, and it lost it on purpose: 128 → 111 runs is the
learning composer no longer rendering in a default build. See §4 and §10.

## 4. Information removed or deferred

| What | Why | Where it went | Why no needed context was lost |
|---|---|---|---|
| The learning-rule composer, on every reveal | `D25 = CONSTRUCT-UNDERIDENTIFIED`, humans measured: 0, and the flag was on-unless-disabled | Behind `VITE_EXPERIMENTAL_LEARNING_ENABLED=true` | The reveal's own three blocks — what this decision does not say, what happened, what is worth testing — are untouched, and they are what `MODE_CONTRACT.REVEAL` names as central. Every stored rule, transfer test and observation is intact and returns the moment the flag is set. |
| The learning queue, in the record explorer | same | same | The explorer's other three readings render unchanged; the test that used to assert the queue's presence now asserts its absence, so the removal cannot happen silently in reverse. |

**Nothing else was removed, hidden, collapsed or moved behind a disclosure.** The re-ranked
sentences on `REFLECT` are the same sentences, in the same order, in the same place, larger. Run
counts on `ARRIVE`, `DECIDE` and `REFLECT` are identical before and after.

## 5. Visual grammar diff

| | Before | After |
|---|---|---|
| Text recession | `opacity` on the element, or `rgba(var(--ink-rgb), α)` at α 0.55–0.80 | `var(--muted)`, declared, measured on all ten ground/theme pairs, worst 4.59:1 |
| Disabled | two languages: a declared pair, and `opacity: 0.45` | one language: a declared pair |
| Secondary action | 3 shared roles + 9 local inventions | 3 shared roles + **8** local inventions (`.learning-save` joined `ghost-control`) |
| `--blue` | primary action **and** selected toggle | primary action |
| Selected toggle | `--blue` fill | `--chip` ground, `--ink` edge, weight 600, `aria-pressed` unchanged |
| Prose rank | 11 px (`--panel-fine`, "never load-bearing") | 14 px (`--panel-body`, "the floor for anything that is a sentence") |
| Forced colours | nothing declared | one scoped block: 4 opt-outs, 2 marks re-stated in system colours |

## 6. Art Direction Contract — **DRAFT, OWNER-REQUIRED**

Read off the built product rather than proposed for it, and **not ratified.** §18 of the brief is
explicit that Claude cannot self-approve aesthetic acceptance, so this is a hypothesis about what
the interface already is, offered for the owner to accept, amend or reject.

**Desired (5):** quiet · precise · paper · chess-first · evidence-conscious
**Forbidden (5):** generic-SaaS · gamified · dashboard-chaotic · clinically-cold · prototype-like

- **Typography voice.** One Hebrew sans for everything a person reads; one mono, used only where a
  glyph is a *reading* — a move, an evaluation, a count. Seven ranks, no eighth.
- **Material voice.** Warm paper (`#e9e4d8`), raised surfaces rather than shadowed cards, hairlines
  rather than boxes. #55's argument stands: whitespace groups, borders do not.
- **Brand presence.** One knight and a wordmark, once, at the top. No watermark, no repetition.
- **Icon voice.** Line icons at a single weight. Currently **eight** sizes for one role — the one
  place the draft contract and the built product disagree, and it is filed as P2-4.
- **Decorative restraint.** Nothing on screen that is not a reading, a control, or a sentence.
- **Motion voice.** Motion explains a state change or does not exist. Verified: 0 live animations
  under `prefers-reduced-motion`.

## 7. Hebrew / RTL

`<html lang="he" dir="rtl">`. 26 logical declarations against 11 physical ones, each of the eleven
read at its call site, none inverting a meaning. 21 deliberate `dir="ltr"` sites — PV, FEN, PGN,
SAN, usernames, CPL, chart frames — all correct.

**One defect found and closed.** `.empty-moves` measured with Range rects: first character at
x = 273, full stop at x = 283 — ten pixels in front of the first word. Now x = 277 and x = 112. The
assertion is on glyph positions rather than on `dir`, for the reason
`signed-number-reads-as-signed` already gives about this class of bug.

**No P0/P1 remain.**

## 8. Accessibility

| | Before | After |
|---|---|---|
| States audited by axe | 3 (cold routes) | **5** (3 cold routes + `REVEAL` + `/` with a record) |
| Serious/critical | 27, in states nothing audited | **0** |
| Moderate | 2 (`heading-order` ×2) | **0** |
| Forced colours | 64 identical squares, identical pieces | checkerboard and piece colours preserved; marks in `Highlight`/`LinkText` |
| Dark theme | 0 violations | 0 violations |
| 200 % zoom / 24 px root | no horizontal overflow | no horizontal overflow |
| `prefers-reduced-motion` | 0 live animations | 0 live animations |
| Tap floor, decision loop | one control at 36 px | **0** below 44 px |

**Not tested, and stated rather than implied: no screen reader was run.** No claim is made about
NVDA, JAWS or VoiceOver. axe checks names, roles and structure; it does not check whether an
announcement makes sense to a person hearing it. That is FIELD-REQUIRED.

## 9. Perceived performance

Lab measurements in Chromium on a local server. **These are not field Core Web Vitals** and RUM
remains production evidence.

| | Before | After |
|---|---|---|
| `/` lab-LCP / FCP | 152 ms | 148 ms |
| `/play` lab-LCP / FCP | 232 ms | 256 ms |
| `/` CLS | 0.0000 | 0.0000 |
| `/play` CLS | 0.0023 | 0.0023 |

The 24 ms on `/play` is within run-to-run variation on this harness and is not attributed to the
change. No P0/P1.

## 10. Semantic / epistemic trust

`D25` says `CONSTRUCT-UNDERIDENTIFIED`. The learning surface is graded `H` — hypothesis. Before this
pass it rendered with the authority of `I` in two independent ways, and both are closed:

1. **It shipped by default.** `!== "false"` → `=== "true"`. Off unless asked for, and failing closed
   on a misspelt flag. The constant no longer contains the word `VERIFIED`, which was a claim the
   evidence does not support.
2. **It carried the heaviest treatment in the product.** `--ink` at weight 700, above a primary
   action at 400. It now uses the shared secondary grammar.

Re-measured on a default build at `REVEAL`: composer absent, queue absent, **zero occurrences of
"verified" or "מאומת" anywhere on screen.**

**What was already right and was left alone:** the copy. `שמירת כלל כהשערה` — *save the rule as a
hypothesis* — the composer's heading asking for a *refutable* rule, the confirmation naming it a
hypothesis, `grade: "hypothesis"` on every new rule, two distinct dates required in either
direction, and `OutcomeSummary`'s existing note about hypotheses promoted by layout. The vocabulary
did not overclaim and was not rewritten.

## 11. Measurement protocol

**Did the measurement stimulus change?** Asked as a measurement rather than as an opinion. All 27
touched classes were searched for on the built app at `DECIDE` cold, at `ANSWER_INSTRUMENT` with a
move played, and again with every instrument step answered and nothing committed.

**Exactly one paints on any of those three:** `.empty-moves`, the move rail's empty-state status
line, 16 px, unchanged in size, colour and position. What changed about it is one bidi-neutral full
stop moving to the correct end of a sentence that is not part of the instrument.

Two changes land on `/` — the front door, before any decision exists: `.first-decision-note` moved
off the floor rank, and the selected source toggle stopped wearing the primary fill.

**Does the protocol version need separation? No, and the reasoning is now in
`shared/measurement-protocol.ts` rather than absent**, together with the case that gives pause
(`.first-decision-note` is framing, and the 2→3 bump listed "two sentences became legible" among its
reasons — but both of those were on the decision screen, and this one was already legible) and an
explicit list of what *would* have forced a bump, so the next reader can check this rather than
trust it.

`CURRENT_PROTOCOL_VERSION` stays at **3**.

## 12. Falsification

The new tests were run against `5ecc58e` — the tree they were written to describe — with the fixes
reverted and the tests kept.

| Attempt | Expected failure | Result | Action |
|---|---|---|---|
| Revert the stylesheet, keep the new axe test | 27 serious + 2 moderate return | **RED**: `serious color-contrast x27 .unclear__group[data-waiting="false"] > .unclear__because` | none; the test is not vacuous |
| Revert, keep the fill test | 2 wearers of `--blue` | **RED**: `expected […(2)] to have a length of 1 but got 2` | none |
| Revert, keep the forced-colours test | squares identical | **RED**: `expected 'rgb(255, 255, 255)' not to be 'rgb(255, 255, 255)'` | none |
| Revert, keep the bidi test | full stop before the sentence | **RED**: `expected 283.125 to be less than 273.078125` | none |
| Does the axe harness pass vacuously? | it must still reach both states | **GREEN on the old tree**: markers found, 37/41 rules evaluated | none; a green result cannot mean a walk that stopped early |
| Blur/squint: does a secondary region dominate? | a competing mass | strongest masses are `commitment-screen`, `primary-control`+`evaluation-track`, `record-layer`+`finding` | `.move-timeline` outranks the primary on `REVEAL` by container area at 45 % alpha; recorded, not acted on |
| Copy-stripped: is the next action findable? | some state fails | **all four states**: strongest non-board control is the primary action | none |
| Grayscale: does rank survive without hue? | rank collapses | `ARRIVE` primary Δ0.688 vs toggle Δ0.100, a 6.9× separation | none |
| Density: was anything hidden? | a run count drops | `ARRIVE`/`DECIDE`/`REFLECT` identical; `REVEAL` 128→111 | that 17 is the composer, and it is §4 |
| Typography: does the rank change break the grid? | overflow or clipping | 0 overflow at 26 viewport/route pairs; 200 % zoom and 24 px root clean | none |
| Did the rank change invert a heading? | a heading under its body | **RED, caught by the repo's own test**: `H4.profile-panel__subtitle 12px < 14px` | fixed: subtitle → `--panel-data`, the rank its role already uses |
| Motion under reduced-motion | an animation survives | 0 | none |
| Performance: did polish cost anything? | LCP or CLS rises | 148/256 ms, CLS unchanged | none |
| Epistemic: did authority outrun evidence? | a learning surface reachable by default | composer absent, queue absent, 0 "verified" on screen | none |

The eleventh row is the one worth keeping: the change **did** introduce a defect, and the existing
suite caught it before the pass ended.

## 13. Remaining P2

- **P2-4 Iconography.** 36 glyphs at eight sizes (12–18 and 44); 1 px steps rank nothing.
- **P2-5 Component grammar.** Eight locally-invented action looks remain beside the three shared
  roles.
- **12 px prose.** ~10 paragraphs sit at `--panel-label`, whose declaration also reads "never a
  sentence". Moving them is a materially larger change to how much of `REFLECT` fits on a screen.

All three are consolidations whose end state is an aesthetic choice. §20 forbids building a
design-system package for it, and §16 forbids letting P2 become infinite work.

## 14. Verification — every command actually run

```
npm run verify        # check && build && test && gates && gates:controls && bundle:budget
  tsc --noEmit                                                          clean
  vite build                                                            built
  vitest run            258 files passed, 2 skipped;  2,894 tests passed, 26 skipped, 0 failed
  gates                 27 gates: 27 pass, 0 fail, 0 not-measured
  gates:controls        27 gates: 0 pass, 27 fail  ("all implemented controls went red" = correct)
  bundle:budget         within budget
                          entry, raw               670.0 kB / 678 kB
                          entry, gzipped           209.1 kB / 211 kB
                          initial download, raw    752.9 kB / 761 kB
```

Run individually during the pass, and again inside the suite above:

```
vitest run tests/layout/axe-past-the-commit.layout.test.ts               3 passed   (new)
vitest run tests/layout/what-a-colour-and-a-direction-mean.layout.test.ts 3 passed  (new)
vitest run tests/layout/what-the-eye-ranks-first.layout.test.ts          green after the P2 fix
vitest run tests/client/reveal-order.test.tsx                            green after the tag change
vitest run tests/client/the-reveal-is-a-path-not-a-toolbox.test.tsx      9 passed
```

**Bundle cost of this pass: 0.29 kB of CSS** (84.65 → 84.94 kB raw). No dependency was added, no
library was introduced, no icon was added. The ~220 lines of stylesheet comment are stripped by the
minifier and cost nothing.

**Browser evidence** was produced by probes kept out of the tree under `audit.local/` (ignored by
`.gitignore`'s `*.local`): the viewport matrix, the axe runs on unaudited states, the fade-chain
walk, the contrast grouping, the bidi Range measurement, the pre-commit stimulus search, and the
thirteen-row falsification harness. Everything they found that is worth keeping is either a test in
`tests/layout/` or a number in this document.

## 15. OWNER-REQUIRED

1. **Is the palette liked?** (#56 Q9.) Still open, and still not answerable from here. No hue moved
   in #55 or in this pass, so there is not even a before/after to compare. Tokenised, both themes
   declared, every pair now measurable — that is *systematic and accessible*, and it is not *liked*.
2. **Ratify, amend or reject the Art Direction Contract in §6.** It is drafted from what the built
   product already is, not proposed for it. Claude may document it and may not approve it.
3. **The 12 px prose.** ~10 paragraphs sit at `--panel-label`, whose declaration also says "never a
   sentence". Moving them to the body rank is defensible by the same argument that moved the 11 px
   ones, and it materially changes how much of `REFLECT` fits on a screen. That trade is a
   preference, so it was not taken.
4. **Is `EXPERIMENTAL_LEARNING_ENABLED` the right resolution**, versus keeping the default and
   renaming the surface? #56 left both open; this pass took the direction the brief named.
5. **Does the product have enough character**, or is "quiet instrument on paper" too austere?

## 16. FIELD-REQUIRED

1. **Is there simply too much on these screens?** (#56 Q10.) Explicitly **not** resolved here. §D
   says the counts do not establish it: `REFLECT`'s 127 runs are not obviously excessive for a mode
   whose contract is "what the record can and cannot say", and choosing between two defensible
   densities is what a person using the product decides.
2. **Does 14 px read better than 11 px for these sentences in Hebrew**, beyond the contrast
   requirement that forced the change anyway?
3. **Is the reveal understood as a hypothesis rather than a verdict?**
4. **Do players find the next action without reading the whole screen?** The grayscale,
   copy-stripped and blur diagnostics in §12 approximate this and do not measure it.
5. **Does opt-in learning strand a returning player** who has seen the composer before?
6. **Screen readers.** No screen reader was run. axe checks names, roles and structure; whether an
   announcement makes sense to a person hearing it is not something axe can answer.

## 17. Status

```
PRE-FIELD FRONTEND TECHNICAL DOD: PASS
OWNER VISUAL ACCEPTANCE:          PENDING
PRE-FIELD FRONTEND DOD:           PENDING
```

The middle line is not a formality and cannot be moved from here. #56 withdrew #55's pass precisely
because §41's owner gate *"was not failed — it was absent"*, and four green rows plus a sixth that
cannot be self-assessed added up to a pass. The gate is named here, and it is open.
