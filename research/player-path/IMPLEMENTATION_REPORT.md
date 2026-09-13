# Implementation report — what was built, and what each change is evidence of

Branch `claude/ux-ui-analysis-v6ao5u`. Base `3d8d023` (merge of `origin/main` `65b1b01`), plan
frozen at `ae707ab`.

Every observation below is `R1`–`R3` — repository facts and browser measurements. Nothing here is
`R6`, and nothing here establishes what a player understands or does.

## 1. The finding outranks its numbers

`client/src/components/ImportDiagnostic.tsx`, `shared/import-diagnostic.ts`, `client/src/index.css`

`Observation` became `Finding`, moved from the bottom of the panel to immediately above the bucket
list, and stopped rendering through `NotMeasured`.

**What `NotMeasured` is.** It renders `<span class="value-triple value-empty"
data-provenance="none">` with `.value-provenance` — the small grey register the product reserves for
*where a number came from*. The panel's conclusion was wearing it. A sentence that denies a ranking
is not a provenance note about the ranking, and rendering it in that register told the eye it was
marginal before anyone read the words.

**Measured on a 390×844 phone, `deviceScaleFactor: 2`, touch on:**

| | before | after |
| --- | --- | --- |
| finding, y | absent from `.import-observation`; rendered via `NotMeasured` at ~2198 | **1329** |
| first rate row, y | 1363 | 1520 |
| finding type size | `--panel-body`, muted | **18px**, `--panel-title` |
| rate type size | 16px | 16px |
| panel height | 1048 | 1155 |

The finding now precedes the numbers (1329 < 1520) and outranks them (18px against 16px).

**The claim level is not raised anywhere.** "The ordering renders below the denial" is an
`OBSERVATION` and is measured above. "The eye has little basis to reject the ranking" is a
`PERCEPTUAL INFERENCE` and is stated as one in `DECISION.md`. "Players misread it" is a
`BEHAVIORAL CLAIM` needing `FIELD` at R6 and is **asserted nowhere in this repository**. It is row 6
of `FIELD_TEST_PROTOCOL.md`.

## 2. The not-separable state carries a reason to act

`shared/import-diagnostic.ts`

```
LIVE_DECISION_ADDS
"החלטה שתרשמו מוסיפה מה שהמשחקים האלה לא מחזיקים: ביטחון שהצהרתם לפני שהמנוע דיבר.
 משחק שכבר שוחק לא יכול לייצר את זה, בשום כמות."
```

The fact existed twice in this file — as `bucket-absent-note` and as `review-caveat` — and was a
**caveat both times**: a limitation of what the player just did. It never once said what it buys.

It is an **evidence-type claim, not an outcome claim**, which is the only reason it may be said at
all. It promises nothing about what will be found; it holds on the first decision and on the
thousandth; and it stays true in the state where no personal pattern is ever found. The reveal
already says the same thing at a single decision's scale in `EVIDENCE_LABEL.process`, and the two
are deliberately worded alike.

The not-separable wording also changed, from a bare denial to a denial with its mechanism:

> אף סוג לא נבדל מהשאר. ההפרשים שלמטה קטנים מטעות הדגימה של עצמם, ולכן המספר הנמוך ביותר אינו ממצא.

## 3. The same repair on the record dashboard, kept apart from the first

`client/src/components/RecordDashboard.tsx`

`BucketFinding` renders above `.bucket-list` on the record screen. Its construct is **separation
from the population**, which is a different claim from the import panel's **separation between the
player's own buckets**, and only rows with `measurable && versusPopulation !== null` enter its
denominator.

Two separations, two denominators, two sentences. They are never merged and never share a number.

## 4. The invariant: `GATE-FINDING-OUTRANKS-ITS-NUMBERS`

`scripts/journey-scan.ts`, `scripts/run_gates.ts`, `docs/GATES.md`

Rule R1. Run over `client/src`, control over `JOURNEY_FIXTURES`. It fails a component that renders a
reading list whose rows carry `SignedProportion`, `accurateRate` or `versusPopulation` when:

- no `*Finding` component renders above it; or
- a `*Finding` renders **after** the numbers it is about; or
- a separation conclusion renders through `NotMeasured`, which is the provenance register.

Positive control: `tests/fixtures/journey/FindingBelowItsNumbers.tsx`, which reproduces the shipped
defect — a `.bucket-list` of `{ scope, accurateRate, n }` rows followed by a `NotMeasured` reading
"הסוגים שנמדדו קרובים זה לזה יותר מטעות הדגימה שלהם".

### Four defects found in the gate itself, before it was trusted

Recorded because each one is a class this repository has hit before.

1. **Too broad.** It fired on `RecordDashboard`'s `MixBlock`, a composition list whose rows are
   shares of one whole and make no ranking claim. Narrowed by requiring the rows to carry one of the
   three reading props.
2. **The control stopped going red** after that narrowing, because the fixture's prop was named
   `rate`. Renamed to `accurateRate`, mirroring the real row shape. A control that survives a
   narrowing by accident is not a control.
