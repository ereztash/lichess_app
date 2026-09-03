# Gate A — action-set validity

**Outcome: `A-REVISION`.** The ontology materially changes. The class this programme was built
around is out on a criterion the repository invented after building it, the two classes that survive
were both graded *"fails A5"* under the old screen, and the column that separates them is one nobody
had computed.

**Nothing here is a pass for a human study.** `A-REVISION`'s instruction is *"update the measurement
model before continuing"*, and §7 says what the update is.

---

## 1. What was run

| | |
| --- | --- |
| corpus | `lichess_db_standard_rated_2013-01.pgn.zst`, **md5 `46fa4bf93894234017be96eed030e7b2`**, 17,761,302 bytes — byte-identical to the published corpus |
| scan | reproduces the published manifest **exactly**: 60,834 games seen, 60,000 used, 180,000 positions, 12,119 in check, **580,852 records**, identical trigger counts on all seventeen classes |
| engine | **Stockfish 17.1**, `stockfish-ubuntu-x86-64-avx2`, 200,000 nodes, `Threads 1`, `Hash 64` — **the published build, on this instrument for the first time** |
| instrument | `research/measurement/action_set.py`, **unchanged**. Same seed `20260831`, same sampler, same 250 per cell, same per-candidate in-check exclusion |
| scale | expected score (`xs`) primary, centipawns kept and never averaged across items containing a mate |
| result | **8,307 items, 48,155 searches, 0 engine failures** — the same item count and the same search count as the published run |
| verdicts | derived by `research/measurement/decide_action_set.py`, **unchanged**, not by this document |

Two things are new. Everything else is deliberately identical, so that a difference is a difference
in the engine or in the question and not in the protocol.

---

## 2. New thing one: the engine. `engine_sensitivity` is closed for this instrument

`docs/measurement/ACTION_SET_MODEL.json` carries its own `provenance_warning`: it ran on **Stockfish
16**, because 17.1 could not be obtained at the time. `STRONGEST_PERMITTED_CLAIM.json` lists
`engine_sensitivity` among the seven unresolved items and says exactly what is untested:

> *"top-1 `b_valid` agrees between SF16 and SF17.1; **action-set value stability**, node/depth
> stability and WDL-model sensitivity are untested"*

Action-set value stability is now tested. Across all seventeen classes, chance-corrected separation:

```text
max |Δ|   = 0.0129        (RC-08)
mean |Δ|  = 0.0052
```

| | Stockfish 17.1 | Stockfish 16 |
| --- | --- | --- |
| ceiling anchor `RC-00` | **+0.3433** | +0.3445 |
| refuted floor `RC-01` | **+0.5689** | +0.5641 |
| `RC-06` | +0.3792 | +0.3911 |
| `RC-05` | +0.0623 | +0.0637 |
| `RC-21` | +0.0165 | +0.0170 |

**All seventeen verdicts are identical.** `decide_action_set.py` returns the same gate string for
every class, the same empty eligible set, the same `recommended: None`, and the same
`demoted_by_decision_model: ["RC-06"]`. `b_valid | T+` agrees to within a few thousandths where it
was checkable: `RC-06` **.968 / .968**, `RC-03` .956 / .964, `RC-05` .512 / .520.

**What this closes and what it does not.** It closes *action-set value stability between these two
builds at this node budget*. It does not touch node/depth stability, and it does not touch WDL-model
sensitivity — though the preserved corpus makes the second free, because the cp column is kept and a
different mapping is post-processing (see `COMPUTE_VALUE_EXTRACTION.md`).

**The anchor inversion reproduces.** The ceiling scores **below** the floor under the published
engine too. `a5_on_expected_score` — the repository's own refutation of `A5` as a gate — is therefore
not an artefact of Stockfish 16.

---

## 3. New thing two: the regret distribution across every permitted action

Gate A's specification asks for it in words:

> *"Also describe the distribution of regret among **all** legal actions satisfying B. A rule is not
> safe merely because one B-action is excellent if many B-actions are bad."*

