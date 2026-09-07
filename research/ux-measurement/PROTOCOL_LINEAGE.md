# Protocol lineage: two holes, and what closed them

> **A measurement stimulus may not change without the resulting evidence carrying enough lineage to
> distinguish the populations.**

`WORK_PLAN.md` §1 established that R1-R5 are software-correct. This document is the other half:
whether the evidence they produce can still be told apart from the evidence that came before, and
whether the quiet-window arm can be turned on without the record losing track of which screen a
player saw.

Neither question is about UX. Both are about the contract between **stimulus → observation → stored
evidence → later inference**.

---

# Part 1 -- Does `CURRENT_PROTOCOL_VERSION` have to move?

## 1.1 The three claims, kept apart

The question *"has protocol version 4 produced real evidence"* collapses three different claims, and
they have three different answers.

| claim | verdict | evidence |
| --- | --- | --- |
| **code capable of writing v4** | **YES** | `878caf4` set the constant to 4 on 2026-09-01 and is an ancestor of `origin/main`. Two sites stamp it: `shared/blitz-record.ts:297` and `client/src/lib/decision-session.ts:394` |
| **a deployment containing v4** | **YES** | `GET https://lichessapp.vercel.app/api/health` → `{"gitSha":"2390b35…","target":"production"}`. `2390b35` carries v4, and so do `07ccd11` and `9d03bbb`, the two earlier production SHAs on the record |
| **a durable row stamped v4** | **`UNKNOWN`, and unknowable** | see below |

**A trap worth naming, because falling into it would settle this the wrong way.** The health
endpoint answers with `build.protocolVersion: "1.0.0"`. That is the **L6 runtime-truth contract**
(`docs/consolidation-research/hardening/TARGET_3_L6_RUNTIME_TRUTH.md`), not
`CURRENT_PROTOCOL_VERSION`. Two different numbers with the same name; the endpoint does not expose
this one.

## 1.2 Why the third claim is unanswerable rather than unanswered

Production reports `checks.storage: "not-configured"`. **There is no server record.** Every decision
taken on the deployed build is written to that visitor's own `localStorage` and never leaves the
machine, which `docs/RETENTION.md` states is the design rather than a gap.

So a v4 row can only exist somewhere nobody can enumerate, export or query. Corroborating, and
consistent with it:

- Seven days of production runtime logs contain **exactly one** invocation, `/api/health`, and it is
  the probe quoted above. No `/api/trpc`, no auth, no writes.
- Vercel Web Analytics is not enabled for the project, so visits cannot be counted either.
- No dataset anywhere in this tree carries a row stamped 4.
- `NETA_EMBODIED_RUN_001` walked production on `9d03bbb` (which carries v4) and committed decisions
  -- into a **fresh Chromium profile per run**, discarded at `browser.close()`. Real writes, zero
  durability.

**This is `UNKNOWN` in the strong sense: it will still be unknown later.** No future audit recovers
it, because the architecture guarantees the rows are unreachable.

## 1.3 The decision, and it did not need the third claim

**Bumped: `CURRENT_PROTOCOL_VERSION` 4 → 5.** Three independent reasons, each sufficient alone.

**Reason 1 -- the exemption expired by its own terms.** The v4 note says *"version 4 has never
stamped a row … 4 exists only on an unmerged branch that has not been deployed"* and sets its own
expiry: *"THIS EXPIRES THE MOMENT A BUILD STAMPING 4 REACHES A PLAYER."* It is on the public
production origin. The premise is false and the trigger has fired. The note also says the constant
is *"written in exactly one place, `shared/blitz-record.ts`"* -- it is written in two, and the other
one stamps every ordinary decision. That error is corrected in the file, because the exemption's
arithmetic rested on it.

**Reason 2 -- under `UNKNOWN`, the conservative action is the bump.** The two errors are not
symmetric. A bump that turns out to have been unnecessary leaves two versions a later analysis may
deliberately pool. A bump that was needed and skipped leaves one version holding two stimuli, with
no way back. Only the first is recoverable.

**Reason 3 -- the change is on this file's own forced-bump list**, which is Part 2.

