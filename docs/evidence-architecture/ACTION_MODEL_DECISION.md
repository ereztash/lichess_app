# Gate A — action-set validity

# Verdict: `ACTION-SIGNATURE-FAILED`

**Not "narrowed". Failed.** The action signature that the whole programme rests on —
`engine best move ∈ B`, aggregated into `separation` — is not a valid measurement of rule use on
the only rule class that ever passed the screen, and the reason is structural rather than statistical.

---

## What Gate A asked

> Does `RC-06` remain distinctive when the domain model evaluates the **set of actions permitted by
> the rule**, rather than only whether the single engine-best move belongs to that set?

Two runs answer it: [#51](https://github.com/ereztash/lichess_app/pull/51)'s action-set model
(seventeen classes, 8,307 items, 48,155 searches, Stockfish 16, expected score primary) and this
audit's fixed-predicate measurement (Stockfish 17.1, the published engine, 250 items per cell,
0 failures).

**Three dimensions, never merged into a score**, as the gate requires.

## EFFICACY — can the policy be followed without material cost?

**Yes, and this is `RC-06`'s real and surviving strength.**

| `RC-06` T+ | |
| --- | --- |
| `regret_B` median | **0 cp**, Q1 0, Q3 0, p90 0 |
| `regret_B` mean, expected score | **0.000**, share non-zero **0.000** |
| obeying is optimal | **242 / 242** |
| obeying loses ≥100 cp | **0 / 242** |

**When a mate is threatened, the best move that stops it is the best move.** On 242 of 242 items
where the rule prescribes anything, at a median cost of one centipawn on the published engine. That
statement survives everything below and is the one thing about `RC-06` worth carrying forward.

## NECESSITY — when T is true, does violating the policy cost something?

**Yes, and by a wide margin.**

| `RC-06` T+ | |
| --- | --- |
| disobeying loses ≥100 cp | **84.9%** (208/245) |
| `advantage` (V_B − V_notB), expected score, mean | **+0.354** |
| chance-corrected advantage, mean | **+0.464** |
| mean `V*` on the positive cell | **0.336** |

That last row matters and is #51's discovery: `RC-06`'s trigger fires when the player is *losing*,
so there is room for a decision to matter. The ceiling anchor's positive cell has mean `V*` =
**1.000** — already won — which is why `A5` inverts (§2.5) and why **`A5` on the expected-score
scale is void and is not used in this verdict.**

## ROBUSTNESS — is `B` safe to pick from, or is one member good?

**No. `RC-06` is the least safe prescription of the three reference classes.**

| | `RC-00` ceiling | `RC-01` refuted floor | **`RC-06`** |
| --- | --- | --- | --- |
| median share of legal moves permitted | .091 | .037 | **.297** |
| share of permitted moves within 100 cp | .482 | .795 | **.286** |
| items where some permitted move loses ≥100 cp | .764 | .236 | **.847** |

`b_valid` cannot see this, because it only ever asks about the **best** member of `B`.

**No threshold is invented here.** No non-arbitrary cut exists for "how much of a prescription must
be safe", and #51 declines to invent one; so does this file. What is stated instead is a
**comparison**: the prescription is broader and less safe than the rule class already shown to be
uninterpretable.

---

## The finding that decides the gate, and it is not any of the three

`separation` is the quantity gate `G5` reads, and `G5` is the only gate `RC-06` uniquely passes.
**`separation` is not a difference between two measurements of the same behaviour.**

`_threat_satisfies` scores *"the opponent has no mate in one"* on T+ and *"the opponent has no check
at all"* on T−. Under one fixed predicate — the rule as its own `prescription` string states it —
measured on Stockfish 17.1:

| | `b_valid` T+ | `b_valid` T− | separation | `G5` (> +0.600)? |
| --- | --- | --- | --- | --- |
| branching `B`, as shipped | .952 | .192 | **+0.760** | passes |
| symmetric `B`, as written | .952 | **1.000** (250/250) | **−0.048** | **fails** |

