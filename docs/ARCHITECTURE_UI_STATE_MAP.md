# Architecture → UI state map

Companion to `ARCHITECTURE_UI_AUTHORITY_CURRENT_STATE.md`, which froze the position before the
work. This says where each canonical input comes from **now**, and — more importantly — how each
one says that it does not know.

---

## 1. The change that makes every other row possible

`ProductState` had four fields whose only value was `null`, and `null` already meant *there is
none*. A surface that had never asked for a drill had one value available to it, and the value
meant something else. So every shadow row this product ever wrote asserted **"no drill is
running"** on the authority of a screen that could not have known.

`shared/next-action.ts` now carries:

```ts
export type Observed<T> = { observed: true; value: T } | { observed: false };
```

`{ observed: true, value: null }` is *a record with no drill in it*.
`{ observed: false }` is *a screen that has not been told*.

These are different facts and they now have different values. **The type no longer offers a way to
be silently blind**: the only way to say "I read it" is to hand over the value.

### And the blindness reaches the derivation, not just the ledger

`proposeNextAction` returns the proposal **and the prefix of higher-ranked inputs that went
unread**:

```ts
interface NextActionProposal {
  action: NextAction;
  blind: readonly BlindableInput[];   // empty ⇒ nothing that could have outranked this went unseen
}
```

`soundProposal(p)` is `p.blind.length === 0`. **That predicate is the authority gate.** A screen
rendering a proposal with non-empty `blind` is rendering an answer that a fact it could not see
would have overruled.

`SURFACE_BLIND_SPOTS` — a hand-maintained `Record<ShadowSurface, string[]>` that reached the ledger
and never reached the derivation — is **deleted**. It was wrong in both directions: it named four
inputs on rows where those inputs ranked *below* the branch that fired, and it could not have
noticed a surface that gained a reader, because it was maintained by attention.

---

## 2. Input by input

| `ProductState` field | Source now | How it says "unknown" | Status |
|---|---|---|---|
| `pendingAnalyses` | `useBlitzReading()` games filtered on `pending` | gated: `useProductState` returns `null` until the reading resolves | unchanged |
| `analysisRunning` | `useBlitzAnalysis().scoring !== null` | same gate | unchanged |
| `drill` | **`useContinuation()` → `continuationReading(store)`** | `UNOBSERVED` while the query is unsettled | **new — branch 1 is reachable** |
| `transfer` | **same read** | `UNOBSERVED` | **new — branch 2 is reachable** |
| `unseenEvent` | — | `UNOBSERVED`, permanently | **deliberately unbuilt — §4** |
| `untestedRule` | **same read** | `UNOBSERVED` | **new — branch 5 is reachable** |
| `claimState` | `claimStateOf(useClaimView().data)` | `{ kind: "unread" }` | unchanged, was already honest |
| `blitzStanding` | `useBlitzReading()` | `null` = not read yet | unchanged, was already honest |
| `decisionsOnRecord` | `useDecisionCount()` | `0` while loading | unchanged |
| `anchor` | `useRecordReading()` + `ANCHOR_POSITIONS.length` | — | unchanged; `anchor.total` is still the *current* set, not the answered set |

**Truthful canonical state coverage: 10 of 11 inputs.** The one that is not is `unseenEvent`, and
it is not an omission — see §4.

---

## 3. Where the continuation reading comes from, and what was *not* built

`shared/continuation.ts` holds both the arithmetic and the read.

```
listOpenDrills()            ─┐
listLearningRules()          ├─► continuationReading(store) ─► { active, untestedRule }
listAtoms()                  │
getOpenLearningTransfer(id)  │
listLearningTransferObservations(id) ─┘
```

**Nothing new is stored.** Both kinds of run were *already* written down before their first
position was shown — `beginDrill` calls `store.saveDrill`, `beginLearningTransfer` calls
`store.saveLearningTransfer` — because a test whose terms are not recorded in advance is not
pre-registered. What was missing was never a write. It was a **read**.

### The one store method that had to be added

`listOpenDrills()` — the drill's counterpart to `getOpenLearningTransfer`, which already existed
and whose own comment states the argument:

> Losing a tab is not misconduct, and a rule whose test can be started but never finished is a rule
> that can only be refuted by accident.

A drill is the same object one authorship over, and it had no such reader. Added to the interface
and to all three implementations (MySQL, in-memory, browser-local). Drills with no recorded
direction are **omitted rather than thrown on**: `getDrill` refuses to hand back an ungradeable
spec, and a list that threw for one legacy row would hide every open drill behind the oldest bad
one.

### `done` needs no new write, and that is a property of drills rather than a convenience

