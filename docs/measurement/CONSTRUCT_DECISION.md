# Does the construct survive?

**Decision: `NARROW`, and the narrowing is not the one that was expected.**

The candidate rule class **unprotected-piece capture discrimination** does **not** survive as
stated. A narrower construct survives, it is a *different* construct, and what it can be used for is
much smaller than what was asked for.

This file follows the form of `docs/decisions/`: claim, alternatives, evidence, counterevidence,
uncertainty, decision, and — without exception — **what would reverse it**.

---

## The four allowed outcomes, and where the evidence lands

| | outcome | verdict |
| --- | --- | --- |
| **A** | **SURVIVES** as `unprotected-piece capture discrimination` | **NO.** [F3](FALSIFICATION_REGISTER.md#f3) refutes the scoring inference: on 15.0% of T+ items the prescribed act loses ≥100 cp, and on 22.8% of T− items the scored false alarm is the engine's own best move |
| **B** | **NARROW** | **YES, with a caveat that changes the name.** See below |
| **C** | **REPLACE** with a rule class having cleaner T and B | **Not established.** No candidate was found with materially cleaner definitions; the search is recorded below |
| **D** | **REJECT** — no interpretable rule class found | **NO, but only just.** The measurement is interpretable as a *task* score. It is not interpretable as a statement about a person, and that distinction is the whole result |

---

## What the narrowing actually is

Six candidate narrowings were applied to the same 57,504 items and scored identically, so the
comparison is between definitions rather than between studies.

| narrowing | n T+ / T− | *d′* | *c* | *d′* monotone in rating? | max \|SMD\| | puzzle: solution = take |
| --- | --- | --- | --- | --- | --- | --- |
| **N0** as stated | 11,752 / 45,752 | 1.555 | −0.012 | **no** | 0.487 | 0.424 |
| **N1** quiet (no check, no mate-in-1) | 10,848 / 36,830 | 1.542 | −0.030 | no | 0.545 | 0.351 |
| **N2** N1 + no larger capture elsewhere | 10,092 / 36,830 | 1.629 | −0.073 | no | 0.581 | 0.395 |
| **N3** N2 + T− must be a **material error** (SEE < 0) | 10,092 / 23,006 | **2.296** | +0.260 | **yes** | **0.705** | 0.395 |
| **N4** N3 + target ≥ minor | 10,092 / 23,006 | 2.296 | +0.260 | yes | 0.705 | 0.395 |
| **N5** N3 + exactly one attacker | 7,369 / 21,720 | 2.178 | +0.360 | yes | 0.832 | — |

**N4 is identical to N3 and that is reported rather than quietly dropped.** The predicate already
excludes pawns, so "target ≥ minor" is not a filter. A narrowing that does nothing is worth one line
saying so; deleting it would have left a reader wondering whether it had been tried.

**N3 is the first definition under which *d′* orders the five rating bands correctly**
(2.059 → 2.131 → 2.218 → 2.387 → 2.487). It looks like the fix. Three things say it is not the fix
that was wanted:

**1. It buys the gradient with worse exchangeability.** Maximum covariate imbalance rises from 0.487
to **0.705**. The narrowing that makes the person-level signal look right makes the item-level
confound worse — which is the shape of an artifact, not of a repair.

**2. It puts an oracle inside the trigger.** N3's T− is "a held target *whose capture SEE calls a
material error*". T is no longer a fact about the arrangement of pieces. It is defensible — SEE is
deterministic, computed from the board, and reads neither behaviour nor the solution — but it is
[F4](FALSIFICATION_REGISTER.md#f4)'s boundary, crossed deliberately and recorded.

**3. It does not repair the scoring inference at all.** Puzzle-solution agreement on T+ items moves
0.424 → 0.395 — *down*. The engine's agreement moves 66.2% → 68.0%. **The competing explanations are
not concentrated where a filter can reach them.** N3 changes which items are negatives; it does not
make `capture(target)` a better description of what a player who knows the rule would do.

### So the surviving construct has a different name

> **N3 measures discrimination between capturing opportunities that are materially profitable and
> capturing opportunities that are not.**

That is not "unprotected-piece capture discrimination". It is closer to *static exchange
discrimination* — and its T is partly defined by a function anyone can compute in microseconds. A
product that teaches it is teaching a player to approximate SEE. That may be worth teaching. It is
not the construct in the mission statement, and calling it by the old name would be the exact
substitution the epistemic rule forbids.

---

## What was rejected, and why

**REPLACE was considered and no replacement was found.** Three alternative rule classes were
examined against the same two requirements — a T definable from the board alone, and a B that is a
single unambiguous act:

- **"Do not move a piece to a square attacked by a lower-valued piece."** T is board-definable and B
  is well-defined, but B is a *prohibition*, so hits are non-events and the T−/noise trial is every
  other move in the position. The base rate problem is worse, not better.
- **"Defend an attacked, undefended piece of your own."** T is board-definable; B is not a single
  act — defending, moving away, and counter-attacking are all correct, so `capture`-style scoring
  has no analogue.
- **"Capture toward the centre / recapture with the correct piece."** T requires a prior move, so it
  is not a property of a position.

None has materially cleaner definitions. The search is recorded as incomplete rather than
exhaustive: it covered rule classes expressible in the same predicate vocabulary, and there may be
others.

**REJECT was not chosen, and the reason is narrow.** The predicate is real, reproducible, robust to
the main alternative definition of "unprotected" (0.64% flip rate), and fires at 20.4% in a corpus
no label selected. There *is* something to measure. What was refuted is that the number it produces
is a statement about a person's rule-specific knowledge.

---

## What may and may not be said, from here

**May be said:**
- "In this item set, this player captured the designated target on X% of T+ items and Y% of T−
  items, giving *d′* = Z and criterion c = W under the loglinear correction."
- "In 60,000 unfiltered rated games, capture behaviour on loose targets orders rating bands weakly
  in sensitivity and monotonically in criterion."

**May not be said, and the wording matters because these are the sentences that get written:**
- "This measures whether the player has learned the unprotected-piece rule."
- "*d′* went up, so discrimination improved."
- "The player applies the rule 78% of the time."
- Anything that reports **accuracy** on T+ items alone. It would have shown a clean monotone
  .751 → .820 and concealed every finding in the register.

---

## Uncertainty

- Whether the non-monotonicity at <1200 is small-n (238 T+ decisions), a population difference, or
  the F2 confound acting differently by strength. **Not resolved.**
- Whether an item bank built from *counterfactual pairs* (Frame C) would restore exchangeability.
  Not built, because showing an edit introduced no new tactical explanation needs adjudication that
  does not exist.
- Whether the 15.0% blunder rate on T+ survives a deeper engine search. Direction unknown.
- Whether *any* of this transfers to a within-person design. Everything here is between-person and
  observational; F2's confounds attach to items, and a within-person design holds the person fixed
  while the items still differ.

---

## What would reverse this decision

**Toward `SURVIVES`:** an item bank in which the engine's best move is the designated capture on
T+ items and is not on T− items at rates near ceiling and floor — the current 66.2% / 22.8% would
have to become something like 95% / 5% — **and** covariate balance holding after matching, **and**
the puzzle-solution agreement rising rather than falling under narrowing.

**Toward `REJECT`:** a measurement-only arm ([F7](FALSIFICATION_REGISTER.md#f7)) showing that
repeated T+/T− exposure alone moves *d′* by as much as an intervention does. That would make the
instrument an intervention and leave nothing for it to measure.

**Toward `REPLACE`:** any rule class whose T is board-definable, whose B is one unambiguous act, and
whose engine agreement is near ceiling on T+ and floor on T−. Finding one is a better use of the
next cycle than repairing this one.
