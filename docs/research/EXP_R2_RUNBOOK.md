# EXP-R2 runbook — recruitment to verdict

**Status: THE SEQUENCE ANOTHER RESEARCHER FOLLOWS.** Every step names what is run, what must be true
before the next step, and which stop code fires when it is not. A step that cannot be completed is a
stop, not a thing to work around.

Companion documents: the frozen design is
[`EXP_R2_RESOURCE_FIELD_PREREG.md`](./EXP_R2_RESOURCE_FIELD_PREREG.md); the architecture and the open
decision are in [`EXP_R2_EXECUTION_PLAN.md`](./EXP_R2_EXECUTION_PLAN.md); the known defects in the
design are in [`TCRF_CONSTRUCT_AUDIT.md`](./TCRF_CONSTRUCT_AUDIT.md).

---

## Phase 0 — before anything

**0.1 Read the audit, then decide A-2.**
`TCRF_CONSTRUCT_AUDIT.md` A-2 shows that constraint and coalition manipulations shifted winning
chances by 0.32 and 0.42 in the pilot, with identical material, because the structure being removed
is the advantage. The execution plan §5 gives three routes. **This decision is the owner's and it
must be made and recorded before a single stimulus is authored**, because it changes how many pairs
are needed and whether §4.3 is amended.

**0.2 Confirm the tree is green.**

```bash
npm run verify
```

Covers typecheck, build, the full suite, 44 gates and 44 positive controls. `GATE-TCRF-STIMULUS` and
`GATE-TCRF-BLIND` are the two that matter here. Note what `verify` does **not** cover: with
`DATABASE_URL` unset the database suite skips, which `npm run verify:scope` prints.

---

## Phase 1 — stimulus construction

This phase is the first hard problem and it is allowed to end the study.

**1.1 Author candidates** into `research/tcrf/stimuli/CANDIDATES.json`. Seven hand-written fields per
pair: `template_id`, `family`, the three FENs, `base_arm`, `target_relation`, the two
`target_affordance_*` sets. Everything else is derived.

Authoring rules learned from the pilot, each with its evidence:

- **Work in near-balanced positions.** Outside winning chances `[0.133, 0.867]` the §4.3 comparison
  has no resolution and the pair is blocked as `VALUE_MATCH_UNRESOLVED` (audit A-4). A pair that
  looks perfectly matched at 1.000 / 1.000 is not matched, it is decided.
- **Break a coalition by moving the lower-degree carrier.** Relocating a queen produced a 27-relation
  diff; relocating the rook in the same position produced 13 (audit A-12).
- **Keep an enemy slider off the line you are editing**, or the edit introduces a pin as a side
  effect. The pilot's first line-activation attempt did exactly that.
- **Affordance moves must be legal for the side to move in that arm.** Two pilot candidates listed
  the wrong side's move and were caught by `AFFORDANCE_ILLEGAL`.
- **Balance `base_arm`.** All eight pilot candidates were edited away from PRESENT, which is the
  maximally skewed arrangement (audit A-3).

**1.2 Derive and validate, without the engine first** — fast, and catches every structural error:

```bash
npx tsx scripts/build_tcrf_stimuli.ts
```

**1.3 Run engine matching** under both §4.3 configurations:

```bash
npx tsx scripts/build_tcrf_stimuli.ts --engine scripts/sf-wasm.sh
```

Shipped is `go depth 14`, the search a player is shown at reveal. High budget is `go nodes 2000000`
with MultiPV 2, which also supplies the forcing-gap asymmetry §4.5's reviewers need. Roughly four
searches per pair; budget wall-clock accordingly.

**1.4 Independent review.** §4.5: two chess reviewers, **blind to the behavioural hypotheses and the
language conditions**, independently confirm the target topology is present and disrupted as
labelled, that no unrelated one-move tactic was introduced, the per-arm target-affordance set, and
that no shown description reveals the manipulation. Start them on the pairs carrying a
`FORCING_ASYMMETRY` flag. Disagreement is resolved before recruitment. Set `review_status` to
`REVIEWED_ADMISSIBLE` and record both `reviewer_ids` and the notes; the validator blocks a pair with
fewer than two reviewers.

