# Architecture → UI authority: current state

**Repository:** `ereztash/lichess_app`
**Branch inspected:** `main`
**SHA:** `a8e7e69d541c80a7bea9d9fc047745e3e3c1a089`
**Date:** 2026-09-14

This document freezes what was true before any code in this migration moved. It exists so the
audit that prompted the work can be checked against the repository rather than believed, and so a
later reader can tell which of the claims below were repaired and which were merely restated.

Everything here was read off `main`. Where the audit and the repository disagree, the repository
wins and the row says so.

---

## 1. The audit, statement by statement

| # | Audit statement | Verdict | Evidence |
|---|---|---|---|
| 1 | `deriveNextAction` is canonical, has 11 next-action kinds, and is shadow-only | **CONFIRMED** | `shared/next-action.ts:52-113` defines exactly 11 members of `NextAction`; `deriveNextAction` at `:206`. No screen consumes its return value — the only call site ignores it (row 5). |
| 2 | `readResume` feeds `ResumeScreen` and collapses next-action vocabulary to `play \| wait` | **CONFIRMED** | `shared/resume-reading.ts:95-98` — `ResumeNext = { kind: "play" } \| { kind: "wait" }`. Called at `client/src/components/ResumeScreen.tsx:131`. |
| 3 | `PostGame` contains a hard-coded primary action `play-blitz` | **CONFIRMED** | `client/src/components/PostGame.tsx:193` — `{...primaryAction("play-blitz")}`, rendered under `lead !== null`. |
| 4 | `RevealPanel` / `RevealFailure` contain hard-coded `next-decision` | **CONFIRMED** | `RevealPanel.tsx:374`, `RevealFailure.tsx:136`. Also `RevealNextPosition.tsx:92` (`return-record`) and `:105` (`next-decision`), which the audit did not name. |
| 5 | Only `ResumeScreen` invokes `useNextActionShadow` | **CONFIRMED** | Single call site, `ResumeScreen.tsx:105`: `useNextActionShadow("resume", useProductState());` — return value discarded. |
| 6 | `post-game` and `record` are declared shadow surfaces with no call site | **CONFIRMED** | `shared/next-action.ts:339` declares `SHADOW_SURFACES = ["resume", "post-game", "record"]`. Neither `PostGame.tsx` nor `Record.tsx` imports `next-action-shadow`. |
| 7 | `productStateFor` supplies higher-priority canonical fields as `null` | **CONFIRMED** | `client/src/lib/next-action-shadow.ts:118-122` hard-codes `drill: null, transfer: null, unseenEvent: null, untestedRule: null`. These are branches 1, 2, 4 and 5 of a 7-branch ladder — the four *highest* priorities after the run checks. |
| 8 | `drill` and `transfer` state live locally in `Home.tsx` | **CONFIRMED, with a material correction** | 13 `useState` hooks at `Home.tsx:377-400`. **But the runs are already persisted server-side**: `record-service.ts:1288` `beginDrill` calls `store.saveDrill`, `:744` `beginLearningTransfer` calls `store.saveLearningTransfer`, and `record-store.ts:206` already exposes `getOpenLearningTransfer(ruleId)`. What is component-local is the *cursor* (which position of the run the player is on), not the *existence* of the run. |
| 9 | `untestedRule` is cheaply recoverable from existing query infrastructure | **CONFIRMED** | `client/src/lib/record-api.ts:425` `useLearningRules()` already exists and is already used by the product. `LearningRule.grade` (`shared/learning-record.ts:12`) and `retrieval_step` (`:42`) are exactly the two fields the question needs. |
| 10 | `unseenEvent` has no implementation | **CONFIRMED** | Every reference in the repository is the type, the branch, or a test fixture. No seen-set, no writer, no query. Listed at §4. |
| 11 | UI actions can contradict canonical policy without the measurement system observing it | **CONFIRMED for `post-game`; PARTLY NO LONGER TRUE for `record`** | No live shadow on either. But `tests/layout/a-walk-the-derivation-can-be-wrong-about.layout.test.ts` walks the built app in Chromium and compares the record page's offered act against the derivation at two states. That is real measurement on `record`, and it is not a hook. |

### Two things the audit did not know

**`actFor` and `agreesWith` already exist.** `shared/next-action.ts:377` and `:406` map a
`NextActionKind` onto a `PrimaryAction` and compare. The "surface-independent semantic action
vocabulary" the migration asks for is `shared/primary-action.ts:PRIMARY_ACTIONS` — nine acts,
closed, read by three gates. **Phase 6 is substantially already built.**

**`D22-next-action-ownership.md` is a reasoned refusal, not an oversight.** It declines to
instrument `post-game` and `record` live *on measured cost grounds*: the blitz reading chain is
**+16.1 kB raw / +5.1 kB gzipped** in the entry graph. Its reversal condition 2 is precisely this
migration's Phase 2:

