# M0 — the epistemic baseline audit

**The gate before any Discovery V2 code exists.** Four questions about the instrument this product
already ships. If one of them fails, the answer is not to build a better search — it is to repair
the instrument, because widening a search that sits on a biased measurement only widens the damage.

Every number below was produced by a run in `research/discovery-oracle/`, at the seeds and record
counts its `results/*.json` records. Nothing was recalled and nothing was estimated by eye.

---

## The four verdicts

| | question | verdict |
| --- | --- | --- |
| **Q1** | Do decision-level and game-clustered inference give the same conclusion? | **PASS, with a bound** — and the obvious repair is **refuted** |
| **Q2** | Is feature materialization free of future leakage under a point-in-time contract? | **PASS on what ships, FAIL on what enforces it** |
| **Q3** | Is every claim sent to a protocol that can reproduce the condition it names? | **FAIL** — established, and the choice is not this document's |
| **Q4** | Does the six-bucket detector survive the harness V2 would be judged by? | **HALF** — error control passes by a wide margin, power fails by a wide margin |

**Discovery V2 does not start.** Not because the instrument is broken in the way the plan expected,
but because Q3 is a live contradiction with an owner, and because Q4 changes what Discovery V2 is
*for*: the six-bucket detector's problem is not that it speaks too often. It is that it is silent.

---

## Q1 — is a decision an observation?

`shared/detector.ts` divides a bucket's gap variance by the number of **decisions** in it. That is
right if decisions are independent draws. `DecisionAtom` carries `game_id`, and moves from one game
share an opponent, an opening, a clock, a time control and a player who was in one state of mind
for all of them.

### The measurement, and why it is not a ratio of two estimates

The obvious experiment — compute both standard errors on one record and divide — answers the wrong
question twice. A cluster-robust error estimated from twenty games is itself very noisy, so the
ratio measures that noise. And neither estimate is the truth.

**The truth is available in simulation, and that is the whole reason for it.** Records drawn from
one null world are independent replications, so the spread of the bucket contrast **across** them
*is* the sampling error — measured, not estimated. `q1_units.py`, 400 records per world, 14 worlds,
6,000 records in total, judges both errors against it.

`sd(z)` below is the spread of `gapDifference / standardError` across independent null records.
**It is 1 when the standard error is right.**

| world | gap ICC between games | worst `sd(z)` shipped | worst `sd(z)` clustered |
| --- | --- | --- | --- |
| NULL-1 independent | −0.000 | 1.037 | 1.305 |
| NULL-2 within-game correlated | 0.016 | 1.137 | 1.223 |
| NULL-6 variable game lengths | 0.015 | **1.200** | 1.345 |
| sweep, game-level gap σ = 0.00 | −0.000 | 1.024 | 1.335 |
| sweep, σ = 0.04 | 0.007 | 1.068 | 1.413 |
| sweep, σ = 0.08 | 0.027 | 1.141 | 1.266 |
| sweep, σ = 0.12 | 0.058 | **1.380** | 1.572 |

Median across all 84 world×bucket cells: **1.022** shipped, **1.100** clustered.

### Three findings, and the second one is the surprise

**1. The shipped standard error is understated, and by a bounded amount.** Over the plausible range
of the game-level component it runs from 0% to **38%** too small. A stated 3.75-sigma bar is
therefore, at worst, a 2.7-sigma bar.

**2. The buckets that suffer are exactly the ones whose membership belongs to the game.**
`fast-under-45s`, `slow-over-2m` and `clock-under-1m` carry every one of the worst cells; the three
phase buckets sit at 0.92–1.05 throughout. This is Moulton's factor doing what it does: a clustered
residual costs nothing when the thing being compared varies freely *inside* a game, and the phases
all occur in every game while a three-minute game is entirely inside `fast-under-45s`.

