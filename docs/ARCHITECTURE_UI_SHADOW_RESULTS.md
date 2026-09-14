# Shadow results: what the derivation and the screens actually disagree about

**Base:** `main` @ `a8e7e69`
**Date:** 2026-09-14

---

## 0. What evidence this document rests on, and what it does not

**It does not rest on player data. There is none.** The ledger the shadow writes to is a ring
buffer in one browser's `localStorage`, this build has had no players, and `D22` said so plainly
when it declined to wait for them: *"the wait had not started and could not finish."*

Three things did produce evidence, and they are named per finding below:

| Source | What it can establish | What it cannot |
|---|---|---|
| `tests/shared/one-truth-many-renderings.test.ts` | which proposals exist, which act each maps to, and which are **sound** | whether a screen renders them |
| `GATE-SHADOW-SURFACE-LIVE`, `GATE-CONTINUATION-OUTRANKS` | that every declared surface is measured, and that a run outranks | frequency |
| `tests/layout/a-walk-the-derivation-can-be-wrong-about.layout.test.ts` | what the **built app in Chromium** offers at two states of the record surface | states requiring a drill in flight |

**Nothing here is a frequency.** Every finding below is a statement about which states *can* occur
and what happens in them, not how often a person meets them. Phase 8 asked seven questions; four of
them are frequencies and are marked `FIELD_REQUIRED` in §4.

---

## 1. The matrix, as shipped

Printed by `one-truth-many-renderings.test.ts`. Two soundness columns, because there are two
questions and only one of them is about the derivation.

| # | canonical kind | semantic act | sound if all read | **sound as shipped** | blind as shipped |
|---|---|---|---|---|---|
| 1 | `continue-drill` | `continue-run` | ✓ | **✓** | – |
| 2 | `continue-transfer` | `continue-run` | ✓ | **✓** | – |
| 3 | `wait-analysis` | *(no control — the screen goes quiet)* | ✓ | **✓** | – |
| 4 | `review-event` | `review-event` | ✓ | ✗ | `unseenEvent` |
| 5 | `test-hypothesis` | `test-hypothesis` | ✓ | ✗ | `unseenEvent` |
| 6 | `test-claim` | `test-hypothesis` | ✓ | ✗ | `unseenEvent` |
| 7 | `none` | *(no control)* | ✓ | ✗ | `unseenEvent` |
| 8 | `play-first-decision` | `play-first-decision` | ✓ | ✗ | `unseenEvent` |
| 9 | `play-blitz` | `play-blitz` | ✓ | ✗ | `unseenEvent` |
| 10 | `collect-more-evidence` | `play-first-decision` | ✓ | ✗ | `unseenEvent` |
| 11 | `return-record` | `return-record` | ✓ | ✗ | `unseenEvent` |

**The gap between the two soundness columns is the remaining architecture → UI gap, printed.**
Three of eleven proposals may be acted on. Eight rest on a fact nobody has measured, and they rest
on it because `review-event` is branch 4 and everything below branch 4 is a proposal that an unread
finding would have outranked.

This is not a limitation discovered by argument. It is the derivation reporting it.

---

## 1b. The walk over the built app, run

`tests/layout/a-walk-the-derivation-can-be-wrong-about.layout.test.ts`, Chromium, phone viewport,
empty profile, reading `[data-primary-action]` off the shipped bundle:

```
the record page, empty:        derivation proposes play-first-decision (act play-first-decision)
                               the screen offers play-first-decision
                               [blind to unseenEvent -- proposal unsound]

the record page, one decision: derivation proposes play-blitz (act play-blitz)
                               the screen offers play-blitz
                               [blind to unseenEvent -- proposal unsound]
```

**Both stops agree, and neither agreement is worth anything yet.** That sentence is the reason the
`blind` column was added to this walk.

Before this pass the walk printed two agreements and stopped. It would have been read as *the
derivation and the screen want the same thing at both states the walk reaches* — and it is not
false, it is just not the whole reading. The proposals rest on `unseenEvent`, which ranks above
both of them and which nothing in the product measures. **A screen and a derivation agreeing about
`play-blitz` means one thing when every higher-ranked input was read and another when one of them
was not**: in the second case they agree about an answer that a fact nobody has measured would have
overruled.

Two agreements, both unsound. That is a different result from two agreements, and the walk now says
which one it found.

---

## 2. The disagreement classes

### Class A — **the newly visible state creates a disagreement no surface can render**

**This is the finding, and it blocks Phase 10.**

Before this work, `continue-drill` and `continue-transfer` were unreachable in production:
`productStateFor` hard-coded `drill: null` and `transfer: null`, so branches 1 and 2 never fired on
any surface. Every shadow row ever written was taken with the top of the ladder switched off.

They now fire. And:

```
$ grep -rn 'primaryAction("continue-run")' client/src/
client/src/pages/Home.tsx:1887
```

