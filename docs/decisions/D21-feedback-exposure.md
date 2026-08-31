# D21 — is a decision taken after feedback the same measurement as one taken before?

**Mode:** `DEFER` for the exposure contract; the two findings below it are closed.
**Status:** **open.** Two of three findings are fixed in the commit that adds this file. The third
— the one the node is named for — is written down and deliberately not implemented.
**Depends on:** `shared/decision-atom.ts`, `shared/evidence-policy.ts`,
`shared/measurement-protocol.ts`, `shared/blitz-strata.ts`, `shared/discovery/clustering.ts`,
`docs/INERTIAL_UX_LAWS.md` LAW 12.

## CLAIM

> A decision made after the player has already seen feedback about a pattern is not automatically
> comparable with a decision made before that feedback.

LAW 12 states this and then refuses to choose a schema for it, because choosing one before the
audit is exactly the blind change the audit exists to prevent. This file is the audit.

The question it had to answer, in the law's own words: **are decisions taken after a reveal, a
claim or a learning intervention pooled with decisions taken before one?**

**They are, completely, and no field in the record could separate them.** That is the answer, and
two smaller things were found on the way to it that can be fixed without choosing anything.

## LOCAL EVIDENCE

### What was read

`ATOM_FIELDS` and `decisionAtomSchema` (`shared/decision-atom.ts`), `StratumKey` / `stratumKeyOf` /
`forDiscovery` (`shared/evidence-policy.ts`), `CURRENT_PROTOCOL_VERSION` and its docblock
(`shared/measurement-protocol.ts`), `BlitzStratumKey` (`shared/blitz-strata.ts`), and `gapsByGame`
(`shared/discovery/clustering.ts`).

### Finding 1 — `protocol_version` was stamped on every row and read by nothing. **Fixed.**

`measurement-protocol.ts` has said since it was written:

> if the confidence sampling rate moves, or the moment the question appears moves, then
> "instrumented-blitz" before and after are two populations. The version is what lets a later
> reader tell them apart

The one module in the product that decides what may be pooled — `StratumKey` — carried `protocol`,
`revealTiming` and `engineBuild`, and **not** the version. This is the same sentence
`evidence-policy.ts` already writes about reveal timing, one axis up: *"The recording happened. The
wall did not exist."*

`shared/blitz-strata.ts` got it right and was never generalised. `BlitzStratumKey` carries both
`protocolVersion` and `samplingPolicyVersion`, with the argument spelled out:

> an axis that is free while it is constant is the only kind that ever gets added, and the day one
> of them moves is the day pooling across it would have been silent.

`protocolVersion` is now an axis of `StratumKey` too. `legacy` is its own stratum rather than
version 1, for the reason the module already gives about every other unstamped field.

### Finding 2 — LAW 1's decision focus changed the stimulus and the version had not moved. **Fixed.**

Before `17c535c`, a player in the `instrumented-standard` loop stated how sure they were with
`<ClaimPanel>` on the same branch — findings about their own past decisions, their calibration
among them — and at the counterfactual stage the whole reveal column rendered, dashboard included.

`CURRENT_PROTOCOL_VERSION` is `2`. The instruction in that file is *"BUMP THIS when anything changes
about HOW a decision is produced"*, and what is on screen while an answer is given is that kind of
fact: the examples given beside it are a sampling rate and the moment a question appears.

This is not a claim that the v1 rows are wrong. It is a claim that they are not the same
population — weaker, and much safer.

**Finding 1 is what makes Finding 2 mean anything.** A version that moves while nothing stratifies
on it is worse than a version that never moves: it reads as though the change were recorded as a
separable population when the two still pool. The axis and the bump belong in one commit and are
in one commit.

### Finding 3 — within-player exposure has no representation at all. **Not fixed, on purpose.**

Decision #1 is taken by somebody who has never seen a reveal. Decision #200 is taken by somebody
who has seen 199, has read at least one claim about their own calibration, and may have run a drill
and a learning transfer in between. **They are one population, and nothing in the atom could tell
them apart.**

- No atom field orders decisions or counts prior exposure. `ATOM_FIELDS` has no sequence, no index,
  and no count. `feedback` is the player's own revision of their read, not exposure to anything.
