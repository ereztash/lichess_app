# Architecture → UI: current state

**Inspected revision:** `490aed07b0ec2e2d27ab7574eacdb7673a7d5666` (`main`, 2026-09-14)
**Scope:** which surface answers *"what should the user do now?"*, and whether it asks the canonical
policy or decides for itself.

This is the **before** picture. It was produced by searching the tree, not by reading the previous
audits, and where it contradicts them the tree wins.

---

## 1. The headline

The canonical policy is `proposeNextAction` in `shared/next-action.ts`: a twelve-branch ladder over
`ProductState`, returning one of **eleven** `NextAction` kinds plus a proposal's blind-spot list.

**In production it decides two of them.**

| | |
| --- | --- |
| `NextAction` kinds defined | 11 |
| kinds any production surface acts on | **2** — `continue-drill`, `continue-transfer` |
| kinds reached only in shadow mode | 9 |
| production surfaces that consult the policy for their primary act | **1** (`ContinueCommitment`) |
| production surfaces that decide their own primary act | **4** (Resume, PostGame, Reveal, Record) |

The single live consumer is `proposeContinuation` → `continuationOffer` → `ContinueCommitment`,
which asks the ladder *only about branches 1 and 2* and ignores the rest by construction.
Everything else runs through `useNextActionShadow`, which writes the policy's answer to a local
trial ledger and **the screen ignores it**.

---

## 2. Why authority could never transfer, and it is one line

`proposeNextAction` consults `unseenEvent` at **branch 4**. Nothing in this repository can produce
that input: there is no seen-set, no writer, no reader, and `PERMANENTLY_UNOBSERVED = ["unseenEvent"]`
in `client/src/lib/next-action-shadow.ts` says so.

Because the ladder models it as `UNOBSERVED` — *"a surface did not read this"* — every branch below
it returns `blind: ["unseenEvent", …]`, and `soundProposal` is therefore **false for 8 of the 11
kinds, permanently, for every surface, in every state**.

`soundProposal` is the predicate authority transfer was supposed to be gated on. So the gate could
never open. That is not a policy defect and not a surface defect: it is a **modelling error**.

> An input the product has no mechanism to produce is not a blind spot. It is an unimplemented
> branch. Marking it unread asserts that something *could* have outranked this answer, and nothing
> could have, because the product cannot reach that state.

This is the one place current repository evidence shows an architectural rule that is **impossible
to execute as written**, and §"do not rewrite architecture unless evidence proves it" therefore
licenses the repair. The repair is not a seen-set (§7 forbids inventing one) — it is the opposite:
refuse to model an unimplementable input as a readable one.

---

## 3. Surface table

| Surface | State it reads | Who decides next action | Current CTA | Canonical policy consulted? | Missing state | Conflict |
| --- | --- | --- | --- | --- | --- | --- |
| **Home** (`/play`) | 47 `useState` hooks; drill/transfer via `useDrillRun` | **Home itself** | `next-decision` (`RevealPanel`), `continue-run` (header, in-run) | no | — | Home owns the in-run loop; legitimate (it *is* the run) |
| **Resume** (`/`, returning) | `useBlitzReading`, `useClaimView`, `useBlitzAnalysis` | **`readResume`** — its own 2-kind vocabulary | `play-blitz`, or a `wait` sentence with no control | shadow only | drill, transfer, untestedRule, claimState | **Parallel policy.** `ResumeNext = play \| wait`, a lookup table keyed on `BlitzBlocker`. Blind to every learning object |
| **PostGame** (`/blitz`) | `readBlitzGame` → `postGameWords` | **`postGameWords`** — hardcoded 3-branch | "play another game" (state A) or "see the position" (B/C) | shadow only | everything except the game just played | **Unconditional `play-blitz` on `nothing-to-conclude`.** "see the position" is not in the act vocabulary at all |
| **Reveal** (`RevealPanel`) | props only | **`Home.tsx`** (`onContinue={nextDecision}`, `:2135`) | `next-decision` | no | — | Continuation is a hardcoded callback chosen by the page |
| **Reveal exhausted** (`RevealNextPosition`) | `answered` bank ids | itself | `next-decision`, or `return-record` when bank complete | no | — | Local two-branch policy |
| **Record cold** (`/`, first visit) | `useRecordReading`, `useImportDiagnostic` | **`Record.tsx`** | `play-first-decision` | no | — | Hardcoded; suppressed only by `standDown` |
| **Record returning** | as above + `ContinuationSlot` | **canonical**, for continuation only | `continue-run` | **yes** (branches 1–2) | — | The one live consumer |
| **Drill / Transfer in run** | `useDrillRun`, Home state | Home | `continue-run` | no | — | In-run; legitimate |
| **Claim / rule** | `useClaimView` → `claimStateOf` | `ClaimPanel` / `LearningQueue` | panel-local controls | no | — | `test-claim` / `test-hypothesis` never rendered as a routed act |
| **Loading** | query `isLoading` | surface | none | n/a | — | Not a product act. Out of scope per §2 |
| **Error / recovery** | `RevealFailure`, `AuthFailureNotice`, `ErrorBoundary` | surface | retry | n/a | — | Recovery control. Out of scope per §2 |