**`continue-run` has exactly one control in the entire product, and it is inside the run itself.**
Neither the record page nor the post-game screen has any control that names it.

So for every state where a run is open and the player is on `/` or on the post-game screen, the
canonical policy now says `continue-run` and the surface offers `play-first-decision` or
`play-blitz`. That is a **structural disagreement on 100 % of such states**, and it was invisible
before because the input was fabricated.

**What it means is not "the screens are wrong."** It means the product has a state it cannot
express: a player with a half-finished pre-registered set, standing on a screen with no way back
into it. `D22` named this from the other side and called it a LAW 4 defect *"with its own row"*.
The row is now readable, and reading it shows the defect is a **missing control**, not a
misrouted one.

Transferring authority here would therefore not be a migration. It would be **adding a product
affordance** — a "finish the run you started" control on two screens that do not have one — and
that is a change with its own design, its own copy, and its own reason to be walked in a browser
before it ships. It is out of scope for an authority migration and named in
`ARCHITECTURE_UI_AUTHORITY_TRANSFER.md` as the next move.

### Class B — **agreement that was an artefact of the shadow, now removed**

`SURFACE_BLIND_SPOTS` named four blind inputs on **every** row, including rows where those inputs
ranked *below* the branch that fired. A `continue-drill` proposed by a surface that could see
drills would have been logged as blind to drills.

`blind` is now the prefix that actually outranked the answer, computed by the derivation. The
change is not cosmetic: an empty `blind` used to be impossible and now means *nothing that could
have beaten this went unseen*. It is the predicate `soundProposal` reads, and therefore the
predicate authority transfer reads.

### Class C — **two surfaces were one screen**

`resume` and `record` are two **states of one route**, not two routes. `ResumeScreen` returns
`null` unless `returning`. Had both probes been mounted unconditionally, `offeredAct` would have
read the same DOM twice and written two rows claiming to be about two surfaces — and the ledger
would have shown **perfect agreement between `resume` and `record`** as an artefact of their being
the same page.

The record probe is gated on `!returning`. The existing browser walk had already met this shape
from the other side: its first draft walked to `/record`, read a 404 as *"a surface with nothing to
offer"*, and *"D22's reversal condition would have been reported as met by a typo."*

### Class D — **Reveal would have manufactured 100 % disagreement out of a correct architecture**

`next-decision`, `commit-decision` and `answer-instrument` are in `PRIMARY_ACTIONS` and reachable
from **no** `NextActionKind`. That is design, established by `D22`: they are controls the player is
*already using*, not somewhere they are *sent*.

A shadow on `RevealPanel` or `RevealFailure` would report a disagreement on every render, forever,
for the reason that the design is working. Reveal is **not instrumented, deliberately**, and it is
an anti-build decision rather than an unfinished one.

---

## 3. Phase 8's seven questions, answered or refused

| # | Question | Answer |
|---|---|---|
| 1 | How frequently do canonical and current UI actions disagree? | **`FIELD_REQUIRED`.** No players. What *can* be said: in any state with an open run, on `/` or post-game, disagreement is **certain** (Class A). |
| 2 | On which surfaces? | `record` and `post-game` for Class A. `resume` offers `play-blitz` and would disagree identically. Reveal is out of scope (Class D). |
| 3 | Which canonical branches cause disagreement? | Branches **1 and 2** (`continue-drill`, `continue-transfer`) — precisely the two the migration made reachable. |
| 4 | Are disagreements driven by newly visible state? | **Yes, entirely.** Every disagreement class above is a consequence of an input that was previously fabricated. |
| 5 | Are canonical proposals stable? | **Yes, by construction.** `deriveNextAction` is pure; `continuationReading` orders rules by `created_at` so two reads of one record propose the same rule. |
| 6 | Are any proposals obviously impossible or harmful? | **Yes — one, and it is impossible rather than harmful.** `continue-run` on `record` / `post-game` names a control neither screen has. See Class A. |
| 7 | How often would authority transfer change a user's next action? | **`FIELD_REQUIRED`.** Structurally: whenever a run is open and the player is not inside it. |

**Agreement rate is not reported, and deliberately.** With eight of eleven proposals unsound and
the only newly-reachable branches unrenderable, a single percentage would average a number that
cannot be acted on with a number that would change the product — and the mission's own instruction
is not to read agreement rate as quality.

---

## 4. What changed in the measurement itself

| Before | After |
|---|---|
| 1 of 3 declared surfaces instrumented; the other 2 silently absent | **3 of 3**, enforced by `GATE-SHADOW-SURFACE-LIVE` with a control that goes red |
| `blind` a hand-maintained per-surface constant | computed by the derivation, per proposal |
| 4 of 11 inputs fabricated as `null`, indistinguishable from absent | **10 of 11** truthful; the 11th says `UNOBSERVED` and cannot be mistaken for absent |
| branches 1, 2 and 5 unreachable in production | reachable |
| no gate could notice a declared surface losing its call site | one can, and its control demonstrates it |
