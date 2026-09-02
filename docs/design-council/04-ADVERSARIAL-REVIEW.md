# The adversarial review register

Three independent passes ran against this work, each with a different job and none of them written
by the author of the direction:

| # | pass | when | saw |
| --- | --- | --- | --- |
| 1 | **Pre-implementation critique** | before a line changed | the proposed direction, the baseline, the base screenshots, the stylesheet |
| 2 | **Blind critique** | after implementation, **before the rationale** | ten rendered screenshots and nothing else. Not the contract, not the constitution, not the stylesheet |
| 3 | **UI/UX red team** | after implementation | the running product in Chromium, driven at four viewports, with instructions to prove the redesign harmed it |
| 4 | **Informed critique** | after the blind pass | the contract, the design system, and the rendered result, asked whether one fulfils the other |

Every finding is recorded, including the ones that were not acted on. A register that lists only
what was fixed is a register that makes the pass look better than it was.

---

## 1. Pre-implementation critique — what it changed before anything shipped

The draft direction went in and came back with four blockers. The direction that was frozen is not
the direction that was proposed, and these are the differences.

| # | finding | what it changed |
| --- | --- | --- |
| PC-1 | **The signature was false at the machine's largest object.** `.evaluation-track`, 20×596, squint mass 9,100, was drawn in `--ink` — the *page's* material — while the direction claimed everything the machine returned was drawn in its own. And the proposed falsification was one-directional: it tested *controls are not blue*, never *machine output is blue*, so it could not fail in the direction the design actually failed | the gate runs both ways and its control reddens twice; the track is `--machine` and 16px |
| PC-2 | **"Five semantic colours, each with one job" was not true of this palette.** `--chosen`, `--accent-soft`, `--last-move` and the five-colour chart palette (validated at ΔE 26.1 / 20.2 protan) were unmentioned. "The machine's blue is the only saturated colour" is false on `EXPLORE` the day it ships | the contract names three colour systems it does not govern, and the claim is scoped to the interface layer |
| PC-3 | **Evidence authority was dropped**, though the constitution says this pass takes it: `[data-authority="tested"]` was `--blue`, and no grade→weight mapping existed | one declared ladder, value then weight, written at the declaration |
| PC-4 | **The proposal re-created the nine-jobs defect on ink**, and unlike a hue, ink has nothing to be told apart by | accepted as the RISK, stated with its measured cost, and answered by shape rather than by hue |
| PC-5 | the player's hand on the board would become unreadable in the board's own wood | two grounds per mark, and later a bounding ring |
| PC-6 | provenance carried by colour alone is 1.4.1 waiting to happen, against this file's own rule that "colour never carries it alone" | the signature became a **plane** first and a hue second |
| PC-7 | deepening the canvas would close the page/board gap from 1.14:1 to 1.09:1 and invalidate every contrast note in the file | `--paper` was moved and put back; the separation is bought at the top of the ladder only |
| PC-8 | `ch` is a Latin metric; set the measure from rendered Hebrew | done, and it caught a layout shift on the way |

---

## 2. Blind critique — ten screenshots, no context

The critic was given the rendered screens and told nothing. Two results matter more than the list.

**It named the product correctly.** *"A chess self-assessment tool, not a chess trainer … you
commit a move plus a written reading plus a 1–7 confidence rating before any engine output, then
the engine speaks."* Nothing on the screens says that in words.

**It found the signature without being told there was one**, and grouped its two members correctly:

> *"Everything is warm cream/brown except two elements — the 'פרטי הניתוח' disclosure bar and the
> eval-bar rail on REVEAL/EXPLORE, both cold blue-gray. They match each other and nothing else."*

Filed by the critic under **inconsistencies**, which is the honest reading of an unexplained
difference and is exactly the field question: perceptible is not the same as understood, and
`VALUE_CLARITY_FIELD_PROTOCOL` Arm B is the instrument, not this document.

### Findings

