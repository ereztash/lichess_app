# `docs/measurement/`

A decision about whether to build a behavioural-transfer feature. **The decision was no**, and
these are the artifacts that reached it.

Read in this order:

| file | what it is |
| --- | --- |
| [`GO_NO_GO.md`](GO_NO_GO.md) | **start here.** The eight questions and their answers |
| [`INTERPRETATION_USE_ARGUMENT.md`](INTERPRETATION_USE_ARGUMENT.md) | the claim, frozen before evidence was collected, as a Kane inference chain |
| [`EXISTING_MEASURE_AUDIT.md`](EXISTING_MEASURE_AUDIT.md) | twelve silos searched before anything was designed |
| [`FALSIFICATION_REGISTER.md`](FALSIFICATION_REGISTER.md) | ten attempts to break the construct, and what each returned |
| [`RULE_CLASS_SEARCH.md`](RULE_CLASS_SEARCH.md) | the second iteration: is there a rule class where `knowledge → action` is identifiable at all? **One of five candidates passed** |
| [`CONSTRUCT_DECISION.md`](CONSTRUCT_DECISION.md) | SURVIVES / NARROW / REPLACE / REJECT → **NARROW**, and why the narrowing renames it |
| [`ITEM_BANK_PROTOCOL.md`](ITEM_BANK_PROTOCOL.md) | what a bank would have to satisfy. Specified, **not built** |
| [`ANALYSIS_PLAN.md`](ANALYSIS_PLAN.md) | score validation before learning validation; every threshold sourced or marked unresolved |
| [`ECOLOGICAL_EXTRAPOLATION_GAP.md`](ECOLOGICAL_EXTRAPOLATION_GAP.md) | the L0–L5 ladder and the four gaps between a task and a game |
| [`EVIDENCE_MANIFEST.json`](EVIDENCE_MANIFEST.json) | every source, with its evidence tier and where it was used |
| [`STRONGEST_PERMITTED_CLAIM.json`](STRONGEST_PERMITTED_CLAIM.json) | the machine-readable version of what may and may not be said |
| [`RULE_CLASS_SCREEN.json`](RULE_CLASS_SCREEN.json) | the rule-class gates and their outcome, derived from the measurements rather than written by hand |

Scripts and results: [`research/measurement/`](../../research/measurement/). Executable controls:
`tests/research/measurement-*.test.ts`.

## The one sentence

The **detector** survived falsification. The **measurement** did not: on 15% of the positions where
the rule says to capture, capturing loses at least a pawn; on 23% of the comparison positions the
scored error is the engine's best move; and the two item sets differ substantially before any player
is involved.

And the reason, found in the second iteration: **T can be objectively true without having a single
correct B.** An offensive rule competes with everything else on the board; a defensive rule against
mate does not, because the alternative is losing. That is why `answer-the-mate-threat` scores .968
where `take the loose piece` scores .784.

## What was not done

No production code was changed. No feature was built. No item bank was constructed. Nothing was
merged.
