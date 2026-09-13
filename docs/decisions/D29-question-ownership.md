# D29 — may a finding the instrument produced become the player's next project without the player saying so?

**Mode:** `DEFER` — the ownership boundary is made expressible and enforceable in the layers that
decide, and **no control was added**, so nothing can enter the new state from a screen. The FIELD
stimulus is frozen and this **does not merge before the run completes.**
**Evidence level:** E1 — derived from the tree and held by tests. Humans measured: 0.
**Depends on:** `shared/claim.ts`, `shared/claim-state.ts`, `shared/next-action.ts`,
`shared/learning-record.ts`, `shared/drill.ts`, `shared/drill-positions.ts`,
`shared/validation-protocol.ts`, `shared/claim-grade-protocol.ts`, `shared/prereg.ts`,
`shared/record-service.ts`, `docs/decisions/D21-feedback-exposure.md`,
`docs/decisions/D22-next-action-ownership.md`, `docs/decisions/D27-recursive-spine.md`,
`docs/decisions/D28-adaptive-policy-architecture.md`,
`research/player-path/FIELD_RUN_CURRENT.md`.

---

## CLAIM

D27 closed the loop: `candidate` reaches `deriveNextAction` and comes back as `test-claim`, so the
output of one cycle now changes what the next cycle may propose. It closed it **one party short.**

> A separation the instrument found becomes the player's next project the moment the detector
> produces it, and there is no state in which the player has been asked and has said no.

The asymmetry that proves it is inside the repository, not argued from outside it. The player's own
hypotheses carry a grade the instrument's do not:

```
LEARNING_RULE_GRADES = ["hypothesis", "replicated", "refuted", "retired"]
CLAIM_GRADES         = ["hypothesis", "replicated", "refuted"]
```

`learning-record.ts` already says what the fourth one is for, and says it exactly right:

> `retired` is the one thing not derivable this way — it is an act of the player's, not a reading of
> the evidence — so it is checked before the fold and never rebuilt by it.

So the ownership boundary this node is about **already exists, is already implemented, and is
already defended in a comment** — on one side of the authorship line. What the player wrote, the
player may stop pursuing. What the instrument found, the player may only outlive.

---

## A. CURRENT PATH

What happens today, end to end, with every owning module named.

| # | step | module | what it decides |
| --- | --- | --- | --- |
| 1 | decisions accumulate | `record-service.ts` | nothing yet |
| 2 | `detect` finds a separation past `DISCOVERY_FLOOR` | `detector.ts` | a bucket separates |
| 3 | `formHypothesis` writes a `Claim`, grade `hypothesis` | `claim.ts` | statement, scope, `refutation_condition`, `predicts_overconfidence` |
| 4 | `claimStateOf` reads it as `{kind: "candidate"}` | `claim-state.ts` | the claim layer's word for it |
| 5 | `awaitsForwardTest` is true, so `deriveNextAction` returns `test-claim` | `next-action.ts` | **the proposal** |
| 6 | the player presses run | `Home.tsx:1312` → `record-api.ts:377` | **the only human input in the whole path** |
| 7 | `beginDrill` looks the claim up, refuses a refuted one, narrows to the claim's phase | `record-service.ts:1288` | eligibility |
| 8 | `selectDrillPositions` picks 5–8 boards the player has never decided | `drill-positions.ts` | the evidence boundary |
| 9 | `createDrill` + `startDrill` freeze the spec and save it | `drill.ts` | the test contract |
| 10 | `finishDrill` grades from the **stored** condition | `record-service.ts` | the disposition |
| 11 | `evaluateClaim` folds results into `replicated` / `refuted` | `claim.ts` | the epistemic state |
| 12 | `claimStateOf` reads `{kind: "decided"}`, `awaitsForwardTest` goes false | `claim-state.ts` | the loop closes |

Steps 7–11 are a genuine frozen forward test and this node does not touch them. **Step 6 is the
whole finding.**

---

## B. OWNERSHIP GAP

