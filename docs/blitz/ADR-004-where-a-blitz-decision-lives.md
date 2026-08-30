# ADR-004 — a blitz decision does not become a commitment-loop atom

**Status:** accepted. **Depends on:** ADR-001 (INV-3, INV-4), ADR-002 (strata, never a pool),
`shared/measurement-protocol.ts`.

## The fork

PR-11 needs the blitz route to persist what it measures. The obvious path is the one the product
already has: `commitDecision` → `decision_atoms`. **A blitz decision does not fit through it**, and
the mismatch is not incidental.

`decisionAtomSchema` requires two stated reads:

```ts
known: z.string().max(200),
unknown: z.string().max(200),
```

Neither is nullable. In the commitment loop the player writes them — that loop exists to make
somebody articulate what they know and what they do not *before* an engine speaks. **In a three
minute game nobody writes prose.** That is not an omission in the blitz protocol, it is the
protocol: INV-3 says the instrument must not change the variable it measures, and a text box
between every move would change it more than anything else the product does.

## Why the tempting fix is the forbidden one

Writing `""` for both is one line and it is a fabrication. This repository draws the same
distinction in four other places and always the same way — `instrumentationLatencyMs` null rather
than zero for a decision nobody questioned, `clockMsRemaining` null rather than zero for a board
with no clock, `LEGACY_PROTOCOL` rather than a backfill, `LEGACY_CONTEXT` rather than a guess. An
empty string here would read afterwards as *"the player was asked and answered with silence"*,
which is a fact about a person that nobody measured.

Widening the atom instead — making the two reads nullable — is the other tempting fix and it is
worse than it looks: it weakens the one constraint that protects the commitment loop, on every
existing row and every consumer, so that a different loop can share a table with it.

## The decision

**Blitz decisions get their own storage, in their own shape.** `blitz_games` and `blitz_decisions`,
holding what a blitz decision actually has: the clocks, the frozen think time, whether the sampler
asked, the probability in force when it chose, the confidence when one was given, the
instrumentation latency in its own nullable field, and the engine's verdict — attached after the
game ended, never during, which is INV-4.

**Nothing is lost by not sharing a table**, and that is what makes this cheap rather than a
compromise. ADR-002 already established that discovery returns **strata** keyed by
`(protocol, revealTiming)` and that there is deliberately no function that flattens them: two
protocols were never going to be one population, whichever table they sat in. A separate table
makes the fact structural instead of a rule the query has to remember.

## Why this is the reversible choice

Additive: new tables, no column changed, no existing row touched, nothing removed from the atom
path. If a later study wants blitz decisions inside the atom table, the rows carry everything the
atom needs except the two reads, and *that* migration is a decision somebody can make with the data
in front of them. The reverse — widening the atom now and discovering it was unnecessary — cannot
be undone the same way, because by then rows will have been written that depend on the wider shape.

## What this ADR does not decide

Whether a blitz decision ever becomes admissible evidence for a claim about the player. It is
stored, it is stratified, and `evidence-policy.ts` decides admission — this file only says where the
rows live.
