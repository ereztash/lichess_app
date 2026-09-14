# Architecture → UI: what authority moved

Every site that independently decided a product-next-action, and what happened to it. Companion to
`ARCHITECTURE_UI_CURRENT_STATE.md` §5, which classified them before anything moved.

---

## 1. The ledger

| Site | Was | Now | Verdict |
| --- | --- | --- | --- |
| `NEXT_STEP` + `NEXT_WHEN_FOUND` (`shared/resume-reading.ts`) | a 2-kind vocabulary (`play` / `wait`) keyed on `BlitzBlocker`, deciding the front door's act | **unused as policy.** `readResume` keeps the description; `presentOnResume` words the canonical act | **REMOVED** |
| `postGameWords().action` (`shared/blitz-words.ts`) | 3 hardcoded branches; `"שחק עוד משחק"` **unconditionally** when a game found nothing | the card's slot holds "see the position" only when there is a position; the act comes from the policy | **REMOVED** |
| `Blitz.tsx` `post-game__again` | `primaryAction("play-blitz")` under `lead !== null` | renders `offer.act` from `presentOnPostGame` | **REMOVED** |
| `ResumeScreen` card action | `act: "play-blitz" as const` | `offer.act`, supplied by the page | **REMOVED** |
| `Home.tsx` `continue-run` (header) | in-run advance to the next transfer position | unchanged | **JUSTIFIED EXCEPTION** — §2 |
| `RevealPanel` `next-decision` | the reveal's continuation | unchanged | **JUSTIFIED EXCEPTION** — §2 |
| `RevealNextPosition` (`next-decision` / `return-record`) | the bank's own next position, or the record when the bank is done | unchanged | **JUSTIFIED EXCEPTION** — §2 |
| `CommitmentScreen` `commit-decision` | submitting the decision being taken | unchanged | **PRESENTATION ONLY** — not a routing act |
| `Blitz.tsx` setup `play-blitz` | marks the *remembered* time control among three | unchanged | **PRESENTATION ONLY** — in-run, already on `/blitz` |
| `Record.tsx` `play-first-decision` | the cold front door's import form | unchanged | **JUSTIFIED EXCEPTION** — §3 |
| `ContinueCommitment` `continue-run` | the continuation control | unchanged | **JUSTIFIED EXCEPTION** — §4 |
| `RevealFailure` retry | retry after an engine failure | unchanged | **RECOVERY CONTROL** |
| `AuthFailureNotice`, `ErrorBoundary`, chunk reload | recovery | unchanged | **RECOVERY CONTROL** |

Four removals, four documented exceptions, two presentation-only, three recovery.

---

## 2. Exception: the in-run loop

**Why architecture should not control it.** Once a player is inside a drill, a transfer, or a
decision→commit→reveal cycle, *"what happens next"* is the protocol executing, not the policy
routing. Advancing to position 4 of 8 is not a product decision about where this player should be;
it is the set they are already in, running.

Handing it to `deriveNextAction` would put the policy between a player and the next board of a set
they are mid-way through — and the policy's answer would be `continue-drill`, the state they are
already in, on every press. The indirection would buy nothing and could only introduce a frame where
the run appears to be a proposal.

The canonical policy decides **which loop a player should be in**. The loop decides its own next
step. That boundary is exactly why `continue-run` exists as an act distinct from `next-decision`.

---

## 3. Exception: the cold front door

`Record.tsx` renders `FirstDecision` with `primaryAction("play-first-decision")` when nothing has
been measured. Two reasons, and the first is evidence rather than argument:

1. **The ladder provably agrees.** On a record with no games and no decisions the canonical answer
   *is* `play-first-decision`, and the proposal is sound.
   `tests/shared/one-truth-many-surfaces.test.ts` asserts it. Without that test this entry would be
   a claim in prose, which is what an allowlist is supposed to replace.
2. **Reading the policy there costs the entry chunk.** `useCanonicalAction` reaches the whole
   reading chain; `Record.tsx` is the entry route. `ContinuationSlot` is lazy for exactly this
   reason. Paying it to answer a question about a record that by definition has nothing in it is the
   trade `NextActionProbe` already refused.

**What would make this exception stale:** the ladder ever answering something other than
`play-first-decision` for an empty record. The test fails first.

---

## 4. Exception: `ContinueCommitment`

It stamps the literal `continue-run` rather than deriving it. It is rendered **only** from
`continuationOffer`, which is `proposeContinuation` — the same ladder, asked about branches 1 and 2 —
and `continue-run` is `actFor`'s answer for both kinds it can receive. The literal is therefore not
a decision; it is a constant that provably equals the derived value.

Left as-is rather than plumbed through `SurfaceOffer` because the plumbing would add a type
conversion whose only effect is to compute a value already known to be constant.

---

## 5. What was deliberately not done

- **No `unseenEvent` implementation.** No seen-set, no inference from page visits, no inference
  from data existing. The branch stays unreachable and is now *marked* unreachable rather than
  charged to its neighbours. `ARCHITECTURE_UI_STATE_MAP.md` §4.
- **No global store.** Nothing was lifted into Redux/Zustand/context for cleanliness. The
  continuation state already lived in the record; the canonical answer travels as a prop.
- **No generic `NextActionButton`.** Two presenters, two voices, per
  `ARCHITECTURE_UI_STATE_MAP.md` §6.
- **No orchestration layer.** `useCanonicalAction` is a hook over the existing assembly;
  `useCanonicalRouting` is a switch with no branch that chooses between acts.
- **`deriveNextAction` was not rewritten.** The ladder's branch order is untouched. One line changed
  in how an unobservable input is *classified*.
- **Resume's description layer untouched.** `readResume` still answers what changed and what the
  record knows. Only its `next` stopped being consulted.

---

## 6. Known limitation, stated rather than hidden

`test-hypothesis` and `test-claim` route the player to `/play` and **do not start the test**.
Registering a drill or a transfer needs candidate positions, and positions come from a loaded game —
`beginDrill` refuses without one and says so. The act lands the player where `ClaimPanel` and
`LearningQueue` offer the start; it does not perform it.

Making it perform the start would mean choosing positions on the player's behalf from whatever
happened to be loaded, which is the evidence selection the pre-registration rules exist to refuse.
So the limitation is preferred to the alternative, and is recorded here instead of being smoothed
over in the copy.
