# The anchor pair rebuilt, and `RC-05` and `RC-02` screened against it

**Result: the floor is now chance rather than a rule class, and on that scale `RC-05 safe-promotion`
reaches 59% of the ceiling — the best interpretable separation in the register.**

This is `R3` from [`ROADMAP.md`](ROADMAP.md), run after
[`C11_SCREEN.md`](C11_SCREEN.md) voided the old floor. Stockfish **17.1** at 200,000 nodes,
`Threads 1`, `Hash 64`, 250 items per cell, **3,000 searches, 0 engine failures**, 15m52s.
Arithmetic: [`anchor_rebuild.py`](../../research/evidence-architecture/anchor_rebuild.py).

---

## Why the pair needed rebuilding

`position_between_anchors` put 0 at the refuted incumbent `RC-01 loose-piece` and 1 at the ceiling
`RC-00 mate-in-one`, and `G5` asked whether a candidate out-separates the floor. **C11 graded
`RC-01` `VACANT`.** This run confirms it on the engine rather than from prescription sizes alone:

| `RC-01`, scored by its own sentence | |
| --- | --- |
| `b_valid \| T+` | **.780** |
| `b_valid \| T−` | **.000** |
| items where **no** legal move satisfies `B` on T− | **100%** |
| separation | **+0.780** |
| corrected separation | **+0.734** — **96% of the ceiling** |

**A floor at 96% of the ceiling is not a floor.** Its separation is `b_valid | T+` minus a zero that
exists by construction: with no capturable-and-undefended piece on the board, no legal move can
*"take it"*. The published +0.600 came from scoring a **different act** on T− — capturing the
dearest **defended** piece.

## The replacement floor is chance, not another rule class

`prescription_size` is already the screen's per-item chance rate for `b_valid`, so the separation a
**move-blind agent earns for free** is `psz|T+ − psz|T−`, and the corrected separation is the
observed one minus that.

**A floor that is a quantity cannot itself be graded `VACANT`**, which is the property the old one
lacked. Three rule classes were measured as candidate replacement floors and all three are worse
than chance for the role:

- **`RC-03 capture-the-checker`** — lives on the *in-check* subset, a disjoint population from every
  other class, so it cannot anchor a common scale. It is also the one whose apparent separation is
  mostly geometry: chance separation **.147**, the largest in the set, and corrected it collapses
  from +0.256 to **+0.109**. That is the published "trap" diagnosis, quantified.
- **`RC-13 underpromote-to-knight`** — `b_valid` .030/.004, near zero on both cells. A floor should
  be a class that looks plausible and is not; one that scores nothing anywhere is a different thing.
- **`RC-21`** — `SEMANTICALLY-UNDERDEFINED` ([`RECONCILIATION.md`](RECONCILIATION.md) §2.2). A
  predicate that does not detect the condition it is named after cannot anchor anything.

### And chance-correction cannot replace `C11` — the order matters

Correction assumes the chance rate is a floor to beat. **Where the chance rate is ~1 there is
nothing to beat and the subtraction becomes a bonus:**

| `RC-06`, one basis | |
| --- | --- |
| observed separation | **−0.048** |
| chance separation | **−0.692** |
| **corrected** | **+0.644** |

On the published-vs-as-stated mix it reaches **+1.461, above the ceiling**. The worst class in the
register becomes the best. **`C11` gates first; correction is applied only to what survives it.**
The two are not substitutes and neither is sufficient alone.

---

## The rebuilt scale

Floor **= 0 = chance**. Ceiling **= `RC-00`'s corrected separation**, re-measured in this run so the
scale is one instrument rather than a comparison against published numbers.

| | rule class | C11 | basis | sep | chance | **corrected** | **vs ceiling** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC-00 | mate-in-one *(ceiling)* | `MEASURABLE` | shipped | +0.816 | .051 | **+0.765** | **1.000** |
| RC-01 | loose-piece *(old floor)* | **`VACANT`** | as-stated | +0.780 | .046 | +0.734 | *0.960 — void* |
| **RC-05** | **safe-promotion** | `MEASURABLE` | shipped | +0.456 | **.002** | **+0.454** | **0.593** |
| RC-02 | recapture | `MEASURABLE` | shipped | +0.380 | .016 | +0.364 | 0.476 |
| RC-04 | save-the-attacked-piece | `MEASURABLE` | shipped | +0.416 | .055 | +0.361 | 0.472 |
| RC-03 | capture-the-checker | `MEASURABLE` | shipped | +0.256 | .147 | +0.109 | 0.143 |

*`RC-01`'s row is reported for the record and is not on the scale: its corrected value is derived
from a zero that exists by construction.*

## What the two screened candidates show

**`RC-05 safe-promotion` is the strongest interpretable separation in the register.** `b_valid`
**.560 / .104**, and its **chance separation is .002** — its two cells have almost identical
prescription sizes (.053 and .051), so essentially *all* of its separation is signal rather than
geometry. That is the opposite of `RC-03`, and it is what a clean rule class looks like on this
scale.

**`RC-02 recapture` is second at 0.476**, `b_valid` **.640 / .260**, chance separation .016.

**Neither approaches the ceiling**, and neither should be read as eligible: this run measures
separation on a rebuilt scale, not the full nine-criterion screen. What it establishes is narrower
and is what `R3` asked:

> **There exist rule classes whose separation is interpretable and materially above chance.**
> `RC-05` at 59% of the ceiling and `RC-02` at 48% are the two best, and their noise cells survive
> `C11`.

## What this does not establish

- **Not eligibility.** `A1`–`A5`, exchangeability, harm and robustness are not re-run here. `RC-05`'s
  base rate is **0.22%** of not-in-check positions — the lowest in the register — which is a
  recruitment problem the old screen already flagged for it.
- **Not that the ceiling is a good ceiling.** `RC-00` survives `C11`, but
  [`RECONCILIATION.md`](RECONCILIATION.md) §2.5 shows its positive cell has mean `V*` = 1.000 on the
  expected-score scale, so it cannot anchor a *utility* comparison even though it anchors this one.
- **Nothing about a player.** No participant was measured, and `D25` is unchanged:
  **`CONSTRUCT-UNDERIDENTIFIED`**.

## One bug in this file's own instrument, caught before the run

The basis was first chosen by *"is there an alternative reading"* rather than by C11's actual rule,
*"does the shipped predicate ask a different question on T−"*. That put the **ceiling** on `RC-00`'s
strict reading, where `B` is the mate itself — which does not exist on a T− item, so `b_valid | T−`
is 0 by construction and the separation is **1.000**. **That is the `VACANT` artefact, and baking it
into the ceiling would have made the entire rebuilt scale an artefact.** The basis now comes from
C11's own `SUBSTITUTES` set.

## What follows

`RC-05` and `RC-02` are the two classes worth a full screen. **Before that, the cheap thing first:**
`RC-05`'s base rate of 0.22% means a within-person design needs a very large number of games, and
that is a counting question answerable from the corpus with no engine. **Do not run a full screen on
a class whose base rate makes the study impossible.**
