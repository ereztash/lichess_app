# Authority transfer: what moved, what did not, and what would move next

**Base:** `main` @ `a8e7e69`
**Date:** 2026-09-14

---

## BLUF

**No screen's primary action was handed to `deriveNextAction` in this pass, and that is the
finding rather than a shortfall.**

The migration's own gate (Phase 9) requires seven conditions. Six are now met for exactly two
branches. The seventh — *"no critical contradiction shows canonical policy is currently unsafe"* —
is met, but a different obstacle sits in front of it: **the two branches that qualify name a
control that two of the three routing surfaces do not have.**

Transferring them would not be a migration. It would be adding a product affordance.

---

## 1. The Phase 9 gate, per branch

Only three proposals are **sound as shipped** (`soundProposal` — see
`ARCHITECTURE_UI_SHADOW_RESULTS.md` §1). Everything else rests on `unseenEvent`, which nothing in
the product writes.

| Condition | `continue-drill` | `continue-transfer` | `wait-analysis` | branches 4–11 |
|---|---|---|---|---|
| 1. Required state inputs truthful | **✓** | **✓** | **✓** | ✗ (`unseenEvent`) |
| 2. Measurement exists on the affected surface | **✓** (3/3) | **✓** | **✓** | ✓ |
| 3. No higher-priority input silently absent | **✓** | **✓** | **✓** | ✗ |
| 4. Semantic translation defined | **✓** `continue-run` | **✓** `continue-run` | **✓** *(no control)* | ✓ |
| 5. Observed disagreements reviewed | **✓** — Class A | **✓** — Class A | **✓** — none found | n/a |
| 6. No critical contradiction | **✓** | **✓** | **✓** | n/a |
| 7. Reversal cheap | **✓** | **✓** | **✓** | n/a |
| **Blocked by** | **no control on 2 of 3 surfaces** | **same** | **already the behaviour** | **input** |

### `wait-analysis` — already transferred, before this work, by a different route

`actFor("wait-analysis")` is `null`: the act is to **wait**, and there is no button for waiting.
The front door already goes quiet on `nothing-scored` — P1.5 made it do so deliberately, because
another game grows the backlog that *is* the blocker — and `D22` calls this *"the most emphatic
agreement in the product."*

There is nothing to move. The canonical policy and the screen already say the same thing, and the
screen said it first.

### `continue-drill` / `continue-transfer` — qualified, and blocked on a missing control

```
$ grep -rn 'primaryAction("continue-run")' client/src/
client/src/pages/Home.tsx:1887
```

One control, inside the run. The record page and the post-game screen have **no way to express
`continue-run` at all.**

So the honest sequence is:

1. a player starts a drill — eight positions chosen in advance to test one thing;
2. they leave, or reload;
3. the record page now *knows* the run is open, and the derivation correctly says `continue-run`;
4. the screen offers `play-first-decision`, because that is the only act it has.

Handing authority over at step 4 would mean rendering an act with no control behind it. The work
the product actually needs is step 3 → a **"finish the set you started"** affordance on the two
screens that lack one. That has its own copy, its own placement question, and its own reason to be
walked in a browser — and `GATE-ONE-PRIMARY-ACTION` will have an opinion about where it goes on a
screen that already offers something.

**It is the next move, and it is a product change rather than an authority migration.**

---

## 2. What was removed, and what was deliberately left

### Removed

| Thing | Why it could go |
|---|---|
| `SURFACE_BLIND_SPOTS` (`Record<ShadowSurface, string[]>`) | a hand-maintained table that reached the ledger and never the derivation. Replaced by `NextActionProposal.blind`, computed. |
| `RESUME_BLIND_SPOTS` | an alias of one row of the above. |
| the `null`-as-both-answers encoding on four inputs | replaced by `Observed<T>`; the type no longer offers a way to be silently blind. |

### Deliberately left in place

