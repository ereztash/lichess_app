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
