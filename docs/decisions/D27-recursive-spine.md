# D27 — what is the recurring loop, and which layer may decide what happens next in it?

**Mode:** `DEFER` — the loop is stated once and held by a test, the layer that decides what happens
next gained the one input that makes it recursive, and it still decides nothing. No screen has been
handed over and no surface a cold participant reaches has moved.
**Evidence level:** E2 — a reference behaviour reproduced beside the product and compared to it.
Humans measured: 0.
**Depends on:** `shared/spine.ts`, `shared/claim-state.ts`, `shared/next-action.ts`,
`shared/learning-journey.ts`, `shared/decision-stage.ts`,
`docs/decisions/D21-feedback-exposure.md`, `docs/decisions/D22-next-action-ownership.md`,
`docs/decisions/D26-primary-evidence-path.md`, `docs/INERTIAL_UX_LAWS.md`,
`research/player-path/PRODUCT_STATE_WALK.md`, `research/player-path/FIELD_RUN_CURRENT.md`.

---

## CLAIM

The product is built as one recurring loop and had no statement of what that loop is. Three state
machines exist, each correct, each owned by a different layer, and **nothing composes them**:

| layer | question it answers | module | who reads it |
| --- | --- | --- | --- |
| event | what happened in THIS decision | `shared/decision-stage.ts` | `Home.tsx`, the board, the commit |
| claim | what the accumulated evidence justifies saying | `shared/learning-journey.ts` | the record page's ledger |
| journey | what is useful to do next | `shared/next-action.ts` | nothing; one surface shadows it |

The consequence is one property, and it is the whole of this node:

> **The output of a cycle did not change what the next cycle could propose.**

Which makes the product a cycle rather than a recursion. Two passes over a record that had learned
something in between produced the same proposal, because the thing that differed between them was
not an input to the function that proposes.

---

## A. CURRENT PRODUCT FLOW, as a user meets it

Walked in Chromium at `4b322f2` and recorded in `research/player-path/PRODUCT_STATE_WALK.md`; this
section summarises that walk rather than repeating it.

```text
/            the record. Cold: a value paragraph and three doors
             (a position from your own games, a bank position, a short blitz game).
             Returning: the resume screen above it, one blocker, one step.

/play        the board. A decision is placed, a commitment panel asks for the move and
             (by purpose) a confidence, the row is written, sometimes a counterfactual
             probe is drawn, then the engine speaks -- or does not, under
             "בסוף המשחק", in which case the game simply continues.

/blitz       an ordinary timed game. The engine is silent throughout. A confidence
             question is drawn on about one move in seven, after the move.
             Nothing is written to the record until the game is over; the analysis
             queue then scores it from any page load.
```

Two evidence lanes, and the walk found that they do not feed each other: a finished blitz game
leaves `"decisions": []` and writes only `blitzGames`. `D26` decided which lane the product leads
with and deliberately deferred the consolidation.

---

## B. RECURSION BREAKS

Six were found. Four are recorded here and repaired or already owned; two are named and left.

**B-1. The claim layer could not reach the journey layer. `REPAIRED HERE.`**
`ProductState` carried `pendingAnalyses`, `blitzStanding`, `decisionsOnRecord`, an anchor shortfall,
two run slots and `untestedRule`. Every one is a count of what is MISSING. None of them moves when
the six-bucket search finally separates something, so `deriveNextAction` could not tell a record
that had learned something from one that had not. Worse, the lane it was blind in is the decision
lane, which `D26` names as the product's long-term user-facing evidence path; the blitz lane already
had its claim state in the derivation as `BlitzStanding`.

**B-2. The loop's terminals were not checkable. `REPAIRED HERE.`**
The inertial laws hold their properties per surface: one primary action, no reading while evidence
is being made, no cancellable pass. "Does this branch come back to a real chess decision" is a
property of the graph those surfaces form, and nothing held it. The only thing that had ever found a
break in it was a person pressing controls in a browser — `B-1` of the product-state walk, where a
live game's opening reveal offered no continuation at all.

