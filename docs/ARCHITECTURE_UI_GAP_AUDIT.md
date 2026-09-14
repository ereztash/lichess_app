# Architecture → UI gap audit

**Measured against `32478f2`, 2026-09-14.** Every claim here was read from the tree or run against
it. Where this document and a design doc disagree, the tree won.

**FIELD: frozen at `stimulus_sha256 20c3c60dcc168b2b8e42625a375acb42dcaf5db994af48c433151b68905b7ebd`,
zero participants, `FIELD_READY / HUMAN_PARTICIPANTS_REQUIRED`.** Every repair named below is in
`client/src` or `shared/`, and either moves the built bundle. **Nothing in this audit is
implemented.** `ARCHITECTURE_UI_EXECUTION_PLAN.md` carries the post-FIELD sequence.

---

## THE HEADLINE, AND IT IS NOT THE ONE THE BRIEF PREDICTED

The brief expected to find the architecture saying `test-claim` while a screen says "play another
game". That contradiction is real, and it is unconditional rather than occasional. But it is not the
finding that matters most, because of what sits underneath it:

> **The apparatus built to measure that disagreement cannot currently observe the four things that
> outrank `test-claim`, and two of its three declared surfaces have no call site at all.**

So the gap is not merely unrepaired. It is **unmeasured, and currently unmeasurable** — and the
telemetry that would tell you whether handing ownership over is safe cannot answer the question.

Repairing the screens before repairing the measurement would be building on a reading nobody took.

---

## F1 — The canonical derivation has no consumer. *(by design, stated for the record)*

`deriveNextAction` is called from exactly three places: the shadow hook, `GATE-NEXT-ACTION-RESOLVES`,
and nothing else. No screen consults it. This is D27's declared position — *"IT DECIDES NOTHING YET"*
— and is not itself a defect. It is stated because it makes every finding below a question about
measurement rather than about behaviour: nothing the derivation says can currently be wrong for a
user, because nothing hears it.

---

## F2 — The shadow's `ProductState` asserts four fields absent, and they are the four that outrank `test-claim` **`P0`**

`productStateFor` in `client/src/lib/next-action-shadow.ts` hard-codes:

```ts
drill: null,
transfer: null,
unseenEvent: null,
untestedRule: null,
```

Against `deriveNextAction`'s actual branch order:

| rank | branch | reads | shadow supplies |
| --- | --- | --- | --- |
| 1 | `continue-drill` | `drill` | **`null`, asserted** |
| 2 | `continue-transfer` | `transfer` | **`null`, asserted** |
| 3 | `wait-analysis` | `pendingAnalyses` | real |
| 4 | `review-event` | `unseenEvent` | **`null`, asserted** |
| 5 | `test-hypothesis` | `untestedRule` | **`null`, asserted** |
| **6** | **`test-claim`** | `claimState` | **real** |

**`test-claim` is rank 6, and four of the five ranks above it are asserted absent.** Every shadow row
proposing `test-claim` is therefore unfalsifiable: the true proposal could have been any of four
higher-ranked actions.

The row is honest about this — it writes `blind: [...SURFACE_BLIND_SPOTS[surface]]`. **Honesty about a
blind spot does not make the row usable.** Phase 6 of the brief requires that "the ProductState
inputs needed for it are truthful" before a state may be handed over; for `test-claim` they are not,
and not because `claimState` is wrong.

Worst of the four: **`untestedRule`**. D22's constitutional ordering is that a question the player
wrote outranks one the instrument found. That ordering is exactly what the shadow cannot see.

---

## F3 — Two of three declared shadow surfaces have no call site **`P0`**

```
shared/next-action.ts:314   SHADOW_SURFACES = ["resume", "post-game", "record"]
```

`useNextActionShadow(` appears **once** in the entire tree:

```
client/src/components/ResumeScreen.tsx:105   useNextActionShadow("resume", useProductState());
```

`post-game` and `record` are declared in the union, given rows in `SURFACE_BLIND_SPOTS`, described in
the module docstring as *"the ones that ROUTE: the returning front door, the screen after a game,
and the record"* — and instrumented nowhere.

**The type system cannot catch this.** `Record<ShadowSurface, …>` forces a row per surface and says
nothing about whether anyone calls the hook with it.

**Why it is worse than an unmeasured disagreement:** a surface with no call site cannot disagree, so
its silence is indistinguishable from agreement. The screen most likely to contradict the
architecture is the one nothing is watching — see F5.

