# Implementation report — the journey pass

Branch restarted from `origin/main` `2afb7a2` (PR #102 and #103 merged), because the previous branch
carried only merged history.

Every observation below is `R1`–`R3`: repository facts and browser measurements. Nothing is `R6`.

---

## 1. A move on the board is not a move that was weighed

`shared/reveal.ts`, `tests/client/choice-rule.test.ts`

`candidate_moves_considered` records every move **placed** on the board before the commit. Two
mechanisms produce the same entry and this record cannot separate them: a move weighed and
rejected, and a move the hand passed through.

The repository had acted on this in **one direction only**. The copy was weakened from
`ראית את המהלך` to `הנחת על הלוח`; `inferenceLimits` stated the *absence* direction. The *presence*
direction was never said, and it is the direction on which a claim is made: `chose-past-it` closed
with `כאן הקושי לא היה למצוא את המהלך, אלא לבחור בינו לבין האחר` — which cognitive difficulty the
player had, inferred from one fact about the board. The two mechanisms call for opposite work.

- `bestMoveWasPlaced` is one predicate, shared by the limit and the branch, so they cannot fire on
  different sets.
- `PLACEMENT_IS_NOT_CONSIDERATION` renders in the limits, before any number.
- The note hands the discrimination to the only party who can make it:
  `רק אתם יודעים אם Nf6 עצר על הלוח או רק עבר.`

A first wording asked whether the player had *weighed* it, and `the-player-sees-chess.test.tsx`
caught `שקלת` in `MIND_WORDS` — correctly. "Did you weigh it" is still a sentence about the mind,
phrased as a question. What the record holds is a gesture, so the question offered is the one the
hand can answer.

## 2. `GATE-PLACEMENT-NOT-EVIDENCE`

`scripts/placement-scan.ts`, `tests/fixtures/placement/ClaimFromPlacements.ts`

No module may read the field except the ones that carry, collect or (in one annotated case)
interpret it. **Nothing on the claim path reads it today**, which is why the gate is worth writing
now: written while the invariant holds it costs one file; written afterwards it costs a migration.

An allowlist, not a forbidden-path list — a new module joins a forbidden-path list by not being on
it. Control: a `deliberationGrade` built from placement counts, written the way a reasonable author
would write it.

## 3. A count that says WHERE is not a count that says MEASURED

`shared/decisions-elsewhere.ts`, `client/src/lib/loop-position.ts`, `shared/learning-journey.ts`

`readElsewhere` is every atom outside the discovery stratum: where a decision is read, not whether
an engine scored it. `plain-reading.ts` owned the clause and wrote the argument down. It drifted
anyway, in two places, and both shipped — the strip at the top of every reveal rendered
`1 נמדדו ונקראות בחלק אחר` (a measurement claimed, and not a sentence in Hebrew), and the journey
ledger rendered `נמדדה`/`נמדדו` with its own singular branch.

Both now come from one module. `GATE-ELSEWHERE-NOT-MEASURED` refuses a fourth copy. **Its first
version reported the two files it had just been written to clear**, on the lines where the repair is
explained: a scanner for a defect that gets documented when it is fixed cannot read prose.

## 4. The walk `D22` asked for

`tests/layout/a-walk-the-derivation-can-be-wrong-about.layout.test.ts`

`D22` defers handing any screen to `deriveNextAction` and names four reversal conditions. The first
is the only one available without a person, and nothing had performed it.

```
the record page, empty:        proposes play-first-decision → offers play-first-decision
the record page, one decision: proposes play-blitz          → offers play-blitz
```

**Its first draft reported a disagreement that was a typo.** It walked to `/record` and read a 404
as a surface offering nothing. There is no `/record`: `/` **is** the record page. The stop was
removed rather than repaired, and the mistake is written into the test and into `CURRENT_STATE.md`.

The calibration run then turned the evidence around, correctly: the two agreeing states are the
**most-determined branches of the union**, where the derivation has almost no choice to make, so
agreement there says nothing about the contested branches.

## 5. The shortfall was out by a factor of two

`shared/record-dashboard.ts`, `client/src/components/WhatIsUnclear.tsx`

Found by the run, which named it *"a correctness defect on the surface steering the only admissible
evidence source, independent of the entire ownership hypothesis space."* Checked, and true.

`shortBy` was `MIN_BUCKET_N - min(inside, outside)`: the gap on the binding side. What the row
renders is what the player must go and produce.

| record | row said | required, best case |
| --- | --- | --- |
| fresh, both sides empty | עוד 30 החלטות | **60** |
| one decision, landed outside | עוד 30 החלטות | 59 |
| 40 outside, 2 inside | עוד 28 החלטות | 28 ✓ |
| 29 inside, 31 outside | עוד 1 החלטות | 1 ✓ |

They agree once either side is full, which is why every existing test missed it: all of them are
records where one side already holds its thirty.

**The third step of one repair.** `a-line-nobody-crossed.test.ts` records that this field once
counted only `inside`, so a split with an empty comparison set "reported that it needed nothing".
That test's own words dispose of the second version: *a player told "three more" would have taken
three and found the split exactly as unreadable* — and thirty behaves identically.

Now: the requirement on both sides, rendered as `לפחות`, because even the corrected figure assumes
every next decision lands on the side that needs one. The field's assertion is the **property** —
`shortBy` equals what both sides still need, whatever the floor — so a change to `MIN_BUCKET_N`
cannot restore the understatement. And `עוד 1 החלטות` became `עוד החלטה אחת לפחות`: the fourth
hand-rolled copy of a clause in which the same Hebrew defect has now been found.

## 6. One quantity, said once

`client/src/components/WhatIsUnclear.tsx`

On the record every arrival has, all six buckets are empty on both sides, so all six asked for the
same figure and the screen printed it six times down a column. A number repeated in every row is a
progress bar with the bar left out, and `GATE-GOAL-NOT-A-DENOMINATOR` cannot see it: no goal in it,
no percentage.

The same argument the *reason* already won in this component, applied to the number. When the splits
differ, nothing moves — that is the other half of the control.

**It shipped broken once, and a real frame is what found it.** The first version compared *every*
row in a group for equality. A group mixes rows that carry a count with rows that carry none: the
`too-few-in-bucket` group holds five bucket splits, each short by the same amount on a young record,
and `האם המאמץ שלך הולך לאן שהספק הולך`, which has no number at all. That one null made the group
look mixed, the hoist never fired, and the screen went on printing `לפחות עוד 59 החלטות` five times
down a column.

**Its test was green throughout**, because the fixture was six rows all carrying the same count —
a shape this product does not produce. Measured on the built app at 390×844, the rendered DOM
reported `shared: null` beside five identical strings. After the repair, one shared line and six
rows with no number of their own.

That is the third time in this pass that looking at a real frame found what no test did, and the
only one of the three where the defect was mine.

## 7. The player's own sentence, which was absent from the screen it matters most on

`client/src/pages/Record.tsx`

`GoalNote` rendered inside the `מה נלמד עליי עד עכשיו` layer, which is correctly gated on
`measured > 0`. **The goal inherited that condition** — so the one line on the page that is the
player's rather than the instrument's was absent for the whole period when somebody is deciding
whether this product is for them, and appeared only once the product had something to say about
them. A note about why you are here is not a thing learned about you.

### The run said to lift it above the counts. Three instruments refused, and all three were right.

The calibration run sequenced the ordering repair first, as a change *"introducing no claim, needing
no evidence level, failing cheaply and visibly"*. It failed visibly.

`GoalNote` is behind `lazyChunk`. Above the fold its chunk arrives **after paint**, so:

```
/ at 390px  scored 0.05948 against a budget of 0.02
            section.first-decision  y 248 -> 323      a 75px push, and everything below it moved
/ at 1280px scored 0.03071
front-door  141 words against a ceiling of 140
front-door   67 words before the one act against a ceiling of 65
```

Making it eager would have traded the shift for entry weight, on a gzip ceiling this same commit had
just spent its last tenth of. **So the position is unchanged and the condition is what was wrong:
the defect found was the absence, not the placement.** `shared/goal.ts`'s argument for keeping the
goal away from every count still stands, and `GATE-GOAL-NOT-A-DENOMINATOR` is untouched.

### And the condition is `returning`, not `measured`

The two differ exactly where it matters: somebody who recorded a decision the engine has not scored
has `measured === 0` and **has used this product**. Tying the goal to whether the *instrument* has
something to say was the defect; tying it to whether the *player* has been here before is the fact
the question is about.

It also keeps four words off the cold front door, which is not an accounting trick: that screen is
the product explaining itself to a stranger who has done nothing yet, and "write down why you are
here" is a question with no context to answer it in. Unconditional, it put that stage at 141 words.
**The ceiling is not raised, because the words were not earned there.**

### How it is held, and why that is weaker than it should be

The **absence** is asserted on the screen — a stranger is not asked — and that test catches a
regression to unconditional. The **condition** is asserted against `Record.tsx`'s source.

That split is a limitation and is stated as one. `GoalNote` is behind `lazyChunk`, and no test in
`record-page.test.tsx` has ever rendered a lazy component; every existing assertion about one checks
that it is absent. Rendering it for real takes the page down the returning-visitor path, where
`ResumeScreen` is unmocked and suspends on its own queries, and a positive assertion there was
measuring the harness rather than the page. A behavioural positive is the better instrument and is
not available in this file. Both mutations go red: re-gating on `measured` fails the condition, and
removing the gate entirely fails both.

---

## Verification

Four new invariants, each demonstrated red before the repair and green after:

| invariant | mutation | result |
| --- | --- | --- |
| the reading does not name which difficulty it was | restore the mechanism note | 2 red |
| the placement caveat renders where the claim is made | drop the limit | 1 red |
| the elsewhere clause claims no measurement | restore `נמדדו` | 3 red |
| one quantity is said once | put it back on every row | 1 red, `printed 6 times` |
| the goal renders on an empty record | put it back behind `measured > 0` | 1 red |

Gates 42 → 44, each with a positive control shown red.

### Ceilings, both raised with attribution and both after the weight was looked for first

- **The reveal's first phone screen, 160 → 162.** The two words are the correction: the honest
  elsewhere clause is two words longer than the wrong one. The room was looked for in the wrong
  place first — the new limit was cut from twenty words to eleven and the reading did not move by
  one, because that limit fires only when the engine's move was among those placed, which the
  stranger's walk does not produce.
- **Entry gzipped, 212 → 213.** Importing the clause from `plain-reading.ts` pulled that whole
  module into the entry and put **all three** ceilings over at once. `shared/decisions-elsewhere.ts`
  holds the sentence and nothing else: 1.1 kB raw and 0.4 kB gzipped came straight back out, and raw
  and initial returned under their unchanged numbers. What is left is the sentence. The previous
  pass predicted this exact tenth and said so in the file.
