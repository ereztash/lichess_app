# Paired reasoning-model test — Model A against Model B, on frozen cases

The mission asks for a paired comparison of two reasoning models over real, already-documented UX
failures, judged by whether the second changes a decision rather than by whether it reads better.

That run was frozen and executed **before** this lane opened, and it is preserved here verbatim as
`PAIRED_RUN_NICO_UX.json` rather than re-run to a friendlier answer.

| | |
| --- | --- |
| task id | `CAL-NICO-UX-PAIRED-2026-09-12` |
| repository | `Product-Perception-Sensemaking-Architect`, branch `run/nico-ux-paired-2026-09-12`, commit `07ddf30` |
| execution | GitHub Actions run `34697289632`, canonical `runtime/calibration_loop/run.py --strict` |
| resource lineage | Copilot adapter, a **different provider lineage** from this lane's run |
| routing | deterministic; `NETA` fired on four triggers, `SCAFFOLD` on three, authority handoffs `REPO`, `FIELD` |
| final state | `COMPLETE` |

## The two models

**Model A** — five audit prompts:
Truth (what does the system actually know?) · Perception (what does the user think it knows?) ·
Action (what should the user do next?) · Ownership (can the user carry the distinction
independently, where transfer matters?) · Effect (what actually changed?)

**Model B** — a layered fault tree:
epistemic validity → representation/comprehension → action selection → action execution →
internalisation/transfer (only when the telos requires it) → outcome, with motivation, expected
value, trust, cost, ability and opportunity modelled as **moderators** rather than forced serial
stages.

## The comparison criterion, fixed before the run

Elegance does not count. **B earns its complexity only when it changes at least one of: failure
location, evidence request, intervention, claim boundary, or priority.** Anything else is a nicer
vocabulary for the same decision.

## The eight frozen cases, and where B changed something

| case | what A gets | what B changed | earned |
| --- | --- | --- | --- |
| C1 time-to-value and waiting | "the experience is weak" | failure location splits into evidence-collection latency **and** representation; evidence request becomes time and effort before first personal value; the calibration wait is re-typed as an instrument constraint, not removable friction | yes |
| C2 feedback without progress | "the KPI is unsupported" | failure location becomes a **claim-boundary** failure between calibration progress, adherence, process change and rating outcome; intervention becomes an evidence-and-effort ledger, not `1500 → 1850, 43%` | yes |
| C3 cold users could not complete the move | "an action failure" | separates action **selection** from action **execution**; the two cold testers had no clear act to select and then could not submit it. Two different repairs, two different observations | yes |
| C4 unique value not understood | "the value is not arriving" | separates epistemic validity from representation from expected-value framing; evidence request becomes whether the user can state the generic-versus-personal distinction, **without treating agreement as proof** | yes |
| C5 detector silence versus person | "the instrument returned something" | names the failure as instrument state becoming an identity claim; keeps detector result, null-model result, source authority and wording boundary as four separate records | yes |
| C6 prompted transfer called transfer | Ownership flags it | splits guided practice / prompted recall (maximum transfer) / unprompted play (typical transfer), and makes Ownership **conditional on telos** rather than a universal stage | yes |
| C7 journey is machinery, not a path | "discoverability is poor" | representation **and** action selection across a multi-step journey, moderated by effort, ability, opportunity, expected value and trust | yes |
| C8 goal-progress causality trap | warns against a false Effect claim | re-types it as an **outcome-boundary and denominator** problem, with expected value and trust as moderators rather than as evidence of progress | yes |

## The run's verdict, quoted

> Retain Truth, Perception, Action, Ownership, and Effect as the compact audit surface, but use
> layered distinctions selectively where they materially separate evidence validity from
> representation, action selection from execution, prompted performance from transfer, and process
> progress from rating outcome.

> The decisive delta is not adding more audit categories; it is preventing the five prompts from
> **collapsing distinct claim boundaries** and bottlenecks.

So neither model wins outright. A is kept because five prompts are auditable by a person in one
pass; B is applied at the six seams where A demonstrably collapses two claims into one.

## What this lane took from it, and what it refused

**Took:** the seam list. Every one of the six is a place where this lane's build had to keep two
things apart, and the import-screen repair is C5 and C8 meeting on one surface.

**Refused:** the run's own ranked recommendation for C4 —

> surface the personal-inference promise **before** the dashboard machinery, using the user's
> advancement goal as the entry frame

That recommendation is the only one in the eight that names a missing *surface* rather than a
missing distinction, and this lane's live run refused it. See `DECISION.md`. The refusal is not a
disagreement about the cases; it is the observation that "personal-inference promise" is
outcome-shaped and that "the user's advancement goal" in chess is rating-shaped.

## Provenance gap, recorded rather than smoothed

The paired run's `resource_invocations[*].result` carries **no `_adapter_meta`**. The adapter in use
at the time did not attach one. Consequences, stated plainly:

- The **provider lineage is recoverable** (the workflow selected the Copilot adapter, and that is in
  the branch's workflow file).
- The **served resource identity is not recoverable from the trace**. It cannot be reconstructed
  after the fact without trusting a memory of the run.
- Therefore the claim "this was a genuinely different lineage" rests on the workflow definition, not
  on the trace. That is weaker than this lane's own run, whose `PATH_PROVENANCE.jsonl` carries the
  delivery manifest and the independence caveat per phase.

This was the defect that motivated `_adapter_meta` in the first place, and it is why the later run
records context delivery per invocation. Recorded here so nobody quotes the paired run as
independent triangulation on the strength of a field that is absent.
