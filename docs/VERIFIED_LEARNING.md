# Verified learning loop

This slice turns an engine verdict into a testable, player-authored learning record. It does not
claim that an engine correction is learning, or that completing the flow improves chess strength.

## Evidence lifecycle

1. A `DecisionAtom` is committed before engine output and then revealed.
2. The player records a `ReflectionDelta`: a revised read and whether they would choose again.
3. The player authors a `LearningRule` with a trigger, mechanism class, missed signal, action,
   optional exception, predicted outcome, and an explicit refutation condition.
4. The rule starts as `hypothesis`. The app schedules retrieval after 1, 3, 7, and 21 days.
5. A transfer test is persisted before any position is shown. It contains exactly three unseen
   positions, the rule snapshot, and the refutation condition.
6. Before each decision the player recalls the rule without seeing its action text. After reveal,
   they report whether they applied it. **That report is recorded and is not part of the success
   condition** — see below.
7. A position succeeds when the recalled text clears `scoreRecall`'s word-overlap floor **and** the
   decision is accurate by the record's own rule, `accurateDecision`, which is win-probability loss
   against the evaluation the position stood at. A test is `observed` at
   `TRANSFER_MINIMUM_SUCCESSES = 2` successes of `TRANSFER_POSITION_COUNT = 3`.
8. Grading is symmetric. Successful tests on **two distinct dates** replicate the rule; failed tests
   on **two distinct dates** refute it. A rule that fails once stays in the queue and returns at the
   next retrieval interval.

> **What this paragraph used to say, and why it is written out rather than quietly corrected.**
>
> It said a position succeeds when "recall is non-empty, application is reported, and centipawn loss
> is at most 30", and that "fewer than two successes refutes the rule". Four claims, and every one
> of them named a rule the code had already left:
>
> - **"centipawn loss is at most 30"** is `ACCURATE_CP_LOSS`, the rule `shared/detector.ts` records
>   as abandoned: thirty centipawns is 2.76 points of winning chances at a level position and 0.28
>   at +10.00. `finishLearningTransfer` migrated to `accurateDecision`, and at an evaluation of
>   +10.00 the two disagree by 182 centipawns.
> - **"application is reported"** was never a success condition in the code. `applied_rule` is
>   stored and read by nothing that grades.
> - **"recall is non-empty"** is weaker than the shipped rule, which is a word-overlap floor.
> - **"fewer than two successes refutes the rule"** described the asymmetry that
>   `shared/learning-record.ts` was rewritten to remove: one bad sitting used to grade a rule
>   `refuted` permanently while replication needed two separate days.
>
> A document that describes a terminal grade by the wrong rule is worse than no document, because
> the grade it describes is one nothing can revive. `tests/shared/what-the-documents-still-say.test.ts`
> now holds this file and the code together.

Refuted and retired rules remain in the record. Authored text is append-only; grading and the
retrieval schedule are the only mutable fields.

## Measurement contract

The primary product metric is **verified transfer completion**:

`completed pre-registered transfer tests / learning rules whose retrieval date became due`

Supporting metrics:

| Metric                | Numerator                                  | Denominator                                               |
| --------------------- | ------------------------------------------ | --------------------------------------------------------- |
| Reflection activation | reveals followed by a saved rule           | persisted reveals where the composer was available        |
| Due retrieval start   | due rules for which a transfer was started | rules that became due                                     |
| Transfer success      | transfer results with `observed=true`      | completed transfer results                                |
| Delayed replication   | rules graded `replicated`                  | rules with at least two completed tests on distinct dates |
| Honest refutation     | rules graded `refuted` and retained        | completed transfer tests that failed preregistration      |

Every metric must report its denominator and sample size. None of these metrics means rating gain,
game-result improvement, or causal learning impact. Those require a separate longitudinal design
with a comparison condition and preregistered outcomes.

## Ownership and trust boundaries

- The API accepts player language only. `authored_by`, `grade`, schedules, successes, and
  `observed` are derived by the service and rejected if injected into strict request schemas.
- Rule creation is authorized only after the reveal is persisted, not merely rendered.
- Transfer FENs and the refutation condition are stored before the first test position is returned.
- Previously decided FENs and the source FEN are excluded from transfer selection.
- Local, in-memory, and MySQL stores enforce the same append-only contract.

## Deployment

The feature is enabled by default. Set the build-time flag below to disable its UI while retaining
the schema and APIs:

```bash
VITE_VERIFIED_LEARNING_ENABLED=false
```

For a MySQL-backed deployment, apply [`drizzle/0001_verified_learning.sql`](../drizzle/0001_verified_learning.sql)
before enabling the UI. Browser records migrate in place: the existing
`decision-lab.record.v1` object is merged with empty learning collections, so earlier decisions are
preserved.

## Current limits

- Transfer positions come from the game currently loaded in the client. They are unseen, but the
  first version does not yet rank them by semantic similarity to the rule trigger.
- `mechanism_class` is chosen by the player; the system does not pretend it inferred cognition
  from a move.
- Application is self-report combined with an outcome threshold. It is evidence, not direct access
  to the player's reasoning.
- There is no notification scheduler yet; due rules appear when the app is opened.

## Complexity audit

Complexity that serves the evidence contract:

- Separate decision, reveal, reflection, rule, preregistration, and result records prevent later
  evidence from rewriting earlier claims.
- One shared `RecordStore` and service layer keeps browser, memory, and MySQL behavior aligned.
- `Claim` and `LearningRule` remain distinct: the first is a system-derived population pattern;
  the second is language owned by the player. Merging them would erase provenance.

Complexity that should be reduced next:

- `client/src/pages/Home.tsx` coordinates game navigation, opponent search, reveal, drills, review,
  and learning transfer. Its state transitions deserve separate reducer-backed controllers once
  another workflow is added; adding more flags directly to the page will become unsafe.
- Browser persistence still uses a permissive v1 JSON merge. The next stored-shape change should
  introduce an explicit versioned parser and migration functions rather than extend the shallow
  merge again.
- MySQL migration application is manual. A deployment pipeline should track applied migrations
  before more evidence tables are introduced.
- Transfer selection currently proves novelty only. Semantic ranking by trigger and mechanism
  should be a separate, testable selector; it should not be folded into the UI or inferred from
  engine score alone.