---

# Part 2 -- Each repair against the versioning rule

The rule is the file's own, stated in the 3 → 3 note so a later reader can check rather than trust:

> *"any change to a class that paints on `DECIDE` or `ANSWER_INSTRUMENT` and is part of the
> instrument -- the board, the read chips, the confidence row, the step heads, `.commitment-summary`,
> `.commitment-submit`, `.board-note`, `.record-mode`, `.context-loop`."*

widened by the 2 → 3 note: *"what is on screen while the answer is given is the same kind of fact as
a sampling rate."*

| Fix | Changes what the player sees while evidence is produced? | Changes the available action? | Changes a collected field? | Changes salience or timing? | Bump? | Why |
| --- | --- | --- | --- | --- | --- | --- |
| **R1** the first decision stops asking for the two reads | **YES.** On `purpose: "first"`, two `.step-head`s, the `.read-chip` menu and two `.required-mark`s stop painting on `DECIDE` | **YES.** Two steps a player could answer are gone | **YES.** `known`/`unknown` are no longer collectable on that purpose | **YES.** The panel is two rows shorter and the confidence step moves up | **FORCES IT** | Step heads and read chips are both named on the list. The largest stimulus change any bump in this file has carried: every previous one moved a colour, a size or a position |
| **R2** the intro names the steps this decision has | **YES.** `.commitment-intro` is rewritten on every purpose | no | no | **YES**, it wraps differently and the panel below it moves | **FORCES IT** | It is the instruction for the task `seconds_taken` is measured to. The 2 → 3 bump counted "two sentences became legible" among its reasons and those were `.board-note` and `.record-mode` |
| **R3** the board stops claiming a return that did not happen | **YES.** `.board-note` is rewritten on first arrival | no | no | no | **FORCES IT** | `.board-note` is named on the list explicitly |
| **R4** the help screen promises the ordering, not a fixed question set | **no** -- an overlay behind a press, absent from `DECIDE` unless opened | no | no | no | **does not force it** | Same shape as the `.first-decision-note` case the 3 → 3 note declined to bump for: a different surface, opt-in, not on screen while the answer is given. It rides along; it did not cause this |
| **R5** the step register clears the sticky submit | **YES, conditionally.** Paints nothing, but changes where this panel's own auto-advance lands a newly-opened step: above the submit rather than under it | no | no | **YES.** What is on screen when the next step is answered differs | **contributes** | `.commitment-step` is a step-head container. Small, and it rides along with R1-R3 in any case |

**`REPO-CERTAIN` and `protocol-significant` are different axes and this table is why.** R1-R3 are
each a defect the code alone settles -- the build contradicting itself -- **and** a change to the
conditions of observation. Both are true at once and neither weakens the other.

---

# Part 3 -- The quiet-window arm could change the stimulus without leaving a trace

## 3.1 The hole

`VITE_QUIET_EVIDENCE_WINDOW_ENABLED` is a **build flag**. Two deployments of one commit -- same
`gitSha`, same `CURRENT_PROTOCOL_VERSION`, same everything a row records -- can put two different
screens in front of two players. `features.ts` said in a comment that turning the arm on required a
protocol bump. **A comment is not an invariant**, and the mechanism could not have worked anyway:

- a flag moves without a commit, so both arms would carry the same version;
- and the version cannot be derived from the flag even in principle -- `CURRENT_PROTOCOL_VERSION`
  lives in `shared/`, the flag is an `import.meta.env` value in `client/`, and `shared/` may not
  read `client/`.

That rules **Option A** (protocol-version-only enforcement) out on an architectural fact rather than
a preference.

## 3.2 The options, and why B

| option | can populations mix silently? | reconstructable later? | interpretable? | new machinery | fits the existing protocol? | reversible? |
| --- | --- | --- | --- | --- | --- | --- |
| **A** version-only enforcement | **not available** -- `shared/` cannot read the flag | -- | -- | -- | -- | -- |
| **B** row-level exposure | **no** | **yes**, in the row itself | **yes** -- both arms analysable under one build | one nullable provenance field | **exactly**: `reveal_timing` is the same shape | yes, a nullable column |
| **C** experiment-only branch | no, but only by preventing the arm existing | weakest -- lineage lives in deployment state, not beside the observation | no | none | n/a | yes |

