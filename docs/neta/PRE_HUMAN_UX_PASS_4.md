# Pre-human UX, pass 4: the owner-licensed intervention

Passes 1 to 3 measured. This one was licensed. The owner named the scope, and the two questions
left open at the end of pass 3 were both answered from outside the repository, which is what pass
3's stopping decision said had to happen.

> primary screen heading only → 600; do not globally change h1/h2/h3.
> replace `CONTINUATION_PROPOSITION` with an accumulation block; do not add a second block beside it.
> preserve the epistemic limitation inside the new block: one decision does not establish a pattern,
> but it does update the evidence balance.
> show only a compact accumulation summary in Reveal; keep the full record behind disclosure.
> rename the disclosure so it explicitly names the record.
> do not move denominators, thresholds, eligibility, events, protocol timing, or add probes.
> do not fix the 3/4 count race in this PR. Record it as a separate finding with its own semantic discriminator.

---

## 1. The criterion and the reversal condition, stated before anything was written

**Perceptual success criterion.** On `dist/public`, at 1440x900 and 390x844:

1. the largest painted heading on the front door and on the deciding screen computes
   `font-weight: 600`, and exactly one element per screen changed weight;
2. the reveal carries at least two record-scoped elements, the new one outside `.reveal-limits`,
   and the replaced proposition's text is absent from the DOM;
3. the reveal's block count is five, not six — replaced, not joined;
4. the control opening the full record has an accessible name containing `רשומה`.

**Reversal condition.** The change comes back out if any of these hold: a denominator, threshold,
eligibility rule, event name or protocol field changes value in any test; the accumulation line
prints a number that contradicts another number on the same screen; the block reads as a claim
about the player rather than a count; any element other than the two named headings changes weight;
any of the 35 gates goes red; the reveal's block order changes.

---

## 2. The measurement that changed the first instruction, before it was carried out

"Primary screen heading only → 600" is not a statement about tags. Measured first:

| screen | largest painted heading | tag | px |
| --- | --- | --- | --- |
| `/` front door | `מה קרה בהחלטה, לפני שהמנוע דיבר` | `h1` | 28 |
| `/play` decide | `מה העמדה הזו דורשת?` | **`h2`** | 22 |
| `/play` reveal | *(none)* | — | — |
| all three | `11. O-O-O` | `h1` | 16 |

On the deciding screen the `h1` is a **move label** in `.workspace-meta`, at 16px, smaller than the
`h2` above it and equal to four `h3`s below it. A rule on `h1` would have put weight 600 on
`11. O-O-O` and left both real headings at 400 — the exact inverse of the licence.

So the weight went on a class, `.screen-heading`, worn by exactly two named elements. A test asserts
that count and that no bare `h1`, `h2` or `h3` rule exists anywhere in the stylesheet.

### And the reveal has no primary heading, which is a finding rather than an omission

Three `h2`s tied at 18px, one per block. Promoting one inverts the order `RevealPanel`'s docblock
calls not negotiable — *"what cannot be inferred here — first, always, before any number"*.
Promoting all three is restyling `h2` globally, which the licence excludes. **Nothing on the reveal
was bolded.** That screen is a sequence of equal sections and the first one is first on purpose.

---

## 3. What replaced the proposition

`CONTINUATION_PROPOSITION` was deleted from the tree, not merely unrendered. A constant nobody calls
is a second answer waiting to be rendered back beside the first by someone who assumes it was
dropped by mistake; a test asserts it is gone.

In its place, one block at the same position, with the same class of styling, carrying three lines:

```
מה שנצבר עד עכשיו
  החלטה אחת אינה דפוס. מה שהיא כן עושה הוא להזיז את מאזן הראיות.
  מהלך שעלה חומר, בלי שהרשומה מוסיפה עליו — הופיע ב-2 מתוך 3 ההחלטות שהמנוע ענה עליהן עד עכשיו.
  ההחלטה הבאה היא עמדה אחרת ורגע אחר, ולכן היא זו שתראה אם זה חוזר.
```

- **The limitation is inside the block, first.** `ACCUMULATION_LEAD` is a constant and does not vary
  by branch or by record size, exactly as the proposition did not. A count under a heading reading
  "what has accumulated" is one sentence away from being read as a pattern; this is that sentence.
- **The count is the only line permitted to vary**, and it is the whole reason the block exists. A
  test asserts the constants are invariant across all five outcomes and three record sizes, and in
  the same file asserts the count is **not** — so a later change cannot freeze one or thaw the other
  without something going red.
- **`ACCUMULATION_NEXT` shares `חוזר` with the button.** Carried from the proposition: a button whose
  words appear nowhere in the sentence above it is a second message.
- **Silent, not zero.** With no record read, or at `n < 2` where the only answered decision is this
  one, the count line does not render at all. "1 of 1" is a reveal restating itself with a
  denominator attached.

### `הופיע` and not `נרשם`, which is not a style choice

The limits block eight lines above says `נרשמו N החלטות` with a different number.
`loop-position.ts` records what happened the last time two registers a few pixels apart shared a
bare verb: *"read together they said the record was broken."* The verb here is about the sentence
appearing, which is what is actually counted.