**B-3. The refuted stage named no way on. `REPAIRED HERE.`**
`ruleJourney`'s `REFUTED` reading ended at *"הכלל נשמר כמו שהוא ולא נבדק שוב"*. `RETIRED`, one branch
up and reached by the player's own choice to close a rule, already said a new rule could be written
after a reveal. So the stage a player arrives at **by being wrong** was the only one in the family
with no sentence about what happens next.

**B-4. A run does not survive navigation. `OWNED ELSEWHERE, NOT REPAIRED HERE.`**
A drill and a transfer live in `Home.tsx`'s component state. `D22` reversal condition 2 names it as
a LAW 4 defect with its own debt row, and it is why `continue-drill` and `continue-transfer` are
proposals no other surface could ever agree with. It is a real recursion break — a branch of the
loop that loses its own position — and repairing it is a change to the most complex file in the
product for a state no shipped record can reach. It stays where it is, with its row.

**B-5. Two denominators on one screen. `DELIBERATELY LEFT.`**
`C-1` of the product-state walk. `D26` decision 3: the consolidation is not implemented before the
FIELD run, and `C-1` is left visible on purpose so the run measures the product as it is. Untouched.

**B-6. An unread record renders as an empty one.** `recordReading(undefined)` produces
`ACCUMULATING` with a count of nought, so "the query has not come back" and "you have recorded
nothing" are one sentence on the record page. The new claim state separates them — `unread` is its
own member and the derivation answers nothing to it — and `journeyStageOf` maps `unread` onto
`ACCUMULATING` so the ledger's behaviour is unchanged. Separating them on screen is a change to a
surface a cold participant reaches, and `FIELD_RUN_CURRENT.md` freezes that surface. **Recorded, not
repaired.** The aliasing is asserted in
`tests/shared/an-instrument-that-cannot-learn-from-its-own-result.test.ts` so the day somebody
separates them, the test says which two things parted.

---

## C. THE CANONICAL RECURSIVE SPINE

```text
        ┌─────────────────────────────────────────────────┐
        │                                                 │
        ▼                                                 │
     PLAY ──────▶ CAPTURE ──────▶ REVEAL ──────▶ UPDATE ──┴──▶ RETURN
       ▲             │                                            │
       └─────────────┴────────────────────────────────────────────┘
```

Five phases, and the arcs are in `shared/spine.ts` as data.

* **PLAY** — ordinary chess. A decision opportunity is a position where it is the player's move.
  `PLAY → PLAY` is an arc, and it is what makes reflection optional: the confidence question is
  drawn at `ASK_RATE`, so a move nobody was asked about is the ordinary case.
* **CAPTURE** — the pre-feedback packet is assembled and closed. `deciding`, `committing`,
  `committed` and `blocked` are all here, the counterfactual probe included.
* **REVEAL** — post-commit information is available. Only `revealed`.
* **UPDATE** — what the accumulated evidence supports is recomputed. It may legitimately support
  nothing, and `nothing-separated` is a first-class member for that reason.
* **RETURN** — one act, which puts the player back into the loop. It is the only phase that fans
  out, and `reentryOf` is what decides where.

### Why five and not the six the obvious drawing has

The obvious drawing puts `ACT` between the commitment and the verdict. Measured against this
repository that is wrong in both lanes, in opposite directions:

| lane | order |
| --- | --- |
| untimed | the move is PLACED during the decision and PLAYED at the continuation, after the reveal |
| blitz | the move is played immediately and the confidence question is put afterwards |

Two lanes, two orders. Pinning either into the spine makes the other an exception. What is invariant
across both is the only thing the product is actually about:

> **The evidence packet closes before any post-commit information becomes available.**

That is `CAPTURE` before `REVEAL`, and it is the one ordering the spine asserts.
`mayShowPostCommitInformation` is its predicate and
`tests/shared/a-loop-with-no-way-back-to-the-board.test.ts` holds it against `engineMayRun`, so the
boundary has one definition rather than two. **Playing a move is where the loop happens, not a phase
of it**, which is also why `PLAY` is the phase everything must return to rather than one stop
among five.

---

## D. THE STATE MODEL

### Event state — `DecisionStage`

Unchanged. `deciding → committing → committed → revealed`, with `blocked` declared and unreached.
`purpose` travels on the position, `evidence-policy.ts` decides which consumer may read a decision
of each purpose, and that pair is already the assistance lineage `§14` asks for: `drill` and
`transfer` decisions are refused by `discovery` and scoped to a matching test, so a supported
success can never be pooled with an unassisted one. **Nothing was added.**