3. **It passed on the exact shipped state.** `findIndex` matched `className="import-finding"` inside
   the component's own *definition*, which sits above the list, so moving the *call* to the bottom
   left the gate green. This is the same `definedIn` trap `LAW 1`'s scanner already avoids. Fixed by
   requiring a JSX render.
4. **`/<[A-Z]\w*Finding[\s/>]/` never matched `<Finding`**, because `[A-Z]` consumed the `F`. Fixed
   to `/<[A-Za-z]*Finding[\s/>]/`. A missing call site was then caught by the gate reporting the
   definition line, which is how `BucketFinding` was found defined and never rendered.

## 4b. A defect the eye found under the finding, and the floor that was lost

`client/src/index.css`, `tests/layout/import-row.layout.test.tsx`

§16 asks for real frames. Looking at one, the unmeasurable row read as
"החלטות אחרי … יותר משתי … דקות", with the reason interleaved into the scope. Measured at 390px the
label laid out **73.59px** wide, against the **90px** floor this repository already enforces on the
other screen built from the same CSS.

The cause is forty lines above it in the same file. `.bucket-list li.unmeasurable` carries
`minmax(7.5rem, auto) minmax(0, 1fr)` and a comment explaining exactly why: an `auto` value track
sized from a long reason claims the row, and `minmax(0, 1fr)` lets the label shrink to zero. Then
`.import-diagnostic .bucket-list li, .import-diagnostic .bucket-list li.unmeasurable` set
`minmax(0, 1fr) auto` — one selector more specific, the same two tracks, the same collapse, on the
panel whose reasons are the longest on either screen.

`tests/layout/bucket-row.layout.test.tsx` is the only instrument that could have seen this, and it
measures `RecordDashboard`. The import panel is the second consumer of that CSS and nothing held it.

**Repaired** by splitting the two selectors and giving the unmeasurable row the floor back.
**Now held** by `tests/layout/import-row.layout.test.tsx`, which measures the import panel in a real
engine at 390px and 1440px: scope width, wrapped lines, document width, and the finding's rank.

That last one is the half `GATE-FINDING-OUTRANKS-ITS-NUMBERS` cannot see. A source scan reads order;
rank is a computed style. Demonstrated by mutation before it was trusted: with `.import-finding` at
`--panel-fine`, the rank assertion goes red at both widths (`the finding is 11px and the numbers it
denies are 16px`) while every order assertion stays green — which is exactly the screen this lane
repaired, and exactly the screen the gate alone would have called fixed.

## 5. Budget

`scripts/check_bundle_budget.ts`: `ENTRY_RAW_KB` 677 → 678, `INITIAL_RAW_KB` 770 → 771. The gzip
ceiling did not fire and keeps its number.

```
                                  entry raw   gzipped   initial raw
  before                            676.7      211.9       769.1
  + the finding above its working   677.4      212.0       770.1
```

The doctrine is that ceilings come down with the thing that lowered them, so a raise is attributed
per move in the same commit. **Three attempts to avoid this raise failed and are recorded in the
file so nobody repeats them:** lazy-loading `ImportDiagnosticPanel` from `Record.tsx` cost 0.3 kB and
saved nothing, because `Home.tsx` imports `SavedReadingOverlay` from the same module and holds it in
the entry; lazy-loading that too cost another 0.2 kB and still saved nothing. Both reverted.

## 6. Catalog and tests

- `docs/GATES.md` gained the gate's row and its count moved to ארבעים ושניים. The catalog test holds
  the table against the runner in both directions, and it caught the omission.
- `tests/docs/the-table-that-fell-behind.test.ts` gained the Hebrew numeral for 42.
- `tests/client/import-diagnostic-panel.test.tsx` was re-scoped from `.import-observation` to
  `.import-finding__what`, **not** to `.import-finding`. The paragraph now carries a second span
  that says the same thing in all three states, so scoping to the paragraph would let the assertion
  pass on a clause that says nothing about the diagnostic under test — which is exactly the failure
  the test's original comment was written against. No assertion was removed or weakened.

## 7. Verification

```
42 gates: 42 pass, 0 fail, 0 not-measured
42 gates: 0 pass, 42 fail, 0 not-measured    All implemented controls went red.
```

`npm run verify` chains typecheck, the inverted typecheck control, build, tests, gates, gate
controls, bundle budget, the inverted budget control, and `verify:scope`. The scope printer states
what the green does not cover; with `DATABASE_URL` unset, ~28 tests of the persistent store skip and
the verdict is not about the database. CI runs those against a real MySQL service.

## 8. What was deliberately not built

The entry frame with the personal-inference promise. The aspiration frame. Any progress bar, rating
denominator or efficacy programme. Any change to the detector's method. The reasons are in
`CANDIDATE_PROCESSES.md` and `DECISION.md`; the short form is that the run refused the first under
every outcome, and the rest fail the evidence ceiling or the no-pattern state.
