# False greens attacked in this lane

Mission §15: verification must attack false greens rather than accumulate passing checks. This is
the list for this lane only. `research/learning-journey/FALSE_GREEN_AUDIT.md` holds the previous
lane's eleven and is not superseded.

Each entry below states **the green that was wrong**, **how it was demonstrated wrong** and **what
now holds it**. A repair with no demonstration is not listed, because an undemonstrated repair is
the thing this file exists to catch.

---

## 1. The gate passed on the exact state it was written to reject

**The green.** `GATE-FINDING-OUTRANKS-ITS-NUMBERS` reported PASS on the shipped `ImportDiagnostic`,
the screen whose defect motivated it.

**Why.** `findIndex` matched `className="import-finding"` inside the component's own **definition**,
which sits above the reading list in the file. Moving the *call site* to the bottom of the render
left the gate green, because the gate had never been looking at a render.

**Demonstrated.** Moved the call below the list; the gate stayed green; then required a JSX render
(`/<[A-Za-z]*Finding[\s/>]/`) and the gate went red on that same tree.

**Now held by.** The render requirement, plus the positive control fixture
`tests/fixtures/journey/FindingBelowItsNumbers.tsx`.

**Class.** The same `definedIn` trap `LAW 1`'s scanner already documents. A source scan that matches
a declaration and calls it a use.

## 2. The positive control stopped being a control and nobody would have noticed

**The green.** After the gate was narrowed to reading lists (rows carrying `SignedProportion`,
`accurateRate` or `versusPopulation`), `npm run gates:controls` still reported all controls red.

**Why.** It didn't. The fixture's prop was named `rate`, so the narrowed gate no longer matched it,
and the control went red **for the wrong reason** — not because the finding was below its numbers,
but because the file no longer looked like a reading list at all.

**Demonstrated.** Renamed the prop to `accurateRate`, mirroring the real row shape, and confirmed
the control goes red on the ordering and green when the ordering is repaired inside the fixture.

**Class.** A control that survives a narrowing by accident. The repository's doctrine is that a gate
which never failed is not proven; the corollary is that a control which fails for a reason other
than the gate's own is not a control.

## 3. "Outranks" was only ever "precedes"

**The green.** With the gate passing and the tests green, the repository asserted that the finding
**outranks** its numbers. Nothing in the repository could see a font size.

**Why.** `GATE-FINDING-OUTRANKS-ITS-NUMBERS` is a source scan. It reads order and register from the
text of a `.tsx` file. Rank is a computed style, and jsdom reports initial values for all of them.
A finding moved to the top of the panel and left at `--panel-fine` would have passed the gate,
passed all 3,265 tests, and read exactly like the defect the gate was written for.

**Demonstrated by mutation.** `.import-finding` set to `--panel-fine`:

```
× the import panel on 'mobile'  > renders the finding above the numbers it denies, and larger than them
  → the finding is 11px and the numbers it denies are 16px: expected 11 to be greater than 16
× the import panel on 'desktop' > renders the finding above the numbers it denies, and larger than them
  → the finding is 11px and the numbers it denies are 16px: expected 11 to be greater than 16
✓ ... never collapses a scope label ...
✓ ... does not push the document sideways
```

The order assertions stayed green throughout, which is the point: the gate's half was satisfied by
the mutated screen.

**Now held by.** `tests/layout/import-row.layout.test.tsx`, in a real engine, at 390px and 1440px.

## 4. The fix the dashboard won, handed back by a more specific selector

**The green.** 3,265 tests and 42 gates, on a panel whose scope label laid out **74px wide** at
390px — under the 90px floor this repository's own test enforces on the other screen that uses the
same CSS.

**Why.** `.bucket-list li.unmeasurable` carries `grid-template-columns: minmax(7.5rem, auto)
minmax(0, 1fr)`, and its comment says precisely why: an `auto` value track sized from a long reason
claims the row, and `minmax(0, 1fr)` lets the label shrink to zero. Forty lines later,
`.import-diagnostic .bucket-list li, .import-diagnostic .bucket-list li.unmeasurable` set
`minmax(0, 1fr) auto` — one selector more specific, the same two tracks, the same collapse, on the
panel whose reasons are the **longest on either screen**.

`tests/layout/bucket-row.layout.test.tsx` measures `RecordDashboard`. It was the only thing in the
repository that could have seen this, and it was pointed at the other consumer.

**Found by.** Looking at a real 390×844 frame, per §16. The scope read as
"החלטות אחרי … יותר משתי … דקות" with the unmeasurable note interleaved. Measurement confirmed the
eye: 73.59px.

**Now held by.** The scope-floor and stack assertions in `tests/layout/import-row.layout.test.tsx`,
which fail on the pre-repair CSS at 390px.

**Class.** A documented fix with a documented reason, defeated by specificity in the same file, with
the only instrument that could see it aimed elsewhere. Neither a missing test nor a wrong test: a
test whose subject was one of two consumers.

## 5. A new gate that the catalog did not know about

**The green.** `npm run gates` reported 42 pass and `npm run gates:controls` reported 42 red, while
`docs/GATES.md` listed 41 and said ארבעים ואחד in words.

**Caught by** `tests/docs/the-table-that-fell-behind.test.ts`, which holds the catalog against the
runner in both directions, and which failed on this tree before it was committed. Recorded here not
as a defect found but as an instrument that worked: the count in words is the part a person reads,
and it is checked.

---

## Attacked and found sound

Listed because a false-green audit that only reports finds is selecting on its own conclusion.

- **`LIVE_DECISION_ADDS` is not an outcome claim in disguise.** Checked against the frozen ceiling:
  it asserts a property of a *kind of evidence* ("a played game carries no confidence stated before
  the engine spoke"), not a prediction about this player. It is true at n=1 and at n=2,209, and true
  in the state where no pattern is ever found. No `R6` is required for it, and none is claimed.
- **The two separations are not the same number.** The import panel's finding is about separation
  **between the player's own buckets**; `BucketFinding` on the record screen is about separation
  **from the population**. Different denominators, different sentences, and only rows with
  `measurable && versusPopulation !== null` enter the second. Checked by reading both call sites.
- **The re-scoped panel test did not lose an assertion.** `.import-observation` →
  `.import-finding__what`, not `.import-finding`. Scoping to the paragraph would have let the
  assertion read `LIVE_DECISION_ADDS`, which is identical in all three states and says nothing about
  the diagnostic under test — passing on a screen whose finding named nothing, which is the failure
  the test's own original comment was written against. Every assertion is unchanged.
- **`npm run verify` is still not CI's verdict**, and `verify:scope` still prints so. With
  `DATABASE_URL` unset, ~28 tests of the persistent store skip. Nothing in this lane quotes the
  local green as though it covered them.
