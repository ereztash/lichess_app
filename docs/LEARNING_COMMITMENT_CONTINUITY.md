# Learning commitment continuity

**Telos.** A learning commitment the player has already started must preserve its behavioural
priority across context boundaries until it is legitimately completed, resolved, or explicitly
superseded.

The record surviving is not sufficient. `saveDrill` has written before the first board was shown
since drills shipped, so the ROW always survived a reload. What did not survive was everything that
makes the row mean anything: nothing could tell an open drill from one the player had closed,
nothing could reconstruct how far in they were, and no screen but the one running it could offer to
carry on. A record that remembers a test and cannot resume it has kept a receipt.

---

## §1 · What was verified against `main` before anything was built

`origin/main` at `23583ae`. Each claim from the previous mission's report, checked against the tree.

| Claim | Verdict | Evidence |
| --- | --- | --- |
| `continue-run` has exactly one control in the product | **CONFIRMED** | `client/src/pages/Home.tsx:1887` was the only `primaryAction("continue-run")` in `client/src` |
| …and it is reachable only from inside the run | **CONFIRMED, and stronger than reported** | its condition is `revealed && revealedDecisionId && learningTransfer && learningTransferStage === "running"`. It is not a re-entry control at all; it advances to the next position of a run already on screen |
| `closeDrill` resets component state and writes no result row | **CONFIRMED** | `Home.tsx:1391`, eleven `setX` calls, no mutation |
| `deriveNextAction` ranks `continue-drill` and `continue-transfer` first | **CONFIRMED** | `shared/next-action.ts`, branches 1 and 2 of `proposeNextAction` |
| `ProductState.drill` / `.transfer` are `Observed<…>` | **CONFIRMED** | the `Observed<T>` migration is in `main` |
| `unseenEvent` has no implementation anywhere | **CONFIRMED** | `PERMANENTLY_UNOBSERVED = ["unseenEvent"]`; no seen-set, no writer, no reader |
| `SHADOW_SURFACES` are `resume`, `post-game`, `record` | **CONFIRMED** | all three instrumented; `GATE-SHADOW-SURFACE-LIVE` holds it |
| the transfer already resumes correctly | **CONFIRMED** | `startLearningTransfer` (`shared/record-service.ts:820`) returns the open transfer with `observed`, and `Home.tsx` sets the index from it |
| a drill has any resume path | **FALSE** | `setDrill` had exactly one caller, `beginDrill`, which starts a NEW drill. There was no read-back path of any kind |

One further fact, not in the previous report and load-bearing here: **`DecisionAtom.drill_id` is
server-verified**. `commitDecision` resolves it against a drill stored before the decision was made
and requires that drill to contain the position (`shared/record-service.ts:294-313`). So a drill's
answered positions and their decision ids are recoverable from the record exactly, with no new
write — which is what made the restore possible at all.

---

## §2 · The drill lifecycle decision

The previous authority-transfer review recommended **C**. It was re-derived from the domain, and
the answer is **A**.

`listOpenDrills` returns drills started and never reported, and that set could not be trusted: a
drill drawn at the briefing and dismissed stayed open forever, indistinguishable from one the
player answered three positions of and means to finish. Any surface routing on "a drill is open"
would have been routing on that.

### The three options against what actually matters

| | **A** · abandon writes a terminal state | **B** · a zero-progress drill does not count | **C** · no second drill while one is open |
| --- | --- | --- | --- |
| **Preregistration integrity** | strong. A registered-and-not-reported test stays visible as one | **worst.** Draw, read the briefing's terms, dismiss, draw again — unlimited redraws, no trace | strongest. Redraw is structurally impossible |
| **Player ownership** | the player's act is honoured and recorded | nothing to own | **worst.** A drill drawn by accident blocks every future drill on every claim, forever |
| **Lost-tab recovery** | a lost tab writes nothing, so the drill stays open and resumable | a tab lost before the first decision is silently discarded | a lost tab permanently bricks drilling |
| **Accidental abandonment** | a misclick ends a run; recoverable only by re-drawing | nothing to misclick | catastrophic — accident becomes permanent |
| **Explicit user intent** | the only option that reads it | ignores it | ignores it |
| **Existing transfer semantics** | adds a concept the transfer lacks | — | mirrors `getOpenLearningTransfer` |
| **Evidence selection after seeing it** | recorded, so visible | **licensed** | prevented |

C has the best integrity and the worst ownership; B has the best ownership and the worst integrity.
Only A separates the two cases by reading what the player actually did.

### The argument that settles it

`LiveLearningCommitment` must distinguish `UNKNOWN ≠ NONE ≠ ABANDONED ≠ COMPLETED ≠ ACTIVE`.

