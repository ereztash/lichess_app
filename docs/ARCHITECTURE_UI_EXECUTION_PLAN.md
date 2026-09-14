# Architecture → UI execution plan

Companion to `ARCHITECTURE_UI_GAP_AUDIT.md`, measured against `32478f2`.

**NOTHING HERE IS IMPLEMENTED, AND THAT IS THE PLAN RATHER THAN A SHORTFALL.** Every repair touches
`client/src` or `shared/`, both of which move the built bundle; the FIELD stimulus is frozen at
`stimulus_sha256 20c3c60d…` with **zero participants**. Two separate constraints then apply, and only
the first is about the freeze:

1. **The freeze.** Any of these merging before the last participant makes the pre-registration
   describe a build nobody was shown. `#112` is already held for exactly this reason.
2. **The ordering.** Even after the freeze lifts, doing these in the wrong order produces more
   uninterpretable telemetry rather than more evidence. See §Sequence.

**Re-freezing to land any of this is an OWNER DECISION and is not recommended.** The protocol permits
it only while the participant count is zero, and spending that allowance on instrumentation would
buy nothing a post-run merge does not.

---

## Sequence, and why this order and no other

```
  F7  continuation state leaves Home.tsx ─┐
                                          ├──► two blind spots close by construction
  F8  shadow reads useLearningRules ──────┘
                    │
                    ▼
        the shadow can now observe 3 of the 4 ranks above test-claim
                    │
                    ▼
  F3  instrument post-game and record  ──► rows become interpretable
                    │
                    ▼
  G   GATE-SHADOW-SURFACE-INSTRUMENTED lands green
                    │
                    ▼
        collect real disagreement evidence on post-game
                    │
                    ▼
  F5  hand the candidate-claim state over to canonical ownership
```

**F3 before F7/F8 is the tempting mistake.** Instrumenting two more surfaces is the smallest diff and
the most visible progress, and it would produce rows whose `proposed` field is unfalsifiable for
exactly the state this whole pass is about. Resist it.

**F6 is independent** and can go any time after the freeze lifts.

---

## F8 — supply `untestedRule` to the shadow

| | |
| --- | --- |
| **problem** | `productStateFor` asserts `untestedRule: null`, so the shadow can never propose `test-hypothesis` — the rank-5 branch that outranks `test-claim` and carries D22's constitutional ordering |
| **current mechanism** | hard-coded `null` in `client/src/lib/next-action-shadow.ts` |
| **desired invariant** | the shadow proposes `test-hypothesis` whenever a truthful `ProductState` would, so a `test-claim` row means the player had no open question of their own |
| **files** | `client/src/lib/next-action-shadow.ts` only |
| **smallest repair** | call `useLearningRules()` in `useProductState`, pass `rules` into `productStateFor`, derive the oldest ungraded rule id. Remove `untestedRule` from `SURFACE_BLIND_SPOTS`. Gate the readiness on it settling, exactly as `claim.isLoading` already does |
| **the argument is already written** | the module's own docstring says `claim` "costs nothing to supply" because the tree already calls `useClaimView` and react-query dedupes by key. `use-loop-position.ts:37` already calls `useLearningRules()` in the same tree |
| **moves the stimulus** | **yes** |
| **gate** | a test that a `ProductState` carrying both an untested rule and a candidate claim proposes `test-hypothesis`, red if the ordering inverts. Extend `nextActionResolves` to run its blocker table under both |
| **reversal** | if rules prove expensive to read on the resume path, put `untestedRule` back in `SURFACE_BLIND_SPOTS` rather than supplying a guess. A declared blind spot is honest; a `null` that means "probably none" is not |

---

## F7 — continuation state must outlive `Home.tsx`

| | |
| --- | --- |
| **problem** | `drill` and `transfer` live in eight `useState` hooks in `Home.tsx:377-391`. No other surface can see a run in progress, so `continue-drill` and `continue-transfer` are unreachable proposals and the shadow must assert them absent |
| **current mechanism** | component state, destroyed on navigation |
| **desired invariant** | any surface that can propose a continuation can also determine whether one exists |
| **files** | `client/src/pages/Home.tsx`, `client/src/lib/next-action-shadow.ts`, plus whichever store the horizon lands in |
| **the horizon question, answered rather than assumed** | the brief asks for the shortest horizon satisfying the invariant. **A drill is already durable**: `beginDrill` writes it through `store.saveDrill`, and `getDrill` reads it back. So the domain record exists; what is missing is a *read* of open runs, not a new place to put them. **The repair is a query, not a persistence layer** |
| **smallest repair** | a `useOpenRun()` reading unreported drills and transfers from the record store, used by `productStateFor`. `Home.tsx` keeps its `useState` for in-flight UI; the store answers "is one open" |
| **what NOT to do** | do not promote `drillIndex`, `drillStage` or `drillVerdict` to domain state. Those are UI position within a run, and the invariant needs only run identity, kind and progress |
| **moves the stimulus** | **yes** |
| **gate** | a test that a record with an unreported drill proposes `continue-drill` from a surface that is not `Home`, red if the read is dropped |
| **reversal** | if the store cannot answer cheaply, keep the blind spot declared. Do not synthesise the field |