A gate for this was written and run during this audit. Against the fixture it names
`post-game, record`; against the real tree it names the same two, because the defect is live. **It is
not landed**, because a red gate blocks every other PR and the fix moves the frozen bundle.
`ARCHITECTURE_UI_EXECUTION_PLAN.md` §G carries it.

---

## F4 — The one instrumented screen runs a policy engine with a two-word vocabulary **`P0`**

| | vocabulary |
| --- | --- |
| `deriveNextAction` | **11 kinds** — `collect-more-evidence`, `continue-drill`, `continue-transfer`, `none`, `play-blitz`, `play-first-decision`, `return-record`, `review-event`, `test-claim`, `test-hypothesis`, `wait-analysis` |
| `actFor` maps those onto | **9 acts** — `commit-decision`, `answer-instrument`, `next-decision`, `play-blitz`, `play-first-decision`, `review-event`, `continue-run`, `test-hypothesis`, `return-record` |
| `readResume().next` | **2 kinds** — `play`, `wait` |

`ResumeScreen` renders `readResume`, whose entire output space for "what now" is *play* or *wait*.
It is **structurally incapable** of agreeing with most of what the derivation can propose.

So on the only surface currently producing rows, `agrees: false` carries close to no information: it
is the expected result of comparing an 11-valued function against a 2-valued one, not evidence that
this particular screen is wrong about this particular state.

---

## F5 — `PostGame`'s primary act is a literal, and nothing watches it **`P0`**

```tsx
client/src/components/PostGame.tsx:193   {...primaryAction("play-blitz")}
```

Not derived, not conditional on any claim or record state — a constant, inside a `lead !== null`
render guard. Whenever that button shows and `claimState === "candidate"`:

| | says |
| --- | --- |
| architecture | `test-claim` |
| screen | `play-blitz` — "משחק חדש" |

**This is the brief's predicted contradiction, and it is unconditional rather than occasional.** And
because of F3, `post-game` writes no shadow row, so this disagreement has never been recorded once.

The same shape, less sharply, in `RevealPanel.tsx:374` and `RevealFailure.tsx:136`, both
`primaryAction("next-decision")` as literals.

---

## F6 — `unread` still renders as `accumulating` at zero **`P1`** *(R-30, still live)*

```ts
client/src/lib/journey-readings.ts:20
export function recordReading(view: ClaimView | undefined): JourneyReading {
  return recordJourney({ scored: view?.scored ?? 0, hasClaim: Boolean(view?.claim), … });
}
```

An unresolved query and an empty record produce the identical reading. The record page says "you have
recorded nothing" to every arrival, for as long as the query takes.

`ClaimState` gained `unread` as its own member precisely so the *derivation* can tell them apart. The
*ledger* still cannot. `R-30` in `docs/MASTER_PRODUCT_DEBT.md` carries this and is unchanged; it is
listed here because it is the one P1 in the set and because the architecture now makes it repairable.

**The invariant, stated the way the brief puts it: absence of a reading is not a reading of absence.**

---

## F7 — `drill` and `transfer` are blind for a *structural* reason, and it is the same defect as the persistence gap **`P0`, root cause**

`client/src/pages/Home.tsx:377-391` holds continuation state in **eight `useState` hooks**:
`drill`, `drillIndex`, `drillDecisionIds`, `drillStage`, `drillVerdict`, `drillError`,
`learningTransfer`, `learningTransferStage`.

The shadow runs inside `ResumeScreen`, a different tree. It *cannot* read Home's component state, so
`drill: null, transfer: null` is not laziness — it is the only thing that assembly can honestly say.

**So F2's two worst blind spots and the brief's hypothesis C are one defect.** Move the continuation
state to a horizon both trees can read and two of four blind spots close by construction. Nothing
else about the shadow needs to change for that.

---

## F8 — `untestedRule` is blind by omission, not by necessity **`P0`, cheap**

`useLearningRules()` exists in `client/src/lib/record-api.ts:425` and is **already called** by
`client/src/lib/use-loop-position.ts:37`. The shadow's own docstring argues that `claim` "costs
nothing to supply" because the tree already calls `useClaimView` and react-query dedupes by key —
**the identical argument applies to rules and was not made.**

This is the cheapest of the four and it closes the blind spot on the highest-ranked thing the shadow
currently misses, which is the player's own question.

---

## F9 — `unseenEvent` has no implementation anywhere

No seen-set exists in the tree. `next-action-shadow.ts` passes `null`; nothing else ever fills it.
The field's own docstring says *"The caller owns the seen-set"*, and no caller does.

Not closable without building one. **Not recommended now** — see `ANTI-BUILD` below.

---

## Parallel decision systems: four engines answering "what now?"

