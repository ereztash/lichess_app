# TARGET 5 — blocking-check falsification coverage

| | before | after |
| --- | ---: | ---: |
| blocking CI steps | 10 | **12** (two are the new controls) |
| classified by what can falsify them | **0** | **12** |
| with a mechanism runnable in this repository | **2** | **3** |
| steps whose control is the step itself | 1 | **3** |
| where a synthetic control would prove something else | — | **2**, named |

---

## 1. The rule that was never applied to the job that runs the rules

`RNL-04` says a gate that has not demonstrated failure is not a gate, and `npm run gates:controls`
proves it for thirty-one predicates. The study found the rule had never been turned on
`verify-build.yml` itself: of ten blocking steps, **two** could demonstrate their own failure.

## 2. Why the fix is not "give all eight a fixture"

The study named the counter-example: `npm audit` fails when a real advisory is published against a
dependency this build ships. A synthetic vulnerability would assert that npm can read a manifest it
was handed, which is a claim about npm rather than about this repository's exposure.

> **A control that proves the wrong thing is worse than an absent one, because it looks like
> coverage.**

So the deliverable is the **classification**, and only one of its five kinds is a fixture.

## 3. The inventory, derived on every run

`npm run falsification` reads the steps out of the workflow file. Nothing is transcribed.

```
step                                        kind                           runnable here
Install dependencies                        TOOL_SELF_TEST                 -
Audit the dependencies this build ships     NO_HONEST_SYNTHETIC_CONTROL    -
Install Chromium for the layout tests       EXTERNAL_CONDITION             -
Typecheck                                   SYNTHETIC_CONTROL_APPROPRIATE  npm run check:control
Typecheck positive control (must fail)      TOOL_SELF_TEST                 -
Build the database schema                   HISTORICAL_DEFECT_FIXTURE      -
Build                                       TOOL_SELF_TEST                 -
Test                                        NO_HONEST_SYNTHETIC_CONTROL    -
Gates                                       SYNTHETIC_CONTROL_APPROPRIATE  npm run gates:controls
Gate positive controls (each must go red)   TOOL_SELF_TEST                 -
Bundle budget                               SYNTHETIC_CONTROL_APPROPRIATE  npm run bundle:budget:control
Bundle budget positive control (must fail)  TOOL_SELF_TEST                 -
```

### The two new fixtures

**`npm run bundle:budget:control`** — `G-02`'s named gap, closed. `check_bundle_budget.ts` gained a
`BUNDLE_ROOT` that exists for this and nothing else, and `tests/fixtures/bundle` holds an entry
chunk one kilobyte over the ratchet with an `index.html` that eagerly preloads the engine. It
catches **both** halves:

```
BUDGET EXCEEDED
  - entry, raw: 679.9 kB exceeds 678 kB
  - index.html eagerly fetches the engine (stockfish-FIXTURE.wasm): R3 requires it to be reached
    only when a reveal asks for it
exit=1
```

**`npm run check:control`** — a green typecheck and a typecheck that is not running look identical
from outside. `tests/fixtures/typecheck/` assigns `"mostly-replicated"` to `LearningRuleGrade`, the
closed union the whole learning fold turns on, and `tsc` rejects it (`TS2322`, exit 2).

Both are now **blocking steps in CI with inverted exits**, so a control that starts passing fails
the job.

### The two that keep `NO_HONEST_SYNTHETIC_CONTROL`, and what is done instead

| step | why no fixture | what is done |
| --- | --- | --- |
| **`npm audit`** | a fabricated advisory tests npm, not this build | the step is *scoped* so its failures mean something: `--omit=dev` because a vulnerability in vitest reaches nobody, `--audit-level=high` because a step that fails on every low advisory is disabled within a month. `Q36` records the matching capability gap: it detects a problem and prescribes no response |
| **`npm test`** | `G-10`. A control for the suite as a whole is a mutation run, and there is none | 31 gate predicates with fixtures, plus a disagreement fixture per repair — the learning queue's is **verified to fail against the pre-change read path** |

Both absences are recorded rather than papered over. The repository has logged at least five cases
of a test passing *because of* a defect (cycles 7, 13 twice, 39, 40), so `npm test`'s missing
control is a real gap and stays visible.

## 4. The inventory cannot fall behind

`GATE-FALSIFICATION-INVENTORY` checks both directions:

- a **blocking step with no row** — the ordinary way coverage rots;
- a **row naming a command that does not exist** — the more dangerous direction, because it claims
  coverage it does not have.

`tests/fixtures/falsification/` carries one of each.

```
npm run gates            31 gates: 31 pass, 0 fail, 0 not-measured
npm run gates:controls   31 gates: 0 pass, 31 fail -- all controls went red
```

## 5. A defect this target found in itself

The first version matched a step to its row by the first substring hit, so
`Typecheck positive control (must fail)` matched the row for `typecheck` — and the inventory
reported the **control** as having a runnable control of its own. Fixed by matching the longest
pattern, which is the only ordering that does not depend on where a row sits in the array.

## 6. What this does not establish

- **That every blocking check will catch the defect it is aimed at.** Three can demonstrate a
  failure on demand; the rest rest on a tool's own contract or on a preserved historical defect.
- **That `npm test` is sound.** It is the largest check in the job and it has no systematic control.
  That is `G-10`, it is unchanged, and it is the most valuable remaining piece of this target.
- **That the classification is right.** It is a judgement about what would be honest evidence, and
  the gate checks that a classification *exists* and that its named mechanism *runs* — not that it
  was the correct call.