---

## F3 — instrument `post-game` and `record`

| | |
| --- | --- |
| **problem** | `SHADOW_SURFACES` declares three; `useNextActionShadow` is called once. Two surfaces write no rows, and a surface with no call site cannot disagree, so its silence reads as agreement |
| **current mechanism** | absence |
| **desired invariant** | every declared surface writes rows, or is not declared |
| **files** | `client/src/components/PostGame.tsx`, the record surface, `client/src/lib/next-action-shadow.ts` |
| **smallest repair** | one `useNextActionShadow("post-game", …)` and one `useNextActionShadow("record", …)`, each passing `null` until its readings settle — the hook already documents that contract |
| **precondition** | **F7 and F8 first.** Otherwise both new surfaces emit rows with four asserted-absent ranks above the proposal |
| **moves the stimulus** | **yes** |
| **gate** | §G below |
| **reversal** | if a surface turns out not to route, delete it from `SHADOW_SURFACES` rather than leaving it declared and silent |

---

## F5 — hand the candidate-claim state to canonical ownership

| | |
| --- | --- |
| **problem** | `PostGame.tsx:193` is `primaryAction("play-blitz")`, a literal. With `claimState === "candidate"` the architecture says `test-claim` and the screen says "משחק חדש" |
| **desired invariant** | for this one state, the rendered primary act corresponds to the canonical proposal, and changing the canonical proposal makes the UI test fail |
| **files** | `client/src/components/PostGame.tsx` |
| **smallest repair** | render the act `actFor(proposal)` names instead of the literal, **for the candidate state only**. Every other state keeps its current act |
| **preconditions, all of them** | F7, F8, F3 landed; real disagreement rows collected on `post-game`; `test-claim`'s route exists and survives navigation; the act returns to the loop (`reentryOf("test-claim") === "CAPTURE"`, already asserted) |
| **authorship** | `actFor("test-claim")` returns `"test-hypothesis"` — one act, two kinds, on the `continue-run` precedent. **The copy must not say "your rule"** for an instrument-discovered claim. The act is shared; the sentence is not |
| **moves the stimulus** | **yes**, and this one is participant-facing in the full sense |
| **gate** | a render test that the offered act equals `actFor(deriveNextAction(state))` for the candidate state, with a control showing the literal `play-blitz` failing |
| **reversal** | if FIELD shows players do not act on a forward test offered here, revert to the literal and record the finding. Do not keep both engines |

---

## F6 — `unread` must not render as an empty record *(R-30)*

| | |
| --- | --- |
| **problem** | `recordReading(undefined)` → `scored: 0, hasClaim: false` → `ACCUMULATING` at nought. Every arrival is told it has recorded nothing, for as long as the query takes |
| **files** | `client/src/lib/journey-readings.ts`, and the ledger that renders it |
| **smallest repair** | `recordReading` returns a distinct reading for `undefined`. The surface renders **silence or reserved layout** — not a spinner, not a sentence |
| **moves the stimulus** | **yes**, and it changes a FIELD-reachable surface |
| **gate** | a render assertion that a record page with an unresolved claim query says something other than what an empty record says. `R-30` already names this gate as absent |
| **reversal** | none needed. The invariant is one-directional: absence of a reading is not a reading of absence |

---

## G — `GATE-SHADOW-SURFACE-INSTRUMENTED`

Written and run during the audit; **deliberately not landed.**

It reads `SHADOW_SURFACES` from `shared/next-action.ts` and every `useNextActionShadow("…")` call
under `client/src`, and fails on any declared surface with no call site. Against a fixture declaring
three and instrumenting one it reports the two missing by name. **Against the real tree it reports
`post-game, record`** — because the defect is live.

**A red gate blocks every other PR**, and the fix moves the frozen bundle. So it ships with F3, in
the same commit, and is green on arrival. The fixture is `tests/fixtures/shadow`, same-predicate
different-input, on the `GATE-STIMULUS-FLAGS` pattern.

---

## What remains deliberately unbuilt

* **F9's seen-set.** `unseenEvent` is unimplemented and `review-event` has no screen that offers it.
  Building a seen-set to close a blind spot in a proposal nothing can act on would be adding product
  to satisfy a table.
* **Any handover beyond the single candidate-claim state.** Ownership is per state; the other fifteen
  rows of the matrix keep their current engines until each earns the same treatment.
* **Everything in the audit's ANTI-BUILD list.**

---

## Activation plan, post-FIELD

1. Last participant finishes. `field/` holds the participant files; FIELD status changes.
2. **R-31 first** — one claim can carry two live drills (`docs/MASTER_PRODUCT_DEBT.md`). Owner has
   confirmed this gates any user-reachable ownership flow.
3. Merge `#112` — the question-ownership boundary.
4. **F8**, then **F7**. Blind spots close.
5. **F3** + **G**. Gate lands green.
6. Collect disagreement rows on `post-game`.
7. **F5**, only if step 6 shows the disagreement is real and the route holds.
8. **F6** any time after step 1.

Steps 4 to 7 are the whole of "make the architecture perceptible". Step 7 is the only one a
participant would see.