### Claim state — `ClaimState`, new

```text
unread  ──▶  accumulating  ──▶  nothing-separated
                   │                    │
                   └────────────────────┴──▶  candidate  ──▶  decided (replicated | refuted)
```

Five members, and each earns itself against the rule that a distinction is kept only if collapsing
it would change what may be claimed, what is shown, what act is recommended, what evidence is
needed next, or how future events are read:

| member | what collapsing it would cost |
| --- | --- |
| `unread` | a record still loading would be read as a record with nothing in it |
| `accumulating` | below the floor every separation is noise; proposing a test of one is proposing a test of nothing |
| `nothing-separated` | a result would be reported as a shortage |
| `candidate` | a question that a forward test could close would be indistinguishable from one already closed |
| `decided` | the system would keep proposing the test that had already answered, in either direction |

`REFUTED` and `REPLICATED` are **not** separated in this state, deliberately. To the layer deciding
what to do next they are one thing: this question has been asked prospectively and asking it again
the same way establishes nothing. What a player is TOLD about the two differs, and that belongs to
the surface that says it.

### Journey state — `NextAction`

Unchanged in shape, one kind added. `test-claim` is separate from `test-hypothesis` because a rule
is a sentence the PLAYER wrote and a claim is a separation the INSTRUMENT found: different authors,
different refutation conditions, different grading code. They share one act (`test-hypothesis` in
`PRIMARY_ACTIONS`) on the precedent `continue-drill` and `continue-transfer` already set.

**The three layers stay separable, and the spine is where they are compared.** A bad move does not
create a claim state: `claimStateOf` reads the search's verdict and never a decision's cost.

---

## E. THE TWELVE-LOOP STATE WALK

Reachability is the `§3` table of `research/player-path/PRODUCT_STATE_WALK.md` at the shipped flag
settings. A loop the product cannot reach is marked as such rather than described as if it could.

| # | loop | system may claim | shown | primary act | after the act | re-enters at |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | cold start | nothing, and it says so | value paragraph, three doors | `play-first-decision` | a record key exists | PLAY |
| 1 | first decision | one decision recorded pre-verdict | commitment panel, then reveal | `commit-decision`, then `next-decision` | `claimState: accumulating` | CAPTURE → REVEAL |
| 2 | reflection skipped | nothing about this move | the board; no question was put | none: the move | the loop is not broken | PLAY → PLAY |
| 3 | self-initiated capture | **NOT REACHABLE** | — | — | — | — |
| 4 | weak signal | nothing: below the floor | `ACCUMULATING`, `n of 60` | `collect-more-evidence` / `play-blitz` | the count moves | PLAY |
| 5 | recurrence | a separation exists in this record | `CANDIDATE`, and its limit | `test-claim` **(new)** | a drill is pre-registered | CAPTURE |
| 6 | context changes it | scoped by `claim.scope` | the claim's own sentence | `test-claim` | — | CAPTURE |
| 7 | practice opportunity | **NOT REACHABLE** — the drill control lives behind a claim, and no shipped record has reached one | — | — | — | — |
| 8 | assisted success | `PRACTISED`, and it says the positions were handed over | drill verdict | return | grade may move | RETURN → PLAY |
| 9 | later unassisted success | `WATCHED_IN_PLAY`, two counts, no difference attributed | the two counts | continue playing | the after-count grows | PLAY |
| 10 | refutation | `REFUTED`; the rule did not hold | verdict, and **now** a way on | write another rule after a reveal | practice on it stops | REVEAL → PLAY |
| 11 | return after days | what changed since the last visit | resume screen, one blocker, one step | one per blocker | the blocker moves | PLAY |

**Loop 3 has no route and that is a finding, not an omission.** There is no control anywhere that
lets a player say *I want to preserve what I am thinking here*. Every capture in the product is
either system-sampled (`ASK_RATE`, `BLITZ_ASK_RATE`) or implied by the position's purpose
(`first`, `anchor`, `drill`, `transfer`). `§7` of the brief requires self-initiated and
system-invited reflection to stay distinct event types, and today only one of the two exists — so
there is nothing to keep distinct yet, and adding the control is a stimulus change. **Not built.
Named in `WHAT WAS DELIBERATELY NOT BUILT`.**

