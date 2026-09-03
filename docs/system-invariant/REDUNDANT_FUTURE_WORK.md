# Work that is now redundant, and work that is still necessary

Mission section 27. The companion to `COMPUTE_VALUE_EXTRACTION.md`: that document stopped engine
searches being bought twice, this one stops *capabilities* being built twice.

Each entry is `REDUNDANT because <existing asset>` or `STILL NECESSARY because <specific missing
quantity>`. Nothing is listed as redundant on the grounds that it is merely similar to something
that exists.

---

## Redundant

### A new system-health composite score
**REDUNDANT because** `p3_system_invariant.py` already computes 24 named relational quantities, and
the pressure-exposure test already showed what happens when two of them are combined without
evidence for the weighting: `OpponentPressure` moved the pooled ranking by `-0.84 pp`,
CI `[-1.85, +0.20]`, and its incremental contribution after exposure was `-0.37 pp`. A weighted
average of columns whose individual signs have not been established is a parameter set nobody
measured. `RESEARCH_QUESTION_FREEZE.md` forbids one for this mission and the reason generalises.

### A second natural-decision sampler
**REDUNDANT because** `research/b3_population_expertise/src/ingest.py` already encodes header
qualification, the structural rated check read from `RatingDiff` rather than the Event string, bot
and termination exclusions, the one-analysed-side-per-game rule, the per-player game cap by
reservoir and the per-side decision cap by even ply spacing. `ingest_natural.py` calls it. A second
sampler would be a second authority for one question.

### A second freeze mechanism
**REDUNDANT because** `docs/learning-v3/FREEZE.json` plus `scripts/learning-v3/verify_freeze.py`
plus the `GATE-RESEARCH-RECONCILED` relation already implement freeze-before-analysis with a
machine check. This mission generalised the verifier to take a freeze path rather than copying it,
and registered one new relation. Nothing else was needed.

### A second engine-evaluation cache
**REDUNDANT because** `research/learning-v3/cache.py` already defines the content-addressed identity
including the root set, which was the defect a first version had. `score_natural.py` imports
`key_for` rather than defining a second key format.

### A ported copy of the OwnExposure metric
**REDUNDANT because** `features.py` calls P3's `system_state`. A port plus an equivalence test still
drifts the first time somebody edits one side. The test asserts the running function was defined in
P3's file.

### Re-scoring any position already in the learning-v3 corpus
**REDUNDANT because** the standing rule and `cache.py` cover it. This mission's searches use a
policy and node budget that do not exist in that corpus (`multipv-8-full-width` at 60,000 nodes
against `multipv-over-B` and `full-width` at 200,000), so they are different measurements with
different keys, and nothing was recomputed.

### A new preregistration format
**REDUNDANT because** the repository has three working ones already
(`SYSTEM_INVARIANT_P3_PREREG.md`, `PRESSURE_EXPOSURE_PREREG.md`, B3's
`PREREGISTRATION.md` with `PREREGISTRATION_FREEZE.json`). This mission reused the idiom.

### A separate statistics stack for dependence
**REDUNDANT because** B3 established the cluster-bootstrap discipline and the reason for it. The
resampling unit here is the player for Test A and the position for Test B, which is B3's own rule
applied to two different questions.

---

## Still necessary

### Scoring a natural sample
**STILL NECESSARY because** `quality_loss` requires a post-move search of the position a human
actually reached, and the preserved corpus contains none. Its 37,226 move evaluations are all
restricted to rule-class permitted sets on trigger-positive positions across 8,399 positions whose
modal candidate count is 2. No rearrangement of it yields a natural played move with a quality
label. This is the one genuinely new quantity this mission had to buy.

### An exposure record for the next participant
**STILL NECESSARY because** the P4 exposure moment is bracketed from commit metadata to 19 minutes
42 seconds and is *nowhere recorded*. That bracket happens to be enough here only because the
account corpus predates all of it by 18.6 hours. It will not be enough for a participant who plays
during the study.
**BUT CONSTRAINED:** `Q28` -- what the product may record about a person -- is deliberately
unresolved (`PARTIAL_AUTHORITY`: `ACQUISITION_EVIDENCE.md` is an authority for the acquisition
ledger, and `schema.ts` states capacity rather than permission). Mission section 15 therefore binds
this to the least persistent representation that answers the question, which for an N-of-1 is a
timestamp in a committed research artifact, **not** a `PolicyExposure` table carrying a
participant id.

### A sham-cue arm
**STILL NECESSARY because** P4 cannot separate "learned the cue" from "attended harder because
somebody was measuring". Its own CONTROL items moved by the same +25 pp as its TARGET items
(3/4 to 4/4 against 6/8 to 8/8), which is exactly the pattern a general attention effect produces.
No existing asset addresses this; it requires a second participant.

### Post-exposure natural games
**STILL NECESSARY because** the repository holds none. `PRE_EXPOSURE_BASELINE.md` freezes the design
that would read them.

---

## Deliberately not decided here

`DecisionAtom` versus a new natural-decision storage model. This mission wrote its rows to research
artifacts and touched no product schema, so it produced no evidence about which product
representation is right. Listing it as redundant would be asserting something not measured.