Four different things are indistinguishable in storage and in the derivation:

| what happened | how the record reads it today |
| --- | --- |
| the candidate was never offered | `candidate` |
| it was offered and the player has not answered | `candidate` |
| it was offered and the player said **no** | `candidate` |
| it was offered, the player said yes, and the drill has not started | `candidate` |

The consequence is not cosmetic. `awaitsForwardTest` is a pure function of `{kind: "candidate"}`,
so `deriveNextAction` proposes `test-claim` on every derivation until the claim is **graded** — and
a claim is graded only by a drill. **A question the player has refused can only be got rid of by
answering it.** The module's own docstring already forbids this shape for the other field it
carries:

> An event the product keeps re-offering is not a next action, it is a nag — and re-showing a
> finding is exposure, which D21 says the record cannot represent.

`unseenEvent` got that protection. `claimState` did not.

A search of `shared/`, `client/src/` and `server/` for any representation of a person declining,
deferring, dismissing or postponing a proposal returns **nothing**. The only refusals in the
vocabulary belong to the engine (`analysis-refused`) and to the player declining to *claim*
(`EVEN_ODDS_LEVEL`). Neither is a person declining a project.

---

## C. ALTERNATIVES CONSIDERED

| | representation | verdict |
| --- | --- | --- |
| **A** | a new persistent `Question` entity: id, authorship, statement, accepted_at, disposition | **rejected.** Every field it needs already exists on `Claim` (`claim_id`, `statement`, `scope`, `refutation_condition`, `n`, `supporting_decision_ids`) or on `StartedDrill` (`started_at`, `predicted`). A second object meaning "a thing that might be true about this player" is the duplication `evidence-policy.ts` and `register-scan.ts` exist to catch |
| **B** | a field on the claim recording the player's answer | **accepted, in the repository's own shape.** See D |
| **C** | widen the drill so the contract itself carries ownership | **rejected.** It inverts the dependency: a decline must be expressible **without** a test, and a drill that exists in order to record that no drill was wanted is a contradiction |
| **D** | client-side only, on the `unseenEvent` precedent ("the caller owns the seen-set") | **rejected on requirement 7.** The seen-set is a convenience; a refusal is a fact about what the person decided, and `next-action-shadow.ts:122` shows what happens to caller-owned fields in practice — it passes `unseenEvent: null` and nothing has ever filled it |

---

## D. DECISION

**One value, no new entity, and it is the value the repository already chose for the other
authorship.**

```
CLAIM_GRADES = ["hypothesis", "replicated", "refuted", "retired"]
```

with exactly the four properties `learning-record.ts` gives its own `retired`:

1. **It is not derivable from evidence**, so `evaluateClaim` checks it **before** the fold. This is
   not a stylistic echo: `evaluateClaim` opens by resetting `grade: "hypothesis"` and replaying the
   results, so a retired claim read twice would come back a hypothesis. The guard is what makes the
   state survive a read.
2. **It is terminal for proposals and not for truth.** `awaitsForwardTest` goes false, so
   `deriveNextAction` stops proposing it. The claim's `statement`, `scope`, `n` and
   `supporting_decision_ids` are untouched, and the evidence that produced it stays exactly as
   strong as it was.
3. **It cannot be un-retired by the system.** `saveClaim` refuses to take a claim off `retired`, on
   the precedent of `saveLearningRule` doing so "in all three implementations".
4. **A retired claim may not be tested.** `beginDrill` refuses it, as `preregisterLearningTransfer`
   already throws on a retired rule.

**Acceptance gets no new state, and that is a falsification result rather than a saving.** The
brief's requirement 6 is that acceptance creates or binds to a frozen prospective test. It already
does: the `StartedDrill` **is** the record of acceptance. It carries `claim_id`, `drill_id`,
`started_at` and `predicted`, it is written only in response to a human pressing a control, and
`ProductState.drill` already turns it into `continue-drill`. Adding an `accepted_at` beside a
`started_at` that means the same thing would fail F2 on its first review.

