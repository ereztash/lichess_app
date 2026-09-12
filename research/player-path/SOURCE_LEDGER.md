# Source ledger

Mission §20 asks for a source ledger covering **new decision-changing research only**. The honest
entry for this lane is short, and the reason it is short is itself the finding.

## New external research performed: none

`DR_PLAN_1.md` §7 fixed the stopping rule before the run:

> Do not reopen a research branch already recorded Δ0 in `research/learning-journey/
> EXTERNAL_EVIDENCE.md` unless I can state in advance what result would change the build.

The run's `next_move` was `COLLECT_REPO`, explicitly **before** `ENVIRONMENT` and before any build,
with the reason stated:

> REPO precedes ENVIRONMENT because Neta's strongest finding is load-bearing on text it self-flagged
> as uninspected, so verification is now cheaper and more decision-changing than the funnel read.

All three questions were answered inside the repository. At no point did an external result stand
between the evidence and the decision, so no external search was run. Running one anyway would have
been encodability bias with a citation attached.

## Evidence actually used, and its authority

| # | source | kind | reality | authority | what it decided |
| --- | --- | --- | --- | --- | --- |
| 1 | `client/src/components/RevealPanel.tsx`, `shared/reveal.ts` | repository read | R1 | REPO | the n=1 payoff exists and is already labelled by evidence kind. Falsified H-2's premise |
| 2 | 390×844 browser measurement of `ImportDiagnosticPanel` | live measurement | R3 | REPO | the finding rendered ~800px below the numbers, in the provenance register |
| 3 | `shared/import-diagnostic.ts` | repository read | R1 | REPO | the evidence-type fact was a caveat twice and a reason to act never |
| 4 | 390×844 frame, looked at by a person (§16) | observation | R3 | REPO | the scope label collapse on the import panel's unmeasurable row |
| 5 | `tests/layout/import-row.layout.test.tsx` | measurement | R3 | REPO | 73.59px against a 90px floor, then green after the CSS repair |
| 6 | `PATH_TRACE.json` (`CAL-LICHESS-PLAYER-PATH-001`) | peer reasoning | — | — | re-typed the four hypotheses; refused H-1's payload. **Produced no evidence**, and its `resource_deltas[0].observed_delta.evidence` is `null`, which is the correct shape |
| 7 | `PAIRED_RUN_NICO_UX.json` (`CAL-NICO-UX-PAIRED-2026-09-12`) | peer reasoning, different provider lineage | — | — | the six seams where the layered model earns its complexity |

Rows 6 and 7 are reasoning, not evidence, and are listed so that nobody later reads a trace as a
citation. Neither carries a reality level, because neither observed anything.

## Frozen prior research relied on and not re-derived

- **The evidence ceiling.** `CAUSALITY` (FIELD), `INTERVENTION` (OWNER), `OUTCOME` (FIELD) are
  unreachable by the discovery pipeline under any result; the claim ladder is unchanged by sample
  size. Frozen in the mechanism research. Load-bearing on every refusal in `CANDIDATE_PROCESSES.md`.
- **`MIN_BUCKET_N = 30`, needed inside and outside a bucket**, so 60 revealed decisions precede any
  claim. Load-bearing on the P2 wait in `PLAYER_PATH.md`.
- **The shipped detector is not the validated research pipeline.** The six-bucket detector returns
  `not-separable` on the owner's whole 2,209-game record while the frozen pysubgroup pipeline finds
  a residual on that same record surviving its own within-game permutation null. Load-bearing on
  every sentence that scopes silence to the instrument.
- **Transfer literature**: typical (unprompted) against maximum (prompted); near against far;
  maintenance against generalisation. Load-bearing on P4's three constructs.

None of these was re-opened, and none of them moved.

## Independence

Every resource in `PATH_TRACE.json` shares one model lineage, and `PATH_PROVENANCE.jsonl` carries
the caveat per phase:

> Same model lineage as the other resources in this run. Agreement between resources is
> role-conditioned execution, not independent triangulation.

The earlier paired run is a different provider lineage, and its resemblance to this run's starting
default is **also** not triangulation — the peer flagged that direction itself, and the run could
not determine whether the default was derived from that finding or arrived at separately. The
decision rests on rows 1 through 5, which are observations.

## Provenance gap, recorded

`PAIRED_RUN_NICO_UX.json` carries no `_adapter_meta` on any invocation. The provider lineage is
recoverable from the branch's workflow definition; the served resource identity is **not recoverable
from the trace**. See `PAIRED_REASONING_TEST.md` for what that does and does not license.
