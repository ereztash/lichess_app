# CLAIM → VERIFIER matrix

Every material claim the learning-journey work relies on, and what actually holds it. Coverage is
**not** inferred from a nearby test; where a mutation was run, the mutation is named and its result
is what the row says.

Dispositions: `COVERED`, `PARTIALLY_COVERED`, `FALSE_GREEN` (was green and should not have been),
`CORRECTLY_OUTSIDE_VERIFY`.

Frozen at `lichess_app` `7ee419f` and `PPSA` `27488cc`. Rows marked **repaired** were `FALSE_GREEN`
at that pair and are covered at the tip of this audit.

---

## A. Product architecture claims

| # | claim | authority | verifier | exercises the mechanism? | control | mutation that falsifies it | Verify red? | disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Three constructs — guided practice, prompted recall, unprompted play — never share a number | REPO | `three-constructs-that-must-not-become-one.test.ts` | yes, over the pure state machine | yes | give the prompted stage a denominator of 3 | **red** | `COVERED` |
| A2 | Unprompted play outranks a prompted pass | REPO | same file | yes | yes | disable the `inScope` branch | **red** | `COVERED` |
| A3 | Prompted sittings are counted, never positions passed | REPO | same file | yes | yes | set `of: TRANSFER_POSITION_COUNT` | **red** | `COVERED` |
| A4 | The detector's silence is scoped to the detector | REPO | same file + `a-loop-that-stopped-at-the-grade.test.ts` | yes | yes | reword the question to "do I have a pattern" | **red** | `COVERED` |
| A5 | The unprompted floor reuses `MIN_BUCKET_N` | REPO | same file | yes | yes | set it to 10 | **red** | `COVERED` |
| A6 | A graded claim is not the end of the loop: the pointer names the rule work waiting | REPO | `a-loop-that-stopped-at-the-grade.test.ts` (9 tests) | **module only — no product path reached it** | no | *none needed:* `useLoopPosition` never passed `rules`; `ruleLoad` had no caller | **green** | **`FALSE_GREEN` → repaired** (`GATE-JOURNEY-REACHABLE`, `ruleLoad` wired, `rule-load.ts` tested) |
| A7 | `ruleLoad` computes the due/open counts correctly | REPO | **nothing** | — | — | it had no test at all | **green** | **`FALSE_GREEN` → repaired** (`a-due-count-the-pointer-can-read.test.ts`, 6 tests) |
| A8 | The ledger is reachable by a user | REPO | `record-page.test.tsx` asserted `.journey-layer` exists | **no — wrong proxy: it measured the wrapper** | no | delete `<JourneyLedger …/>`: 2,613 tests and 38 gates stayed green | **green** | **`FALSE_GREEN` → repaired** (`GATE-JOURNEY-REACHABLE`) |
| A9 | `ruleReadings` turns stored rules into stages | REPO | **nothing** | — | — | make it `return []` always: everything stayed green | **green** | **`FALSE_GREEN` → repaired** (reachability only; see limits below) |
| A10 | The goal is never rendered beside a count | REPO | `GATE-GOAL-NOT-A-DENOMINATOR` | **no — token scan** | shared the gate's assumption | a probe with a hardcoded lead and a prop named `statement`: passed every gate | **green** | **`FALSE_GREEN` → repaired** (`GATE-GOAL-CONTAINED`) |
| A11 | A stage number never renders without its construct | REPO | `GATE-CONSTRUCT-NAMED` | **no — literal `count.n`** | shared the gate's assumption | `const { n } = reading.count`: passed every gate | **green** | **`FALSE_GREEN` → repaired** (`GATE-CONSTRUCT-CONTAINED`) |
| A12 | The layer does not render on an empty record | REPO | the front-door word ceiling + CLS budget | yes, in a real browser | yes | remove the `measured > 0` guard | **red** | `COVERED` |
| A13 | No global progress number exists | REPO | A10, A11 + absence of any such field | partially — absence is not directly checkable | — | add one in a new component | now **red** via A10/A11 containment | `PARTIALLY_COVERED` |
| A14 | The journey layer is not a third measurement | REPO | `record-page.test.tsx` | yes, asserts the class is absent | no dedicated control | add `record-layer` back | **red** | `COVERED` |
| A15 | The player's decision is committed before the engine speaks | REPO | `GATE-COMMIT`, `GATE-TWO-HANDS`, R3 | yes | yes | static engine import in the render path | **red** | `COVERED` |
| A16 | The product is easier to understand | **FIELD** | none, and none possible | — | — | — | — | `CORRECTLY_OUTSIDE_VERIFY` |
| A17 | The journey motivates continued use | **FIELD** | none | — | — | — | — | `CORRECTLY_OUTSIDE_VERIFY` |

