# What the engine run bought, beyond the gate it was run for

**54,959 Stockfish 17.1 searches at 200,000 nodes each. About 11.0 billion nodes, an hour of
four-way CPU, and 0 engine failures.**

A gate verdict is a few bytes of that. This file is the audit of everything else it bought, and —
more usefully — of what it did **not**, so that the next engine run is justified by a named gap
rather than by habit.

**Nothing here required a new search.** Every number below is a re-read of the frozen corpus.
`ACTION_SET_AUDIT.md` and `EXCHANGEABILITY_AUDIT.md` are preserved separately and unchanged; where a
derived artifact disagrees with them, the disagreement is the finding.

---

## 1. What is preserved, and at what granularity

| | |
| --- | --- |
| evaluations | **70,258**, content-addressed |
| distinct positions | **8,021** |
| items, with provenance | **9,441** — 8,310 natural, 378 minimal twins, 378 sham controls, 375 re-scored sources |
| committed size | **4.29 MB**, zstd-19 — about **12,800 searches per megabyte** |
| checked by | `GATE-RESEARCH-RECONCILED`, on every `npm run gates`. Verified by tampering: the gate names the file and both hashes |

Per **(position, move)**, for every member of `B`: a real evaluation, in centipawns and expected
score, with its rank inside `B`. Per position: the full-width search, its best move and the
position's value. Per **(position, move set)**: root-restricted maxima for `V_B`, `V_notB` and the
two halves of the size-matched chance partition.

### The identity, and why the policy is part of it

```text
move  sha256("move|" + fen + "|" + uci + "|" + build + "|" + nodes + "|" + policy)
set   sha256("set|"  + fen + "|" + ",".join(sorted(uci)) + "|" + build + "|" + nodes + "|" + policy)
```

`policy` is one of `multipv-over-B`, `full-width`, `root-restricted-max`. **A MultiPV line restricted
to `B` is not a full-width search**, and merging two numbers for the same position and move under
one key would be exactly the silent instrument change this repository keeps catching. `cache.py`
answers *"has this been evaluated?"*; a miss returns `None` rather than raising, because the caller's
next step is to search.

**The rule already paid for itself once.** The sham control needed the 378 source positions and they
were already evaluated in the twin run, so only the 378 sham positions were searched: **2,268
searches not spent**, on the first run after the cache existed.

### Two defects the preservation caught, both in this cycle's own work

**The provenance join was wrong where positions repeat.** It keyed on `(fen, rule_class)` on the
strength of the corpus manifest's *"one record per (position, rule class that fired)"* — which is
true of the **scan** and false of the **sample**, because games that transpose reach the same board.
**52 (class, position) pairs repeat among the 8,307 items**, one of them eleven times from the
`1.e4 e5 2.Nf3` position at Elos from 1204 to 1902, and the join was stamping one game's id onto all
of them. Fixed by keying on Elo and the played move as well; **47 rows remain ambiguous** and list
every candidate rather than naming one.

**Corpus-level tables must deduplicate.** Items drawn from one position are not independent
observations. `extract.py::natural` removes constructed positions and collapses repeats before any
table, which is why the natural corpus is **8,310** rather than 9,441.

---

## 2. Questions now answerable for zero engine cost

### 2.1 Action-Set Atlas — `compute_value.json` §1

One row per (class, cell): `|B|` in moves and as a share of legal, best-`B` against best-non-`B`,
median / p90 / max regret across every permitted action, the worst member per item, and `b_valid`.
34 rows, 17 classes, both cells.

### 2.2 Rule-Class Viability Matrix — §2

Seven columns per class: trigger specificity, action-model validity, safety, negative-cell
behaviour, engine sensitivity, twin availability, and **what remains human-required**. The last
column is the point — six of the seven are answered by a machine and are answered; a matrix that
omitted the seventh would read as though six green cells meant a class was ready for a player.

### 2.3 Single-Best-Move Approximation Audit — §3

**The most useful thing in this file.** `b_valid` asks whether the engine's argmax is in `B`. The
set-valued model asks what obeying costs. They disagree in two directions, and which direction
depends on the class:

| | disagreement | what `b_valid` gets wrong |
| --- | --- | --- |
| **false alarm** | argmax outside `B`, and obeying costs **nothing** | scores a miss where the rule is free to follow |
| **false comfort** | argmax **in** `B`, and some permitted move loses ≥0.25 expected score | scores a hit while the permitted set is dangerous |

T+ cells, natural items only:

| class | n | false alarm | false comfort |
| --- | --- | --- | --- |
| RC-13 underpromote-to-knight | 67 | **.806** | .000 |
| RC-21 push-the-unstoppable-passer | 250 | **.532** | .036 |
| RC-05 safe-promotion | 313 | **.428** | .058 |
| RC-20 defend-the-piece-in-place | 205 | .390 | .122 |
| RC-12 stop-the-promotion | 188 | .314 | .229 |
| RC-14 capture-the-mating-piece | 240 | .271 | .083 |
| RC-09 answer-the-minor-threat | 247 | .219 | .316 |
| RC-08 answer-the-rook-threat | 246 | .195 | .329 |
| RC-11 move-the-threatened-minor | 246 | .187 | .378 |
| RC-18 move-the-piece-that-must-move | 248 | .157 | **.431** |
| RC-02 recapture | 247 | .154 | .162 |
| RC-01 loose-piece | 249 | .149 | .076 |
| RC-04 save-the-attacked-piece | 250 | .148 | **.416** |
| RC-07 answer-the-queen-threat | 245 | .118 | .355 |
| RC-03 capture-the-checker | 250 | .044 | .096 |
| RC-06 answer-the-mate-threat | 236 | .000 | **.415** |
| RC-00 mate-in-one *(ceiling)* | 247 | .000 | **.547** |

**The binary screen is wrong in one direction for narrow prescriptions and in the other for wide
ones.** `RC-21`'s `b_valid | T+` of .172 is *half false alarms*: on 53.2% of its items the argmax is
outside `B` and following the rule costs nothing. `RC-00`, the ceiling anchor, has zero false alarms
and **54.7% false comfort**: the screen scores a hit while a permitted move loses more than a
quarter of the expected score.

This quantifies, per item, the argument `ACTION_SET_REANALYSIS.md` made per class. Neither
disagreement is symmetric and neither is small.

### 2.4 Engine-Sensitivity Map

Across all seventeen classes: **max |Δ| 0.0129, mean |Δ| 0.0052** on chance-corrected separation,
and **all seventeen verdicts identical** between Stockfish 16 and 17.1 from the frozen decision
program. The anchor inversion reproduces. This closes *action-set value stability*, one of the seven
open blockers in `STRONGEST_PERMITTED_CLAIM.json`.

**WDL-model sensitivity is now free and has not been spent.** The `cp` column is preserved for every
evaluation, so remapping expected score under `sf15.1`, `sf16.1` or the Lichess model is pure
post-processing. It needs no engine and it is the obvious next zero-cost analysis.

### 2.5 Reusable Item Bank — §5

Every item classified and kept:

| label | n |
| --- | --- |
| trigger-positive | 4,620 |
| trigger-negative | 4,821 |
| **hard negative** — the rule names a move on `T−` **and that move is wrong** | **1,100** |
| soft negative — the rule names a move on `T−` and it is fine | 3,488 |
| boundary — the permitted set contains a move losing ≥0.5 expected score | 2,329 |
| degenerate — no permitted move exists | 361 |
| degenerate — every legal move is permitted | 81 |
| **minimal functional twins** | **378** |
| **sham controls** — matched perturbation, trigger not flipped | **378** |

**The 1,100 hard negatives are the most valuable rows in the bank.** A trigger-negative item where
the rule still names a move *and that move is wrong* is exactly the item that separates conditional
discrimination from response bias — the pair `STRONGEST_PERMITTED_CLAIM.json` reports as
observationally equivalent at 0.500 under a saturated noise cell and separable at 0.983 under a
non-saturated one.

**The 378 twins and their 378 shams are a standing experimental asset**, committed with their
transformations, their covariate deltas and their evaluations, not folded into an aggregate.

### 2.6 Failure Ontology — §6

Every rejected class keeps its exact reason. The recurring mechanisms, counted:

| mechanism | classes |
| --- | --- |
| unsafe permitted set (p90 permitted-action regret ≥ 0.5) | **13** |
| **the predicate scores a different act on `T−` than the class's own sentence names** | **10** |
| vacant noise cell | 8 |
| not necessary (best permitted move no better than best forbidden one) | 4 |
| saturated noise cell | 2 |

**Four of these five are checkable with no engine at all**, which makes them pre-screens:

| pre-screen | cost | would have retired |
| --- | --- | --- |
| `C11` — prescription size on the trigger-negative cell, as the sentence states it | no engine, no corpus | **10 of 17** |
| the predicate substitutes the antecedent on `T−` | static read | 0 directly, but it is why 10 classes must be graded on the as-stated reading |
| the response predicate branches on its own trigger | static, `branching_audit.py` | 2 |
| prescription covers most legal moves | no engine | 0, but it caps what the rule can say |

**Only safety and necessity need an engine.** The regret distribution over `B` needs a value per
move; `V_notB` needs a search over the complement. Everything else that killed a class in this
register could have been found before the engine started.

### 2.7 Natural-Retest Assets — §7

The unaided rate at which the real players in these games made a rule-consistent move on `T+` items:

| class | rate | | class | rate |
| --- | --- | --- | --- | --- |
| RC-03 capture-the-checker | .956 | | RC-18 | .669 |
| RC-00 mate-in-one | .830 | | RC-09 | .664 |
| RC-01 loose-piece | .795 | | RC-14 | .637 |
| RC-07 | .792 | | RC-11 | .627 |
| RC-02 recapture | .769 | | **RC-05 safe-promotion** | **.575** |
| RC-06 answer-the-mate-threat | .721 | | RC-12 | .482 |
| RC-08 | .704 | | RC-21 | .240 |
| RC-04 | .700 | | RC-20 | .225 |
| | | | RC-13 | .000 |

`RC-06`'s **.721** reproduces the published pooled figure of **.716 [.696, .735]** without a new
search. **`RC-05`'s .575 is new** and it is the headroom number a study on that class would need:
real players already promote to a safe square 57.5% of the time, so the ceiling on any intervention
is the remaining 42.5% — wider than `RC-06`'s 27.9% and much narrower than `RC-21`'s 76.0%.

**No ecological claim is made.** These positions came from real games, but the move is all that is
observed: nothing here says any player *recognised* the trigger, and nothing was collected during a
game with a prompt withheld. What the corpus supports is a **calibration set for a cue matcher** and
a base rate, which is a smaller and different claim.

---

## 3. What was not preserved, and therefore remains expensive

Stated so that no later document mistakes an absent column for a null result.

| missing | why | what it would cost |
| --- | --- | --- |
| **a value for each individual move outside `B`** | the complement was searched as a **set** and only its maximum kept | a full MultiPV over all legal moves: roughly `n_legal / |B|` times the current per-item cost, so several times 55,000 searches |
| the **levels** of the two chance-partition halves | `action_set.py` stored the derived advantage and regret, which pin the difference and not the levels | two root-restricted searches per item, ~16,600 searches |
| **search depth** | the policy is a fixed node budget, which is preserved; the depth each search reached was never recorded | free on a re-run, worthless without one |
| **node/depth stability** | one budget was used | a second budget over the same items, ~55,000 searches |
| **anything about a person** | no human has seen any of these positions | recruitment |

---

## 4. What future engine work is necessary, and what is now redundant

### Redundant — do not run these

| proposed run | why it is redundant |
| --- | --- |
| re-running the action-set model on Stockfish 17.1 | done; the corpus is the result |
| re-running it on Stockfish 16 to compare | the comparison exists: max \|Δ\| 0.0129, 17/17 verdicts identical |
| re-deriving `b_valid` for any of the seventeen classes | preserved per item under `full-width` |
| a WDL-model sensitivity run | the `cp` column is preserved; remapping is post-processing |
| re-scoring the 378 twin sources for any new control | the cache holds them; the sham run already did this |
| screening candidate rule class 18 with an engine before checking its noise cell | `C11` retires classes for free, and would have retired 10 of these 17 |

### Necessary — with the gap each closes

| run | cost | what it buys |
| --- | --- | --- |
| **full MultiPV over all legal moves, `RC-05` only** | ~3,000 searches | per-move regret **outside** `B`, so *"how bad is the best thing a player might do instead"* stops being a set maximum |
| **twin banks for `RC-02`, `RC-03`, `RC-04`** | construction is free; scoring ~4,500 searches each | whether §6 of `EXCHANGEABILITY_AUDIT.md` generalises — that natural separation understates classes with local triggers — or is a fact about promotions |
| **a second node budget on the `RC-05` twin bank** | ~4,500 searches | node/depth stability, the remaining half of `engine_sensitivity` |

Everything else on the roadmap needs people, not processors.

---

## 5. The marginal information beyond the original Gate A question

Gate A asked one thing: *does the relevant candidate remain separable under a set-valued action
model?* Answering it needed the run. These came out of the same searches at no extra cost:

1. **`engine_sensitivity` closed** for action-set value stability — an open blocker in the current
   authority, retired by a comparison rather than by an assurance.
2. **The single-best-move approximation quantified per item**, in both directions, for all
   seventeen classes. The binary screen's error rate ranges from **.806** to **.000** depending on
   the class and flips sign between narrow and wide prescriptions.
3. **1,100 hard negatives**, identified and labelled — the item type the identifiability result says
   is the difference between a measurable class and an unmeasurable one.
4. **`RC-05`'s unaided human base rate, .575**, which no document contained and which any study on
   that class needs before it can size itself.
5. **Four engine-free pre-screens**, derived from what actually killed classes here rather than
   proposed in advance, that between them account for every non-safety failure in the register.
6. **378 twins and 378 shams** as a standing bank, with their transformations and covariate deltas.
7. **A cache that makes the next run cheaper**, already demonstrated: 2,268 searches avoided on the
   first run after it existed.
8. **Two defects in this cycle's own provenance handling**, found because preserving at move
   granularity forced the join to be right.

**The ratio this run was optimised for** is not *did Gate A pass*. It is
`reusable scientific information / expensive engine computation`, and the honest accounting is: one
gate verdict, one gate control, one closed blocker, three new datasets, four pre-screens and a cache,
for 4.29 MB and about an hour of CPU.
