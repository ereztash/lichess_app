# Final verification

**Base:** `main` @ `a8e7e69d541c80a7bea9d9fc047745e3e3c1a089`
**Date:** 2026-09-14

---

## 1. `npm run verify` — exits 0

Every stage, on the merged tree:

```
check                               pass
check:control:inverted              pass  (the typecheck control is red, as required)
build                               pass
test              Test Files  311 passed | 6 skipped (317)
                       Tests  3376 passed | 38 skipped (3414)
gates                               47 gates: 47 pass, 0 fail, 0 not-measured
gates:controls                      47 gates: 0 pass, 47 fail, 0 not-measured
                                    All implemented controls went red.
bundle:budget                       within budget
bundle:budget:control:inverted      pass  (the budget control exceeds, as required)
verify:scope                        pass
```

**45 gates before, 47 after.** Both new gates have a positive control that is demonstrated red —
`GATE-SHADOW-SURFACE-LIVE` fails on a fixture instrumenting only one surface, with the message
*"SHADOW_SURFACES declares `post-game` and nothing instruments it"*, which is the product's actual
prior state; `GATE-CONTINUATION-OUTRANKS` fails on the ladder with the backlog check moved above
the run.

## 2. Bundle budget — measured, attributed, raised in the same commit

```
entry, raw               679.7 kB / 681 kB      (was 678.8 / 679)
entry, gzipped           212.6 kB / 213 kB      (unchanged ceiling — it was not crossed)
initial download, raw    772.9 kB / 774 kB      (was 772.0 / 772)
```

**Net cost of the whole change: +0.9 kB entry raw.** Three quarters of the first attempt was moved
out of the entry graph rather than paid for, and `scripts/check_bundle_budget.ts` carries the
line-by-line attribution:

| step | entry raw | Δ |
|---|---|---|
| the hook in `record-api.ts` | 680.8 | +2.0 |
| hook moved to `continuation-api.ts` | 680.6 | −0.2 |
| read moved out of `record-service.ts` | 679.7 | −0.9 |

The gzip ceiling does **not** move: 212.6 against 213 was not crossed, and a ceiling that has not
fired keeps its number.

## 3. Browser verification — **PARTIAL**, and executed

`tests/layout/a-walk-the-derivation-can-be-wrong-about.layout.test.ts`, real Chromium, phone
viewport, shipped bundle, empty profile:

```
the record page, empty:        proposes play-first-decision · offers play-first-decision · [unsound: unseenEvent]
the record page, one decision: proposes play-blitz          · offers play-blitz          · [unsound: unseenEvent]
```

**Executed: 2 of the 11 states Phase 17 asks for.** What was reached and what was not:

| State | Walked? | Why |
|---|---|---|
| cold entry | ✓ | stop 1 |
| first decision | ✓ | the walk records one |
| reveal | ✓ | the walk passes through it |
| return / resume | ✓ | stop 2 |
| record | ✓ | stop 2 *is* the record page |
| post-game | **NOT EXECUTED** | needs a blitz game played to completion in-browser |
| active drill | **NOT EXECUTED** | needs a claim at candidate grade, which needs `DISCOVERY_FLOOR` scored decisions |
| active transfer | **NOT EXECUTED** | needs an authored rule and a preregistered transfer |
| candidate claim | **NOT EXECUTED** | same floor |
| untested player rule | **NOT EXECUTED** | needs a reveal-and-reflect cycle |
| pending analysis | **NOT EXECUTED** | needs a game stored and the queue stopped mid-pass |

**The three unexecuted states that matter are the three that would exercise the new branches.**
`continue-drill`, `continue-transfer` and `test-hypothesis` are exactly the branches this work made
reachable, and none of them was reached in a browser. They are covered by unit and matrix tests and
by `GATE-CONTINUATION-OUTRANKS`; they are **not** covered by a walk.

That gap is not closed here and is not claimed to be. It is the first half of the next move in
`ARCHITECTURE_UI_AUTHORITY_TRANSFER.md` §6: the `continue-run` control has to exist before a walk
through a drill can read anything off the page anyway.

## 4. What the walk established that a unit test could not

Both stops **agree**, and both proposals are **unsound**.

Before this pass the walk printed two agreements and stopped there. It would have read as *the
derivation and the screen want the same thing* — true, and not the whole reading. Both answers rest
on `unseenEvent`, which outranks them and which nothing in the product writes.

**Two agreements, both unsound, is a different result from two agreements.** The walk now says
which one it found, and the `blind` column is why.

## 5. Scoreboard

| | before | after |
|---|---|---|
| Truthful canonical inputs | 7 / 11 | **10 / 11** |
| Routing surfaces instrumented | 1 / 3 | **3 / 3** |
| Derivation branches reachable in production | 8 / 12 | **11 / 12** |
| Proposals sound as shipped | 0 / 11 | **3 / 11** |
| Canonical next-action authority | NONE | **NONE** |
| Parallel policy engines | 4 | **3** |
| Hard-coded primary product actions on routing surfaces | 3 | **3** |
| Gates | 45 | **47** |

**Authority did not move, and the scoreboard is meant to show why that is a result rather than a
stall.** Three proposals now qualify; two of them name a control that two of the three routing
surfaces do not have. The blocker moved from *we cannot measure this* to *the product has no way to
say this*, which is a different and much more actionable sentence.

## 6. `FIELD_REQUIRED`

Untouched by this work and not closeable by it:

- whether a player notices the primary action;
- whether they understand it;
- whether they agree with its meaning;
- whether they know why it is next;
- whether they prefer the flow, or complete it;
- whether the **order** in `deriveNextAction` matches what a person would have wanted — `D22`
  reversal condition 3, which needs the acquisition trial.
