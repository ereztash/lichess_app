# Pre-human UX, pass 2: five candidates, five dissolutions

This pass produced no code change, and that is its result rather than its failure. It took the one
thing [`PRE_HUMAN_UX_PASS_1.md`](PRE_HUMAN_UX_PASS_1.md) left open as a mechanism, `M-C`, and
measured each of its parts until each one either survived or turned out to be the product working
as designed. None survived.

Method is Neta v0.2 at `5344852`. Measured on the built app at `ed7fe24`, both viewports.

---

## What `M-C` claimed

> salience does not agree with priority

with four rows of evidence. Every number in those rows re-measured identically. The reading of them
did not.

---

## Row by row

### 1. On the desktop reveal, the top-ranked element is the closing sentence, above the finding

**Re-measured:** yes. Score 180 for the closing sentence at 12px, against 178 for the finding at
16px. It wins on area, because it is longer.

**What it actually is.** `CONTINUATION_PROPOSITION` in `shared/reveal.ts`, and its own source says
what it is for: it is the argument that makes the continuation control actionable rather than
decorative, it is deliberately identical on every reveal so the trial cannot read its own copy back,
and it deliberately carries no number because "a digit here is a countdown whatever the surrounding
words say".

I called it "the boilerplate that is identical on every reveal". It is identical on purpose, it is
the reason the button beneath it means anything, and dimming it would weaken the primary action's
justification. **Dissolved, and the wording in pass 1 was wrong.**

### 2. On the handset reveal, the record-mode notice ranks first

**Re-measured:** yes. Score 195, y=744, area 26,478.

**What it actually is.** Two things, and neither is a defect. `RecordModeNotice` is the only place
the product says where a person's decisions are kept, and its source argues that case at length. And
the ranking itself is an artefact of my instrument: the salience scan only ranks what is inside the
current viewport, and on a handset the reveal's four blocks begin at y=899. The notice ranks first
because the reveal is below the fold, which is `F-1` restated, not a second finding. **Dissolved.**

### 3. The reveal's `h1` is smaller than its `h2`s

**Re-measured:** yes. `h1` 16px, three `h2` at 18px.

**What it actually is.** The product's documented rule.
`tests/layout/what-the-eye-ranks-first.layout.test.ts` holds that the task outranks its own
subject's label, and the `h1` is the position's name. The same relation holds on `DECIDE`, where the
question is 22px over the same 16px `h1`. **Dissolved.**

### 4. The front door's primary control has the lowest contrast on the screen

**Re-measured:** 4.6, and then measured again with the username field filled: `rgb(247,243,233)` on
`rgb(23,34,31)`, which is the product's highest contrast pair.

4.6 was the **disabled** state, which is what a primary control that cannot yet be pressed should
look like. I would have "fixed" a correct disabled state. **Dissolved.**

### 5. Weight 800 is shipped and never painted

Not from pass 1; found in this one, and it is the one that came closest to a change.

**Measured:** across five screens, 354 painted elements at weight 400, 14 at 600, 24 at 700, and
**zero at 800**. The browser fetched seven of the nine font files; neither weight-800 file was ever
requested. Two `@font-face` declarations and 32,456 bytes of woff2 for nothing.

**What it actually is.** `.learning-grade` is `font-weight: 800`, rendered by `LearningQueue.tsx` on
a rule that has been graded. A five-screen walk cannot reach that state, and a five-screen walk is
what I had. Removing the face would have deleted a weight a real screen paints. **Dissolved, and it
is the one that would have shipped a defect.**

---

## What this says about the instrument, which is the transferable part

Two systematic biases, both mine, both now measured:

**A salience proxy that ranks by area will always rank prose above controls.** In a product whose
proposition is what it says rather than what you press, that is the proxy describing itself. The
numbers were right and "inversion" was a word I brought to them.

**A five-screen sweep understates the state space.** Weight 800 is painted on a screen that needs
sixty measured decisions or a completed drill to exist. Any claim of the form "nothing in this
product does X", drawn from a walk, is a claim about the walk.

Both belong in `harness/README.md` beside the two instrument defects already recorded there.

---

## What is left, and it is one thing

**354 : 14 : 24.** Ninety percent of painted text is weight 400, and **every heading on every screen
is weight 400** while the product ships and paints 600 and 700. The type scale ranks by size alone.

That is a fair mechanical description of two owner signals that nothing else in either pass
accounts for:

> העיצוב מרגיש מיושן · המוצר מרגיש פחות מתקדם מהטכנולוגיה שהוא מכיל

and it is the only candidate left standing after this pass.

**It is not mine to decide.** Whether headings carry weight is the product's voice. The restraint is
visibly deliberate everywhere else: no shadows, two radii, three surfaces, hairline borders, one
transition. A bold heading could be exactly wrong for it. That is an `OWNER` claim under v0.2, the
observation is `REPO` at `R3`, and the two must not be confused.

---

## Stopping decision

`M-C` is closed as a mechanism: it was not one. The measurements stand and are recorded here with
what each of them turned out to be.

The heading-weight question is open, is stated, and is the owner's. No further technical work
reduces it, which is the authority ceiling for this pass.

No code was changed. Nothing was shipped to satisfy the shape of a pass.