| ID | finding | class | outcome |
| --- | --- | --- | --- |
| BC-1 | the evaluation number is rotated inside a 16px track, clipped on both sides, illegible | REPO | **fixed** — it is a horizontal reading under the gauge, with the engine's identity beside it |
| BC-2 | the loop strip's ticks disappear entirely under `forced-colors`, live one included | REPO | **fixed** — `GrayText` / `Highlight`, in a block placed after the rules it must beat |
| BC-3 | the explore door is a dashed box and reads as an empty labelled container | REPO | **fixed** — dashed now means one thing, "not yet"; the door is a secondary control |
| BC-4 | "חובה" persists on steps that already show an answer and a check | PRODUCT | **not taken.** `P2-8`: its behaviour is documented and tested ("what is required has to be knowable before the click"). Removing a tested behaviour for a salience gain is not this pass's call |
| BC-5 | three counts disagree on `DECIDE` (four unanswered steps, one named missing item, "2 missing") | PRODUCT | **not taken.** Copy and derivation, not art direction. Recorded for the debt register |
| BC-6 | `1 נמדדו` and `0 נמדדו מתוך 1 שנרשמו` appear 400px apart on `REVEAL` | PRODUCT | **not taken**, same reason |
| BC-7 | the untranslated state labels `DECIDE` / `REVEAL` read as internal enum values | OWNER | **not taken.** `VISUAL_ARCHITECTURE_AUDIT` §10.4 already classes these FIELD-REQUIRED and says do not guess |
| BC-8 | `ARRIVE` has four paragraphs before a control; the caveat is restated up to three times | FIELD | **not taken.** The front door's sentences are frozen by `shared/promise.ts` and a field protocol that has not run |
| BC-9 | the step-rail's active label wraps and is clipped at the viewport edge | REPO | **not taken this pass.** Recorded; it is a layout fix in a component this pass did not otherwise touch |
| BC-10 | the confidence scale wraps 5+2, leaving an orphan row | REPO + PROTOCOL | **not taken**, and the reason is a conflict: seven columns at the declared 44px floor need 330px, and the panel is 291px at 390. Fixing the wrap either breaks the tap floor or turns the instrument into a scroll row, and both are instrument decisions. See RT-2 |
| BC-11 | `REFLECT`'s first card starts 288px right of everything below it | REPO | **fixed** — one column width; the measure belongs to the prose, not to the block |
| BC-12 | the eval column's cold grey "matches nothing else on the page" | — | **this is the signature.** Recorded as the blind confirmation it is |

---

## 3. UI/UX red team — the running product

**No P0.** Every task in the loop completes in Chromium at all four viewports: the board takes
mouse and keyboard, the instrument accepts answers, commit reaches the reveal, blitz starts, plays
and resigns, and there is no horizontal overflow at any width. The red team says so plainly rather
than inflating.