### The one new field, and why it is not `mix`

`RecordReading.mix` is computed over the **descriptive** population. The product's own front door
hands over a bank position, and `evidence-policy.ts` files bank decisions as `separate` — so a block
reading `mix` would report zero to every player who has only ever done what the product first
offered them. That is the defect pass 3 just fixed, arriving through a third door.

`mixAll` is the same computation over every atom. Pooling is correct **here and would not be
elsewhere**: `oneThingMix` says of itself that it is *"a reading of the INSTRUMENT, not a finding
about the player"*, and that question has one population. The comparisons that must not pool —
free play, and the bank between players — are computed from `mix`, `scored` and `anchor`, all
untouched.

---

## 4. The disclosure now names what is behind it

`מה עוד יש כאן` → **`לרשומה המלאה`**. The old label described the act of looking, not the thing
looked at, so a player asking "what has all this added up to" had no reason to think that control
answered them — and the entire record dashboard is what opens.

Measured and **not** changed: the control sits 912px below the fold of a 900px viewport on desktop
and 1185px below an 844px one on the handset, at weight 400 and 12px. Naming it does not move it.
Whether it should move is a separate question and was not licensed.

---

## 5. The criterion, measured on the built tree

`docs/neta/harness/p-accumulation.mjs`, same walk as the pass-3 baseline:

```
### 1. FRONT DOOR
   weights: 400:27  600:2  700:1
   H1 w=600  28px  מה קרה בהחלטה, לפני שהמנוע דיבר          -> OK
### 2. DECIDE
   weights: 400:197  600:10  700:8
   H2 w=600  22px  מה העמדה הזו דורשת?                       -> OK
### 3. REVEAL after 3 decisions
   blocks (5): limits -> one-thing -> question -> secondary -> accumulation
   record-scoped elements: 2 of 17          (baseline 1 of 14)
   blocks they sit in: reveal-limits, reveal-accumulation   (baseline: reveal-limits only)
   block count 5, not 6:                    OK
   accumulation is last:                    OK
   replaced proposition absent from the DOM: OK
   control naming the record:               OK -> לרשומה המלאה
```

No number on that screen contradicts another: the limits block says `נרשמו 3 החלטות` and the
accumulation says `2 מתוך 3`. The reversal condition on contradicting numbers is not triggered.

---

## 6. Falsification, and the controls that make it mean something

`tests/client/one-heading-a-screen-is-about.test.tsx` was broken three ways and went red each time,
then green on the restored tree:

| break | result |
| --- | --- |
| append `h2 { font-weight: 600 }` — the global restyle the licence excludes | **1 failed** |
| remove the class from the front door's heading | **2 failed** |
| revert the disclosure label to `מה עוד יש כאן` | **1 failed** |
| restored | 8 passed |

`tests/client/why-another-decision.test.tsx` was rewritten rather than deleted: every invariant it
held over the proposition — identical after all five outcomes, no digit, no reward or streak
vocabulary, no promise that a pattern is there, no borrowing of the record's floor, post-commit
only, one rendering site — now holds over the two constants, and four assertions about the count
were added beside them. 23 tests.

### Two ratchets fired, and neither was loosened by argument

**`Home.tsx` line ceiling.** The change put the file at 2,409 against a ceiling of 2,400, whose own
docblock says *"THESE NUMBERS ONLY EVER GO DOWN"*. The ceiling was not raised: the explanatory prose
moved out of `Home.tsx` to the component and the test where it belongs, and the file came back to
2,399.

**Bundle budget.** 684.5 → 686.0 kB entry raw. That mechanism explicitly permits a raise recorded in
the same commit, so 685 → 687, 215 → 216, 774 → 776, with the byte attribution written into
`check_bundle_budget.ts` beside every previous raise. The `Layers` icon was measured on its own by
removing it and rebuilding — 0.3 kB of the 1.5 — and kept, because the four sibling blocks each
carry one.

---

## 7. What was deliberately not done

**The 3/4 count race is `N-7`**, recorded with three candidate mechanisms and a discriminator on
each. The mechanism is read off the code — `Home.tsx:972` builds `(count ?? 0) + 1` and refetches
*after* capture, so the number is right only while the query is stale — and the disagreement is
reproduced, including between the desktop and handset passes of a single run. What is **not**
established is which sentence is correct, which is a question about what `decisionsOnRecord` means
rather than about a race, and the discriminator forces the losing arm rather than sampling for it.
Shipping an unverified fix beside a verified one is the failure mode pass 2 exists to prevent.

**The disclosure was not moved.** Below the fold on both viewports, at weight 400 and 12px. Named,
not relocated.

**Nothing on the reveal was bolded.** §2.

---

## Stopping decision

Every licensed item is built, measured against a criterion stated before implementation, and
falsified with controls that go red on their own break. The one item the licence excluded is
recorded as a finding with its discriminator. What remains open needs the owner or its own pass,
not another probe on this one.
