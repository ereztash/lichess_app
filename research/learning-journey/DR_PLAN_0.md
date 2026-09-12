# DR_PLAN_0 — frozen before external research and before the R&D run

Written 2026-09-12T10:45Z. Frozen at the hashes below. Nothing in this file was optimised by the
R&D Agent, by Neta, or by any external source; it is the analyst's pre-commitment, and the point of
freezing it is that the R&D run and the external search can be scored against what was expected
rather than against a plan rewritten to match what came back.

| pin | value |
| --- | --- |
| `lichess_app` working head | `2d7eebdec26a1d8406dac2a8286462fa1b91b186` |
| `lichess_app` `origin/main` | `f699b38b9b546ce32f1345bf6c60dbba922cfb30` |
| mechanism research head | `origin/claude/generalize-research-pipeline-75k53u` `fd3f8ca2a74e4783e9a6554261074c47bc55a933` |
| `Product-Perception-Sensemaking-Architect` working head | `619c23d39d10516d7e46b95324e26da4cb1a46d8` |
| PPSA `origin/main` | `5e156cd291da2eedfe415fd7340dcc545af44d1f` |

---

## 1. The exact decision

> What should the next product layer of Lichess App be, so that a player moves from a desired
> improvement goal, through personal diagnosis, into meaningful action and visible progress, without
> conflating effort, mastery, transfer, rating, statistical confidence and causal impact?

The decision is **which architecture**, and then **the smallest complete slice that makes it
perceptible**. It is not "should there be a progress bar".

## 2. Current state, verified rather than assumed

Verified by reading the repositories at the pins above, before writing this plan.

**The product already has most of a learning loop, in the data layer, and the user cannot see it as
one thing.**

| capability | exists? | where | visible as a journey? |
| --- | --- | --- | --- |
| decision committed before reveal | yes | `commitDecision` / `reveal` | yes, it is the core act |
| six-bucket pattern detector | yes | `shared/detector.ts`, `BUCKETINGS`, `MIN_BUCKET_N = 30` | as a claim panel |
| claim with scope + refutation condition | yes | `currentClaim`, `ClaimView` | yes |
| pre-registered narrowed search | yes | `registerHypothesis`, `PREREGISTERED_MIN_BUCKET_N = 20` | partly |
| drill on claim-matched positions | yes | `beginDrill` / `finishDrill`, `Bucketing.drillPhase` | yes |
| player-authored learning rule | yes | `createLearningRule` | yes, in `/play` |
| spaced retrieval queue with grades | yes | `learningRules`, `gradeLearningRule` | `LearningQueue` in `/play` |
| transfer test against a rule | yes | `beginLearningTransfer` … `finishLearningTransfer` | `LearningTransferRunner` in `/play` |
| rule refutation and retirement | yes | `retireLearningRule`, `refuted` grade | yes |
| one state representation of the loop | **partly** | `client/src/lib/loop-position.ts`, 4 steps: record → detect → drill → grade | one strip |
| **a goal** | **no** | nothing in `shared/` or `client/src/` carries one | no |
| **transfer as a distinct state in the loop** | **no** | `loopPosition` ends at `grade`; transfer is invisible to it | no |
| **an outcome series** | **written, read by nothing** | `ratingSeries` in `ImportGames.tsx` → `StoredImportDiagnostic.rating` | no |

So the mission's candidate chain is not absent. Its **middle** is built and its **two ends** are
missing, and the middle is not legible as one journey because `loopPosition` stops at `grade` and
knows nothing about rules, transfers or outcomes.

**The detector the product ships is not the detector the research validated.** This distinction is
load-bearing for every claim the UI is allowed to make:

- shipped: six fixed buckets (time, phase, clock), `MIN_BUCKET_N = 30` inside and outside, so 60
  revealed decisions before any claim is possible; `SEPARABILITY_K = 3.75`.
- research: a frozen pysubgroup beam search over an observable vocabulary with a same-rating
  population residual correction, requiring ≈1,786 admissible blitz games / 5,749 blitz VALIDATE
  decisions to be `RESIDUAL_POWERED`.
- the shipped detector **cannot register a separable bucket on the owner's whole 2,209-game record**
  (`not-separable`). The research pipeline **can** find a personal residual on that same record, and
  it survives its own within-game permutation null.

**What the research licenses, exactly.** From `REPLICATION_100_REPORT.md` at the research pin:

- `OBSERVATION` (REPO) reachable; `PREDICTION` (REPO) reachable; `SPECIFICITY` (RESEARCH) reachable
  only through the population baseline;
- **`CAUSALITY` (FIELD), `INTERVENTION` (OWNER) and `OUTCOME` (FIELD) are NOT reachable by this
  pipeline under any result.** "The claim ladder is unchanged by sample size."
- the 100-player cohort verdict is `UNDETERMINED` (a pre-declared red flag fired), and Amendment 1
  of the null-calibration prereg establishes the flag's *specification* was defective, not the
  instrument: the permutation false-positive rate is 3/4800 ≈ 0.06% and does not move with corpus
  size.
- still open (`Q2`): whether the discovery vocabulary's concentration (28.3% of candidates across
  100 players are the owner's own regions verbatim) is a property of the instrument or of the
  population. Unanswered, and it bears directly on whether "your pattern" is personal at all.

## 3. Claims that must be resolved before building

