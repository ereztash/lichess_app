# The calibration run, and what it changed

Task `CAL-LICHESS-ORCHESTRATION-001`, `final_state: COMPLETE`, `stop_or_continue: CONTINUE`.
Frozen plan: `DR_PLAN_2.md`, written before the run with H-1 named as the favoured hypothesis.

Routing was deterministic: `NETA` fired on `multiple_plausible_mechanisms`,
`proxy_substitution_risk`, `research_to_intervention_transition`, `signal_interpretation_ambiguity`;
authority handoffs `OWNER`, `REPO`, `FIELD`. `SCAFFOLD` was not invoked.

## The decision before

Render `deriveNextAction`'s **reason** and not its choice: the surface keeps offering exactly the
act it offers today, and the derivation supplies the sentence saying what completing it makes
knowable. No act changes, no number, no denominator, no telemetry.

## The decision after

> **The hypothesis cut itself was wrong, and that is the operative change.**

H-4 — the ordering repair, which I had carried as a rival of unknown weight — was promoted to
**first**, on a ground the plan had not considered:

> the owner's raw six-part ask is five orientation questions and one action question, and
> H-1/H-2/H-3 all argue only the action question while inheriting D22's ownership frame instead of
> testing it.

That is the proxy substitution, located inside my own framing rather than downstream: I had read a
request about orientation as a request about ownership, and then spent the whole hypothesis space
on ownership.

### The dispositions

| | disposition |
| --- | --- |
| **H-4** ordering repair | **FIRST.** Introduces no claim, needs no evidence level, is OWNER-authorized, fails cheaply and visibly |
| **H-1** render the reason | **CONDITIONALLY ADMISSIBLE**, sequenced second, under three named constraints |
| **H-2** hand the act over | **DENIED**, on a second and independent ground (below) |
| **H-3** wait for the trial | **REJECTED as over-deferral** — it blocks a repair that requires no evidence level |

### The three constraints on H-1, if it is built at all

1. **A grammatical subject gate**, built as a sibling of `GATE-GOAL-NOT-A-DENOMINATOR` with a
   positive control that must go red: the sentence's subject is the record's eligibility state,
   never the player. *"the blitz bucket is not yet comparable"* passes; any second-person capability
   verb fails.
2. **No numeral anywhere in the reason sentence.**
3. A pre/post free-play decision-rate reading on the owner's own record, so the salience change is
   at least observable.

### Why H-2 was denied twice over

The walk I had offered as evidence was turned around:

> the two agreeing states (empty record, one decision) are the **most-determined branches of the
> union** where the derivation has almost no choice to make, so the agreement is uninformative
> about the contested branches (half-finished run, bucketing short on one side, unscored game
> co-occurring) — quite apart from the fact that D22's condition was disagreement.

That is correct and I had not seen it. Two agreements at the branches with no degrees of freedom
say nothing about the branches with several.

## The two REPO facts that outranked the question

> Two new REPO-closable facts now outrank the original question in cost-to-value.

1. **A progress denominator may already exist on the shipped page** — five of eleven unclear-rows
   ending in the identical quantity is a progress number assembled by repetition, eleven rows above
   where `GATE-GOAL-NOT-A-DENOMINATOR` guards.
2. **That quantity may be arithmetically false**, since `MIN_BUCKET_N` is 30 required inside *and*
   outside a bucket, so 60 measured decisions precede a claim.

The second is *"a correctness defect on the surface steering the only admissible evidence source,
independent of the entire ownership hypothesis space."*

### It was checked, and it was true

`shortBy` was `MIN_BUCKET_N - min(inside, outside)` — the gap on the binding side. What the row
renders is a statement about what the player must go and produce. Measured:

| record | row said | actually required, best case |
| --- | --- | --- |
| fresh, both sides empty | עוד 30 החלטות | **60** |
| one decision, landed outside | עוד 30 החלטות | 59 |
| 40 outside, 2 inside | עוד 28 החלטות | 28 ✓ |
| 29 inside, 31 outside | עוד 1 החלטות | 1 ✓ |

The two agree once either side is full, which is why every existing test of the field missed it:
they are all records where one side already holds its thirty. On the record every arrival has, the
figure was **out by a factor of two**, on the surface whose stated job is to say whether going on
helps.

**This is the third step of one repair.** `a-line-nobody-crossed.test.ts` records that `shortBy`
once counted only the `inside` side, so a split with an empty comparison set "reported that it
needed nothing"; it was repaired to the binding side. That test's own words dispose of the second
version too: *a player told "three more" would have taken three and found the split exactly as
unreadable* — and a player told "thirty more" can take thirty, land every one inside, and find it
exactly as unreadable.

And `עוד 1 החלטות` is not Hebrew. It is the branch one decision short of a readable bucket, so the
ungrammatical case was reserved for the moment a player is closest to a reading. The same defect has
now been found in four separate hand-rolled copies of a clause.

## What was built from this run

- The shortfall is the requirement on **both** sides, and the copy says `לפחות`, because even the
  corrected figure assumes every next decision lands on the side that needs one.
- One quantity is said once when every split in a group asks for the same one, and stays per split
  the moment they differ.
- The goal is no longer gated on the instrument having something to say. **Its placement is
  unchanged**, because lifting it above the counts is what the run sequenced and what three
  instruments then refused: 0.059 of layout shift at 390px against a budget of 0.02, and both
  front-door word ceilings. The defect was the absence, not the position.
- The singular branch says `עוד החלטה אחת לפחות`.
- Both held by tests, and the field's assertion is now the **property** — `shortBy` equals what both
  sides still need, whatever the floor — so a change to `MIN_BUCKET_N` cannot restore the
  understatement.

## What was not built, and by whose authority

**H-1 is not built in this pass.** Its first constraint is a new gate whose predicate is the
grammatical subject of a Hebrew sentence, and the run sequences it second, behind an ordering repair
it says must ship and be observed first. Building it now would be taking the second step before the
first, which is the error the run had just corrected in my framing.

**H-2 stays denied.** `docs/decisions/D22-next-action-ownership.md` is unchanged and no screen is
handed over.

**FIELD stays deferred and is now the binding authority.** No cold user has seen the repaired build;
two of three failed the core move. `NOT_FIELD_VALIDATED`.

## Provenance, and a gap of my own making

`NETA`'s invocation carries `_adapter_meta` inline — adapter, transport, provider, requested and
served resource, turn count, stop reason, cost, the context-delivery manifest (4 of 4 documents
delivered whole) and the independence caveat. `RND`'s two invocations carry none.

That is **not** a defect in the adapter. `claude_cli_adapter.py` routes RND provenance to a sidecar
rather than inline, because the strict RND semantic shape cannot legally carry it, and the sidecar
is written only when `CALIBRATION_ADAPTER_PROVENANCE` names a file. **I did not set it.** So for
this run the served identity of the two RND phases is not recoverable from the record.

It is recorded rather than repaired, and deliberately not re-run to fix. A second run produces a
different synthesis, and attaching this decision's provenance to a different decision's trace would
be worse than an absent field. The previous lane made the same call about the paired run's missing
`_adapter_meta`, for the same reason.

**The independence caveat still applies and is stronger than the gap.** Every resource in this run
shares one model lineage, which `NETA`'s meta states in as many words: *"Agreement between resources
is role-conditioned execution, not independent triangulation."* Whatever the sidecar would have said
about which model served `RND`, it would not have made this a triangulated result.