**Loops 7, 8 and part of 10 are unreachable in the shipped build** for reasons already decided:
the drill sits behind a claim, and the learning surfaces sit behind
`EXPERIMENTAL_LEARNING_ENABLED`, which `D25` turned off and `D26` decision 4 keeps off for the FIELD
run. The spine is stated over them anyway, because a state nobody can reach is exactly the state
that ships with no way back once somebody can.

---

## F. FEATURE-TO-SPINE MAP

| feature | phase | notes |
| --- | --- | --- |
| `/play` board, `ChessBoard`, `boardAuthorityFor` | PLAY / CAPTURE | authority is derived from stage, which is the boundary |
| `CommitmentScreen` | CAPTURE | the packet; the submit is the boundary |
| `CounterfactualProbe` | CAPTURE | pinned to `committed` by `PROBE_STAGE`, pre-engine |
| `RevealPanel` | REVEAL | already answers the three questions: what this does not say, what happened, what is worth checking |
| `SilentGame`, `בסוף המשחק` | CAPTURE → PLAY | a deferred verdict, not a shortcut past it |
| `/blitz`, `PostGame` | PLAY → CAPTURE → UPDATE | the reveal is for the game, not the move |
| analysis queue (`BlitzAnalysisKeeper`) | UPDATE | LAW 4: it finishes from any page load |
| `RecordDashboard`, `JourneyLedger`, `OutcomeSummary` | UPDATE | the claim layer's surfaces |
| `ResumeScreen` | RETURN | the only surface that proposes today, and it reads the blitz lane only |
| `ClaimPanel`, `DrillRunner` | RETURN → CAPTURE | a pre-registered test is evidence-making, not reading |
| `LearningQueue`, `LearningRuleComposer`, `LearningTransferRunner` | REVEAL → RETURN → CAPTURE | behind the flag |
| `RecordExplorer`, `GameReview`, `LichessLayersPanel` | UPDATE | the toolbox, behind one control, correctly outside focus |
| `ImportGames`, `ImportDiagnostic` | UPDATE | a separate section by `evidence-policy`, and the screen says so |
| `GoalNote` | outside the loop | the player's own sentence, with no counter scoped to it. Correct as is |
| `ContextRibbon`, `LoopStrip` | UPDATE | where-am-I, suppressed while evidence is made |

Nothing failed to map. Two things map **outside** the loop and should stay there: `GoalNote`
(a sentence the product deliberately does not measure against) and the self-check / help overlays.

---

## G. KEEP / MOVE / MERGE / DEFER / DELETE

Nothing is deleted and nothing is moved. That is the finding, not a reluctance.

| surface | verdict | reason |
| --- | --- | --- |
| `/` record | KEEP | it is the front door and the UPDATE surface; `C-1` waits on FIELD |
| `/play` | KEEP | PLAY and CAPTURE for the untimed lane |
| `/blitz` | KEEP | the only lane a cold user can complete end to end today |
| `ResumeScreen` vs `deriveNextAction` | **MERGE, DEFERRED** | two derivations of one thing: one lane-local and owning the screen, one whole-record and owning nothing. Merging them is handing a screen over, which is `D22`, still `DEFER` |
| `RecordExplorer` toolbox | KEEP | already one control, already lazy, already outside focus |
| drill / transfer run state | MOVE, **not now** | out of `Home.tsx` and into the record, so any surface can see a run. `D22` reversal condition 2 owns it |
| `LoopStrip` + `ContextRibbon` | MERGE candidate, DEFER | both answer where-am-I from different inputs. Not worth a stimulus change before FIELD |

---

## H. EXTENSION-POINT MAP

Each future layer attaches to one transition, consumes existing state and creates new state. None of
them is built.

