# Implementation report

Evidence class of everything below: **repository-verified**. Nothing here is FIELD-supported, and
the one claim a reader is most likely to make from it — that the product is easier to understand —
is exactly the claim this does not establish.

## What runs, and how it was run

The R&D result in `RND_TRACE.json` came through the actual Calibration Loop, not through reasoning
about it:

```
python runtime/calibration_loop/run.py <task> \
  --config runtime/calibration_loop/claude-cli-config.json --strict --output RND_TRACE.json
```

`final_state: COMPLETE`. Provenance per invocation is in `RND_PROVENANCE.jsonl`: one R&D
`DIAGNOSE`, one routed `NETA` `ANALYZE`, one R&D `SYNTHESIZE`, each a single turn through the Claude
CLI adapter with repository tool access disabled and a neutral working directory.

**Independence caveat, carried from the adapter and not softened.** Every resource in this run
shares one model lineage, so agreement between R&D, Neta and Scaffold is role-conditioned execution
and **not** independent triangulation. The trace records this on each invocation.

Two defects in the runtime were found by running it and repaired before the run of record. Both are
transport, neither touches the routing law or the epistemic method:

1. **Peers were handed context they could not read.** `context_refs` reached the peer as *paths*,
   and the CLI adapter disables `Read`. A smoke run's own synthesis caught it: *"the loop paid for a
   peer invocation while withholding the documents that define the peer's own constraints … every
   sufficiency test is biased toward BUILD."* `context_documents` now resolves them, bounded, with
   a delivery manifest stating every truncation and every failure.
2. **The `SYNTHESIZE` bridge contract omitted the closure its validator enforces** while asking the
   model to "preserve conflicts" with no field to put them in. The first live run returned an extra
   `_conflicts_preserved` key and was rejected **after both peers had been paid for**. The contract
   now states the closure and names `learning_records` as where conflicts go.

Both are covered by controls in `scripts/check_live_adapters.py`, each broken on purpose and
watched go red.

`RESEARCH` could not be named as an available resource: the calibration task schema's enum omits it
while the shared kernel lists it as an authority. Recorded in the task's constraints. **The schema
was not widened to make the task fit.**

## Files

| file | what it is |
| --- | --- |
| `shared/learning-journey.ts` | new. The state machine: nine stages, each carrying its construct, denominator, next act and stated limit |
| `shared/goal.ts` | new. The goal as copy, with the argument for why it is not a state |
| `client/src/components/JourneyLedger.tsx` | new. The plural ledger. Owns no control |
| `client/src/components/GoalNote.tsx` | new. Owns the goal and its storage |
| `client/src/lib/journey-readings.ts` | new. Record → readings adapter |
| `client/src/lib/player-goal.ts` | new. Per-browser storage, registered |
| `scripts/journey-scan.ts` | new. Two scanners |
| `client/src/lib/loop-position.ts` | `grade` stops being a terminal; the instrument/person overclaim repaired |
| `scripts/run_gates.ts`, `scripts/inertia-scan.ts` | two gates registered; the ledger registered under LAW 1 |
| `scripts/check_bundle_budget.ts` | two ceilings raised, with the per-move attribution |
| `client/src/pages/Record.tsx`, `client/src/index.css` | the layer, gated on a record with something in it |
| `docs/GATES.md` | 36 → 38 |

## Behaviour changes

**A graded claim is no longer the end of the loop.** A player who had graded a claim, written a rule
and had a retrieval test come due was told "more decisions may produce the next claim". The record
knew; the pointer did not read it. The four-step vocabulary is unchanged — a fifth label would be a
new thing to learn — and `grade` now names the rule work that is waiting.

**"No pattern cleared the threshold" became a statement about the detector.** The shipped six-bucket
detector returns `not-separable` on the owner's whole 2,209-game record, while the frozen research
pipeline finds a residual on that same record which survives its own within-game permutation null.
The old sentence was true of the instrument and false as a description of a person. `תשובה ולא
שתיקה` is kept verbatim: a first pass replaced it and `said-once.test.ts` caught the loss.

**Guided practice, prompted recall and unprompted play are three constructs.** The transfer
literature's *typical vs maximum* split is the name for the last two. `beginLearningTransfer` is the
prompted one, and the product called it transfer.

**Two new gates.** `GATE-GOAL-NOT-A-DENOMINATOR` refuses a goal in the same element as a count;
`GATE-CONSTRUCT-NAMED` refuses a stage number rendered without the construct it counts. Neither
defect contains a percentage, so `GATE-DENOM` cannot see either.

## What looking found that tests did not

The contact sheet's frame 19, on a 390×844 phone: the ledger read **"0 מתוך 60 החלטות מדודות"
directly beneath a dashboard reading `n=1`**, on a record holding one decision. Both numbers were
correct — `scored` is the discovery population and a bank answer is filed `separate` with its own
denominator — and they shared a word. `loopPosition` had already met this collision and fixed it by
giving the two registers different verbs; the ledger had reintroduced it. The count is now *what
this search counts*, and the decision it does not count is named rather than left as a hole in the
arithmetic. A second look found `1 החלטות`, which is not Hebrew, on the branch every new player
reads first.

**Cost in pixels.** The record screen after one decision: 2,019 → 2,340 CSS px. That is the honest
price of the layer and it is not hidden.

## Deliberate non-changes

No global progress number. No rating denominator, and `ratingSeries` stays unrendered. No prescribed
programme. No coaching-style selector — no evidence says one is needed, and deriving a register from
nationality would be a stereotype dressed as personalisation. No port of the research discovery
vocabulary into the product: that is a research decision with an open confound (`Q2`). No
onboarding: no usability evidence says the interface cannot teach itself.

The journey layer does **not** render on an empty record. It shipped without that gate for one
build, the front door grew from 137 to 184 words past a ceiling that only comes down, and the empty
record scored 0.084 of layout shift on a phone against a budget of 0.02. Both were the same wrong
idea: a record with no decision in it has no journey to summarise.

## Verification

`npm run verify` on the tip: **3,262 tests pass, 38 gates pass, 38 positive controls red, bundle
within the raised budget** (entry 676.5/677 kB, gzipped 211.8/212, initial 768.9/769).

Every new invariant was confirmed by breaking it on purpose and watching the assertion that owns it
go red: collapsing prompted sittings into a score out of three, reading the prompted stage before
the unprompted one, making the detector's silence a statement about the player, inventing a second
floor instead of reusing `MIN_BUCKET_N`, delivering a context path instead of a document, swallowing
an unresolvable reference, truncating silently, and removing the closure line from the SYNTHESIZE
contract.

Mobile inspected at 390×844 through the contact sheet and read as an image, which is how both copy
defects above were found.

## Claim boundary

This does not establish that the product is easier to understand, that a player can state the
journey, that anyone will continue using it, or that anything here improves play or rating. The
first of those is the subject of `FIELD_TEST_PROTOCOL.md`; the last is unreachable by the discovery
pipeline under any result.
