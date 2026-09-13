# The words a stranger has to read

**Rule, in the owner's words:** the player plays, and learns something new when a need arises. The
product does not spend the player's resources on being learned.

This directory records one pass under that rule: what was measured, what was cut, what was
deliberately left, and the ceiling that keeps the cut from growing back. It is not a second debt
register and it opens no debt row. Where a finding here touches one that Neta already holds
(`docs/neta/findings/N-1.json`, `N-8.json`), the disposition stays with that ledger.

---

## 1. What "cost" means here

Attention goes to the position or to the product. Every sentence that explains the instrument is
attention the position did not get. That is the whole of the claim, and it is a claim about text on
a screen, not about comprehension: a short screen can be opaque and a long one can be read in a
glance. Comprehension belongs to `FIELD` and is what Arm B of
[`VALUE_CLARITY_FIELD_PROTOCOL.md`](../VALUE_CLARITY_FIELD_PROTOCOL.md) measures. What the repository
can put a ceiling on without a person is the cost of the screen as text.

**The instrument.** `tests/layout/learning-cost.ts` walks the stranger's journey on the built app,
the way `a-stranger-takes-their-first-decision` and `the-loop-a-stranger-can-close` already walk it:
built assets served statically, `/api/*` answering 503, Lichess answered from the fixture, the engine
not intercepted. At each stage it counts the visible words in `<main>`, board and move list excluded,
closed disclosures unread. `npm run learning-cost -- --label <name>` deposits the reading in
`evidence/`; `tests/layout/the-words-a-stranger-must-read.layout.test.ts` holds the ceilings.

**One correction the instrument needed.** Chromium keeps a box for the body of a closed `<details>`,
so the first run counted the reveal's collapsed numbers and the ribbon's "למה?" as read. The counter
now walks the disclosure ancestors; both readings below were taken with the corrected counter, on
two builds of the same commit's toolchain (`evidence/before.json` on `06828af`, `evidence/after.json`
on this tree).

---

## 2. The reading

Visible words, desktop viewport 1440×900. "Before the act" is the words in document order ahead of
the stage's one primary control. The phone column is what is on a 390×844 screen without scrolling.

| stage | words before | words after | before the act, before → after | phone first screen, before → after |
| --- | ---: | ---: | --- | --- |
| front door, cold | 187 | 137 | 83 → 63 | 136 → 106 |
| decide, before a move | 140 | 97 | 88 → 58 | 73 → 44 |
| commitment, move placed | 151 | 107 | 98 → 68 | 146 → 102 |
| reveal | 270 | 199 | 221 → 163 | 186 → 151 |
| shared set, commitment | 207 | 172 | 152 → 131 | 196 → 167 |

The longest single block on the decide screen went from 29 words to 19; on the reveal from 36 to 29.
The front door's longest block is unchanged at 31 words: it is the licence notice, which is a legal
text and not copy.

---

## 3. What was cut, and the rule each cut follows

Every change below is copy or one sentence's condition. No event, denominator, threshold, gate or
measurement moved. `npm run verify` is green on this tree.

**Do not teach the form before the task.**
`PROMISE.mechanism` listed the four things the ordering records; the commitment screen puts those
four in front of the player one step at a time, on the decision itself. The front door now says only
the ordering. `PROMISE.payoff` keeps its two hedges (`לפעמים`, `לא בכל החלטה`) and lost a clause.
The three ideas `PROMISE_ANCHORS` holds survive on every stage of the chain, and
`the-link-someone-was-sent` still asserts them.

**The steps are the instruction.**
The commitment screen rendered a sentence describing the accordion directly beneath it, derived
from `stepsFor` so it could not drift. It was the list said twice. Gone; the one sentence the steps
cannot say for themselves, why the engine waits, stays, because the protocol's Mechanism gate asks a
player to give it back and `why-the-engine-waits` holds it.

**Say the limit, not the paragraph about it.**
The reveal's limits block keeps its place, first, before any number. What changed is the length of
each line: the first is now `זו החלטה אחת שנרשמה. לא דפוס.`, the scope sentence the field protocol
names as the compact form, with the words `a-count-the-record-does-not-hold` reads the count from
(N-7) kept. The single-engine fact (`BUILD_LIMIT`) is a property of the build, true of every
position, and now sits at the top of the collapsed numbers it qualifies rather than among the
per-decision limits.