**B, and the repository had already reached it for this exact failure.** `reveal_timing` is an
experimental condition stored per decision, and `session-position.ts` records what happened before
it was: a reload dropped the arm back to its default and produced *"ONE GAME whose first half says
`end-of-game` and whose second half says `per-decision`, every row internally consistent and nothing
saying the condition changed underneath it."* That is this hole, and per-row storage is what closed
it then.

## 3.3 What was built

`shared/quiet-window.ts` -- **one expression, two consumers**:

```
quietWindowExposure({ armEnabled, producingEvidence })
        │
        ├── ContextRibbon renders nothing iff this is "context-ribbon-suppressed"
        └── buildCommitEvent stamps exactly what this returns
```

They are not two implementations that agree. They are one call read twice, so *"the ribbon was
suppressed but the row says visible"* is **unrepresentable** rather than merely absent.

The value is derived from the condition on screen, never from the experiment's intent: the flag is
not copied into a column, and `Home.tsx` passes `exposureNow(stage)` rather than a literal.

Three states, not two:

| value | meaning |
| --- | --- |
| `context-ribbon-visible` | the ribbon was on screen. The shipped default |
| `context-ribbon-suppressed` | the arm was on for this decision's whole evidence window |
| `null` | **the row recorded no condition** -- a client older than the field |

`null` is not the control arm. `producedUnderQuietWindow` returns `null` for it rather than `false`,
for the reason `measurement-protocol.ts` refuses to backfill `legacy` and `record-store.ts` spells
out for `probeAssignment`: reading an unstamped row as the control enrols it retrospectively into a
group it was never in.

## 3.4 OFF row vs ON row, as an analyst would see them

Round-tripped through the real wire schema, service and store in
`tests/shared/a-row-that-cannot-say-which-screen-produced-it.test.ts`:

| field | OFF row | ON row |
| --- | --- | --- |
| `protocol_version` | 5 | 5 |
| `measurement_protocol` | `instrumented-standard` | `instrumented-standard` |
| `reveal_timing` | `per-decision` | `per-decision` |
| `analysis_timing` | `during-play` | `during-play` |
| **`quiet_window_exposure`** | **`context-ribbon-visible`** | **`context-ribbon-suppressed`** |

The test asserts the first four are **equal** and the fifth is **not**, so it fails if the field
stops being the thing that separates them.

## 3.5 The hard invariant, at two layers, each shown red under its own defect

**Layer 1 -- a gate**, `GATE-QUIET-WINDOW-LINEAGE`, over the source. Three findings:

| defect | reverted into the real tree | result |
| --- | --- | --- |
| a second suppression path (the ribbon reads the flag itself) | `ContextRibbon.tsx` | **RED**, 2 findings |
| a hard-coded arm at the write | `decision-session.ts` | **RED**, 1 finding |
| the ribbon stops calling `quietWindowExposure` | fixture | **RED** |

**Layer 2 -- a test**, over the running pipeline, because the gate is blind to a field that is
*dropped* rather than *added*:

| defect | reverted into the real tree | gate | test |
| --- | --- | --- | --- |
| `record-service` stops passing the field through | `shared/record-service.ts` | **green** (blind) | **RED**, 2 assertions |

Neither predicate sees the other's defect, which is why both exist.

**Layer 3 -- the type system.** `buildCommitEvent` takes the exposure as a **required** parameter:
no overload, no default, no `?? null`. A caller must have an answer before it can write anything.
`GATE-ISO` then forces the field through all three layers or the gate goes red.

---

# Part 4 -- Does the arm change more than visibility?

Measured, not reasoned: two builds of the same commit, `VITE_QUIET_EVIDENCE_WINDOW_ENABLED` unset
and `=true`, walked by the same probe with the counterfactual arm pinned, at 1440x900.

## 4.1 What changes