**Defer gets no state either, and this is the discrimination principle applied rather than
skipped.** Deferring would have to change some downstream reality-facing decision to be a state. It
does not: with no re-offer schedule in the product and no exposure counter on the record (D21
Finding 3, still open), "not now" and "not answered yet" license precisely the same next action —
propose it again next derivation. **Defer is the absence of an answer, not a third answer.** It
becomes a real state on the day something re-offers on a schedule, and D21's exposure schema is
what that day needs first.

So the vocabulary is **two answers and a silence**, not three states.

---

## E. STATE MACHINE

Only transitions that change what the system may legitimately do next.

```
                    detect + formHypothesis
                              │
                              ▼
                        ┌──────────┐
       no answer ──────▶│ candidate│◀──── (stays here; silence is not a state)
                        └────┬─────┘
                             │
              player says no │        │ player runs the drill
                             ▼        ▼
                       ┌─────────┐  ┌────────────────┐
                       │ retired │  │ drill in flight│
                       └─────────┘  └───────┬────────┘
                       terminal for                  │ finishDrill
                       proposals only                ▼
                                            ┌──────────────────┐
                                            │ replicated       │
                                            │ refuted          │
                                            └──────────────────┘
                                            terminal for truth
```

`retired` and `refuted` are both terminal for proposals and they are **not** the same edge:
`refuted` is a verdict the evidence produced, `retired` is a sentence the evidence never spoke.
Nothing may render them with one word, and `GRADE_WORD` is where that is held.

---

## F. TEST CONTRACT — what is already frozen

Audited rather than assumed. Phase C of the brief asked which of hypothesis, evidence boundary,
protocol and refutation condition the current forward test actually freezes.

| commitment | frozen where | how |
| --- | --- | --- |
| hypothesis | `DrillSpec.claim_id` | derived from the bucket, so a caller cannot re-derive a different one (`claim-grade-protocol.ts`) |
| direction | `DrillSpec.predicts_overconfidence` | `startDrill` throws `MissingClaimDirection` on a spec without it — "the sign is half the pre-registered term" |
| refutation condition | `DrillSpec.refutation_condition` | `startDrill` throws `MissingRefutationCondition`; `finishDrill` grades from the **stored** condition, not a fresh one |
| evidence boundary | `selectDrillPositions` | boards the player has **never decided**, keyed by position rather than by FEN, against the record and against the drill's own selection |
| protocol | `graded_under` + `decidesClaim` | a result from a protocol the claim does not require may speak and may not **close** |
| target n | `MIN_DRILL_POSITIONS` = 5, `MAX_DRILL_POSITIONS` = 8 | fixed by the selection, before any position is shown |

**The gap Phase C was looking for is not in the drill.** It is that the drill's boundary is
*generative*: a drill makes its own evidence, so novelty of position is a sufficient boundary and no
timestamp is needed. The contract for the other shape — a test that **reads normal play** — is
`TimedHoldout` in `validation-protocol.ts`, and it is fully specified:
`claimFrozenAt`, `eligibleProtocol`, `eligibleTimeControl`, `targetN`, `confirmAtOrAbove`,
`refuteAtOrBelow`, with `excludedBecause` naming four exclusions and a strict inequality whose
comment says why. **It has zero callers.** `evaluateHoldout`, `excludedBecause` and `claimFrozenAt`
are reached from nowhere in `shared/`, `client/src/` or `server/`.

That is a second finding, it is the same shape as D22's (a derivation that exists, is correct and
owns no screen), and **this node does not close it.** It is recorded in §M so the next node inherits
a fact rather than a rediscovery.

---

## G. ANSWERABILITY

The brief asks for a gate that prevents registering a test whose observations cannot discriminate
support from refutation. Three of them already exist, at three different depths, and adding a fourth
state would be redundant:

1. **`protocolFor` returns `null`** for a bucket nobody has classified, rather than naming the
   nearest protocol it does implement. A clock claim cannot be tested by a board.
