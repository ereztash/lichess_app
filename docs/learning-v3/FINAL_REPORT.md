# Final report — closing the learning loop around the minimum information

## The outcome

```text
PRE-HUMAN GATES PASSED, ENDPOINT NOT REACHABLE
```

**None of Outcomes A–F is chosen, and this is not a dodge.** The nearest is **A**, and choosing it
would be wrong in a way that matters:

> **A — `PRE-HUMAN MEASUREMENT INVALID`.** *Meaning final action / trigger task cannot support the
> learning loop. Next step: process evidence.*

Both halves are false here. The final-action task **does** support the loop: Gate A returned
`A-REVISION` and Gate B returned `B-PASS`. And *"process evidence is the next research object"* is a
**forbidden claim** in this repository — `D25` tested process evidence against this exact failure and
found it *"worth exactly nothing on it"*, with a Bayes-optimal classifier separating the two
hypotheses at **0.500** on every observation set tried, including time, candidate sets, delayed
conditions and generic cues.

Choosing A would misattribute a feasibility failure to the instrument and prescribe a remedy the
repository has already refuted. So the outcome is stated as an addition to the tree, in the idiom
this repository uses when a verdict set misdescribes the evidence — the same move that produced
`C11`, `CONSTRUCT-UNDERIDENTIFIED` and `SEMANTICALLY-UNDERDEFINED`.

**What it means:** the measurement programme succeeded. The behaviour it was pointed at is too rare
and too cheap to be worth changing, on the one rule class that survived to be pointed at.

---

## 1. Current `main` SHA

`c848f244d380e13a8622c590791b22a2bef7a39b`. Work branch
`claude/repo-native-os-extraction-o1psvb`, restarted from it. `experiment/n-of-1-timing-policy`
untouched at `d1cdc02215ba6c56eb70b81fe4c907fe962793cf`.

## 2. Did Gate A pass?

**`A-REVISION`.** The ontology materially changed.

Not `A-PASS`: the historical candidate `RC-06` is `C11`-SATURATED, its response predicate branches on
its own trigger (asking *"no mate in one"* on `T+` and *"no check at all"* on `T−`), and a tenth of
its permitted moves lose the game outright.

Not `A-FAIL`: `RC-03` has zero regret on obeying, the lowest blunder share in the corpus, and
`RC-05`'s one permitted move costs nothing at the ninetieth percentile.

**Two things came out of it that were not asked for.** `engine_sensitivity` is closed for action-set
value stability — max |Δ| **0.0129**, mean **0.0052**, and all seventeen verdicts identical between
Stockfish 16 and the published 17.1. And the regret distribution across every permitted action,
which `b_valid` structurally cannot see: `RC-06` prescribes a median of **nine** moves and its p90
costs **1.0000** expected score.

## 3. Did Gate B pass?

**`B-PASS` for `RC-05 safe-promotion`, on a bank that is not the class.**

378 minimal functional twins, material and piece count moving by exactly zero, prescription size by
+0.0003. Contrast `regret_B` **−0.1088**, `advantage` **+0.1485**; on the 277 pairs whose halves are
worth *identically* the same to the engine it survives at full strength, and on the strictest subset
— one square moved, identical value, n=142 — it is **larger**. Against a matched sham that does not
flip the trigger, the difference of differences is **+0.1812** [+0.1431, +0.2192].

**And the bank is selected.** 49% of items admit no twin, and the half that does has piece-count SMD
**+1.263** and material SMD **−1.112** against the half that does not — where `GO_NO_GO.md` treated
**0.573** as disqualifying. Found by this cycle's own adversarial pass, after this file's first draft
said the difference *"may exist"* and declined to measure it.

## 4. First binding barrier

**Not a human barrier.** Barrier 3, content validity, in the specific sense that the rule is
**underdetermined by consequence**:

```text
trigger fires                                     0.206% of sampled positions
player declines                                   42.5%
declining costs >= 0.10 expected score             5.4%
                                                  ---------
a decision worth changing, per position            ~4.7e-5
```

Of the 148 real players who declined a safe promotion, **92.6% lost nothing at all** in expected
score. In centipawns it is a real error — **20.3% lost ≥ 100 cp** against 4.1% of those who
followed — but **83% of these positions are already won**, so material lost is rarely a game lost.

**A frozen falsifier fired.** `F-E5-c`, written before the repository was read and marked as one of
only three executable without participants, on evidence gathered after it was frozen.

## 5. Smallest supported user-facing packet

**None is supported.** `WHEN X → DO Y` is *expressible* for `RC-05` in its sharpest possible form —
`|B| = 1` on all 435 trigger-positive items, so the action is one specific move — and it is not worth
showing. `F-E1-c` did not fire; the packet's **form** survived and its **occasion** did not.

## 6. What information was proven unnecessary

Nothing was **proven** unnecessary, and saying otherwise would need the arm comparison that
`INTERVENTION_EXPERIMENT.md` records as `NOT ADMISSIBLE`. Two things were proven **unusable**:

* **A cue that requires an engine.** `GATE-CUE-PLAYER-OBSERVABLE` now refuses one, transitively.
* **`b_valid` as a safety statistic.** It reads the argmax. `RC-06` scores **.968** and its permitted
  set is the second worst in the corpus; `RC-21` scores **.172** and **53.2%** of that is items where
  obeying costs nothing.

## 7. What remains optional / trust-only