| ID | finding | severity | class | outcome |
| --- | --- | --- | --- | --- |
| RT-1 | **the same 7-point confidence scale runs in opposite directions on `/play` and `/blitz`** — `dir="ltr"` on one, document RTL on the other, so "the third box" means two different confidences | P1 | REPO + **PROTOCOL** | **fixed** — the direction is removed; the labels are Hebrew and the document is Hebrew, and a single digit is not a Latin *run* |
| RT-2 | the same scale wraps 5+2 at 1440, 6+1 at 390, 7 at 1024 — the instrument's shape is a function of the window | P1 | REPO + PROTOCOL | **not taken.** 7 × 44px does not fit a 291px panel, and the 44px floor is a rule this product enforces. Every fix is an instrument decision: `FIELD` / `OWNER` |
| RT-3 | the sticky commit control paints over live rows of the panel it belongs to | P1 | REPO | **partly fixed** — the panel now has a foot the height of the control, so its own last row clears it. Overlaying content that scrolls *under* it is what a sticky control is, and the stylesheet already argues for it |
| RT-4 | the one next action is below the fold at three of four viewports | P1 | REPO | **not taken.** Pinning it at stacked widths is a layout change to the state that produces evidence, on top of a protocol bump this pass already spent. Recorded |
| RT-5 | at 844×390 the first screen contains none of the task | P1 | REPO | **not taken**, same reason. A short-height landscape branch is its own pass |
| RT-6 | **the not-ready commit control became the quietest thing in its own panel** — 14th of 87 runs by ink mass, behind four inert legends and the wordmark | P1 | REPO | **fixed, and it is this pass's own regression.** Removing the alarm was right; replacing it with nothing was not. Ink and a dashed ink edge: not a failure, and the heaviest thing in the panel |
| RT-7 | on the front door one fill means "you chose this", "you cannot press this" and "I am working" — pending is byte-identical to disabled | P1 | REPO | **not taken this pass.** Recorded, with the token named: `--chip` on `:disabled` and on `[aria-pressed="true"]` |
| RT-8 | pressing explore grows the document 3,478px with a 2px visible change on desktop, and jumps to the absolute bottom on a phone | P1 | REPO | **not taken.** A scroll behaviour, and the one place this pass would have to add motion |
| RT-9 | the evaluation number is rotated, clipped and blended into unreadability | P1 | REPO | **fixed** before the report landed; the red team says so itself |
| RT-10 | nine of eleven control classes have no hover; `.read-chip:hover:not(.selected)` sets the background to the value it already has | P2 | REPO | **not taken this pass.** Recorded with its cause: a specificity collision between the touch-input rule and the hover rule |
| RT-11 | **Hebrew in the DM Mono stack is painted by Liberation Serif** — read back through CDP: `בחרו מהלך על הלוח` rendered in two faces inside one string | P2 | REPO | **fixed** — the mono stack names the product's own Hebrew face after DM Mono, so Latin glyphs stay mono and Hebrew ones stop being a serif |
| RT-12 | a read-only field and the button that submits it are two dashed rounded rectangles 8px apart with nearly the same words | P2 | REPO | **fixed by RT-6's fix** — the control is ink, the field is a hairline |
| RT-13 | three "selected" idioms and six control-boundary values, ranked inversely to task importance | P2 | REPO | **partly fixed** — one edge at ≥3:1 on both grounds. The three selected idioms remain and are recorded |
| RT-14 | `<summary>` gets the browser's default 1px focus ring, which this file's own comment calls "nearly invisible on this palette" | P2 | REPO | **fixed** — one word added to the `:where()` list |
| RT-15 | a hung request changes 50 pixels in eight seconds, all of them the spinner | P2 | PRODUCT | **not taken.** A timeout and a cancel are product behaviour |
| RT-16 | "חובה" never clears | P2 | PRODUCT | as BC-4 |
| RT-17 | `REFLECT`'s left edge steps three times | P2 | REPO | **fixed** |
| RT-18 | the reveal column forces 35–45 characters, under the range the measure is set from; and one block still exceeded the cap | P3 | REPO | **half fixed** — the block is capped. The column's own 330px is the binding constraint and widening it is a layout decision; the design system now says the measure does not reach it |
| RT-19 | two shadow languages, and the board's is a hard 12×14 grey slab with physical offsets in an RTL document | P3 | REPO | **not taken.** Recorded |
| RT-20 | an evidence grade wraps mid-phrase, with the disclosure control between its halves | P3 | REPO | **fixed** |
| RT-21 | the post-game screen is 60% dead board and stopped clocks, with the one next action at the fold | P3 | REPO | **not taken.** Recorded |

**Checked and clean, in the red team's words:** the focus ring works on an ink-filled primary and on
a dark board square (888 changed pixels, focused against blurred); board keyboard navigation moves
between squares and fills the commitment field; no horizontal overflow anywhere. And one apparent
finding was withdrawn by the red team itself after measuring the piece outline — which is the
behaviour that makes the rest of the list worth reading.

---

## 4. Informed critique — does the rendered product fulfil the contract?

Four blockers, and all four were true.