---

## 4. Old audit findings, re-checked against the tree

| Finding | Source | Verdict now |
| --- | --- | --- |
| `continue-run` has exactly one control, inside the run | `ARCHITECTURE_UI_AUTHORITY_TRANSFER.md` | **NO LONGER TRUE.** `ContinueCommitment` added a second, reachable from Record/Resume/PostGame |
| Drill state is trapped in `Home.tsx` component state | same | **NO LONGER TRUE.** `listOpenDrills` + `continuationReading` + `restoreDrillRun` read it from the record; `useDrillRun` holds it |
| `null` in `ProductState` conflates "absent" and "unread" | `D22` amendment | **CHANGED.** `Observed<T>` fixed it for the four blindable inputs |
| 8 of 11 proposals are unsound as shipped | `D22` amendment | **CONFIRMED — and the cause is misdiagnosed there.** It is treated as a fact about `unseenEvent` being unbuilt; it is actually a modelling error about what "unread" means (§2) |
| `unseenEvent` has no implementation | `ARCHITECTURE_UI_AUTHORITY_CURRENT_STATE.md` | **CONFIRMED.** No seen-set anywhere |
| Resume offers `play-blitz` at the same weight as the front door's own primary | `ARCHITECTURE_UI_GAP_AUDIT.md` | **CHANGED.** `standDown` resolves it when a continuation is live; unresolved otherwise |
| `SHADOW_SURFACES` are instrumented but ignored | `D22` | **CONFIRMED.** All three write to the ledger; none acts |

---

## 5. Independent product-policy sites, classified

Per §2. A loading retry or modal close is not a product-next-action and is not listed.

| Site | Classification |
| --- | --- |
| `proposeNextAction` (`shared/next-action.ts`) | **CANONICAL POLICY** |
| `proposeContinuation` / `continuationOffer` | **CANONICAL POLICY** (a narrowed ask, same ladder) |
| `NEXT_STEP` + `NEXT_WHEN_FOUND` (`shared/resume-reading.ts`) | **LEGACY POLICY** — to remove |
| `postGameWords().action` (`shared/blitz-words.ts`) | **LEGACY POLICY** — to remove |
| `Home.tsx:2135` `onContinue={nextDecision}` | **JUSTIFIED EXCEPTION** — in-run advance, see §6 |
| `RevealNextPosition` bank branch | **JUSTIFIED EXCEPTION** — in-run, bank-local |
| `Record.tsx` `FirstDecision` submit | **PRESENTATION ONLY** once it renders a canonical act |
| `Blitz.tsx` `post-game__again` | **LEGACY POLICY** — to remove |
| `RevealFailure` retry | **RECOVERY/ERROR CONTROL** |
| `AuthFailureNotice`, `ErrorBoundary`, chunk reload | **RECOVERY/ERROR CONTROL** |

---

## 6. What must stay local, and why

**The in-run loop.** Once a player is inside a drill, a transfer, or a decision→commit→reveal cycle,
"what happens next" is the protocol's answer and not the policy's. Advancing to position 4 of 8 is
not a product routing decision; it is the run executing. Handing that to `deriveNextAction` would
put a policy between a player and the next board of a set they are already in, and the policy would
answer `continue-drill` — the state they are already in — on every press.

The canonical policy decides **which loop a player should be in**. The loop decides what its own
next step is. That boundary is the reason `continue-run` exists as an act distinct from
`next-decision`.

---

## 7. What this audit does not establish

That any of it is better for a person. Every statement here is about code paths and rendered
controls. Whether a player notices, understands, or acts on a canonical action is
**`FIELD_REQUIRED`** and is not answered by any amount of wiring.