> **The blind spots close.** … While they are invisible to every other surface, `continue-drill`
> and `continue-transfer` are proposals no screen could ever have agreed with, and a derivation
> cannot own a state whose highest-priority input it cannot see.

---

## 2. `deriveNextAction` branch order, and what each branch reads

Source: `shared/next-action.ts:206-262`. The order is the argument; each row names the *only*
`ProductState` fields that branch consults.

| # | Branch | Emits | Reads | Truthful today? |
|---|---|---|---|---|
| 1 | `state.drill !== null` | `continue-drill` | `drill` | **NO — hard-coded `null`** |
| 2 | `state.transfer !== null` | `continue-transfer` | `transfer` | **NO — hard-coded `null`** |
| 3 | `state.pendingAnalyses > 0` | `wait-analysis` | `pendingAnalyses`, `analysisRunning` | yes |
| 4 | `state.unseenEvent !== null` | `review-event` | `unseenEvent` | **NO — hard-coded `null`, and nothing could supply it** |
| 5 | `state.untestedRule !== null` | `test-hypothesis` | `untestedRule` | **NO — hard-coded `null`** |
| 6 | `awaitsForwardTest(state.claimState)` | `test-claim` | `claimState` | yes |
| 7 | `state.blitzStanding === null` | `none` | `blitzStanding` | yes |
| 8 | no games + no decisions | `play-first-decision` | `decisionsOnRecord`, `blitzStanding` | yes |
| 9 | `!blitzStanding.may` | `play-blitz` | `blitzStanding` | yes |
| 10 | `decisionsOnRecord === 0` | `play-first-decision` | `decisionsOnRecord` | yes |
| 11 | `anchor.answered < anchor.total` | `collect-more-evidence` | `anchor` | partly — `anchor.total` is the *current* set's size, not the set the record answered (`next-action-shadow.ts:133-139` says so) |
| 12 | fallthrough | `return-record` | — | yes |

**Four of the five highest-priority branches cannot fire.** Branches 1, 2, 4 and 5 are
unreachable in production because their inputs are fabricated. A derivation whose top of the ladder
is switched off is a derivation that can only ever propose the bottom of it — which is what makes
the present agreement between shadow and screen uninformative.

### The fabrication is the defect, not the `null`

`drill: null` does not mean *no drill is running*. It means *this surface cannot see whether one
is*. The type cannot tell those apart, and `deriveNextAction` reads the second as the first.
`SURFACE_BLIND_SPOTS` (`next-action-shadow.ts:69-73`) records the difference *beside* the row
rather than *in* it, which is enough to interpret a ledger and not enough to stop the derivation
acting on a value it should not trust.

---

## 3. Authority map

| Surface | Component | Route / chunk | Current decision source | Canonical source available? | Inputs truthful? | Shadow measured? | Safe to transfer? |
|---|---|---|---|---|---|---|---|
| **Resume** | `ResumeScreen.tsx` | `/` → lazy chunk | `readResume()` → `play\|wait`; act hard-coded `"play-blitz"` at `:181` | yes — already calls `useProductState()` | **no** — 4 of 11 inputs fabricated | **yes, live** (`:105`) | **no** — branches 1/2/5 invisible |
| **PostGame** | `PostGame.tsx` | `/blitz` → lazy chunk | literal `primaryAction("play-blitz")` at `:193` | yes, cheaply — chunk already holds the blitz reading chain | **no** | **no** — declared, never called | **no** |
| **Record** | `Record.tsx` | `/` → **entry chunk** | literal `primaryAction("play-first-decision")` at `:260`, suppressed when `deferPrimary` (`:552`, `returning`) | **expensive** — would pull the blitz chain into the entry chunk | **no** | **partly** — Chromium walk test, 2 states, not a hook | **no** |
| **RevealPanel** | `RevealPanel.tsx` | `/play` → lazy | literal `primaryAction("next-decision")` at `:374` | **n/a by design** | n/a | no | **no, and deliberately never** — see below |
| **RevealFailure** | `RevealFailure.tsx` | `/play` → lazy | literal `primaryAction("next-decision")` at `:136` | **n/a by design** | n/a | no | **no, and deliberately never** |

### Why Reveal is not a routing surface

`next-decision`, `commit-decision` and `answer-instrument` are in `PRIMARY_ACTIONS` and are
reachable from **no** `NextActionKind`. D22 establishes this as design, not omission: they are
controls the player is *already using*, not somewhere they are *sent*. The existing walk test says
the same in its header — `/play` is excluded because *"a comparison there would report a
disagreement on every run, for a reason that is the design working."*