**3. THE OBVIOUS REPAIR IS REFUTED.** A cluster-robust standard error — `statsmodels` `OLS` with
`cov_type="cluster"`, the reference implementation — is **worse** calibrated than the formula it
would replace in **82 of 84 cells**, and its false-positive rate under the null is *higher* in
nearly every one (up to 3.9% for one bucket against the shipped 1.5%). Twenty games is not enough
clusters for the sandwich to estimate itself, and the plan's assumption that clustering is the
correction does not survive contact with the number of games a real record has.

So **nothing in the detector changes.** `shared/discovery/clustering.ts` is what M0 adds instead:
the estimator that supplies the one number still missing — the intraclass correlation of a *real*
player's gap, which cannot be read off any screen today because `scoreDecisions` drops `game_id`
before the detector sees it.

### Parity

The shipped formula is reproduced in Python only so the difference between it and the clustered one
can be attributed (OLS's default error is pooled; the product's is not). Worst disagreement between
the reproduction and the real `gapDifferenceStandardError`, over every bucket of every record:
**9.7 × 10⁻¹⁷**.

---

## Q2 — does any feature know the future?

### What ships is clean, and it was checked rather than assumed

| feature the detector reads | observable at | evidence |
| --- | --- | --- |
| `phase` | before the decision | `classifyPhase(entry_state.fen, ply)`, re-derived server-side and refused if the client disagrees — `record-service.ts:176` |
| `secondsTaken` | at commit | `bounded_action.seconds_taken`; nullable, and null is never defaulted to 0 — `detector.ts:252` |
| `clockMsRemaining` | before the decision | *"the clock as the player FACED it — the reading before their move"*, `pgn-clock.ts:106`; live path writes `position.clockMsRemaining` at presentation — `decision-session.ts:216` |
| `confidence` | at commit | stated by the player; scale recorded, and a decision without one is refused at the boundary — `record-service.ts:190` |
| `accurate` | **after** | the engine's verdict. This is the **target**, and it is correctly never a predictor. |

**No leak found in any feature that reaches `detect()` today.**

### What fails is the enforcement

1. **Cleanliness is a property of prose and vigilance, not of a type.** Nothing in the tree could
   tell a leaked feature from a clean one. `shared/blitz-features.ts` already names the exact
   hazard in its own docstring — *"a reference drawn from the same decisions being read is leakage
   wearing a percentile"* — and then can only ask a caller to write down where the reference came
   from. A label on a column cannot see a value that was legitimately available and then
   **recomputed later from better information**, which is the shape the next leak will have.

2. **The largest leakage surface in the tree is unwired, not safe.** `shared/game-features.ts`
   exposes `DeepGameFeatures` — `totalMoves`, `gameLength`, `result`, `castlingSpeed`,
   `passedPawnCount` and twenty more — every one computed by replaying the **whole game**. Every one
   is post-game with respect to any decision inside it. It has **no consumers**; it arrived in a
   repository merge. The moment anything wires it to discovery, every claim it produces predicts
   the past. It is one import away.

**The repair is `shared/discovery/feature-contract.ts`**: the unit is an observation with three
timestamps, not a column with a label, and a read is positioned at a decision's own commit. A
recomputation is a *new observation with a later `observed_at`*, so a reader positioned before it
cannot see it — the percentile case becomes expressible instead of merely warned about. Three of
the tests in `tests/discovery/no-feature-from-the-future.test.ts` apply the mutations that matter —
moving the cutoff to the end of the game, dropping the observability filter, tightening `<=` to `<`
— and assert the answer changes, so the comparison is load-bearing rather than decorative.

---

## Q3 — is every claim tested by something that can reproduce its condition?

### **No, and the repository already knew.**

`docs/blitz/ADR-003.md` records it, reproduced with one line printed from the repository's own
drill-loop test:

```
DRILLED_CLAIM: claim-fast-under-45s | protocol INV-10 requires: timed-holdout
```

The product takes a claim about time pressure, drills it on eight static positions with no clock,
and grades it `refuted` or `replicated` — **and both grades are terminal.** `protocolFor` has said
since it was written that such a claim needs a timed holdout. Nothing consulted it. The rule was
true and inert.

### What M0 changes, and what it deliberately does not