Engine-free and prior to any search: **99.5% of legal moves satisfy the rule on trigger-negative
items, and on 94.1% of them every single legal move does.**

**The prescription is not wrong. It is uninformative.** *"Play a move that stops the mate"* is
excellent advice whose best member is the engine's own move. It cannot discriminate, because when no
mate is threatened, not-allowing-mate-in-one is already true of nearly everything you might play.

**And it is two classes, not one** (§2.6b): `RC-12` inflates the same way (+0.815) and the shipped
branching detector reports it as clean.

---

## Answers to the gate's own questions

| # | question | answer |
| --- | --- | --- |
| 1 | RC-06 remains exceptional under action-set measures? | **partly.** Efficacy and necessity are genuinely strong; robustness is the worst of the three references |
| 2 | do other classes become viable? | **no.** ρ = +0.821 between `separation_b_valid` and separation in necessity across seventeen classes: the decision model reproduces the published ordering rather than reordering it |
| 3 | does RC-06 lose its advantage? | **yes, but not on this instrument.** It loses it on the response definition, which the action-set model does not examine |
| 4 | do the action sets overlap in value on both cells? | **the question does not apply**, because the two cells do not score the same act |

**Row 2 is the useful negative.** #51 built the set-valued instrument to test whether the published
ranking was an artefact of measuring argmax agreement. It is not: the two instruments rank the same
seventeen classes alike. **The binary top-move screen was never the bottleneck.** The bottleneck was
one layer further in, in what `B` means on each cell — which neither instrument asks.

## What this gate does **not** establish

- **Not that `b_valid` is a bad statistic.** On the positive cell it is fine, and 242/242 at a median
  of one centipawn is a real fact about chess.
- **Not that severity is wrong.** The ladder's positive-cell monotonicity is unaffected.
- **Not that no rule class can work.** It establishes that the seventeen tried do not, and that the
  one that appeared to did so through its response definition.
- **Not that exchangeability is resolved.** It is untouched; max |SMD| 0.573 stands. It is now moot
  for `RC-06` — matching items for a contrast that is void does not produce a valid contrast.

## What replaces the gate

**`C11`, and it is cheap.** Before any class is screened:

> Compute `prescription_size` on the trigger-negative cell **under the response predicate as the
> class's own `prescription` sentence states it.** If it is near 1, the class has no noise cell, and
> its published separation is a fact about its predicate rather than about the rule.

It needs no engine, no participants and no new corpus — `branching_audit.py` runs it in under two
minutes on data already on disk — and it would have caught both `RC-06` and `RC-12` before the first
search was spent. It is the direct analogue of `prescription_size`, which already exists as the guard
against a vacuous prescription scoring well on the *positive* cell. **The screen guarded one cell and
not the other.**

---

## Consequence for the programme

**The eligible set is empty.** Fifteen candidates, eight families, three selection strategies, two
anchors. **`Gate B` is moot**, `Study D` has no item bank, and every document downstream of
"`RC-06` is eligible" inherits this.

The programme's own stop rule applies verbatim:

> *"If Gate A or Gate B fails, do not repair the human study around the failure. The conclusion to
> carry forward is that rule use is not identifiable from the final move under the current paradigm.
> The next research object is process evidence, not a sixteenth rule class and not a more elaborate
> learning UI."*

**With one correction to it, earned here.** The failure is not "the final move is insufficient" in
general. It is sharper and more useful than that:

> **On outcome-shaped rules — *"if T, act so that T is gone"* — the negative cell is degenerate by
> construction, so no final-move contrast can exist. On method-shaped rules — where `B` is a property
> of the move — it is not, and `RC-11 move-the-threatened-minor` is a worked example that does not
> branch.**

That is a prediction, it is cheap to test, and it is the highest-ranked item in
[`ROADMAP.md`](ROADMAP.md). **It does not license process evidence yet**, because it names a
final-move design that has not been tried.