**A constant sentence is read once.**
The accumulation block's two constants and the evidence-class labels were cut to their claim.
`ACCUMULATION_LEAD` still says a single decision is not a pattern; `ACCUMULATION_NEXT` still shares
`חוזר` with the button under it. `why-another-decision` holds every invariance it held before.

**An empty record is empty.**
Above the board, before a stranger's first move, the ribbon announced the detector's floor (`עוד 60
החלטות מדודות`) and offered the import that shortens it: twenty-nine words about a claim nobody was
waiting for, on the screen where attention is the measurement. `loopPosition` now returns a
one-line position for a record with no decision in it and no narrowed search; the distance and the
shortcut arrive with the first decision. This is the one change that is a condition rather than a
wording. It adds no reading of the record, the ribbon still renders a position in every state (the
CLS argument in `ContextRibbon` holds), and `loop-position.test.ts` pins both sides of the line.

**Notices say what the board does.**
Seven status lines told the player to "write your read" on positions where no read is asked. They
say `בחרו מהלך.` The signed-out storage notice, under the board on every visit, keeps both facts the
privacy claims rest on, in eleven words.

Smaller cuts of the same kind: the front door's two alternative routes, the new-game notes, the blitz
setup line, the record page's two layer leads, the outcome summary's footnote, the position-source
detail, the shared-set counter.

**Two clauses came back after the first measurement**, and the reading above is the one with them
in. `choice-rule.test.ts` holds the single-candidate limit to saying that moves considered off the
board were never recorded, and `commit-blocked.test.tsx` holds the refusal to saying it is the rule
and not a fault; both were written on a real report, and a test that names its reason is a sentence
that stays. Each is one clause, not a paragraph.

---

## 4. What was deliberately not changed

- **The reveal's order.** Limits first, then the finding, then the question, then the numbers. The
  field protocol names the limits-order question as one Arm B decides and says the incumbent stays
  until it does. Length moved; position did not.
- **The reason the engine waits**, on the commitment screen, in every state. A preregistered gate
  (Mechanism, 9/10, arms A and B) asks for it back.
- **The help overlay (`WhatThisIs`).** It is behind a press, which is what "when a need arises"
  looks like on a screen. Its length is the reader's choice.
- **The ribbon's quiet-window arm.** `QUIET_EVIDENCE_WINDOW_ENABLED` is a research condition
  (`research/ux-measurement/` X-5) and `GATE-QUIET-WINDOW-LINEAGE` holds its lineage. Suppressing the
  ribbon while deciding is a measurement change and is not made here.
- **Every failure sentence.** `GATE-ENGINE-FAILURE-DISTINCT` and R-09 are the reason six causes have
  six sentences; shortening them into one another would be the defect that gate exists for.
- **`Home.tsx`'s shape.** Under its ratchet and an owner decision; nothing here touches it.
- **Em dashes in copy that was not rewritten.** New sentences use commas and full stops; sentences
  that only lost words keep their punctuation.

---

## 5. What this does to the frozen field protocol

Nothing in `ACQUISITION_PROTOCOL_V1.md` sections 1 to 6 moved: the two entry routes, the events, the
denominators and the per-participant reconstruction are as frozen. `VALUE_CLARITY_FIELD_PROTOCOL.md`
pins interview questions and a coding scheme, not screen copy, and no participant has been run, so
there is no trial-1 number to keep comparable. The one consequence a recruiter should know: the
runnability evidence in `PRE_RELEASE_STATE.md` was measured on `07ccd11`, and this tree changes
client bytes. The two stranger walks pass on this build; the deployed-origin probe is re-run by the
next `deployed.yml` after this ships, not carried forward.

---

## 6. The ceiling, and what reverses it

`the-words-a-stranger-must-read.layout.test.ts` holds each stage at its reading after this pass,
rounded up to the next five. It only comes down. Raising a ceiling is a decision made in a diff,
with the sentence that needed the room named in it.

**What reverses a cut.** Arm B of the field protocol. A participant who cannot reconstruct why the
engine waits, or cannot say that one decision is not a pattern, after reading the shorter screen is
evidence that a sentence cut here was load-bearing, and the row that shows it names which one. A
weak Arm B result is a result; it is not a licence to put every sentence back.
