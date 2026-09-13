# Candidate architectures, and what killed each one

The matrix is not averaged. A candidate with a fatal epistemic defect loses to a candidate with a
lower mean, because the defect is what ships.

## The candidates

| # | name | unit of learning | unit of progress | denominator |
| --- | --- | --- | --- | --- |
| 1 | Feedback-first (incumbent) | a decision | none | none |
| 2 | Goal-first | a decision | distance to a rating target | rating points |
| 3 | Managed-effort / program-first | a prescribed exercise | programme completion + a KPI | exercises done, rating |
| 3p | **Procedural prescription** (split out of 3 by NETA) | a product commitment | what the product will do next and what it will then be able to say | none; it is a contract, not a measure |
| 4 | Pattern-centered learning loop | **a claim / a rule** | **state transitions of that object** | per state, its own |
| 5 | Ledger-first / time-to-value (SCAFFOLD D) | a committed decision | the decision itself | n = 1, stated |

## The matrix

Scored 0–3. `EPISTEMIC INTEGRITY` and `DEPENDENCE ON UNPROVEN CAUSAL CLAIMS` are not averaged with
the rest; they are gates.

| axis | 1 | 2 | 3 | 3p | 4 | 5 |
| --- | --: | --: | --: | --: | --: | --: |
| value comprehension | 1 | 3 | 3 | 2 | 2 | 2 |
| next-action clarity | 1 | 2 | 3 | 3 | 3 | 2 |
| time-to-first-value | 1 | 2 | 2 | 2 | 1 | **3** |
| motivation to continue | 1 | 3 | 3 | 2 | 2 | 1 |
| user ownership | 3 | 1 | 0 | 2 | 3 | 3 |
| personalisation depth | 2 | 1 | 2 | 1 | 3 | 0 |
| measurability | 1 | 1 | 2 | 2 | 3 | 2 |
| transfer measurability | 0 | 0 | 0 | 0 | **3** | 0 |
| implementation cost (3 = cheapest) | 3 | 2 | 0 | 2 | 2 | 3 |
| reversibility | 3 | 2 | 1 | 3 | 3 | 3 |
| compatibility with the shipped detector | 3 | 1 | 1 | 3 | 3 | 3 |
| compatibility with the current app | 3 | 2 | 1 | 3 | **3** | 3 |
| field-testability | 2 | 2 | 2 | 2 | 3 | 3 |
| **epistemic integrity** (gate) | PASS | **FAIL** | **FAIL** | PASS | PASS | PASS |
| **depends on an unproven causal claim** (gate) | no | **yes** | **yes** | no | no | no |

## What was falsified, and by what

**Candidate 3, managed-effort, in its efficacy register. FALSIFIED.**
It requires the product to say that doing the prescribed work improves play. The frozen research
states that `CAUSALITY` (FIELD), `INTERVENTION` (OWNER) and `OUTCOME` (FIELD) are unreachable by the
discovery pipeline **under any result**, and that the claim ladder is unchanged by sample size. E1
then shows the strongest commercial instance of this architecture making that claim anyway with no
sample sizes, no confidence intervals and no transfer evidence. Being common is not being licensed.

**Candidate 2, goal-first. FALSIFIED as an architecture, admitted as copy.**
Two independent failures. (a) NETA: *framing is not a state*. A state machine asserts that its
members are ordered and advance. A GOAL node whose only content is an aspiration either advances —
and then it has a denominator, contradicting the safeguard that created it — or it does not, and
then it is decoration inside a machine that implies progression. (b) The **implied denominator**:
rendering `1500 → 1800` beside a loop creates a perceived progress bar with no number in it.
`GATE-DENOM` catches a literal percentage in a paragraph; it cannot catch a denominator the layout
implies. "The goal is never a denominator" was a statement about the product's arithmetic, not about
the reader's.

**Candidate 5, ledger-first. SURVIVES, and is absorbed rather than chosen.**
Its claim — that the honest n = 1 value is the committed decision against the reveal, available on
the first position — is correct and is already what the product does. It is not an architecture; it
is the empty-state contract of one. Folded into the winner as the first-run behaviour.

**Candidate 1, feedback-first. SURVIVES, incomplete.**
Nothing in it is false. It stops at "here is what we found" and has no representation of what
happens next, which is exactly the missing user contract the mentor named.

**Candidate 3p, procedural prescription. SURVIVES, admitted, and not the architecture.**
NETA's split is real and is the only part of the mentor's signal that is licensed: *"here is what
this product will do with you next, and what it will then be able to say"* is a statement about the
product's own behaviour, resolvable by OWNER, requiring no INTERVENTION claim. It is a property the
winner must have, not a competing shape.

## The winner

**Candidate 4, pattern-centered, with 5 as its empty state and 3p as its voice.**

Three things decide it.

1. **The repository has already voted.** `currentClaim`, `registerHypothesis`, `beginDrill`,
   `createLearningRule`, `gradeLearningRule`, `beginLearningTransfer`, `retireLearningRule` are all
   scoped to a claim or a rule. Only `loopPosition` is scoped to the player.
2. **It is the only candidate that can measure transfer** (E6), because only it has an object whose
   trigger can be matched against later unprompted play.
3. **It needs no claim above the ceiling.** Every state is a REPO-countable fact about an object in
   the record.

## The correction the REPO check forced on the winner

Both peers argued that `loopPosition` is a lossy scalar reduction over plural objects with an
unnamed reduction rule. Checked at head `2d7eebd`, that is **half right, and the half matters**:

- **Claims are singular by construction and the reduction rule is already named and rendered.**
  `currentClaim` returns `claim: Claim | null` together with `othersWithheld: number`. The product
  already shows one and says how many it withheld.
- **Learning rules are genuinely plural and concurrent.** `learningRules` returns an array; each
  rule carries its own `grade` ∈ {hypothesis, replicated, refuted, retired}, its own
  `retrieval_step` and its own `next_due_at`.

So the cardinality mismatch is real **exactly where transfer would live**, and nowhere else. The
consequence for the build is sharper than "rewrite loopPosition": the player-scoped scalar stays,
because "what should I do now" is singular by nature; what must become plural is the **ledger of
what the system has learned**, which is a different question and today has no surface at all.