The published model answers with two numbers per class — the worst member, and the share of items
whose worst member blunders. The per-item MultiPV over B has always been in the raw rows as
`within_b`; it was never pooled. **A player is taught a set. What they may pick from is the
distribution, not its extremes.**

Regret of a permitted move, in expected score, pooled over every member of B on every T+ item.
`safe` is the published convention: the share of permitted moves within 100 cp of best.

| id | C11 | median | p75 | **p90** | max | mean share of an item's B that blunders | safe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **RC-05** safe-promotion | MEASURABLE | 0.0000 | **0.0000** | **0.0000** | 1.0000 | 0.152 | **.848** |
| RC-03 capture-the-checker | MEASURABLE | 0.0000 | 0.0074 | 0.1249 | 0.9975 | **0.109** | .853 |
| RC-01 loose-piece *(refuted floor)* | VACANT | 0.0000 | 0.0025 | 0.1124 | 1.0000 | 0.180 | .804 |
| RC-14 capture-the-mating-piece | VACANT | 0.0000 | 0.0000 | 0.1847 | 1.0000 | 0.262 | .719 |
| RC-13 underpromote-to-knight | MEASURABLE | 0.0000 | 0.0000 | 0.5000 | 1.0000 | 0.619 | .346 |
| RC-02 recapture | MEASURABLE | 0.0000 | 0.0800 | 0.5127 | 1.0000 | 0.343 | .664 |
| RC-21 push-the-unstoppable-passer | MEASURABLE | 0.0000 | 0.0365 | 0.6319 | 1.0000 | 0.566 | .414 |
| RC-07 answer-the-queen-threat | VACANT | 0.0005 | 0.3713 | 0.6485 | 1.0000 | 0.506 | .466 |
| RC-09 answer-the-minor-threat | VACANT | 0.0025 | 0.3975 | 0.8773 | 1.0000 | 0.465 | .482 |
| RC-18 move-the-piece-that-must-move | VACANT | 0.0695 | 0.4960 | 0.8873 | 1.0000 | 0.644 | .351 |
| RC-11 move-the-threatened-minor | VACANT | 0.0240 | 0.4975 | 0.9058 | 1.0000 | 0.630 | .373 |
| RC-04 save-the-attacked-piece | MEASURABLE | 0.0145 | 0.5040 | 0.9990 | 1.0000 | 0.673 | .310 |
| RC-20 defend-the-piece-in-place | VACANT | 0.0208 | 0.5005 | 0.9995 | 1.0000 | 0.711 | .261 |
| **RC-00 mate-in-one** *(ceiling)* | MEASURABLE | 0.0000 | 0.9325 | **1.0000** | 1.0000 | 0.461 | .484 |
| **RC-06 answer-the-mate-threat** | SATURATED | 0.0005 | 0.5000 | **1.0000** | 1.0000 | 0.623 | .287 |
| RC-08 answer-the-rook-threat | VACANT | 0.0000 | 0.4835 | 1.0000 | 1.0000 | 0.527 | .415 |
| RC-12 stop-the-promotion | SATURATED | 0.0000 | 0.4980 | 1.0000 | 1.0000 | 0.506 | .421 |

Read the **p90** column. A regret of 1.0000 in expected score is the whole game: a permitted move
that turns a win into a loss.

**`RC-05`'s column is perfect and it is also trivial, and the second half of that sentence was
missing from the first version of this file.** `|B| = 1` on **every one of its 435 trigger-positive
items**, because the trigger requires all queen promotions to go to a single square and `satisfies`
is `move.promotion == QUEEN`. There is exactly one permitted move, so the per-action distribution
*is* the per-item `regret_B` distribution and says nothing `regret_B` did not.

What the column does say about `RC-05` is the true and smaller claim: **its one permitted move costs
nothing at the ninetieth percentile**. What it does not say is that a permitted *set* is safe
throughout, because there is no set. `ADVERSARIAL_PASS.md` A-2 is where this was caught.