**1.5 Gate.** `npm run gates` must be green, and the `GATE-TCRF-STIMULUS` detail line reports the
admissible primary count per family.

> **STOP-R2-STIMULUS** — fewer than 24 admissible primary templates. Rebuild the stimuli. Do not
> loosen §4.2 or §4.3 to admit more pairs: the tolerances are what make the comparison a topology
> comparison rather than a value comparison.

**Expect this to be the expensive phase.** Pilot yield was 2 of 8 first-attempt candidates clearing
every structural and value invariant, which implies roughly 90–120 authored pairs for a 24–32
template set, before the reviewers see anything.

---

## Phase 2 — discovery cohort (n = 60)

The discovery cohort **builds the codebook and may not test the hypotheses.**

**2.1 Recruit 60.** Inclusion per §3.2: a Lichess account, a non-provisional blitz rating, at least
50 rated standard blitz games, 18+. No rating cutoff; rating is analysed continuously. Record context
descriptors (country of residence, where most chess was learned, primary training mode, age band,
years of experience) as **descriptors**. They are never causal explanations and no artefact stores a
culture.

**2.2 Run sessions** under `research/tcrf/protocol.ts`. The ordering is enforced: position, timer,
commit, freeze, optional probe, reveal. The machine throws on any other order.

**2.3 Cognitive interviews** in all three languages: ask what each question meant to the participant.
Revise the Hebrew and Spanish wordings in `probe-wording.ts`, recording `back_translation`,
`cognitive_interview_note` and `revised_from`, and advance their `state` to `FROZEN`. They are
currently `DRAFTED` and that is deliberate: §7.3 freezes them *after* discovery.

**2.4 Set the confirmatory time regimes.** Per template: `TIGHT` = discovery median completion time,
`ROOMY` = discovery 90th percentile, both capped at 45 s and floored at 3 s, identical across the two
arms of a pair.

**2.5 Build the codebook.** Six representation levels plus `OTHER_UNCLASSIFIED`, the per-template
`target_structure_mentioned` and `target_telos_linked` rules, and the polarity rule from audit A-1:
**the primary variable counts presence-assertions only**; explicit-absence mentions are coded into
`target_structure_referenced`. Write the per-template rules in the form the coder receives them —
*"the response asserts that the rook on e1 covers the knight on e5"* — never in a form that names the
condition.

**2.6 Freeze.** Commit the codebook, every valid primary stimulus pair, the target-affordance labels,
the confirmatory time limits and the analysis scripts. Record `CodebookFreeze` with
`frozen_at_git_sha` and `confirmatory_responses_read: 0`. `freezeIsAdmissible()` refuses a freeze that
read any confirmatory response.

> **Nothing after this point may change a threshold, a wording, a stimulus or a coding rule.**

---

## Phase 3 — confirmatory cohort (n = 180)

**3.1 Recruit 60 per language stratum** — Hebrew, English, Spanish. These are **measurement-language
strata, not three cultures.** Aim for broad rating coverage within each; report any stratum whose
rating range is materially narrower and interpret H4 conditionally.

**3.2 Assign.** 16 of 32 templates per participant under a balanced incomplete-block design. Template
assignment, topology variant, trial order, time regime and probe assignment are randomised from a
**stored seed**. A participant never sees both arms of one template.

**3.3 Run.** Probe on 50% of trials, selected before the session and recorded. A timeout records
`probe_delivery: "blocked_timeout"` — there was no decision to ask about — and leaves `think_ms`
null rather than writing the budget into it.

**3.4 Record provenance** per trial via `research/tcrf/trace.ts`: commit, protocol version, stimulus
version, detector versions, language version, codebook version, seed, assignment, condition, regime,
probe assignment, rating snapshot. Raw account data does not enter the repository and there is no
field for a username.

> **STOP-R2-SAMPLE** — fewer than 120 confirmatory participants. No verdict.
> Fewer than 35 in any stratum: H4 is `NOT ESTABLISHED`; H1 and H2 may still be tested pooled if the
> total floor is met.

---

## Phase 4 — coding