| ID | finding | outcome |
| --- | --- | --- |
| IC-1 | **the machine plane is pressable, and the gate is built so it cannot say so.** `.reveal-secondary` carries the plane and is a `<details>`; `MACHINE_SURFACES` *requires* the plane on that selector while `MACHINE_TOKENS` forbade any control from carrying it. The two directions contradicted each other on one selector, and `details` was in neither of the scanner's lists | **fixed** — a ground is not a voice. `--surface-machine` left the forbidden set, `details` and `summary` joined the interactive set, and the rule is restated in both documents |
| IC-2 | **the signature is invisible in dark mode and had never been photographed there.** Page→plane 1.037:1 (ΔL 0.0022); no dark `REVEAL` in the shot set | **fixed** — the dark plane is `#1e2a2f`, measured 1.215:1 against the page, and `dark-REVEAL` at two widths is now captured |
| IC-3 | **"not measurable" is drawn as a failure.** `[data-kind="unreadable"]` in `--warn` where every sibling kind is `--muted`, and `unreadable` means `bucket-too-small`. Same defect on `.import-not-kept`, a storage condition | **fixed** — both to `--muted` / `--edge`. This is `APOLOGETIC`, the perceptual contract's own first forbidden quality, found in the product after the pass claimed to have removed it |
| IC-4 | the engine's arrow measures 1.07:1 crossing a dark square — half the contrast the design system calls unacceptable for the focus ring — and scores zero on the squint-mass probe because that probe reads `background-color` only | **fixed** for contrast (a two-tone drop-shadow outline, measured); **accepted and stated** for the probe: it cannot see SVG, so the mass table is a statement about painted grounds and says so |
| IC-5 | the chart palette's `#0077aa` is 1.6° of hue from the machine's `#1e5b72`, on the same scroll, on the *player's* data — exempted by definition and never measured | **recorded, not changed.** The ΔE 26.1 / 20.2-protan validation behind that palette is not overturned by a hue-angle argument, and re-picking it is its own measured pass. It is the strongest open objection to the signature |
| IC-6 | `ARRIVE` and `REFLECT` carry zero raised pixels — "one per screen" reads as a guarantee and is a permission | **wording fixed** ("at most one"). Whether those two screens want a central object is a composition question this pass did not open |
| IC-7 | a third entry route was added to a pre-commit screen, against a RESTRAINT line, undisclosed | **disclosed.** `ARRIVE` is an acquisition surface rather than a `producingEvidence` mode, the restraint did not reach it, and the contract now says so instead of being read as covering it |
| IC-8 | `--chip` collision on the front door: disabled primary, selected chip and the input well within 1.006:1, and `--chip` was in neither document's table | **half fixed** — `--chip` is in both tables now. The collision itself is recorded: it is a front-door composition question and `ARRIVE` is the surface this pass is most reluctant to change |
| IC-9 | the licence line runs ~150 characters, longer than every "before" figure quoted | **fixed** |
| IC-10 | `.commitment-summary { color: var(--warn) }` still live, dead only by an override 1,900 lines later — the exact shape this file warns about | **fixed** |
| IC-11 | canvas luminance stated as 0.783; it measures 0.778 | **fixed** in both documents, with a note saying why arithmetic is not the record |
| IC-12 | four Hebrew stage labels set in DM Mono at the 11px floor | **fixed** by RT-11's fix |
| IC-13 | density says "unchanged" while `REFLECT` grew 173px | **fixed** — the report states the growth and its cause |
| IC-14 | the subject-swap PASS rested on one idea, not four | **fixed** — the table now counts one, and names it: the *timing*, not the plane |
| IC-15 | five claims in the contract were unfalsifiable as written | **four fixed** by the corrections above. The fifth — *"the machine's plane is neither better nor worse than the page"* — is genuinely unfalsifiable by any test, and is now marked as what it is: a statement of intent, and a `FIELD` question |

---

## 4a. Round two, reviewed against itself

The owner looked and named three things. Those are recorded in
[`05-FINAL-REPORT.md`](05-FINAL-REPORT.md) §13. This section is the case against what was done
about them, written before the branch was pushed rather than after somebody else made it.

