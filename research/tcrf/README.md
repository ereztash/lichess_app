# EXP-R2 — telos-conditioned resource field, executable parts

Research-only. Nothing here is imported by `client/src`, nothing renders, and no product surface
changes. See [`docs/research/EXP_R2_EXECUTION_PLAN.md`](../../docs/research/EXP_R2_EXECUTION_PLAN.md)
for what each module is for and why the architecture is shaped this way.

The frozen design is [`docs/research/EXP_R2_RESOURCE_FIELD_PREREG.md`](../../docs/research/EXP_R2_RESOURCE_FIELD_PREREG.md).
Section references in the source comments are to that document.

```bash
# derive and validate the stimulus manifest, without an engine
npx tsx scripts/build_tcrf_stimuli.ts

# the full §4.3 matching run, both engine configurations
npx tsx scripts/build_tcrf_stimuli.ts --engine scripts/sf-wasm.sh

# the two gates, and the controls that prove they can fail
npm run gates && npm run gates:controls
```

`stimuli/CANDIDATES.json` is hand-authored and `stimuli/PRIMARY_V1.json` is derived from it. The
derived file is regenerated, never edited: every field in it is recomputed by
`GATE-TCRF-STIMULUS` and compared against the positions it claims to describe.

**The current manifest is a feasibility pilot, not a stimulus set.** Eight candidate pairs, none
reviewed, `STOP-R2-STIMULUS` would fire at recruitment. What it establishes is in
[`docs/research/TCRF_CONSTRUCT_AUDIT.md`](../../docs/research/TCRF_CONSTRUCT_AUDIT.md) A-2 and A-4.