The column is not trivial elsewhere: **`RC-06`'s median `|B|` is 9** and only 3.6% of its items have
a singleton, `RC-00`'s median is 3, and `RC-03`'s is 1 with 55.6% singletons. For those classes the
distribution is a genuinely independent question, and it is where `RC-06` fails.

**Five classes have a p90 of 1.0000**, and one of them is the **ceiling anchor**. That is not a
surprise once `RC-00`'s own `scope_claim` is read — its `satisfies` is *"gives check"*, not *"gives
mate"*, and the class says so and even predicts the number this run reproduces:

> *"`satisfies` is `gives check`, which is wider than the name — but that is the prescription's
> breadth, not a condition the trigger claims and skips, and it shows up in robustness (**48.2%** of
> permitted moves safe)"*

Measured here: **.484**. The class predicted its own robustness figure and the published engine
confirms it.

**`RC-06` is the case the whole programme was built on**, and its permitted set is the second worst
in the corpus: a tenth of the moves that "answer the mate threat" lose the game outright, 62% of an
average item's permitted set blunders, and only 28.7% of permitted moves are safe.

---

## 4. Why every class still reads `fails A5`, and why that is not a finding

`A5` asks whether a candidate out-separates `RC-01`, the refuted incumbent. Under this instrument
the ceiling does not out-separate the floor — **+0.3433 against +0.5689** — so the interval the gate
measures against is inverted, and every candidate fails a comparison against a rule class the
repository has already shown to be uninterpretable.

This is `STRONGEST_PERMITTED_CLAIM.json`'s `a5_on_expected_score`, reproduced on the published engine:

> *"`A5_beats_incumbent` is a gate on the expected-score scale… The ceiling anchor RC-00 mate-in-one
> scores +0.344 where the refuted floor RC-01 scores +0.564. **status: refuted.**"*

**The gate is reported unchanged and its result is not used.** `PRE_HUMAN_GATES.md` forbids
introducing a numerical acceptance threshold in Gate A, and removing a gate to obtain a pass would be
the same act in the other direction. `A5` fails for seventeen of seventeen; the repository has
published why that failure is about the scale rather than about the classes; both facts stand
together.

---

## 5. The two criteria that do bind

`C11` and the robustness distribution are the criteria that survive. Crossing them:

```text
                     p90 permitted-action regret
                     0.00        ≤0.20        >0.20
C11 MEASURABLE     RC-05        RC-03        RC-02  RC-04  RC-13  RC-21  RC-00*
C11 VACANT           —          RC-01* RC-14  RC-07 RC-08 RC-09 RC-11 RC-18 RC-20
C11 SATURATED        —            —          RC-06  RC-12
                                                            * = anchor, not a candidate
```

**Two candidates occupy the top-left region: `RC-05` and `RC-03`.** Neither is `RC-06`.

### `RC-05 safe-promotion` — safe, and barely necessary

| | |
| --- | --- |
| regret of obeying, T+ | +0.0383 |
| regret of obeying, T− | +0.1265 |
| **separation of regret** | **+0.0882** — obeying is cheaper when the trigger fires |
| advantage, T+ | **−0.0141** — the best permitted move is *worse* than the best forbidden one, on average |
| chance-corrected advantage, T+ | +0.1187 |
| separation of chance-corrected advantage | **+0.0623** — third-lowest of seventeen |
| `b_valid \| T+` | .512 |
| prescription size | .053 (T+) / .051 (T−) — **the same on both cells** |

`action_set.py`'s own docstring names this shape exactly: *"A rule class with `regret_B` = 0 on every
item and advantage = 0 on every item is perfectly safe and teaches nothing — it permits the best move
and so does everything else."* `RC-05` is not quite that, but it is nearer that pole than any other
class. **In the natural corpus it looks safe and nearly worthless.**

Gate B changes that reading, and §6 of `EXCHANGEABILITY_AUDIT.md` is where it changes.

