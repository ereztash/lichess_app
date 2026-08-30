# Action plan: a board that answers a keyboard, and the engine that produced our numbers

Written 30 Aug 2026, against `main` at `71c848a`, after two external reviews and after the three
open pull requests were closed out.

---

## 1. Where this comes from, and how much of it survived checking

Two reviews arrived. They are not comparable and the plan treats them differently.

| review | checkable claims | held | disposition |
| --- | ---: | ---: | --- |
| Gemini 3.1 "Deep Research", performance | 6 | **0** | not acted on |
| GPT, UX/usability with a pass over the code | 10 | **9** | this plan |

The first asserted a stack this repository does not have — WebSocket transport, JSON-LD, premove
handling, a Rust component — none of which exist here. Nothing in it is actionable because nothing
in it is about this code.

The second was checked claim by claim against the tree. Its disposition:

| finding | severity claimed | state |
| --- | --- | --- |
| one evaluation anywhere on the page kills a whole import scan | P0 | **shipped** — #38 |
| a new deploy makes an open tab show a crash screen | P0 | **shipped** — #35 |
| the board declares `role="grid"` and does not implement it | P0 | **open, this plan** |
| `Overlay` has no focus trap and does not restore focus | P1 | **open, this plan** |
| `Home.tsx` is a 108 kB single file | P2 | **open, this plan** |
| touch targets at 36×36 against a 44 px standard | P2 | **rejected as framed** — see below |

### 1.1 Two things the report got wrong, corrected here

**The squares are already keyboard-reachable.** The report noted no `tabIndex` on the gridcells and
concluded a keyboard user cannot select a square. The gridcells are `<button>` elements, and a
native button is in the tab order and activates on Enter and Space without any `tabIndex`. The
defect is real but it is a different defect, stated in A1.

**There is no 36×36 anywhere.** `client/src/index.css` declares `--tap-floor: 44px` and applies it
to about a dozen control groups. Board squares are excluded, deliberately, with the reason written
at the exclusion: *"A square is sized by the board, the board is sized by the viewport, and a floor
on a square would break the grid before it helped anyone."* At a 390 px viewport a square computes
to roughly 42.75 px. That is under 44 and it is a considered decision with a stated cost, not an
oversight. No PR.

### 1.2 What the report missed, found while checking it

**`aria-label={square}` replaces the square's contents in the accessible name.** Every gridcell
carries `aria-label={square}`, and by the accessible-name computation an `aria-label` beats the
element's contents. A screen reader therefore announces `"e4"` — never `"e4, white knight"`. The
piece glyph is rendered and is not `aria-hidden`, and it is still never spoken.

So the board is not merely hard to navigate without a mouse. **It is unreadable without sight**: 64
coordinates and no pieces. This is a larger break than the navigation gap the report found, and
A1 is scoped around it rather than around arrow keys.

**There is exactly one `aria-live` region in the entire client**, in `SilentGame.tsx`. Nothing
announces a move, a commit, a reveal, or a refusal.

---

## 2. The ordering argument

Two things want to be first and they are first for different reasons.

**A1 goes first because it is cheap and certain.** The WAI-ARIA grid pattern is specified; there is
no research question, no threshold to derive, and no chance the work turns out to be unnecessary.
It is the only S1 in either review with no owner.

**B1 has the highest stake in the plan.** Every number this repository quotes about real games —
the 7.8 % book exclusion, the 14.3 pp game-order effect, the 0.7 % false-positive rate, the 2-second
median think time, the 13.0–19.5 point bars on six real players — was produced by
`scripts/run_import_harness.ts`, which spawns a **native** Stockfish binary over UCI. The product
ships `stockfish-18-lite-single.wasm` and searches at depth 14. Those are two different instruments:
a different build, a different NNUE net, a different depth.

That does not mean the numbers are wrong. It means **nobody has checked**, and the check is cheap:
point the harness at the build the product ships, re-run the same six players, and diff the
decision-level verdicts. If they agree, `docs/MEASUREMENTS.md` gains a line it currently cannot
claim. If they disagree, the disagreement is the finding and it is larger than everything else here.

So: A1 and B1 run in parallel. Nothing else starts until both land.