- **B produces no `ABANDONED` state.** It folds abandoned into `none` — a collapse, in the
  direction that discards a commitment.
- **C produces no `ABANDONED` state either.** Everything open stays `ACTIVE` forever, which makes
  `ACTIVE` a lie.
- **A produces a real, readable `ABANDONED`.**

So the option is chosen by the requirement, not by the earlier recommendation.

### What A costs, and how the cost is bounded

A's weakness is accidental abandonment. The mitigation is that abandonment is **explicit and
narrow**: only the player's own close control writes it. A reload, a navigation, a lost tab and a
crashed browser all write nothing, and the drill stays open and resumable. That asymmetry is the
telos stated as a rule — a commitment survives everything except the player deciding it should not.

An abandonment is **not a result**. It writes no verdict, grades no claim, and leaves
`drill_results` untouched. A registry that folded it into a count of forward tests would be
reporting tests that never ran.

**What A does not decide, and is deliberately left open:** whether `beginDrill` should refuse a
claim whose previous drill was abandoned. The abandoned rows accumulate and are visible, so the
question can be answered later from evidence. Answering it now would be adding a policy to a slice
that does not need one.

### Where it lives

`drills.abandoned_at`, nullable, migration `0020`. Null on every open drill, every reported drill,
and every row written before the column existed — and null means open, which is the direction that
returns a commitment rather than silently discarding one.

---

## §3 · The five states

`shared/continuation.ts`. The distinctions are stated as the differences they protect.

| State | Means | Protects against |
| --- | --- | --- |
| `unknown` + `not-attempted` | the read has not happened | a screen that renders `none` while a request is in flight |
| `unknown` + `read-failed` | the read came back an error | a failed request being read as an empty record |
| `none` | read, and this record has never opened a run | "you have never done this" said to somebody who just finished one |
| `completed` | the most recent run reached a verdict | an achievement reported as an absence |
| `abandoned` | the player closed the most recent run | a test that never ran counted as one that did |
| `active` | a run is open, with `done`, `total` and whether it can be reopened | — |

`abandoned` is unreachable on the transfer slot, and that is a fact about the product rather than
an oversight: a transfer has no close control, so its only endings are reported and still-running.
The state exists on the type because one type serves both slots.

`unknown` is never produced by a caller's `??`. `useContinuation` returns a reading always and
`undefined` never, so no surface holds "no data" and decides for itself what that meant.

---

## §4 · Restoring the run

`restoreDrillRun` in `shared/drill-restore.ts`. It returns the registered spec, the decision ids,
and the cursor — or says why it cannot.

- **The terms are the stored ones.** Positions, order, refutation condition and direction are read
  back exactly as registered. Nothing is re-selected: a resume that chose fresh positions would be
  a player picking their own evidence after seeing part of it, under a stamp that says they did not.
- **The decision ids are not a convenience.** `finishDrill` takes them and refuses any set whose
  size is not the registered size. A run that could be continued and never reported would leave a
  claim frozen with no path that could test it.
- **Progress is matched by `drill_id` AND by board.** The id says which run a decision belongs to;
  the board says which registered slot it answered, and the cursor needs that. `samePosition` is
  used because that is the predicate `finishDrill` grades with — a stricter count would send the
  player to a board they had already answered and `finishDrill` would then refuse the whole drill.
- **When the two counts disagree, it says so.** `progress-ambiguous` is reachable for real:
  `decisions.drill_id` shipped in migration `0015` and `drills.predicts_overconfidence` in `0006`,
  so a drill started between them is gradeable, still open, and its decisions carry no binding.
  Guessing would either re-serve a decided board or drop a registered position.

The transfer needed none of this. `startLearningTransfer` already returned the open run with its
observation count; what was missing was a way to reach it from a screen that is not the board.

---

## §5 · One act, three presentations

`continuationOffer` (`shared/continuation-offer.ts`) answers which run outranks and whether the
surface must stand its own primary down. It asks `proposeContinuation`, which is `deriveNextAction`
run with everything below branch 2 honestly unread — so the ranking is the ladder's, once, and
there is no second comparison written beside three controls.

| Surface | Frame | What stands down |
| --- | --- | --- |
| `record` (`/`, first visit) | `ContinuationSlot`, lazily mounted above the branch | `FirstDecision`'s `play-first-decision` submit |
| `resume` (`/`, returning) | the same slot, one element for both of the page's states | the resume card's `play-blitz` action |
| `post-game` (`/blitz`) | the slot `משחק חדש` occupied | `post-game__again`, and the card's own action when it *is* play-again |

Suppression happens only when the set can actually be reopened. A set that cannot offers no act to
prefer; a read that failed has decided nothing and may not silence a control either.