### `RC-03 capture-the-checker` — safe and necessary, and its trigger is not a discrimination

| | |
| --- | --- |
| regret of obeying, T+ | +0.0000 |
| chance-corrected advantage, T+ | +0.3835 |
| separation of chance-corrected advantage | +0.1457 |
| p90 permitted-action regret | 0.1249, mean blunder share **0.109 — the lowest in the corpus** |
| prescription size | **.543** (T+) |

It is the only class that is both safe throughout and clearly worth obeying. And it is unusable as a
learning target for a reason that is not statistical: **its trigger is "you are in check"**. There is
no recognition step to teach. `ANCHOR_REBUILD` already quantified the rest — chance separation .147
against a corrected .109, *"the published trap, quantified: most of its apparent separation is
geometry"* — and its prescription covers **more than half the legal moves**.

---

## 6. What was attacked and did not break

| attack | result |
| --- | --- |
| *the difference is the engine* | 17/17 verdicts identical, mean \|Δ\| 0.0052 |
| *the difference is the protocol* | same seed, sampler, sample size, exclusions; same 8,307 items and 48,155 searches as the published run |
| *the robustness column is a new threshold in disguise* | no cut is applied anywhere; the full quantiles are published and the verdict function is the frozen one |
| *`RC-05` wins because its B is tiny* | prescription size .053, and the chance control is size-matched per item; its chance-corrected advantage is reported and is small |
| *the corpus is a different draw* | manifest reproduces exactly on all seventeen trigger counts |

---

## 7. Verdict, and what the revision is

```text
A-REVISION
```

Against the mission's three outcomes:

- **not `A-PASS`.** The relevant candidate was `RC-06`, and it is not separable in the sense that
  matters. `C11` grades it SATURATED, its response predicate branches on its own trigger, its
  symmetric separation is **−0.048**, and a tenth of its permitted moves lose the game.
- **not `A-FAIL`.** The final action *can* identify rule-consistent behaviour: `RC-03` has zero
  regret on obeying, +0.3835 chance-corrected advantage and the lowest blunder share in the corpus,
  and `RC-05`'s permitted set is safe at the ninetieth percentile. *"The final move is insufficient
  in general"* is a forbidden claim in this repository, and this run gives no reason to make it.
  (`A-FAIL`'s prescribed remedy — move to process evidence — is itself forbidden here: `D25` tested
  it and found it *"worth exactly nothing on this failure"*.)
- **`A-REVISION`**: *"previously rejected classes become viable or the ontology materially changes."*
  Both halves happened.

**The revision, stated as the measurement model it replaces:**

| was | is |
| --- | --- |
| eligibility = `A1–A5`, binding on `A5` | `A5` is refuted on its own scale and binds nothing. Eligibility is **`C11` ∧ the permitted-set regret distribution** |
| a class is safe if `b_valid` is high | `b_valid` reads the argmax. `RC-06` scores **.968** and its permitted set is the second worst in the corpus. Safety is a property of the **distribution over B** |
| the candidate is `RC-06` | the candidates are **`RC-05`** and, with a caveat that disqualifies it as a learning target, `RC-03` |
| the floor is `RC-01` | the floor is `CHANCE`, per `ANCHOR_REBUILD`; `RC-01`'s zero exists by construction |

**What may not be concluded from this file.** That `RC-05` is a good rule to teach — §5 says it is
nearly costless *and* nearly pointless in the natural contrast, and Gate B is where that is settled.
That any of it is exchangeable — untouched here. That any human would recognise the cue —
`GATE-CUE-PLAYER-OBSERVABLE` does not exist yet and `RC-05`'s trigger, *"a pawn can promote to a
square nothing attacks"*, has not been shown to be recognisable without being told.

**Data:** `research/learning-v3/results/gate_a.json`, `action_set_sf171.json`,
`action_set_model_sf171.json`. Every underlying evaluation is preserved and content-addressed in
`research/learning-v3/corpus/`.