**Changed.** The classification is now a **value**, derived from what a subgroup *reads* rather than
from a list of six names — `shared/discovery/claim-class.ts`, with the D20 taxonomy and its
dispatch:

| class | protocol | because |
| --- | --- | --- |
| `POSITION` | matched unseen positions | the condition is a board, and a board can be presented again |
| `ENVIRONMENT` | natural timed holdout | no choice of positions reproduces a clock |
| `POSITION_X_ENVIRONMENT` | timed matching condition | both halves have to hold at once |
| `SEQUENCE` | future complete games | an order of events exists only in a game played forward |
| `MODEL_DERIVED` | model-version-locked holdout | the model version is part of the claim |
| `UNKNOWN` | **no verdict** | nothing here knows what condition this names |

`shared/validation-protocol.ts` now derives `protocolFor` from that one table instead of keeping a
second list of keys, and answers exactly what it answered before — the existing test file is
unchanged and passes. A seventh bucket added without deciding how it can be validated classifies
`UNKNOWN` and gets no verdict, rather than defaulting to the only protocol on the shelf.

**Not changed, deliberately.** ADR-003 states three defensible resolutions — enforce INV-10, narrow
it to `clock-under-1m`, or grade by protocol — argues all three, and says the choice *"belongs to
whoever owns the product"* because it decides which claims the product can ever grade. Nothing here
settles it. What is settled is that whichever is chosen is now an edit to one table, against a
classification that exists as a value, instead of an argument reconstructed from scratch.

**Q3 remains FAIL until that choice is made.**

---

## Q4 — does the six-bucket detector survive the harness V2 would face?

`shared/detector.ts` was calibrated against a shuffled-label control — one record, permuted
hundreds of times, worst cell reported. That is a good control for the question it asks: *does the
search invent structure?* It is not the question here. The product does not stop at a search.

`q4_end_to_end.py` runs the **whole chain**, on the shipped code, over records whose truth is known:

```
detect(20 derivation games, DEFAULT_THRESHOLDS)          the six-bucket scan
readVariables(...).findings[0].strongest                 one claim, three variables
freeze that bucket key
detect(20 validation games, PREREGISTERED_THRESHOLDS, onlyBucketKey)
same sign, or it is a refutation and not a replication
```

The split is always on a **game** boundary, so no sitting appears on both sides of the wall.

### The error half: PASS, by a wide margin

10 null worlds × 800 records:

| | |
| --- | --- |
| validated false claims | **0 / 8,000** |
| 95% CI | **[0.0000, 0.00048]** |
| ceiling | 0.02 |

The per-world **claim-formed** rate — what a player would actually be shown, as a `hypothesis` —
runs 0.13% to 0.63%, rising to **1.5%** only in the sweep cell with a game-level gap component of
σ = 0.12 (ICC 0.058). Not one of those claims survived the prospective test. The two-stage freeze
absorbs the whole of the standard-error understatement Q1 measured.

### The power half: FAIL, by a wide margin

9 planted worlds × 400 records. `delta` is the planted shift in calibration gap; the coaching-scale
effect `shared/detector.ts` calibrates against is 0.255.

| plant | delta | any bucket fires | names the right bucket | validated end to end | validated **and** right |
| --- | --- | --- | --- | --- | --- |
| clean middlegame | 0.18 | 0.628 | 0.593 | 0.458 | **0.448** |
| clean fast | 0.18 | 0.278 | 0.265 | 0.125 | **0.125** |
| sparse low clock | 0.22 | 0.628 | 0.615 | 0.478 | **0.478** |
| weak middlegame | 0.07 | 0.028 | 0.020 | 0.003 | 0.003 |
| weak fast | 0.07 | 0.015 | 0.010 | 0.000 | 0.000 |
| interaction only (`fast AND endgame`) | 0.22 | 0.250 | **0.000** | 0.110 | **0.000** |
| proxy-correlated | 0.20 | 0.120 | **0.000** | 0.023 | **0.000** |
| every game, first moves | 0.20 | 0.045 | **0.000** | 0.000 | 0.000 |
| one game only | 0.22 | 0.005 | **0.000** | 0.000 | 0.000 |