The act has one `data-primary-action="continue-run"` control in the whole client, in
`ContinueCommitment.tsx`, mounted by three surfaces.

---

## §6 · What a player reads

No architecture vocabulary. Nothing says continuation, canonical, branch, or preregistered evidence
set.

- drill: `התחלתם לבדוק את זה. סיימו את הסט שהתחלתם.`
- transfer: `התחלתם לבדוק את הכלל שכתבתם. סיימו את הסט שהתחלתם.`
- progress: `עניתם על 2 מתוך 3 עמדות.`
- control: `חזרה לסט`
- cannot be reopened: `יש סט שהתחלתם ואי אפשר לפתוח אותו מחדש מכאן, כי ההיסטוריה לא יכולה להגיד על אילו עמדות כבר עניתם.` + `סגירת הסט` at ghost weight
- read failed: `לא הצלחנו לקרוא את ההיסטוריה, אז אם יש סט פתוח הוא לא מוצג כאן.`

A read **in flight** draws nothing. Rendering the failure note for both cases put an untrue
sentence on the front door for a few hundred milliseconds and then removed it — measured in
Chromium as a 0.10 layout shift against a 0.02 budget, on the topmost element of the page.

---

## §7 · Browser verification

The previous mission reported the continuation states `NOT EXECUTED`. They are executed. Chromium
`/opt/pw-browsers/chromium-1194`, against the production build served over HTTP, one fresh browser
context per row, record seeded through `localStorage` in the shape `local-record-store.ts` reads.

| Walk | Visible primary acts | What the screen said | Result |
| --- | --- | --- | --- |
| returning visit, no commitment | `["play-blitz"]` | — | no regression |
| returning visit, drill open 2 of 3 | `["continue-run"]` | headline + `עניתם על 2 מתוך 3 עמדות.` | the competing primary stood down |
| **first** visit on this browser, drill open | `["continue-run"]` | same | the second-device case works: `returning` is browser bookkeeping, the record is not |
| press the control | — | lands on `/play` | see below |
| drill whose decisions carry no binding | `["play-blitz"]` | the cannot-reopen sentence | no fresh drill offered; the surface keeps its own primary |
| drill the player closed | `["play-blitz"]` | — | terminal, not revived |

Zero page errors in every walk.

**The press, in detail.** After pressing `חזרה לסט` the board is at the drill's **third** registered
position, not the first: `c3` holds a white pawn, `c2` is empty, `c5` holds a black bishop — which
is `fens[2]` and not `fens[0]`. The ribbon reads `דריל בעיצומו — 2 מתוך 3 עמדות`, so
`drillDecisionIds` came back with both ids. Cursor, progress and preregistered set all restored; no
decided board re-served.

---

## §8 · Gates

Two new, each with a positive control demonstrated red.

- **`GATE-CONTINUE-REACHABLE-OFF-RUN`** — the act that finishes a started set is reachable from
  outside the run itself. Control: `tests/fixtures/continuation-surfaces/pages/Home.tsx`, which is
  the product's own control copied off `23583ae`, at the path the gate excludes. Red.
- **`GATE-UNREAD-COMMITMENT-NOT-EMPTY`** — a commitment that could not be read is never offered as
  a record with none. Control: one `??`-shaped collapse of `unknown` into `none`. Red.

49 gates, 49 pass. 49 controls, 49 red.

---

## §9 · What was deliberately not built

- **No `unseenEvent`, no seen-set, no `review-event` infrastructure.** Branch 4 stays blind and
  `PERMANENTLY_UNOBSERVED` still names it. Architecture completeness is not the telos.
- **No authority transfer.** The surfaces render the continuation act; they do not defer to
  `deriveNextAction` for anything else. `CANONICAL AUTHORITY: PARTIAL`.
- **No new `NextAction` kinds.** `continue-drill`, `continue-transfer` and `continue-run` all
  existed.
- **No redesign** of Record, PostGame or Resume. Each gained one prop or one lazily-mounted sibling.
- **No transfer for `test-claim`, `test-hypothesis`, `play-blitz`, `collect-more-evidence`,
  `return-record`, `review-event`.**
- **No policy on redrawing a claim whose drill was abandoned.** §2 says why.

## §10 · What this cost, and what it bought

`Home.tsx` went over its 2,400-line ceiling, which may only go down. So `useDrillRun` took the
drill's six pieces of state and its four transitions out as one thing, and `useResumeRequest` took
the handoff. The state ratchet tightened from 53 to 47 behind them.

The bundle ceilings moved once, with the measurement table in `scripts/check_bundle_budget.ts`. The
reading that answers "is a set open" is in no eager chunk; the restore is, because the board is what
puts a player back inside a run and `Home.tsx` is a static import.