**`WHY YOU` is untested and is specified as separable by construction** — its own field, its own
falsifiers `F-E4-a/b/c`, and a required denominator with `causal_language: false` asserted. Whether
it is a learning mechanism or a trust layer is exactly what was not measured, and `E4` says it *"has
not been established as causally necessary"*. That remains the position.

**The instrumentation layer is available by disclosure and is not presumed necessary.** That is repo
law already — LAW 6, `GATE-DECISION-FOCUS` — and this cycle neither strengthened nor weakened it.

## 8. Exact natural-retest endpoint

```text
primary     ΔP(Y | X)      the action, given the cue, on an uncued natural opportunity
mandatory   ΔP(Y | ¬X)     the same action when the cue is absent
```

Reported against the **move-blind floor**, never against zero: an agent picking uniformly among legal
moves scores *d′* **0.80** and *c* **+0.88** on `RC-06`'s own prescription sizes, so more than half
of the lowest rating band's measured *d′* of 1.180 needs no knowledge of chess.

The second term is not optional and is a required field on the retest type, so it cannot be omitted
later by forgetting.

## 9. What can falsify the intervention

`FALSIFICATION_REGISTER.md`, frozen before the audit, 13 rows for `E1`–`E5` and 3 for the candidate.
Dispositions:

| | count | |
| --- | --- | --- |
| **EXECUTED — REFUTED** | **1** | `F-E5-c`: opportunities too rare and too cheap on `RC-05` |
| EXECUTED — NOT REFUTED | 2 | `F-E1-c` the unit is expressible; `F-E3-b` the cue needs no engine |
| NOT EXECUTABLE | 13 | every one needs participants |

**Three of three executable falsifiers ran and one fired**, without a participant. That is what the
register was written for.

## 10. Code and PR

[ereztash/lichess_app#66](https://github.com/ereztash/lichess_app/pull/66), draft.

**Shipped into the product's machinery: one gate.** `GATE-CUE-PLAYER-OBSERVABLE`
(`scripts/cue-scan.ts`) with a three-trigger positive control that fires on the transitive case a
declaration-only scanner would pass.

**Everything else is research and documents:** eight Python instruments under
`research/learning-v3/`, a content-addressed corpus of **70,258 evaluations** (4.3 MB, re-hashed by
`GATE-RESEARCH-RECONCILED` on every gate run), and thirteen documents under `docs/learning-v3/`.

**No production behaviour changed. No flag flipped. No surface added. No research history rewritten.**

## 11. CI and gates

`npm run check` clean · **32/32 gates pass, 32/32 controls red** · **2,931 tests pass, 33 skipped**
(the three suites that refuse rather than pretend without `DEPLOYED_ORIGIN` / `DATABASE_URL`) ·
build clean · bundle within budget · both inverted controls fail as required.

## 12. Before a real user can be recruited

1. **`C12` over all seventeen classes** — *what did declining cost?* One search per trigger-positive
   item with a recorded move, ~4,000 searches, a fifteenth of what this cycle spent. It is the
   measurement that decided this cycle and no class has it but `RC-05`.
2. **A twin bank for whichever class survives**, with the twin-able/not-twin-able balance measured
   this time rather than asserted.
3. **The true per-game opportunity rate**, scanning every ply rather than three per game. No engine,
   no participants, and no protocol can size itself without it.
4. **Study D**, which needs people.

`RC-02 recapture` is the obvious first look: `C11` MEASURABLE, base rate **12.2%** — sixty times
`RC-05`'s — unaided human rate **.769**. Its permitted set is the caution: p90 regret **0.5127**.

## 13. Before any claim of learning is allowed

* **Level 3 or above** on the outcome hierarchy: the player detects `X` without a rule-specific cue
  and chooses `Y`. Nothing here reached Level 2.
* **The trigger-negative term reported beside it.** A rise in both is `CRITERION_SHIFT`.
* **A non-saturated noise cell.** Under a saturated one the two hypotheses are observationally
  equivalent to a classifier handed the truth — 0.500, re-derived in this cycle and matching the
  published output on all 122 values.
* **`mayPrescribe` at `tested`**, which requires a forward test that could have come back negative.
* **A fix for `finishLearningTransfer`**, which currently scores rule use as engine agreement.
  Unreachable today because the flag is off; a blocker the moment it is not.

---

## What this cycle actually established

1. **The pre-human gates work.** They reached a stop condition without recruiting anybody, which is
   what they are for.
2. **The measurement model changed**: eligibility is `C11` plus the permitted-set regret
   distribution, not `A1–A5` binding on a gate whose floor sits above its ceiling.
3. **Natural-cell separation understates rule classes with local triggers.** `RC-05`'s advantage is
   −0.0141 in the natural corpus and +0.1812 against its sham. A class may not be retired on a weak
   natural separation alone.
4. **The repository reached `E2` independently** and states it better than the external prior:
   *"an authored trigger must name something the player already looks at while choosing a move"* —
   and then names its own vocabulary as failing it.
5. **The product scores rule use as engine agreement**, which its own knowledge map lists as a
   failure mode. Found, recorded, deliberately not fixed in the same pass as the measurement model.
6. **An hour of Stockfish became an asset**: one gate verdict, one gate control, one closed research
   blocker, three datasets, four engine-free pre-screens, and a cache that has already saved 2,268
   searches.

---

> **The player should see only the information required to change the next decision; the repository may retain everything required to justify, test, and reverse that information.**