| Thing | Why it still owns a distinct question |
|---|---|
| `readResume()` | **It answers a different question, and Phase 11 says so.** `ResumeNext` (`play \| wait`) is an *action* vocabulary and should not survive authority transfer — but `ResumeKnowledge`, `ResumeChange` and the `because` sentences are a **state description**: what the player should be *told*, not where they should be *sent*. The description has no canonical replacement and should not acquire one. Only its `next` field competes with the derivation, and it cannot be retired until `continue-run` is renderable on that screen. |
| `primaryAction("play-blitz")` in `PostGame` | branch 9 is unsound as shipped; there is nothing qualified to replace it with. |
| `primaryAction("play-first-decision")` in `Record` | same. |
| `primaryAction("next-decision")` in `RevealPanel` / `RevealFailure` | **out of scope permanently.** Reachable from no `NextActionKind` by design — see `ARCHITECTURE_UI_SHADOW_RESULTS.md` Class D. Phase 13's warning applies exactly here: reveal is the transition from a player-owned decision to new evidence, and centralising its continuation control would collapse the authorship boundary. |
| the drill **cursor** in `Home.tsx` | which position is on screen is genuinely that component's. The policy asks whether a run is open and how far in; both are now answerable from the record. |

---

## 2b. The blocking precondition review found: an abandoned drill never closes

**This is a pre-existing product gap that this change makes load-bearing for the first time, and it
must be settled before `continue-drill` is rendered anywhere.**

`beginDrill` writes the `StoredDrill` before the briefing renders — correctly, because a
pre-registered set has to exist before its first position is shown. `closeDrill`
(`client/src/pages/Home.tsx:1391`) resets eleven pieces of component state and **writes no result
row**. `saveDrillResult` is reached only from `finishDrill`.

So a player who opens a drill, reads the briefing and dismisses it leaves a drill that is **open in
the record forever**. Nothing distinguishes it from one they walked away from mid-way and mean to
finish, because the record stores no such distinction.

Before this change that cost nothing: no surface could see open drills. Now branch 1 fires on it,
`blind` is empty, and the proposal is **sound** — so a stale drill would be logged as the product's
top proposal on every surface, indefinitely. That is the same class of defect as `analysisRunning`
hard-coded `false`: a measurement about the measurer.

**What was done here.** Two things that need no product decision:

- the read takes the **newest** open drill, not the oldest, so a stale run cannot mask a live one;
- **ungradeable** drills are omitted in all three stores, not just the MySQL one, per the interface
  contract.

**What was deliberately not done.** Closing a drill on abandon is a change to what the product
*means* by abandoning one, and there are at least three defensible answers:

1. **`closeDrill` writes an abandonment row.** Honest, and it forecloses resuming — which is the
   opposite of what `getOpenLearningTransfer` argues for on the transfer side: *"Losing a tab is not
   misconduct, and a rule whose test can be started but never finished is a rule that can only be
   refuted by accident."*
2. **A drill with `done === 0` is not a continuation.** Cheap, and it lets a player who dislikes the
   positions dismiss the briefing and draw again — choosing their own evidence under a stamp that
   says they did not, which is exactly what pre-registration exists to prevent.
3. **`beginDrill` refuses a second open drill**, as `beginLearningTransfer` already does for
   transfers. The most consistent with the existing domain, and the one that makes the stale drill a
   blocker the player must resolve rather than a row the read has to guess about.

**Option 3 is the one this document recommends**, on the ground that the transfer side already
chose it and the drill side is the same object one authorship over. It is a product change, it is
not in this pass, and `continue-drill` should not be rendered on any surface until it lands.

---

## 3. Failure states (Phase 14)

Canonical policy must not turn a failure into a fake normal state. Where each lands:

| Situation | Canonical action | Who owns the screen |
|---|---|---|
| continuation query **in flight** | `UNOBSERVED` → proposal unsound → `useProductState` returns `null`, no row written | the screen, unchanged |
| continuation query **failed** | `UNOBSERVED` — a failed read genuinely has not come back | the screen, unchanged |
| blitz reading unresolved | `blitzStanding: null` → `none` | the screen |
| claim read failed | `claimStateOf(undefined)` → `{ kind: "unread" }` | the screen |
| analysis failure | out of the derivation's vocabulary entirely | **local recovery owns it** |
| drill with no recorded direction | omitted from `listOpenDrills` — it is ungradeable, so finishing it is an act with no outcome | the screen |