A shadow on Reveal would manufacture a 100% disagreement rate out of a correct architecture.
Phase 13's warning applies exactly here: reveal is the transition from a player-owned decision to
new evidence, and centralising its continuation control would collapse the authorship boundary the
epistemic architecture depends on. **Reveal is out of scope for authority transfer**, and this is
an anti-build decision rather than an unfinished one.

---

## 4. State inventory: where each canonical input comes from

| `ProductState` field | Source today | Classification |
|---|---|---|
| `pendingAnalyses` | `blitz.data.games` filtered on `analysisState === "pending"` | **query-derived** |
| `analysisRunning` | `useBlitzAnalysis().scoring !== null` | **query-derived** (subscription) |
| `drill` | — | **component-local** (`Home.tsx:377-385`), **persisted server-side but unqueryable**: `saveDrill`/`getDrill(id)` exist, no list-open |
| `transfer` | — | **component-local** (`Home.tsx:388-400`), **persisted and queryable per rule**: `getOpenLearningTransfer(ruleId)` at `record-store.ts:206` |
| `unseenEvent` | — | **unavailable**. No seen-set anywhere in the repository |
| `untestedRule` | — | **query-derived, unwired**: `useLearningRules()` exists at `record-api.ts:425` |
| `claimState` | `claimStateOf(useClaimView().data)` | **query-derived**, and correctly carries `unread` |
| `blitzStanding` | `useBlitzReading().data.reading.standing` | **query-derived**, and correctly carries `null` for unread |
| `decisionsOnRecord` | `useDecisionCount()` | **query-derived** |
| `anchor.answered` | `useRecordReading().data.anchorAnswered.length` | **query-derived** |
| `anchor.total` | `ANCHOR_POSITIONS.length` | **synthesized** — the current set, not the answered set |

**Two fields are honest about not knowing** (`claimState: "unread"`, `blitzStanding: null`) and the
derivation handles both. **Four are dishonest** (`drill`, `transfer`, `unseenEvent`,
`untestedRule`), and the type offers them no way to be honest: `null` is the only value, and it
already means *absent*.

---

## 5. Every hard-coded next action in the product

Found by `grep -rn "primaryAction(" client/src/`.

| File:line | Act | Routing surface? | Status |
|---|---|---|---|
| `PostGame.tsx:193` | `play-blitz` | **yes** | **in scope** |
| `Record.tsx:260` | `play-first-decision` | **yes** | **in scope** |
| `ResumeScreen.tsx:181` (via `FindingCard`) | `play-blitz` | **yes** | **in scope** |
| `RevealPanel.tsx:374` | `next-decision` | no — mid-act | out of scope, by design |
| `RevealFailure.tsx:136` | `next-decision` | no — mid-act | out of scope, by design |
| `RevealNextPosition.tsx:92` | `return-record` | no — mid-act | out of scope, by design |
| `RevealNextPosition.tsx:105` | `next-decision` | no — mid-act | out of scope, by design |
| `CommitmentScreen.tsx:707` | `commit-decision` | no — mid-act | out of scope, by design |
| `Home.tsx:1887` | `continue-run` | no — mid-act | out of scope; it *is* the run |
| `Blitz.tsx:418` | `play-blitz` | no — mid-game | out of scope |
| `FindingCard.tsx:99` | caller's | — | a renderer, not a policy |

**Three routing surfaces, three hard-coded product actions.**

---

## 6. The binding constraint nobody may design around

The bundle budget on this SHA, measured by `npm run bundle:budget` against a real build:

```
ok    entry, raw                     678.8 kB / 679 kB      →  0.2 kB headroom
ok    entry, gzipped                 212.4 kB / 213 kB      →  0.6 kB headroom
ok    initial download, raw          772.0 kB / 772 kB      →  0.0 kB headroom
```

`Record.tsx` **is** the entry chunk (`App.tsx:49` routes `/` to it). D22 measured the blitz reading
chain at **+16.1 kB raw**. There is **0.2 kB** of room.

A live `useProductState()` call inside `Record.tsx` is therefore not a judgement call — it fails
the budget gate by roughly eighty times the available headroom. Any instrumentation of the record
surface must arrive **outside the entry graph** or not at all. This is recorded here so that the
constraint is understood as arithmetic rather than re-litigated as taste.

`PostGame`, by contrast, lives in the `/blitz` chunk, which is **not** eagerly fetched and not in
the budget — and `Blitz.tsx:57` already imports `use-blitz-analysis`. Post-game instrumentation is
close to free.

---

## 7. What this document does not establish

It does not say the derivation is right. It says which of its inputs are true, which are invented,
and which screens could notice the difference. Whether the *order* in `deriveNextAction` is the
order a person would want is D22 reversal condition 3, it needs the acquisition trial, and nothing
in this repository can answer it.