---

## 3. Track A — the interface refuses a keyboard and says nothing to a screen reader

### A1 · The board announces its pieces and navigates as one grid

*The defect.* Three separate breaks in one component:

1. `aria-label={square}` overrides the cell contents, so pieces are never announced.
2. 64 buttons are 64 tab stops. Reaching h1 takes 64 presses of Tab, and `role="grid"` promises a
   reader that arrow keys will work — a promise nothing in the component keeps.
3. Nothing announces the result of a move. A sighted user sees the piece move; a screen-reader user
   gets silence.

*The fix.* The grid pattern as specified: a roving `tabIndex` so the board is one tab stop; arrow
keys, Home, End, and Ctrl+Home/End moving the roving focus; Enter and Space keeping the behaviour
`onClick` already has; an `aria-label` that names the square **and** what stands on it; and one
`aria-live="polite"` region that speaks what changed after a move is placed or a selection is made.

*What holds it.* A test that drives the board by key events only — no clicks — and reaches a legal
move from a cold render. Plus an assertion on the accessible name of an occupied square, which is
the half a keyboard test cannot see.

*What it must not do.* The live region may not speak anything the engine knows. R3 is that the
machine does not answer before the decision is recorded, and a region that announced an evaluation
would be a fourth path around it. The announcement is what the **player** did.

*Size.* One component, one test file, one gate control. Small.

### A2 · A dialog that traps focus and gives it back

*The defect.* `Overlay` sets `role="dialog"` and `aria-modal="true"`, handles Escape, and focuses
the first control. It does not trap Tab, so the third Tab press walks into the page behind it — which
`aria-modal` has told the screen reader is not there. It does not restore focus on close, so the
keyboard user lands back at the top of the document.

*The fix.* Cycle Tab and Shift+Tab within the panel; store `document.activeElement` on open and
restore it on close.

*What holds it.* A test that Tabs past the last control and asserts it came back to the first, and
one that closes the overlay and asserts focus returned to the element that opened it.

*Size.* One component, one test. Small.

### A3 · `GATE-KEYBOARD`

*Why a gate and not just tests.* A1 and A2 are each held by their own tests, and each of those tests
lives beside the component it covers. The next interactive surface will not have one. The gate is
the general form: **no element may declare an ARIA pattern it does not implement** — a `role="grid"`
with no arrow-key handler, a `role="dialog"` with no focus management, a `role="tablist"` with no
roving focus.

*The positive control.* The board exactly as it is on `71c848a`: a grid role, no key handler. The
control must go red against the shipped component, which is the only proof that the gate would have
caught this.

*Size.* Medium. It is a source scan, and its scope has to be drawn narrowly enough not to be a
lint rule nobody can satisfy.

---

## 4. Track B — the numbers came from an engine the product does not ship

### B1 · Measure the shipped engine (this is PR9 of the earlier plan)

*The question.* Does `stockfish-18-lite-single` at depth 14 agree with the native binary at depth 12
on the verdicts we have published?

*The method.* Re-run `run_import_harness.ts` over the same 48 games and six players against the
shipped WASM build, at the depth the product actually uses. Compare at the decision level, not the
aggregate level: how many of the 1,587 decisions change side of the accuracy threshold, and what
that does to each of the six buckets.

*What it would take to say "the numbers hold".* This needs a tolerance **derived, not chosen** —
the same discipline the blitz preregistration used. The natural one is the smallest difference the
product is willing to display, and that number already exists in the repo
(`ACCURATE_WIN_PROBABILITY_LOSS`). If the two engines disagree on fewer decisions than the product's
own display resolution, the published numbers stand.

*What it would mean if they disagree.* `docs/MEASUREMENTS.md` is a record of a different instrument
and has to say so, in every row that came from the harness. That is a documentation change with a
large surface, and it is the honest outcome rather than a failure.

*Register the tolerance before running it.* Same rule as the blitz study: the threshold goes in
writing, committed, before the first comparison.

*Size.* Large in engine time, small in code. The harness already exists; what is missing is a UCI
adapter for the WASM build so `UciEngine.spawn` can drive it.

### B2 · How time is represented (PR7)