`beginDrill` selects positions with `selectDrillPositions(available, decidedFens, …)` — **every
position in a drill spec is one the player had not decided when the drill started.** So an atom on
a drill's fen can only have been recorded during the drill, and counting them is exact without a
timestamp. `drillProgress` is that count.

The transfer needs no such argument: it already writes each observation as it happens, and
`record-store.ts` says why — *"These used to be held in React state for the whole run and reach the
server only at completion, and three defects came out of that one choice."*

### What is deliberately still component-local

**The cursor.** Which position of the run is on screen right now is genuinely `Home.tsx`'s, it is
genuinely lost on navigation, and centralising it would be lifting eight `useState` hooks into a
store to answer a question the policy never asks. The policy asks whether a run is **open** and how
much of it is **done**. Both are now answerable from the record.

Resuming a drill *mid-position* after a reload remains unfixed and is named in
`ARCHITECTURE_UI_AUTHORITY_TRANSFER.md`.

### `untestedRule` is `grade === "hypothesis" && retrieval_step === 0`, and the second conjunct is the one that matters

`gradeLearningRule` folds every completed sitting over the rule and steps `retrieval_step` per
result, so a rule tested once and neither replicated nor refuted is **still graded `hypothesis`**,
with `retrieval_step > 0`. Reading the grade alone would call that rule untested — and
`test-hypothesis` means *"a pattern was found retrospectively and needs a forward test that could
come back negative."* A test that already came back is not that.

Whether a rule that *has* been tested is **due again** is the retrieval schedule's question
(`next_due_at`) and is deliberately not answered here. A derivation proposing a scheduled
repetition under the sentence *"your rule has never been tested"* would be saying something false
to the player.

A rule whose transfer is **already running** is not untested either — it is branch 2, not branch 5.
Proposing that the player start a forward test they are three positions into would offer them a
second draw over the same rule, which is the exact thing `getOpenLearningTransfer` exists to refuse.

---

## 4. `unseenEvent`: an anti-build decision, recorded

**Nothing was built, and nothing should be until the evidence below exists.**

There is no seen-set anywhere in the repository — no writer, no reader, no storage. Every reference
to `unseenEvent` on the SHA this began from was the type, the branch, or a test fixture.

**What would justify building it.** A seen-set is only meaningful if the product can distinguish
*a finding the player has looked at* from *a finding it has merely rendered*. That requires deciding
what counts as "seen" — opened, dwelt on, acknowledged — and each answer is a different measurement.
`docs/decisions/D21-feedback-exposure.md` is why this is not a detail: decisions taken after a
player has seen feedback are pooled with decisions taken before, and **no field in the record can
separate them**. A seen-set is the field that would separate them, and inventing one casually would
put a half-considered exposure marker into the record that every later analysis would read.

**The behaviour that would require it:** a player returning to a record that holds a finding they
have never opened, and the product offering them another game instead. That is observable — it
needs the acquisition trial, not more code.

**What stays blind until then.** `review-event` is branch 4 of 12, so **every proposal ranked below
it carries `blind: ["unseenEvent"]`** and is therefore unsound by `soundProposal`. Concretely:
`test-hypothesis`, `test-claim`, `play-first-decision`, `play-blitz`, `collect-more-evidence`,
`return-record` and `none` **cannot be handed authority** while this input is missing.

That is not a limitation of the design. It is the design reporting, correctly, that seven of its
twelve answers rest on a fact nobody has measured.

---

## 5. Surfaces, now

| Surface | Instrumentation | Cost | Why that shape |
|---|---|---|---|
| **resume** | `useNextActionShadow("resume", …)` in `ResumeScreen` | lazy chunk, already paid | unchanged |
| **post-game** | `useNextActionShadow("post-game", …)` in `PostGame` | **≈ free** | `/blitz` is a lazy route and `Blitz.tsx` already imports the blitz reading chain |
| **record** | `<NextActionProbe surface="record" />`, lazily mounted in `Record.tsx` | **out of the entry chunk** | `Record.tsx` *is* the entry chunk; a direct hook is +16.1 kB against 0.2 kB of headroom |
| **Reveal** | none, deliberately | — | `next-decision` is reachable from no `NextActionKind` **by design**; a shadow there would manufacture 100 % disagreement out of a correct architecture |

`resume` and `record` are **two states of one route**, not two routes. `ResumeScreen` returns
`null` unless `returning`, so the record probe is gated on `!returning`. Two probes mounted
together would read the same DOM through `offeredAct` and write two rows claiming to be about two
surfaces — and the ledger would show perfect agreement between them as an artefact of their being
the same page.

The existing browser walk had already found this shape from the other side: its first draft walked
to `/record`, read a 404 as *"a surface with nothing to offer"*, and would have reported D22's
reversal condition as met by a typo. **A surface is a state, not a URL.**
