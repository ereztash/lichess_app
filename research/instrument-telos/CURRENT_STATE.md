# Current state, frozen before the Instrument–Telos audit

Written before `DR_PLAN_0.md` and before any ledger work. Nothing below is inferred from a design
document: every reachability claim traces to a walk of the built bundle recorded in
`../player-path/PRODUCT_STATE_WALK.md`, or to a fetch of a live deployment performed for this file.

## Repository and build

| | |
|---|---|
| Repository | `ereztash/lichess_app` |
| Branch | `claude/ux-ui-analysis-v6ao5u` |
| HEAD at freeze | `9c5db6cd128e7b0c52fe514a5b68af8dcdb57f31` |
| Product source frozen at | `4c395637cd274c5faffb29ebb8429bfdac358eb1`; later commits are documentation only and do not move the page bundle |
| Page bundle | `assets/index-D_Il6CdA.js`. **Kept as written.** The stimulus was re-frozen at `index-DUEXf-qq.js` after this audit, when a phone frame found the read step clipping its own option list. This file records the build the audit was performed against and is not updated to follow it |
| PR | [#105](https://github.com/ereztash/lichess_app/pull/105), draft, `mergeable_state: clean` |
| Local verification | `npm run verify` `EXIT=0`. 3297 passed, 36 skipped, 44 gates pass, 44 controls red, bundle within budget |
| CI | `verify` `success` on `9c5db6c` |
| Deployment inspected | PR #105 preview, reached signed-out through a protection-bypass share link, serving `index-D_Il6CdA.js` |
| Production, for contrast | `lichessapp.vercel.app` serves `main` at `2afb7a2`, `index-D4R4s45s.js`. **Not** the build audited here |
| Server storage | `/api/health` reports `checks.storage: "not-configured"` in production, and the audited deployment behaves the same way: records live in the browser |

## Feature flags, as the shipped bundle carries them

| Flag | Resolution | Consequence |
|---|---|---|
| `EXPERIMENTAL_LEARNING_ENABLED` | `import.meta.env.VITE_EXPERIMENTAL_LEARNING_ENABLED === "true"`, and no deployment sets it | Off. The learning composer and queue strings are absent from the built bundle |
| `QUIET_EVIDENCE_WINDOW_ENABLED` | Same shape, unset | Off. The context ribbon behaves as it does today |

Both stay off for this audit and for the FIELD run. `docs/decisions/D25-evidence-architecture.md`
decided the first; `docs/decisions/D26-primary-evidence-path.md` records the owner's decision to
leave the evidence lanes unmerged until FIELD has run.

## The two evidence lanes

Established by walking, not by reading. A finished blitz game leaves `"decisions":[]` in
`decision-lab.record.v1` and writes only `blitzGames`.

| | Decision lane | Blitz lane |
|---|---|---|
| Store | `decisions` | `blitzGames` |
| Written by | `/play` | `/blitz`, and only when a game finishes |
| Row carries | a `purpose` | no purpose; its own strata |
| Admitted to discovery | `play` only, per `EVIDENCE_POLICY_VERSION = 4` | not part of that population |
| Floor | `MIN_BUCKET_N * 2 = 60` **scored** decisions | expressed to the player in games |
| On the record page | `0 מתוך 60 החלטות שהחיפוש הזה סופר` | `עוד 30 משחקים לפחות יאפשרו בדיקה ראשונה` |

## Reachable states

Walked in Chromium at 390x844 from fresh profiles.

| State | Reachable | Note |
|---|---|---|
| Cold arrival `/` | yes | three doors: username import, bank position, blitz |
| Cold arrival `/play` | yes | opens with a decision already open, so the control rail is hidden |
| Historical import | yes | five games, 240 positions, about 80 seconds, leading with a finding |
| First prospective decision | yes | `purpose: "first"`, confidence always asked |
| Reveal | yes | inference limits, `מה קרה כאן`, `מה שווה לבדוק`, `מה נצבר` |
| Continuation after a live reveal | yes, since `4c39563` | the B-1 repair; before it, a live game stopped after one decision |
| Ordinary live play | yes | per-decision reveal, or `בסוף המשחק` which advances by itself |
| Blitz, played and finished | yes | analysis runs after the game; nothing is written before it ends |
| Accumulation readings | yes, both lanes | neither has reached a threshold in any walk |
| Negative result | yes | `לא מצאתי במשחק הזה לבדו משהו שכדאי להסיק ממנו עליך`, `בדקנו את כל החלוקות שיש לנו` |
| Returning user | yes | resume screen with one blocker and one next step |
| Anchor / bank position | yes | `purpose: "anchor"`, refused by discovery |

## Unreachable states

| State | Why |
|---|---|
| Candidate pattern | needs the discovery floor; no walk has reached it |
| Context check, candidate rejection | downstream of the candidate |
| Rule creation, player-owned rule | `EXPERIMENTAL_LEARNING_ENABLED` off; strings absent from the bundle |
| Drill / guided practice | its control lives behind a claim |
| Prompted retrieval, transfer check | same flag |
| Recurring, weakened, refuted, retired | `ruleJourney` stages, same flag |
| Multiple simultaneous learning objects | same flag |

## Instrumentation constants, as shipped

Recorded here so the audit cannot quietly assume a different build.

| Constant | Value | Where |
|---|---|---|
| `ASK_RATE` | `0.15` | `shared/confidence-asked.ts` |
| `BLITZ_ASK_RATE` | `0.15` | `shared/blitz-instrument.ts` |
| `PROBE_PROBABILITY` | `0.35` | `shared/counterfactual.ts` |
| `MIN_BUCKET_N` | `30`, needed on both sides of a split | `shared/record-dashboard.ts` |
| `EVIDENCE_POLICY_VERSION` | `4` | `shared/evidence-policy.ts` |
| Purposes always asked for confidence | `first`, `anchor`, `drill`, `transfer` | `shared/confidence-asked.ts` |

None of these may be changed by this mission.
