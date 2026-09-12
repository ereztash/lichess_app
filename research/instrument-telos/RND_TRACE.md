# R&D / Calibration Loop run

Not a simulation. The actual runtime in `ereztash/Product-Perception-Sensemaking-Architect` was
invoked against the frozen audit.

```bash
python3 runtime/calibration_loop/run.py \
  research/instrument-telos/CALIBRATION_TASK.json \
  --config runtime/calibration_loop/claude-cli-config.json \
  --strict \
  --output research/instrument-telos/ITG_TRACE.json
```

| | |
|---|---|
| Task | `CAL-LICHESS-INSTRUMENT-TELOS-001` |
| `final_state` | `COMPLETE` |
| Routing fired | `NETA` on `multiple_plausible_mechanisms`, `proxy_substitution_risk`, `research_to_intervention_transition`, `signal_interpretation_ambiguity`; `AUTHORITY` on all three of owner, repo and field |
| Resource calls used | 1 of 6 |
| `stop_or_continue` | `CONTINUE` |
| Trace | `ITG_TRACE.json`, input `CALIBRATION_TASK.json` |

Three validator refusals preceded the run and are kept because they are part of the record:
`unknown available resource` twice, from a resource vocabulary this task invented rather than read,
and `budget fields drift`. The schema is `{max_resource_calls, max_parallel_calls}` and the
vocabulary is `{RND, NETA, SCAFFOLD, OWNER, REPO, ENVIRONMENT, FIELD}`.

## The bottleneck it named, before doing anything else

> The lens has no recorded refusal. Every measured cost so far cited in its support is also fully
> consistent with three hypotheses frozen before the audit.

That is the failure mode `DR_PLAN_0.md` named as "retrofit", identified independently by the
runtime from the signals alone.

## What it changed

**Disposition moved from `PARTIAL_ROOT_CAUSE` to `SCOPE_LIMITED_PARTIAL`**, and the run insisted
this is a bounded region claim rather than a weaker version of the whole claim. Three regions,
three different verdicts:

**(a) Refuted in the per-decision region.** The run took the confidence draw as the case the lens
most strongly predicts should read as aversive, and found it goes the other way: `nextQuestion`
consumes `statedUnknown` on the very next screen, and the repository already ran this mission's
delete test on itself, cutting the read fields from required to sampled with the reason recorded.

> That is the recorded refusal the pre-invocation diagnosis said the lens lacked, and it was in hand
> rather than in FIELD.

This contradicted the run's own prior expectation, which was that the confidence draw would be the
residue carrying the mechanism. The two readings were kept as a genuine disagreement and not
averaged.

**(b) Mis-specified in the record-page region.** The two denominators cost the player nothing to
render, so they fail the delete audit's own unit of a costly action. Folding them into an
instrument-burden hypothesis is a category error against what is actually a trust and ontology
defect.

**(c) Scope-limited to the accumulation and flag regions.** What survives is the telos chain
breaking at the 60 threshold and at the flag boundary, **which are precisely H3 and H4**, the two
competitors pre-registered against the owner's hypothesis. The run recorded that the written
reversal condition is therefore partially met before any FIELD contact, on REPO grounds.

It also relocated the candidate highest-value owner decision from the confidence draw's level to
`PROBE_PROBABILITY = 0.35`, conditional on a fork it opened.

## Three distinctions it said the ledger's vocabulary cannot express

1. **Rendered is not noticed.** Salience is not beneficiary mismatch.
2. **A zero-cost defect is outside the delete audit's unit**, which is a costly action.
3. **Taps per decision is a burden measure being read as an attribution claim.** Two actions at
   identical tap cost can differ entirely in who benefits.

All three are correct and all three apply to this audit's own ledger.

## The fork it opened, and its closure

The run found a stable tap residual in both walks that does not scale with decision count, and
said it is either fixed navigation overhead, which would over-credit the mechanism, or unmeasured
probe firings, which would under-state instrument cost. It called the fork REPO-decidable and
refused to report a finding until REPO answered.

**Closed here, by decomposing the two existing walks rather than re-walking**, which is what the
run asked for. The walk script's `tryMove` clicks candidate source squares until one has a legal
target, so every source with no legal move costs a tap that no human would spend.

Walk A, 34 taps over six decisions:

| Target | Taps |
|---|---|
| Board, productive | 12 |
| Board, exploratory, an artefact of the script | 5 |
| Submit | 6 |
| Continuation | 6 |
| Confidence | 2 |
| Reads | 2 |
| Counterfactual probe | 1 |

**The residual is script exploration, not unmeasured probes.** Removing it leaves 29 real taps, of
which the instrument layer is **5, about 17 percent**. Walk B, decomposed the same way and stripping
four disclosure taps this audit added, leaves 20 real taps of which 4 are instrument, **20 percent**.

So the answer to the fork is the branch that **weakens** the mechanism claim: the instrument layer
is about a fifth of the taps in a live game, and the core loop is the rest.

## The second REPO item: is 1-of-6 the designed rate or a tail?

Closed by arithmetic on the shipped rules. Decision 1 of any game is `first`: confidence always
asked, and refused by discovery, so it contributes nothing to the counter. Every later decision is
`play` and draws at `ASK_RATE = 0.15`.

| Walk | `play` decisions | Expected counted | Observed | `P(>= observed)` |
|---|---|---|---|---|
| A | 5 | 0.75 | 1 | 0.556 |
| B | 3 | 0.45 | 1 | 0.386 |

**Both observations sit in the body of the designed distribution.** `1 of 6` is the designed
exchange rate, not a tail.

The designed cost of the first claim follows directly:

```text
60 counted decisions / 0.15 + 1 = 401 decisions
at roughly three real taps each, about 1,200 taps
```

This is the single most decision-relevant number the audit produced, and it settles the run's
question the way the run framed it: **the discovery-counter complaint is an unstated exchange rate,
which is legibility and owner-decidable, not a beneficiary mismatch.**

## The third REPO item, and the limitation that travels with the disposition

**All nine `context_refs` failed delivery.** The frozen discrimination table, the sixteen-action
ledger with its eight verdicts, the delete audit and `D25`/`D26` were read by no resource in this
run. The run detected this itself and recorded that every claim it made about what the lens had
already refused rests on the signals prose.

That limitation is not absorbed into confidence here. It means the run's disposition is an
**independent reading of the same evidence, not a review of this audit's reasoning.** Two
consequences it named and this file keeps:

* **NETA ran on the same model lineage as RND.** Its agreement with any RND position is
  role-conditioned execution, not independent triangulation. The only independent sources for this
  task are REPO artefacts and FIELD participants.
* **Both walks were performed by someone who knows the refusal and sampling rules.** The tap counts
  are measured and transferable; the felt meaning of `1 מתוך 60`, of the disclosure, and of
  per-decision repayment is not, and these walks may not be used as a proxy for stranger behaviour.

## The pre-FIELD declaration the run asked for

The run asked for one thing to be written before any participant, and it does not modify the frozen
protocol:

> **The counterfactual arm is non-discriminating unless M1 to M8 already record whether a
> participant opened the `פרטי הניתוח` disclosure.**

The frozen participant file records the raw chronological log with every press, so a disclosure
opening **is** captured by the existing instrument. No change to
`research/player-path/FIELD_RUN_CURRENT.md` is required or made. What is declared here, in advance,
is how that log line must be read: a participant who never opens the disclosure and then fails M6
says nothing about whether the probe's payoff is adequate, because they never met it.

## What the run deferred, and why

OWNER, deliberately:

> an owner ruling on the owner's own hypothesis taken while discrimination is open would trade
> independence for permission the current default already has.