## B. Research-process claims

| # | claim | authority | verifier | exercises it? | control | mutation | Verify red? | disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | `DR_PLAN_0` was frozen before the run and before any search | REPO | commit order: `5b2b144` precedes the trace deposit | partially — order is checkable, intent is not | no | backdate the plan | **green** | `PARTIALLY_COVERED`, and see the note below |
| B2 | The R&D run reached `COMPLETE` through the real runtime | REPO | `RND_TRACE.json` `final_state` + `RND_PROVENANCE.jsonl` | yes, the artefact is the evidence | no | hand-write a trace | **green** | `CORRECTLY_OUTSIDE_VERIFY` — CI cannot re-run a live model |
| B3 | Every declared external branch was executed or recorded as stopped | **RESEARCH** | **nothing** | — | — | Japan and France were silently dropped from E5 | **green** | **`FALSE_GREEN` → repaired by amendment**, not by a gate |
| B4 | Every decision-changing external claim is reconstructable from a source | **RESEARCH** | **nothing** | — | — | prose confidence was the only provenance | **green** | **`FALSE_GREEN` → repaired** (`SOURCE_LEDGER.md`) |
| B5 | Peers received the documents the task named | REPO | `check_live_adapters.py` (PPSA) | yes, since `27488cc` | yes | deliver a path instead of a document | **red** | `COVERED` |
| B6 | The trace records **whether** those documents arrived | REPO | **nothing** | — | — | make every ref unresolvable: the run still reaches `COMPLETE` with no record | **green** | **`FALSE_GREEN` → repaired** (`context_delivery` in the provenance sidecar) |
| B7 | Resources and peers share one model lineage, so agreement is not triangulation | REPO | the adapter stamps `independence_caveat` on every invocation | yes | no | strip the caveat | **green** | `PARTIALLY_COVERED` |
| B8 | The mechanism research forbids CAUSALITY / INTERVENTION / OUTCOME | **RESEARCH** | the frozen research corpus itself | n/a | n/a | n/a | n/a | `CORRECTLY_OUTSIDE_VERIFY` |
| B9 | The chosen architecture is the best available | **OWNER** | the matrix, which is an argument | no | no | n/a | n/a | `CORRECTLY_OUTSIDE_VERIFY` |

## C. Handoff and cross-artifact claims

| # | claim | authority | verifier | exercises it? | control | mutation | Verify red? | disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | The FIELD protocol collects every variable its decision rule reads | **OWNER/FIELD** | **nothing** | — | — | the rule read "intention to return"; nothing collected it | **green** | **`FALSE_GREEN` → repaired** (observation `C1`, and a variable table) |
| C2 | The protocol and `DECISION.md` agree about prescription | **RESEARCH/OWNER** | **nothing** | — | — | M3 said prescription is forbidden; the decision accepts procedural prescription | **green** | **`FALSE_GREEN` → repaired**, with the distinction preserved |
| C3 | `resource` and `authority` are different vocabularies | REPO | **nothing**; now `docs/RESOURCE_IS_NOT_AUTHORITY.md` | — | — | the task recorded a "schema gap" that is not one | **green** | **documented boundary**, schema unchanged |
| C4 | "`npm run verify` is green" means what CI's Verify means | REPO | **nothing** | — | — | locally the 28 database tests SKIP and two controls never run | **green** | **`FALSE_GREEN` → repaired** (`verify` now runs both controls and prints its scope) |

---

## What `GATE-JOURNEY-REACHABLE` does and does not prove

Written here because a gate whose limits are not stated gets quoted as a proof.

**It proves** that each named member of the journey family is called or rendered by at least one file
under `client/src`, and its control proves it can tell reached from unreached rather than merely
reporting an empty directory.

**It does not prove** that the call site is on a path a user can walk, that the render is behind a
condition that is ever true, or that the rendered thing is visible. A9 is therefore `PARTIALLY_COVERED`
and not `COVERED`: `ruleReadings` now has a caller, and no test asserts that a stored learning rule
produces the stage a player would see. Closing that needs a component test over a populated record,
which is work this audit did not do and which is named in `FALSE_GREEN_AUDIT.md` as open.

## On B1, and why it is not a gate

Commit order is checkable; "frozen before, and not optimised by the thing it predicts" is not. A gate
over it would check that `DR_PLAN_0.md` is unmodified since its commit, which is true and is not the
claim. The claim rests on the commit graph and on the author's account, and this row says so rather
than borrowing confidence from the rows above it.