**A recovery mechanism is not a product next action, and none of the above was turned into one.**
`UNOBSERVED` propagates to `blind`, `blind` makes the proposal unsound, and an unsound proposal is
never rendered. The failure path and the policy path do not meet.

---

## 4. The gates added, and their controls

Both go red on a fixture, because a green gate with no demonstrated failure is not evidence.

| Gate | Asserts | Positive control | Control's red reason |
|---|---|---|---|
| `GATE-SHADOW-SURFACE-LIVE` | every `SHADOW_SURFACES` member has a live call site | `tests/fixtures/shadow-surfaces/` instruments only `resume` | *"SHADOW_SURFACES declares `post-game` and nothing instruments it"* — the product's actual prior state |
| `GATE-CONTINUATION-OUTRANKS` | an open run outranks every lower branch, with all of them loud at once | the ladder with the backlog check moved above the run | *"an open drill proposed `wait-analysis` instead of `continue-drill`"* |

**The second control is not contrived.** `wait-analysis` is the branch P1.5 fought hardest for and
the most defensible thing to promote — and promoting it abandons a pre-registered set to wait for
an engine.

### The gates from Phase 15 that were **not** written, and why

| Asked for | Status |
|---|---|
| **G2** — canonical state is not fabricated | **enforced by the type system instead.** `Observed<T>` makes the fabrication unrepresentable; a gate scanning for it would be checking something the compiler already refuses. A gate here would be ceremony. |
| **G3** — one semantic authority (no hard-coded action after transfer) | **premature.** Nothing has been transferred. Writing it now would assert a condition no branch is in, and its control would have to fake a transfer that has not happened. |
| **G4** — surface translation preserves semantic action | **premature, same reason**, and partly covered: `actFor`/`agreesWith` are tested for totality and ontoness by `a-proposal-with-no-control-to-name-it.test.ts`, and `one-truth-many-renderings.test.ts` asserts that no two materially different intentions share an act. |
| **G6** — player-authored untested rule stays visible to policy | **covered by test rather than gate.** `continuationReading` is the only path, and the matrix asserts branch 5 fires from `untestedRule`. A gate would need a source scan over a path with one implementation. |

Writing G3 and G4 before any authority moved would have produced two green gates that had never
been able to fail — which is the thing this repository's gate discipline exists to refuse.

---

## 5. What remains `FIELD_REQUIRED`

Repository correctness cannot establish any of these, and none of them is closed by this work:

- whether a player **notices** the primary action;
- whether they **understand** what it will do;
- whether they **agree** it is the right next thing;
- whether they know **why** it is next;
- whether the order in `deriveNextAction` — which is a set of arguments, and an argument is the
  thing a person can be wrong about — matches what a person would have wanted. This is `D22`
  reversal condition 3 and needs the acquisition trial.

**The technical milestone this pass reaches:** canonical policy and the rendered UI no longer
*silently* contradict each other — every contradiction is now either measured, typed as unsound, or
named as a missing control.

**The human milestone is untouched.**

---

## 6. Exact next move

**First, settle §2b** — an abandoned drill that never closes makes `continue-drill` unsafe to
render however good the control is. Option 3 (`beginDrill` refuses a second open drill, as
`beginLearningTransfer` already does) is the recommendation.

**Then add a `continue-run` control** to the record page and the post-game screen, gated on
`soundProposal(proposal) && proposal.action.kind` being a run, and walk it in Chromium with a drill
actually open.

That is the smallest change that turns the one confirmed disagreement class into a product the
player can act on — and it is the only branch pair that has passed the transfer gate. The order
matters: the control without §2b would route a player to a run the record cannot tell is live.
