# The evidence window and the learning window

A bounded programme with one question:

> **While evidence is still mutable, minimise cognitive intervention. Once the evidence window
> closes, maximise the learning the evidence actually justifies.**

Not a UX cleanup. The target is not fewer questions, fewer screens or less text, and
`docs/INERTIAL_UX_LAWS.md` LAW 9 already holds three of this product's surfaces behind a research
gate precisely because their friction **is** the instrument.

## The distinction the whole directory rests on

**Instrument literacy** -- what a player must learn about Decision Lab to use it. A cost. Target
zero.

**Decision literacy** -- what a player learns about their own reading, confidence and choosing from
having used it. The product. Target as much as the evidence supports.

> The player should learn as little as possible about the instrument in order to use it, and as
> much as possible about themselves as a result of using it.

## Read in this order

| # | document | what it settles |
| --- | --- | --- |
| 1 | [`CURRENT_STATE.md`](CURRENT_STATE.md) | the frozen baseline: SHAs, test status, invariants, five defect candidates including one refuted by its own measurement |
| 2 | [`PRE_EVIDENCE_SURFACE_LEDGER.md`](PRE_EVIDENCE_SURFACE_LEDGER.md) | every surface on screen while the evidence is mutable, classified, with a reactivity rating and an authority |
| 3 | [`OBSERVATION_LEARNING_BOUNDARY.md`](OBSERVATION_LEARNING_BOUNDARY.md) | the exact event after which the evidence is fixed, and the Production / Reveal / Accumulation contracts |
| 4 | [`DESIGN_ALTERNATIVES.md`](DESIGN_ALTERNATIVES.md) | five architectures, a scoring framework frozen before any score, and where the scores stop meaning anything |
| 5 | [`DESIGN_DECISION.md`](DESIGN_DECISION.md) | `NO WINNER -- FIELD REQUIRED` for the architecture; the contradiction fixes ship as a floor |
| 6 | [`WORK_PLAN.md`](WORK_PLAN.md) | every task tagged `REPO-CERTAIN` / `RESEARCH-GATED` / `FIELD-GATED`, the change map, the do-not-change list, the stop condition |
| 7 | [`MEASUREMENT_REACTIVITY_EXPERIMENTS.md`](MEASUREMENT_REACTIVITY_EXPERIMENTS.md) | the six experiments that could change a decision, in dependency order |
| 8 | [`FIELD_COMPANION_PROTOCOL.md`](FIELD_COMPANION_PROTOCOL.md) | Arms D and E, added beside the frozen protocol, rewording nothing |

## What shipped

Four sentences this build said that this build contradicted, each with a test shown red under its
own defect:

- the first decision presented two fields as required that nothing required;
- the commitment intro instructed a step the state did not offer, on ~6 ordinary decisions in 7;
- the board told a first-time arrival they had come back to a game they had never seen;
- the help screen described a four-step loop that runs on about one decision in seven.

Plus a step head the sticky submit was covering -- the layout suite was clearing it by four pixels
-- and one experiment arm, `QUIET_EVIDENCE_WINDOW_ENABLED`, **off by default**, which is the single
arm that can falsify the leading architecture rather than confirm it.

Nothing else. No instrument changed, no threshold moved, no schema changed, no protocol version
bumped.

## What did not ship, and why

`DESIGN_DECISION.md` returns `NO WINNER -- FIELD REQUIRED`. The leading architecture leads by 4
points out of 100, and the one dimension that is `FIELD REQUIRED` in every cell carries 15. Locking
it now would be pseudo-precision dressed as a decision.

## Where the authority is

Not here. `runtime/handoffs/HANDOFF-LICHESS-FIELD-001.json` in
`ereztash/product-perception-sensemaking-architect` is an open handoff to FIELD for `F-HUMAN-CORE`,
and `research/lichess-prerelease/FIELD_RUN_SHEET_TRIAL1.md` carries zero participant rows.

This work does not reopen that. It observes that four sentences on the way to a first decision were
false, and that a comprehension trial run over them would have produced comprehension data about
defects. They are fixed. **The next move is a participant.**

## Re-measuring

```bash
npm run build
node research/ux-measurement/probes/pre-evidence-surfaces.mjs probed
node research/ux-measurement/probes/pre-evidence-surfaces.mjs unprobed
node research/ux-measurement/probes/tension-and-disclosure.mjs
```

See [`probes/README.md`](probes/README.md) for what each measures and for the two instrument
properties that already changed a finding.