| id | claim | authority | why it blocks |
| --- | --- | --- | --- |
| C1 | The gap is information architecture, not missing learning machinery | REPO | decides build size: a new subsystem vs. making an existing one legible |
| C2 | A goal can be represented without the app claiming progress toward it | OWNER + REPO | the whole Nicolas signal turns on this |
| C3 | Transfer is separable from guided practice with data the product already has | REPO | decides whether TRANSFER is a real state or a label |
| C4 | Early value can be honest without pretending an immature signal is personal | RESEARCH + REPO | time-to-value |
| C5 | The seven waiting messages are one state shown seven times, not seven states | REPO | decides merge vs. reframe; one merge attempt was already refuted by tests |
| C6 | No architecture here may assert that using the app changes rating | RESEARCH | hard constraint, already established |

## 4. Hypotheses, stated before the evidence

- **H-A (favoured going in).** The decision is an information-architecture decision. The loop's
  states exist; the product shows them as unrelated surfaces. Adding GOAL at the front and
  TRANSFER/OUTCOME at the back of one existing state machine, and rendering it once, resolves more
  than any new subsystem would.
- **H-B.** The real blocker is time-to-value, not legibility: 60 revealed decisions is too far, and
  the layer that matters is the first session.
- **H-C.** The real blocker is that the product's unit of learning is a *bucket* and a player's is a
  *situation*; no presentation layer repairs that, and the answer is to port the research
  vocabulary into the product.
- **H-D.** Nothing should be built. The honest move is a FIELD test of the current build.

## 5. Candidate architectures

1. **Feedback-first** (incumbent). Observe → diagnose → show. No goal, no prescription.
2. **Goal-first.** Player states a target; everything is framed as distance to it.
3. **Managed-effort / program-first** (Nicolas's proposal). Goal → required work → feedback →
   progress, with a prescribed programme and a KPI.
4. **Pattern-centered learning loop.** The claim is the unit; evidence → practice → transfer are
   states of a claim, and the goal is context rather than a denominator.
5. **Anything stronger found externally.** Reserved.

## 6. Current default, and what reverses it

**Default: candidate 1 plus the two missing ends, built as information architecture (H-A).** Add no
global "% toward rating goal", no prescribed programme, no new training subsystem, and no causal
claim. Make the existing states one perceptible journey; let the goal be *aspiration and framing*,
never a denominator.

**Reversal condition.** Evidence that another architecture has materially higher decision value —
specifically: that a prescription the product can legitimately make exists (which today requires an
INTERVENTION claim the research explicitly cannot reach), or that legibility is not the binding
constraint because cold users already understand the journey and still do not continue.

## 7. Falsifiers, one per candidate

| candidate | what would falsify it |
| --- | --- |
| 1 + ends (default) | cold users can already state the journey, so legibility is not binding; or the states cannot be rendered without new data |
| 2 goal-first | a goal with no honest denominator reads as an empty promise, or displaces the decision the player is on |
| 3 managed-effort | requires prescribing work whose effect is unproven; the research forbids the INTERVENTION rung. Falsified unless a prescription exists that needs no causal claim |
| 4 pattern-centered | the product's claim rate is too low to carry a journey: a player who never gets a claim gets no product |
| 5 external | n/a until found |

## 8. External research families, with expected decision value

Declared before searching, so a branch that returns Δ0 is visible as a mispredicted branch.

| # | family | what it could change | expected decision value |
| --- | --- | --- | --- |
| E1 | Chess learning products (Lichess, Chess.com, Aimchess, Maia, ChessTraining.app, Listudy) | what "progress" is allowed to mean in this category; whether anyone separates mastery from transfer | **high** |
| E2 | Go (KaTrain, tsumego systems) | review → retry → play loops; local mastery vs global rank | medium |
| E3 | Riichi Mahjong (efficiency/safety analysers) | the context-check state: when locally suboptimal is correct | **high for C3/context**, low for layout |
| E4 | Xiangqi (ElephantChess etc.) | negative evidence: does analysis + puzzles integrate, or is integration left to the user | low-medium |
| E5 | Cross-ecosystem product convention (RU/JP/US/FR) | whether the learning loop is invariant and only the coaching surface varies | medium |
| E6 | Learning science (deliberate/retrieval/spaced practice, transfer, mastery learning, goal-setting, formative assessment) | which constructs the state machine must keep separate | medium; the product already implements spaced retrieval, so much of this is Δ0 by construction |

**Stopping rule for each branch:** if I cannot name the product decision that would differ, stop
reading that branch and record it as Δ0.

## 9. Stopping condition

Stop research when (a) the candidate ranking is stable under the last two branches examined, and
(b) the remaining uncertainty is a FIELD uncertainty — what a cold user understands — which no
further reading can resolve.

## 10. Build / no-build boundary

**May build** (reversible, OWNER authority): information architecture, copy, local data model
additions, components, tests, instrumentation, progressive disclosure.

**May not build without a new authority:** any surface asserting that app use changed rating; any
prescribed training programme presented as effective; any single number combining effort, mastery,
transfer or outcome; any change to the detector's statistical method; any destructive migration.

## 11. What this plan expects to be wrong about

Recorded so the R&D run can be scored. I expect H-A to survive and H-C to be the strongest
challenger. I expect E6 to be largely Δ0 because the product already implements spaced retrieval and
committed-answer retrieval practice without having read that literature. I expect the R&D run's main
contribution to be on the **goal** construct rather than on the architecture ranking.