Against a power floor declared in advance — lower 95% CI above 0.95 on effects declared strong
before the run — `clean-middlegame` lands at **[0.400, 0.497]** and `clean-fast` at
**[0.096, 0.161]**. Both **FAIL**, and not marginally.

### Three things this table says that the shuffled-label control could not

**1. `fast-under-45s` is nearly powerless, and the repository has already published why.** It fires
on a clean 0.18 effect less than half as often as the middlegame bucket does. The reason is the
finding of `docs/research/TIME_REPRESENTATION_RESULTS.md`: the shipped 45-second cut puts the
overwhelming majority of decisions on one side, so the contrast has almost no comparison group. The
B2 study reached that through a 117-game corpus; this reaches it through simulation and a
completely different route.

**2. An effect no bucket can express is not merely missed — it is MISATTRIBUTED.** The
interaction-only world plants a real effect in `fast AND endgame`. The chain fires on 25% of
records, and **validates a claim on 11% of them, naming the wrong subgroup every single time.**
The judge cannot catch this, because the judge tests the *bucket* that was frozen, and that bucket
really does separate — it overlaps the planted region. Error control against "nothing is there" is
intact; **attribution is not.**

**3. The mirror is under control.** `shared/bucket-variable.ts` was written because a middlegame
weakness made the opening look separable, in the underconfident direction, 19.5% of the time. Under
the same planted effect, through the chain that now includes it, the mirror rate is **1.0–3.0%**.
That module works.

---

## What these numbers do not cover

- **There is no real record.** No corpus of live decisions with stated confidence is committed, so
  every rate here comes from a simulated world. What that buys is a known truth to grade against;
  what it costs is that a real player may differ from the generative model in ways nobody has
  thought of. The one quantity that matters most — how much of the gap belongs to the game — is
  reported as a **sweep** rather than a value, precisely because it is not known.
  `shared/discovery/clustering.ts` is what closes it when a record with enough games exists.
- **The harness models the chain the V2 plan specifies, not the product's drill path.** The product
  as shipped has no prospective validation for a six-bucket claim: it forms the claim, shows it as
  a `hypothesis`, and only a drill can promote it. That drill path is out of scope here because Q3
  shows it is protocol-mismatched for three of the six buckets. The 0/8,000 figure describes the
  chain the plan proposes; the 0.13–1.5% claim-formed rate describes what the product does today.
- **Accuracy is simulated as a bit, not as an engine.** The harness draws the *outcome* of
  `accurateDecision`, not a centipawn loss and an evaluation. Nothing here measures the engine.
- **Power was measured on a 20-game derivation half and a 20-game validation half.** A player with
  more games gets more power. The figures are for that record size and no other.

---

## What M0 concludes

The plan came in expecting the instrument to be **too loud** — a detector reporting structure in
noise, needing a clustered error to restrain it. Neither half survived measurement. The
clustered error is worse at the number of games a record has, and the chain is already far under
its own false-claim ceiling.

**The instrument's defect is the opposite one.** It is silent on a coaching-scale effect more than
half the time, silent on a weak one essentially always, and when the truth is something its six
buckets cannot say, it does not stay silent — it validates the nearest thing it *can* say.

That reframes what Discovery V2 is for. Not a wider net for more claims. **A vocabulary that can
name what is actually there, and an attribution test that can tell the named region from a bucket
that merely overlaps it** — because Q4 shows the current judge cannot.

### The gate

| | |
| --- | --- |
| Q1 | closed, with an open **number** — the ICC of a real record |
| Q2 | closed by contract; the `game-features.ts` surface is **open** until it is declared or deleted |
| Q3 | **OPEN**, and it is a product decision. ADR-003 owns it. |
| Q4 | closed, and it changes the brief |

**Discovery V2 does not begin until Q3 is decided.** The mechanism is built; the choice is not
this document's to make.