| layer | attaches to | consumes | creates | lineage it needs | evidence that would justify it |
| --- | --- | --- | --- | --- | --- |
| system invitation policy | `PLAY → CAPTURE` | purpose, `ASK_RATE` draw | invited / accepted / skipped as **distinct** events | the draw and the answer stored separately | a measured skip rate that differs from the unasked rate |
| self-initiated capture | `PLAY → CAPTURE` | nothing | a fifth capture origin | must not be pooled with sampled ones | anyone asking for it in FIELD |
| reward / payoff | `REVEAL → RETURN` | reveal kind | nothing on the record | must not become a denominator | M6 failing in FIELD: the next unit of effort is not worth it |
| pattern visualisation | `UPDATE` | `ClaimState` + claim scope | nothing | reads, never writes | M2 failing: journey orientation |
| map / journey representation | `UPDATE` | `JourneyStage` per object | nothing | the ledger already holds the objects | more than one live object at once |
| avatar / identity | outside the loop | nothing | nothing | must not be scoped to a counter | none today |
| practice | `RETURN → CAPTURE` | `candidate` | drill decisions at `purpose: "drill"` | already refused by `discovery` | a reachable claim |
| scaffolding / hint | `CAPTURE` | position only | an assistance level on the decision | `DecisionPurpose` is the existing vocabulary; extend it, do not parallel it | a measured gap between supported and unsupported success |
| provenance / "why now" | `UPDATE → RETURN` | claim id, decision ids | nothing | `Claim.supporting_decision_ids` already carries it | M2 or M5 failing |
| adaptive prompting | `PLAY → CAPTURE` | claim state | a prompt exposure on the decision | **blocked by `D21`**: the record cannot represent feedback exposure | `D21`'s contract closing first |

The pattern in the right-hand column is the point: **every one of these attaches to an existing
transition and none of them requires the spine to change.**

---

## I. THE MINIMUM IMPLEMENTATION

What changed, and nothing else did:

1. `shared/claim-state.ts` — the claim layer as a value, derived once from the claim view.
2. `shared/spine.ts` — the five phases, the arcs, and `reachesPlay`.
3. `shared/next-action.ts` — `claimState` as an input; `test-claim` as a kind; one ordering branch,
   under the file's own rule 4 and one rank below the player's own question.
4. `client/src/lib/next-action-shadow.ts` — supplies the claim view it already holds.
5. `shared/detector.ts` — `DISCOVERY_FLOOR`, so the floor has one definition.
6. `shared/learning-journey.ts` — `journeyStageOf`, the stated correspondence; and the `REFUTED`
   stage gains a way on.
7. `scripts/run_gates.ts` — `GATE-NEXT-ACTION-RESOLVES-BLOCKER` runs its table under two claim
   states, because the new input is one that could outrank a blocker.

**No screen changed. No route changed. No flag moved.** The entry chunk moved by 17 bytes and no
ceiling was raised.

---

## WHAT THIS DOES NOT ESTABLISH

**That an arc in the model is a control on a screen.** `test-claim` re-enters at `CAPTURE`, and the
control that would take a player there lives behind a claim no shipped record has reached. The model
says the loop closes; only a walk says whether the product does.

**That the ORDER is right.** `deriveNextAction`'s ordering is a set of arguments, and an argument is
the thing a person can be wrong about. `D22` reversal condition 3 already says so and this node adds
one more argument to the list.

**That the loop is legible.** Every measure in `FIELD_RUN_CURRENT.md` is about whether a person can
orient, act and tell what a number does not claim. Nothing in this repository can answer those.

---

## REVERSAL CONDITIONS

1. **A FIELD participant's failure is located at a transition the spine does not have.** The frozen
   interpretation rules map an outcome to the layer that owns it; a failure that maps to no phase
   means the phases are wrong.
2. **A claim state is needed that carries what the claim is ABOUT.** The guard in
   `tests/shared/what-the-record-is-missing.test.ts` permits a kind, a count, an id and a grade.
   Needing a scope or a gap in the router means the router has become a coach and `D21` applies.
3. **`CAPTURE → REVEAL` stops being the invariant.** If a lane arrives where post-commit information
   is legitimately available before the packet closes, the one ordering the spine asserts is wrong
   and the model has to be rebuilt rather than extended.
4. **The two derivations are merged.** `readResume` and `deriveNextAction` are two answers to one
   question; the day one of them owns a screen, `D22` moves and this node's `MERGE, DEFERRED` row
   is settled with it.
