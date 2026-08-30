# ADR-002 — discovery reads one regime, and which one is a decision this ADR does not make

**Status:** accepted. **Depends on:** ADR-001 (INV-6, INV-7), `docs/blitz/AUDIT.md` §1.4.

## The defect this closes, which is not about blitz

`shared/reveal-timing.ts` has said since it was written that the two reveal timings *"are not
poolable, and every decision records which was in force."* The recording happens: `reveal_timing`
is on the atom, in the database, mapped by the service, set by the UI. **Nothing enforced it.**
`evidence-policy.ts` keys admission on `DecisionPurpose` alone, so a decision taken twenty moves
into a coached game — by somebody who had been told, twenty times, how their last move scored — and
one taken unaided are both `purpose: "play"` and both entered discovery.

That is `STOP-C` failing on the shipped product, before any blitz evidence exists.

## Why the existing table could not have caught it

The table asks a question about a **row**: may this consumer read this decision? That is exactly
right for a purpose — a drill decision is inadmissible on its own, one at a time.

Protocol and reveal timing are not properties of a row. They describe an incompatibility **between**
rows. No single decision is "pooled"; a set is. Asked row by row, the question always answers yes:
every `play` decision is individually fine, and forty of them from two regimes are not one
population. The axis cannot be a seventh column.

## The decision

`forDiscovery` returns **strata** — populations grouped by `(protocol, revealTiming)` — and there is
deliberately **no function that flattens them back**. Refusing to provide the operation is stronger
than documenting that it is wrong: the old shape let a caller pool by doing nothing at all, which is
how this survived a module written specifically to prevent it.

## And the part this ADR refuses to decide

Splitting the population is an **engineering** fix. Choosing among the strata is a **scientific**
one, and this repository's rule is that one must not ride inside the other.

`discoverySearchPopulation` takes **the largest** stratum. Its one virtue is that it ignores the
answer: it is chosen from sizes alone, before anything is scored, so it cannot select the regime
that happens to contain a finding. Ties break by name, not by arrival order, so the same record
always yields the same search. And it changes today's behaviour as little as any non-pooling rule
can — every row in the shipped record has a null protocol, so the whole record is one stratum.

**It is not an argument that the largest regime is the right one to study.** There is a real case
that discovery should prefer `end-of-game`, and `reveal-timing.ts` makes it. Adopting that
preference would silence the detector for most players, because the coached mode is the default.
That trade is a decision about what the product measures. It belongs to whoever owns the product,
it is **open**, and when it is made it changes one function and bumps `EVIDENCE_POLICY_VERSION`.

## Consequences

- `EVIDENCE_POLICY_VERSION` 2 → 3. A claim formed under one population is not the same quantity as
  under another, and anything storing a finding stores this number beside it.
- Strata that were not searched are **named and counted**, not dropped.
- The purpose wall is unchanged and still applies first: stratifying must not widen anything, and a
  test asserts a drill still cannot enter any regime.