*The question.* `secondsTaken` is a raw number of seconds, and the buckets cut it at 45 s and 120 s.
On a real record the median is 2 seconds and 99.9 % of decisions fall under 45. Two of six buckets
are therefore structurally empty, which `GATE-SHUFFLE-REAL` already measured and reported.

A raw second is the wrong unit for a quantity distributed like that. The candidate representations —
log seconds, a fraction of the time actually available on the clock, a rank within the player's own
record — are each defensible and they are not the same variable.

*The rule.* This is a **representation** study, not a threshold change. No cut moves in this PR. The
output is a document saying which representation separates the outcome best, on held-out data, and
by how much over the raw-seconds baseline.

*Blocked by B1.* Choosing a representation from numbers a different engine produced is choosing on
noise of unknown size.

### B3 · What MultiPV costs, and what "practically forced" is worth (PR8)

*The question.* `bookLookup` and the single-legal-move rule remove 7.8 % of moves from the
denominator. A position with one move that is not losing is not a decision either, and finding it
needs MultiPV — which costs engine time the import does not currently spend.

*The output.* A measurement of the cost in seconds per game, and of how many additional moves leave
the denominator, before any decision to ship it.

*Blocked by B1.* Same reason.

### B4 · Prospective effectiveness (PR10)

*The question.* The one this product exists to answer and has never asked: does a player who runs
drills change their calibration gap?

*Why it is last.* It needs a person, over weeks, with a record that was collected by an instrument we
trust. B1 is what makes that instrument trustworthy, and the field protocol in
`docs/VALUE_CLARITY_FIELD_PROTOCOL.md` is what makes the person recruitable. Neither is done.

---

## 5. Track C — one file is 108 kB

### C1 · `Home.tsx`

108,010 bytes in one component. The report calls it a maintainability risk and it is right, but it is
the only finding here with no user-visible symptom, no correctness claim, and no measurement
attached. Splitting it is a large diff across the most-tested surface in the repository, and a large
diff with no falsifiable claim is exactly the kind of change this project is set up to be sceptical
of.

*So it is scheduled behind everything else*, and when it happens it is a mechanical extraction with
the existing tests as the invariant — not a redesign.

---

## 6. What this plan deliberately does not do

- **No new detector, no new bucket, no threshold change.** The standing rule from the measurement
  work holds: fix what enters the denominator, then test the whole system on real records, and only
  then touch thresholds or ontology. B1 is the "test the whole system" step and it is not finished.
- **No touch-target change on the board.** The exclusion is documented with a reason (§1.1).
- **Nothing from the Gemini report.**
- **No adaptive copy, no coach, no LLM layer.** Unchanged from `docs/VALUE_CLARITY.md`.
- **No accessibility work beyond what a test can hold.** An a11y pass that produces a checklist and
  no failing test is a claim without a control.

---

## 7. Stop rules

Written before the work, so they cannot be adjusted to fit a result.

- **STOP-A1.** If the roving-focus model cannot coexist with drag-and-drop without breaking the
  existing pointer tests, ship the accessible name and the live region alone and record the
  navigation gap as unresolved. A board that speaks its pieces and tabs 64 times is strictly better
  than one that does neither.
- **STOP-B1.** If the two engines disagree on more decisions than the product's own display
  resolution, **do not re-tune anything.** Write it in `docs/MEASUREMENTS.md`, mark every affected
  row as measured on an instrument that is not shipped, and stop the plan there until it is decided
  what the record is worth.
- **STOP-B2.** If no representation beats raw seconds out of sample, keep raw seconds and write
  "no representation was better". Do not adopt the best in-sample one.
- **General.** In any stop: do not adjust a threshold to rescue a result. Write "hypothesis not
  supported".

---

## 8. Order

```
now      A1  board: name, roving focus, live region        ─┐
         B1  engine parity, tolerance registered first     ─┘  parallel

then     A2  overlay focus trap and restore
         A3  GATE-KEYBOARD

then     B2  time representation        (blocked by B1)
         B3  MultiPV cost               (blocked by B1)

later    C1  Home.tsx extraction
         B4  prospective effectiveness  (blocked by B1 and by recruitment)
```