2. **`isRegistrableBucket`** refuses a bucket the live loop can never fill — measured on
   `clock-under-1m` against a board that writes `clockMsRemaining: null` on every decision it will
   ever record. This is answerability in its strongest form: not "is the question meaningful" but
   "can this instrument ever produce the observation".
3. **`selectDrillPositions` returns a reason rather than a short drill**, because "a drill of two
   positions that reports a verdict is worse than no drill, the verdict looks like evidence".

So for the candidates reachable today, **answerability holds by construction** and is proved rather
than asserted: a `Claim` exists only for one of the six `BUCKETINGS`, every one of which
`classifyBucketKey` maps to `POSITION` or `ENVIRONMENT`, and both have a protocol.

**`UNANSWERABLE` is therefore not created.** It would be a pre-test failure, not a disposition, and
the product already renders that failure in the only place it can occur — `not-registrable` in
`PreregOutcome`, with `PreregisterBridge` already wording it. Inventing a fourth terminal state for
a condition three existing gates catch earlier would put a name on a state nothing can enter.

The one thing that is **not** proved and is stated instead: answerability is checked at step 7, after
the player has already pressed. `selectDrillPositions` can still return a reason at that point. That
is a legitimate late failure — whether enough fresh boards exist depends on the games loaded, which
is not knowable when the offer is made — and it is not repaired here because repairing it means
changing what is offered, which is a surface.

---

## H. EVIDENCE ADMISSION

Unchanged by this node, and restated because a reader has to be able to check that it is unchanged.

* Retrospective evidence **cannot** promote a claim: `evaluateClaim` folds only
  `ProspectiveDrillResult`, and `RetrospectiveEvidence` is what formed the hypothesis.
* A drill's evidence is admitted by **position novelty**, keyed by board.
* A result decides only under the protocol the claim requires (`decidesClaim`), except
  `LEGACY_VALIDATION`, which still decides — deliberately, because re-grading a verdict a player has
  already been shown is a worse failure than carrying an old one that is named as old.
* Retiring admits **nothing**. It writes one grade and touches no `supporting_decision_ids`, no
  `n`, no `prospective_tests`.

---

## I. DISPOSITIONS — what each one means, and what it does not

| disposition | means | does **not** mean |
| --- | --- | --- |
| `hypothesis` | the search separated something; nothing has tested it forward | that it is true |
| `replicated` | a forward test under the required protocol supported it | that the player improved, or that anything should now be practised |
| `refuted` | a forward test under the required protocol contradicted it | that the player failed. It is information, and it is terminal |
| `retired` | **the player has decided this question is not worth their effort** | that the claim is false, that the detector erred, or that the evidence weakened |

The fourth row is the whole node. The product must never render `retired` in words a reader could
take for `refuted`, and `GRADE_WORD` is the single place that can go wrong, so it is the single
place the test looks.

---

## J. NEXT-ACTION EFFECT

| claim state | `deriveNextAction` | why |
| --- | --- | --- |
| `candidate` | `test-claim` | unchanged: the offer stands while the player has not answered |
| `retired` | falls through to whatever else the record needs | `awaitsForwardTest` is false, so the instrument stops asking |
| drill in flight | `continue-drill` | unchanged, and it already outranks `test-claim` |
| `decided` | falls through | unchanged |

**The constitutional ordering is untouched.** `untestedRule` is still tested before `claimState`, so
a question the player wrote still outranks a question the instrument found. Nothing in this node
moves a rank; it adds a way for the instrument's question to leave the queue without being answered.

---

## K. SCENARIO WALK

All twelve, with the expected behaviour and where it is enforced.