**4.1 Build the blinded batches.** `buildCodingBatch()` constructs each payload from a whitelist and
sorts by a salted token, so collection order cannot leak session structure. The salt lives outside
the repository. Coders receive the response text, the language, the frozen per-template rule and an
opaque token — and nothing else. Contaminated, unprobed and unanswered trials are excluded before
coding, not after.

**4.2 Two independent coders per response**, blind to condition, evaluation, move quality, rating and
result, coding in the **source language**. Machine translation may exist as a convenience copy and is
never the coding source; `ResourceTrial` has no field for one.

**4.3 Reliability.** Krippendorff's alpha on `target_structure_mentioned`.

> **STOP-R2-CODE** — pooled alpha below 0.80. The TCRF subjective layer is not established.
> A stratum below 0.70 blocks H4 for that stratum only, and is investigated **without changing the
> confirmatory codebook**.

**4.4 Adjudicate** if wanted. Adjudication may produce a final coded dataset and **does not erase the
pre-adjudication reliability figures**, which are what §8 reports.

---

## Phase 5 — analysis, read once

**5.1 Report C-I first.** The distribution of representation levels, and the base rate of
relation-level-or-higher responses, **before** H1 is interpreted. A rate of zero in both arms is a
pass-shaped null and must not be read as "topology changed nothing" (execution plan §2).

**5.2 Fit the six models** exactly as `research/tcrf/analysis/plan.ts` states them, with participant
and template random intercepts and participant-cluster bootstrap CIs. This repository ships no mixed
model; the formulas are handed verbatim to the external tool, and the tool and its version are
recorded beside the result.

**5.3 Run every control.** C1 through C9 in `analysis/controls.ts`. A failed control is a result.

**5.4 Report contamination counts by kind**, not as a total: a reveal before commit is a broken
instrument and a reveal before probe is a broken question.

**5.5 Verdict**, from `stop-conditions.ts`:

| H1 | H2 | H4 | verdict |
| --- | --- | --- | --- |
| fail | — | — | `STOP` |
| pass | fail | — | `RESEARCH_ONLY` |
| pass | pass | not established | `CONDITIONAL_RESEARCH` |
| pass | pass | pass | `UNLOCK_EXP_R3` |

**No outcome unlocks production UI.** And `UNLOCK_EXP_R3` still leaves R3 blocked on P-3 and P-4 in
[`TCRF_EXP_R3_PRECONDITIONS.md`](./TCRF_EXP_R3_PRECONDITIONS.md).

**5.6 Write `EXP_R2_RESULTS.md`** in the shape `BLITZ_COMPUTATION_RESULTS.md` uses: what was
established and at which rung, provenance, every gate and control with its verdict, deviations from
the preregistration, what would change the verdict, and the verdict matrix. A failed hypothesis is
reported as a finding, not as a reason to re-run.

---

## Stop codes, one line each

| code | fires when | what is permitted next |
| --- | --- | --- |
| `STOP-R2-SAMPLE` | confirmatory n < 120 | recruit more, or report as not run |
| `STOP-R2-STIMULUS` | < 24 admissible primary templates | rebuild stimuli; never loosen §4.2 or §4.3 |
| `STOP-R2-CODE` | pooled alpha < 0.80 | report the alpha; do not change the codebook |
| `STOP-R2-H1` | topology does not change representation | report the null. The programme stops |
| `STOP-R2-H2` | representation adds no held-out information | `RESEARCH_ONLY`. No product work of any kind |
| `STOP-R2-CONFOUND` | value, tactics or collateral edits explain it | rebuild the stimuli; do not reinterpret |
| `STOP-R2-TEMPLATE` | one family, or no transfer to unseen templates | state the scope; a family effect is not a field |
| `STOP-R2-LANGUAGE` | sign reversal, or a lexical artefact | report per stratum; do not pool across a reversal |
| `STOP-R2-REACTIVITY` | probing at t changes behaviour at t+1 | probes are interventions in all later work |
| `STOP-R2-INSTRUMENT` | the effect needs the interface to name the relation | stop. The measurement created the construct |

No threshold is changed after a stop condition fires.