| # | objection | answer |
| --- | --- | --- |
| R2-1 | **The direction defect was in this pass's own tip, and this pass captured a screenshot of it and did not see it.** `DECIDE` at 1440×900 was rendered, cropped and read during the baseline, with the commitment panel at `x=24..354`. The pass measured contrast, rank, size, displacement, squint mass and measure — every quantity it could name — and none of them asks *which end of the line does this language start at*. A native reader saw it in one glance | **conceded, and it is the most useful finding of the round.** A measurement programme is only as good as the questions it can express, and "is this the right way round for the reader" was not one of them. It is one now: `tests/client/one-direction-one-language.test.ts` and the track-name assertions in the layout suite. Neither of those would have caught it *first* — a person did — and that is recorded rather than dressed up |
| R2-2 | **The licence for the surface changes came from a menu this pass wrote.** The owner said *"it should look a bit more like it reflects strategy"*; four readings were offered and he picked one. If the four were the wrong four, the answer is an artefact of the question | **partly conceded.** The alternative was guessing, and two of the four readings would have changed what a player looks at while a decision is being measured — a protocol change dressed as taste. Offering the choice is what kept it from being taken silently. That the answer is bounded by the options is true and is why §13.5 leaves the underlying question open rather than closed |
| R2-3 | **The register adds a boundary to a pass whose headline was six control edges reduced to one.** Three hairlines were added between steps in the same commit that removed one from the open step. The net count of drawn lines on `DECIDE` went **up** | **conceded on the count, disputed on the claim.** The count that mattered was of *control edges* doing the same job in six different weights; the register's rule is a grouping mark on the panel's own `--hairline`, not a seventh control treatment, and it replaces a 12px gap that was making the same statement less clearly. It is still an addition, and an addition is the thing this pass is meant to be reluctant about |
| R2-4 | **The protocol did not bump, on an argument about deployment state rather than about the stimulus.** The rule says a change to a class that paints on `DECIDE` forces a version. Three did. The exception granted is "version 4 has never stamped a row", which is a fact about where the branch is, not about what the screen is. The first exception to a rule is how the rule dies | **disclosed rather than resolved.** The argument is written at the constant, it is checkable (`CURRENT_PROTOCOL_VERSION` is stamped in exactly one place, by whichever build is running, and this branch is unmerged), and it carries its own expiry: the moment a build stamping 4 reaches a player, the next change to the same list is 5. An adversary is right that this is the weakest paragraph in the round. It is also the one most likely to be checked, which is why it is written where the constant is rather than in a document |
| R2-5 | **The phone's DOM order and visual order now disagree, and they used to agree.** A keyboard or screen-reader user on a phone reaches the panel before the board the panel's first field is filled from | **conceded as a cost, taken deliberately.** One of the two orders had to give: repairing the desktop with `order` or `tabindex` would put the divergence on the surface that matters more, and putting the panel above the board on a phone would separate the move from the board it is made on. Both sequences carry the same meaning, which is what 1.3.2 asks, and both are asserted so neither can drift. **The screen-reader half of that claim is reasoned, not tested** — no screen reader has been run in this pass or any before it, and §9 of the report says so |
| R2-6 | **"It reads as an instrument rather than a form" is exactly the kind of perceptual claim this pass sends to FIELD, and it was not sent** | **conceded and corrected.** It is a `FIELD` question and it is now in the table below. What can be said without a field is narrower and is all that is claimed: the wizard-step badge is gone, the rows are one register, and no word, question, option or requirement changed |
| R2-7 | **A review bot found a P1 in the first round's own work before any of this pass's measurements did, and it was right.** `.board-assembly` reserves a fixed 28px track; the evaluation instrument was given `min-inline-size: 6.75rem` and a fixed grid track does not grow for an item's minimum size, so the instrument overflowed 80px into the board's column. Measured at reveal: clearance 33px at 1440×900, **3px at 1280×800**, and **−80px at 390×844**, where the board painted over the gauge and the reading spilled out below it | **conceded, fixed, and the diagnosis is the useful part.** Every probe this pass ran measures ONE element — contrast, size, rank, squint mass, measure — and not one of them asks whether two elements are in the same place. That is the same shape as R2-1: a measurement programme is only as good as the questions it can express. The track is `6.75rem` now, reserved in both states so the board still does not move between them; on a phone the assembly is one column and the gauge lies down, which also returns 28px to the board. `tests/layout/the-instrument-and-the-board-it-measures.layout.test.ts` asserts disjointness at six viewports and that the gauge stays a proportion on whichever axis it runs along, demonstrated red on the shipped shape |

---

## 5. What no pass could settle

| # | question | authority |
| --- | --- | --- |
| 1 | Is the palette liked? | **OWNER** |
| 2 | Is there too much on these screens? | **FIELD** — and this pass did not measure it, it measured the measure |
| 3 | Does the human/machine boundary become understandable? | **FIELD** — Arm B, and the blind critic's reading is the strongest available evidence that it is *perceptible* and not that it is *understood* |
| 4 | Does silence feel legitimate? | **FIELD** |
| 5 | Should the front door carry the brand? | **FIELD**, unchanged from `VISUAL_ARCHITECTURE_AUDIT` §10.1 |
| 6 | Which of the three routes should a cold arrival take? | **FIELD** — the ledger already records it |
| 7 | Is the chart palette too close to the machine's hue to keep? | **OWNER**, after a measured re-validation |
| 8 | Do the internal state labels (`DECIDE`, `REVEAL`) help? | **FIELD** |
| 9 | Does the decision panel read as an instrument rather than as a form, to somebody who did not build it? | **FIELD** — one screenshot and one owner answer scoped the change; neither settles how it is read |
| 10 | Does a screen reader hear the phone's DOM order as the same meaning the eye sees? | **FIELD**, and it is the one place the two orders differ. No screen reader has been run |
