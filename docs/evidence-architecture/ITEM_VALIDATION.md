# Gate B — item validity and exchangeability

# Verdict: `ITEM-PARADIGM-FAILED` — and not for an item reason

**Gate B could not be run, and the reason is upstream of items.** A minimal functional twin flips the
trigger while holding everything else fixed. On the only rule class that reached this gate, **`B`
itself changes across the flip**, so no item construction repairs it: the defect is in the response
definition, not in the positions.

**This is not the verdict Gate B was designed to produce**, and the distinction matters for what
happens next. `ITEM-PARADIGM-FAILED` here means *"the paradigm was never testable on this class"*,
not *"items cannot be matched"*.

---

## B0 — the precondition, which is new and which fails

**Stated first because it is prior to B1 and B2**, and because it was not known when Gate B was
written.

> A twin pair `P / P'` flips `T`. If `B` is **also** defined differently on the two sides of that
> flip, the contrast measures the predicate change and not the trigger change — and **no amount of
> matching repairs that**, because it is in the response definition.

**`RC-06` fails B0.** `_threat_satisfies` scores *"the opponent has no mate in one"* on T+ and
*"the opponent has no check at all"* on T−.

**And symmetrising is not available**, which is what makes this terminal rather than a fix:

| `RC-06` T− prescription size | |
| --- | --- |
| shipped (branching) predicate | **.104** |
| the rule as its own sentence states it | **.995** |
| items where **every** legal move satisfies the stated rule | **93.2%** |
| `b_valid` under the stated rule, Stockfish 17.1 | **1.000** (250/250) |

One predicate gives a degenerate noise cell; the other gives an uninterpretable comparison. **There
is no third option at this rule shape**, and #49's H23 gives the structural reason: for any rule of
the form *"if THREAT, act so that THREAT is gone"*, `B` is automatically satisfied whenever the
threat is absent.

**`RC-12` fails B0 too** ([`RECONCILIATION.md`](RECONCILIATION.md) §2.6b), inflation +0.815, and the
shipped branching detector reports it as clean.

## B1 — natural matching: **measured, and it fails on its own terms as well**

Reported as the full imbalance vector rather than a single maximum, as required.

| covariate | `RC-06` T+ vs T− |
| --- | --- |
| **max \|SMD\| across all matched covariates** | **0.573** |
| material balance (games, incumbent class) | −0.487 |
| material balance (puzzles, incumbent class) | −0.724 |
| attacker count (games, incumbent class) | +0.475 |
| puzzle rating (incumbent class) | −0.239 |
| max residual \|SMD\| **after exact matching** (incumbent class) | **0.402** |
| base rate of T+ | **1.24%** of not-in-check positions |
| cell sizes | 2,080 vs 80,332 |

**Two things this vector says that a maximum does not.**

1. **The imbalance is structural, not sampling noise.** A position where the opponent threatens mate
   *is* a different position: worse material, more attackers, later phase. The mean `V*` on `RC-06`'s
   positive cell is **0.336** — the player is losing — against a not-losing negative cell. **You
   cannot match that away without matching away the trigger.**
2. **Exact matching removes less than a third of it** (0.573 → 0.402 on the class where it was
   measured), and `negative-controls.ts::itemDifficultyConfound` is committed to the repository as a
   **failing** control: an agent with zero discrimination produces a large *d′* on unbalanced items.

**Under B0's failure this is moot for `RC-06`** — matching items for a void contrast produces a void
contrast — but it is retained because it is a fact about defensive triggers generally and will apply
to the next class.

## B2 — minimal functional twins: **not attempted, and correctly so**

The design (Sheridan/Reingold-style: a small chess-valid transformation flips `T` while preserving
the decision problem) is sound and remains the right instrument. **It was not attempted because B0
fails**, and running it would have produced pairs whose contrast could not be interpreted.

**One thing #51 contributes that survives for the next class.** The per-move regret landscape from
the action-set model is the adjudication B2 was blocked on: *whether an edit introduced a new
tactical explanation is now a measurable question rather than an assumed one.* When B2 becomes
admissible, that instrument is already built.

## B3 — the metamorphic tests, declared before any pair is built

Kept because they cost nothing now and because declaring them after seeing results is the failure
this programme exists to avoid.

| transformation | **must change** | **must stay stable** |
| --- | --- | --- |
| remove the mating piece | `T` flips to false; `V*` rises | legal-move count ±2; material ±0; phase |
| add a defender of the mating square | `T` flips to false; `advantage` → ~0 | material ±0; attacker count ±1 |
| shift the whole position one file | nothing | `T`, `V*`, `b_valid`, prescription size, all within tolerance |
| mirror the position | nothing | as above — **this is the null transformation and any pair design must pass it** |
| swap a knight for a bishop off the critical line | nothing | `T`, `b_valid` |

**Rejection rule, declared now:** a pair whose measured change does not match its predicted change is
discarded, not explained. The file-shift and mirror rows are the controls: **a pair design that moves
any quantity under them is measuring the board's coordinates.**

---

## What would make Gate B runnable

Exactly one thing, and it is upstream:

> **A rule class whose response predicate is a property of the move, scored identically on both
> cells, with a trigger-negative prescription size materially below 1.**

`RC-11 move-the-threatened-minor` is the worked candidate: method-shaped, does not branch, T−
prescription size **.175**. Whether it survives its own screen is unknown — its published separation
is +0.448, below the incumbent floor of +0.600 — **and that comparison is now itself suspect**,
because the floor `RC-01` and the ceiling `RC-00` were never checked for the `C11` property either.

**Re-screening the incumbent anchors under `C11` is therefore a precondition on re-screening
anything**, and it is cheap: no engine, no participants, data already on disk.