| state | OFF | ON | Δ | gone in ON |
| --- | ---: | ---: | ---: | --- |
| `01-ARRIVE` | 21 | 21 | **0** | -- |
| `02-DECIDE` before any move | 64 | 61 | −3 | `למה?`, `.context-loop`, `.context-loop-basis` |
| `03-DECIDE` piece selected | 64 | 61 | −3 | the same three |
| `04-DECIDE` move placed | 76 | 73 | −3 | the same three |
| `05-DECIDE` reads stated | 85 | 82 | −3 | the same three |
| `06-DECIDE` ready to commit | 62 | 59 | −3 | the same three |
| `07-AFTER-COMMIT` | 50 | 47 | −3 | the same three |
| `08-COMMITTED` probe open | 50 | 47 | −3 | the same three |
| `09-REVEAL` | 69 | 69 | **0** | -- |

Exactly three surfaces, in exactly the seven `makingEvidence` states, and nowhere else. `ARRIVE` and
`REVEAL` are identical, which is the arm being scoped to the window rather than to the app.

**Nothing is added in either arm.** The `ADDED` column was empty at every state.

## 4.2 The layout shift, documented rather than repaired

Removing the ribbon moves everything below it **up by 77px, uniformly**. At `02-DECIDE`, of 61
surfaces present in both arms, 56 move by exactly −77 and 5 do not (the header, which sits above
the ribbon):

```
  y=189 -> 112  (-77)  the DECIDE badge
  y=207 -> 130  (-77)  תור / שחור
  y=227 -> 150  (-77)  .screen-heading   מה העמדה הזו דורשת?
  y=272 -> 195  (-77)  .commitment-intro
  y=390 -> 313  (-77)  .step-head 1
```

**This is not corrected, and correcting it would be the error.** Padding the gap to make the arms
geometrically identical would mean shipping a blank 77px band to the treatment arm -- a surface
nobody designed, present only in one arm, in order to make a comparison look tidier. The shift is
part of what "the ribbon is not there" means, and an experiment that removed it would be measuring
something that does not exist. It goes in the analysis as a known property of the treatment.

**What it plausibly buys, stated as the hypothesis it is:** at 1440x900 the confidence step head sat
at y=854 with a sticky submit at y=847 (see `WORK_PLAN.md` R5). Seventy-seven pixels is roughly two
step rows. Whether that changes anything is X-5's question, not this document's.

## 4.3 What does not change

| dimension | evidence |
| --- | --- |
| the steps asked | identical legends in both arms, from the probe's own dump |
| instrument surfaces | every `.commitment-*`, `.step-*`, `.read-*`, `.counterfactual-probe__*` present in both |
| data fetching | the guard is the **last** decision the component makes; every hook runs in both arms. Pinned by a test that goes red when the guard is moved above the hooks |
| persistence | `persistUsage` runs in an effect above the guard |
| stylesheet side effects | `data-input` / `data-device` still reach `documentElement` in both arms |
| timing start/stop | `startedAt` lives in `CommitmentScreen`; untouched |
| stage transitions | `Home`'s state machine; untouched |
| decision validation | `draftProblems`; untouched |
| confidence and candidate collection | untouched |
| probe assignment | `assignProbe` inside `buildCommitEvent`; untouched |
| engine timing | `runReveal`; untouched |

**One thing the probe cannot establish, stated so the table is not read as more than it is.** Both
walks fired the counterfactual because the probe **pins** `Math.random`. That the arm fired in both
is a property of the instrument, not evidence that the flag leaves probe assignment alone; the
evidence for that is that `assignProbe` is not reachable from anything the flag touches.

---

# Part 5 -- What this does not settle

- **Whether the quiet window helps or hurts.** X-5, and it needs the arm actually run.
- **Whether the 77px shift matters.** Same experiment.
- **Whether any v4 row exists.** Permanently unknowable, and now permanently irrelevant: rows from
  here carry 5, and rows from before carry 4 or `null`.
- **Whether the repairs changed any measured behaviour.** The bump asserts the populations are
  *different*, which is the weaker and safer claim this file's own 1 → 2 note describes. It does not
  assert that v4 rows are wrong.