| | scenario | expected | enforced by |
| --- | --- | --- | --- |
| S1 | candidate appears, player has not chosen | no test begins | nothing calls `beginDrill` but a human control; `deriveNextAction` proposes, it does not act |
| S2 | player accepts | exactly one frozen contract is created | `createDrill` + `startDrill`, both throwing rather than defaulting |
| S3 | player declines | epistemic state unchanged, no test begins, **the same offer stops** | `retireClaim` writes the grade and nothing else; `awaitsForwardTest` goes false |
| S4 | player defers | no false epistemic reading | **collapsed into S1 by §D.** Silence licenses the same next action as "not now" |
| S5 | accepted test receives more retrospective data | the claim is not promoted | `evaluateClaim` folds prospective results only |
| S6 | active test receives valid prospective evidence | only policy-admitted evidence may decide | `decidesClaim`, `graded_under` |
| S7 | test supports | the question resolves and stops being proposed | `claimStateOf` → `decided`; `awaitsForwardTest` false |
| S8 | test refutes | resolves, stops, no confirmation-seeking | `refuted` is terminal in the fold; `beginDrill` refuses it |
| S9 | not enough prospective evidence | no fake progress | `selectDrillPositions` returns a reason; `evaluateHoldout` refuses below `targetN` |
| S10 | evidence from an unrelated intervention | cannot leak | `evidence-policy.ts` strata; `discovery` admits `play` only (D28 tension 3) |
| S11 | the same candidate is reopened | idempotent | `saveClaim` refuses to take a claim off `retired`; the fold is a pure function of the results |
| S12 | player-authored rule and system candidate coexist | the player's outranks the instrument's | `untestedRule` is tested before `claimState` in `deriveNextAction`, unchanged |

---

## L. FALSIFICATION RESULTS

| | test | result |
| --- | --- | --- |
| F1 | existing objects can already represent ownership unambiguously → no `Question` | **fired. No `Question` entity.** `Claim` + `StartedDrill` carry every field one would need |
| F2 | acceptance adds no downstream distinction → do not persist it | **fired. No acceptance record.** The started drill is the acceptance |
| F3 | the prospective infrastructure cannot freeze the derivation boundary → do not call it a forward test | **did not fire.** It freezes it, by position novelty keyed on the board, and `finishDrill` grades from the stored condition |
| F4 | the candidate cannot specify a falsifiable prospective question → do not offer it | **did not fire**, and it is proved rather than asserted: see §G |
| F5 | a disposition that changes no future behaviour is not a state | **fired twice.** `defer` removed; `UNANSWERABLE` not created |
| F6 | the slice requires redesigning the Record page → the coupling is the problem | **did not fire.** Nothing here needs a screen; the coupling was already solved by D27 putting the claim layer into `ProductState` |
| F7 | it cannot be isolated from the FIELD stimulus → stop before product-surface implementation | **fired, and it binds.** See §M |

---

## M. FIELD FREEZE IMPACT

**Nothing in this node may reach production before the FIELD run completes, and the constraint is
stronger than "do not change a screen".**

The freeze is on the **built bundle**, not on reachability. `shared/claim-state.ts` is imported by
`client/src/lib/next-action-shadow.ts`, so a change to the claim layer moves `assets/index-*.js`
even though no participant can reach a claim inside a twenty-minute session. The pre-registration's
stimulus identity would move, and a session run against it would be a different study.

**FOUR CLIENT FILES ARE TOUCHED, AND THE FIRST DRAFT OF THIS SECTION SAID NONE WERE.** The plan was
to keep the change inside `shared/`; the compiler refused, and the refusal is the mechanism working
rather than an obstacle to it. `GRADE_WORD`, `GRADE_MEANING`, `GRADE_LABEL` and `GRADE_AUTHORITY` are
`Record<ClaimGrade, …>`, so widening the union makes every read site name the new member or fail to
build. That is precisely the property a `retired_at: string | null` field would have given up: an
optional field every existing reader may ignore is how `protocol_version` came to be *"stamped on
every row and read by nothing"* (D21 Finding 1) and how `quiet_window_exposure` was stored for a
release before `stratumKeyOf` read it. **The cost of the union is four compiler errors. The cost of
the field is a state nobody notices.**

What the four are:

| file | change | reachable at run time |
| --- | --- | --- |
| `client/src/components/ClaimCard.tsx` | one row in `GRADE_MEANING` | **no** — nothing can produce a retired claim |
| `client/src/components/Value.tsx` | one row in `GRADE_LABEL`, and the vocabulary copy replaced by an import | **no** |
| `client/src/lib/loop-position.ts` | a branch that does not point at the drill panel, and the vocabulary copy replaced by an import | **no** |
| `client/src/lib/local-record-store.ts` | the un-retire guard, matching both server stores | **no** — the guard only fires on a retired row |

**No control was added anywhere.** No button, no route, no menu item, no copy on a path a
participant can walk. `retireClaimById` exists in the service and has no caller outside tests, which
is the same shape D27 used for the derivation: the mechanism first, the screen after the run.

**THREE HAND-WRITTEN COPIES OF `CLAIM_GRADES` WERE FOUND ON THE WAY, and all three are gone.**
`loop-position.ts:54` and `Value.tsx:15` each declared `"hypothesis" | "replicated" | "refuted"`
beside the real union, and both read as exhaustive over a set that had grown. They are now
`export type { ClaimGrade } from "@shared/claim"`, type-only, so the bundle is unchanged by the
change itself. `claim-grade-protocol.ts` had already made the argument for the other union:
*"A second hand-written copy of these strings is how a schema and its type drift apart."*

So:

* `shared/` is touched, and that alone is sufficient to block the merge.
* A **database migration** is part of this node: `0020_absent_winter_soldier.sql` widens the
  `claims.grade` MySQL enum. It is additive and no row can carry the new value until a control
  exists, so it is safe to apply ahead of the code — and it must not be applied while a FIELD
  session is running, for the same reason nothing else may be.
* `EXPERIMENTAL_LEARNING_ENABLED` stays off. `ASK_RATE`, `PROBE_PROBABILITY`, the confidence timing
  and the counterfactual probability are untouched.
* The merge constraint: **after the last participant, not before.** There is no partial merge that
  is safe, because the bundle moves on the first `shared/` byte.

**Two gaps were found while walking the scenarios and neither is repaired here.** Both are written
down rather than left in the diff, because a mission that finds a defect and files it under future
work has hidden it.

**`R-31` — one claim can carry two live drills at once.** `startDrill` mints a fresh uuid on every
call and nothing asks whether the claim already has an unreported drill; the append-only guard the
stores carry is on the drill id, which a fresh uuid can never collide with. Two presses produce two
live forward tests of one question, and since `refuted` is terminal within the fold, the claim is
graded by whichever finishes first — a stopping rule chosen after the fact, which is exactly what
`validation-protocol.ts` refuses by name on the holdout path. It is not covered by a test here,
deliberately: a test that passes because the defect is present is a defect with a guard on it.
`docs/MASTER_PRODUCT_DEBT.md` carries it with its gate and its escalation condition.

The other open item this node hands forward is `TimedHoldout` (§F): the only contract in the repository
under which **normal play supplies evidence to a registered test**, fully specified, reachable from
nowhere. Wiring it is what makes the brief's "NORMAL PLAY PRODUCES PROSPECTIVE EVIDENCE" true for a
claim about a clock, and it needs a persisted holdout, an admission path off the ambient decision
stream, and a screen. All three are post-FIELD.

---

## N. DELIBERATELY NOT BUILT

Player-authored question creation. The Research Notebook and any Record-page redesign. Question
history, hypothesis library, timeline, archive browser, progress map, question graph. Adaptive
sampling. Adaptive prompt rate. Re-offer scheduling. Rewards, XP, avatar, map. Neural policy,
bandit, personalisation. A `Question` entity. An acceptance record. A `defer` state. An
`UNANSWERABLE` disposition. A progress counter of the form `37 / 60`.

`TimedHoldout` is not wired, and that is named in §M rather than left in this list, because it is a
gap somebody found rather than a thing nobody wanted.