```
record / games / claim
        │
        ├──► deriveNextAction ──► (shadow only) ──► localStorage row      11 kinds, 0 screens
        │
        ├──► readResume ────────► ResumeScreen ──► resume CTA             2 kinds
        │
        ├──► postGameWords ─────► PostGame ─────► words only
        │                              └────────► primaryAction("play-blitz")   ← literal
        │
        └──► (nothing) ─────────► RevealPanel ──► primaryAction("next-decision") ← literal
                                   RevealFailure ─► primaryAction("next-decision") ← literal
```

Three of the four never consult the record at the point where they choose the act.

---

## State × surface matrix

`arch` is what `deriveNextAction` returns given truthful inputs. `shadow` is what the shadow can
actually observe today.

| state | arch proposes | shadow can see it? | screen's act | agree? | user consequence |
| --- | --- | --- | --- | --- | --- |
| cold start, no record | `play-first-decision` | yes | front door offers first decision | **yes** | none |
| first stored decision | `collect-more-evidence` or `play-blitz` | yes | resume says *play* | **yes**, coincidentally | none |
| **claim unread** | `none` (blitz unread) / `test-claim` if claim resolves | partly | ledger says **"nothing recorded"** | **no** | product asserts an absence it has not measured — F6 |
| accumulating below floor | `collect-more-evidence` / `play-blitz` | yes | resume says *play* | yes | none |
| floor reached, nothing separated | `collect-more-evidence` / `play-blitz` | yes | resume says *play* | yes | correct, and the negative result is stated |
| **candidate claim** | **`test-claim`** | **rank 6 under 4 blind ranks** | resume *play*; PostGame **`play-blitz`** | **no** | **told to collect more of the evidence that already separated** — F5 |
| decided replicated | falls through | yes | resume *play* | yes | none |
| decided refuted | falls through | yes | resume *play* | yes | none |
| pending blitz analysis | `wait-analysis` | yes | resume says *wait* | **yes** | none. The one place the two engines genuinely coincide |
| **unseen event** | `review-event` | **never — F9** | nothing offers it | unmeasurable | the action exists in the vocabulary and cannot be proposed |
| **untested player rule** | `test-hypothesis` | **never — F8** | nothing on resume | unmeasurable | **D22's constitutional ordering is invisible to the instrument** |
| **incomplete drill** | `continue-drill` | **never — F7** | only Home knows | unmeasurable | leave Home and the run is unreachable from any other surface |
| **incomplete transfer** | `continue-transfer` | **never — F7** | only Home knows | unmeasurable | same |
| anchor shortfall | `collect-more-evidence` | yes | resume *play* | partly | the shortfall is real and the resume words do not name it |
| blitz blocker | `play-blitz` with `because` | yes | resume *play* with `because` | **yes** | none |
| nothing blocked | `return-record` | yes | resume *play* | **no** | resume cannot say *return to the record*; its vocabulary has no such word — F4 |

**Six of sixteen rows are unmeasurable**, and they include every row where the architecture would
propose something a screen has no word for.

---

## Priority

| | finding | why |
| --- | --- | --- |
| **P0** | F2, F3, F5, F7, F8 | architecture and UI contradict, and the contradiction is currently unmeasurable |
| **P1** | F6 | the product says something false to every arrival |
| **P2** | F1, F9 | architecture invisible, deliberately. Not a defect |

**Ordering constraint, and it is the point of the audit:** F7 and F8 must land **before** F3 and F5.
Instrumenting more surfaces while four higher-ranked inputs are asserted absent produces more
uninterpretable rows, not more evidence.

---

## ANTI-BUILD — refused explicitly

Not built, and not recommended: a learning dashboard, a visible `PLAY/CAPTURE/REVEAL/UPDATE/RETURN`
tracker, adaptive prompt frequency, per-player sampling, gamification, streaks, rewards,
personalisation, extra navigation, a design system, a second state machine, a coaching engine,
ranking by expected improvement, or a redesign of Record, Blitz or Commitment.

Also refused, specifically: **F9's seen-set.** Building a seen-set to close one blind spot, when
`review-event` has no screen that offers it and no evidence anyone wants it, would be adding product
to satisfy a table.

---

## What would falsify this audit

* A shadow row from `post-game` or `record` existing anywhere — would refute F3.
* Any screen reading `deriveNextAction` for its act — would refute F1 and most of F5.
* `readResume` proposing something outside `play | wait` — would refute F4.
* A `drill` or `transfer` value reaching the shadow — would refute F7.
* A record page distinguishing an unresolved query from an empty record — would refute F6.

Each is one grep.