- `entry_state` carries `game_id` and `ply` — position within one game, not position within a
  record.
- `gapsByGame` groups by game because the unit of inference is the game (D02). Games are unordered
  there and no exposure travels with them.
- The three axes of `StratumKey` are all properties of the *build*, not of the player's history.

So the answer to LAW 12's question is unqualified, and the exposure of every decision in the record
is unknown rather than merely unrecorded.

## ALTERNATIVES

Three contracts could represent it. They are not equivalent and this file does not choose:

1. **An exposure epoch.** A monotone counter on the record, bumped whenever the player is shown a
   claim, completes a drill, or finishes a learning transfer; stamped on every decision.
   *Cheap to write, and a stratum axis by construction. Coarse: it cannot say WHICH claim, and a
   player who saw one claim about openings has not been exposed with respect to a claim about
   time pressure.*
2. **A per-claim exposure flag.** Each decision records which claim ids the player had been shown
   before it.
   *Precise, and it is the one that answers the question a detector actually asks. Costs a
   many-to-many on every row, and its size grows with the record.*
3. **A count of prior reveals.** One integer, already derivable from the record's own ordering.
   *Almost free and re-derivable for historical rows without asserting anything nobody wrote down
   — the only one of the three with that property. It conflates "has been told 199 times how a
   move scored" with "has been told once what their weakness is", which are different exposures.*

## COUNTEREVIDENCE

**The strongest argument against doing anything here is that it may not matter.** Feedback exposure
is a threat to comparability, not a demonstrated effect: nothing in this repository has measured
whether a player's calibration gap moves with exposure, and a stratum axis added for a threat that
turns out to be flat costs statistical power on every claim for the life of the product.
`MIN_BUCKET_N = 30` is not generous, and every axis multiplies the number of strata.

**The argument against choosing now specifically** is that all three options are cheap to add later
and expensive to change once rows carry them, and that option 3 can be reconstructed for existing
rows while 1 and 2 cannot. Deciding under that asymmetry, before any measurement, would be picking
the schema blind — which is the thing LAW 12 exists to stop.

## UNCERTAINTY

Unknown, and each would change the answer:

- whether the calibration gap moves with exposure at all, and in which direction;
- whether it moves with *reveal* exposure (many, uninformative about the player) or with *claim*
  exposure (few, explicitly about the player) — options 1 and 3 cannot distinguish these;
- whether the product will ever have enough decisions per player for an exposure-stratified
  estimate to be worth having.

## DECISION

**Findings 1 and 2: closed.** `protocolVersion` is an axis of `StratumKey`;
`CURRENT_PROTOCOL_VERSION` is 2. Held by
`tests/shared/two-regimes-are-not-one-population.test.ts`, which now asserts that two decisions
differing only in protocol version do not pool, and that an unversioned row is its own regime
rather than version 1.

**Finding 3: `DEFER`, with its trigger written down.** No exposure field is added. The three
options above are recorded so that whoever adds one is choosing between them rather than inventing
one, and `GATE-EXPOSURE-CONTEXT` stays unregistered until there is something for it to hold.

**What may not happen in the meantime:** Discovery must not widen — no new claim class, no new
bucket variable, no new consumer admitted by `evidence-policy.ts` — on the assumption that exposure
is uniform. It is not uniform and it is not recorded. This is the constraint LAW 12 asks for and it
is the whole of what this node delivers for Finding 3.

## REVERSAL CONDITION

**What would start the work:** a measurement showing the calibration gap differs between early and
late decisions within a player, at n ≥ `MIN_BUCKET_N` per half, on the existing record. The record
can already be split by decision order after the fact — that is the point of option 3 being
re-derivable — so this measurement needs no schema change to run. If the halves do not differ, the
axis is not worth its power and this node closes as `REJECT` with the measurement attached.

**What would reverse Findings 1 and 2:** evidence that the decision focus does *not* change the
confidence a player states — a within-subject comparison across the v1/v2 boundary showing the
distribution unmoved. That would make version 2 a version bump with no population behind it, and
the honest response would be to say so here rather than to merge the strata, because the rows would
still have been produced under two different screens.
