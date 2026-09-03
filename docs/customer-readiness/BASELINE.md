# Customer-readiness baseline, frozen before any fix

**Frozen at** `c848f244d380e13a8622c590791b22a2bef7a39b` (`origin/main`, the merge of PR #65).
**Mission branch** `claude/lichess-customer-readiness-uqj2cq`, branched from that commit.
**Open PR dependencies** none. PR #66 (learning-v3) and PR #67 (OwnExposure system-invariant, verdict
`SYSTEM POLICY VALID, ECOLOGICALLY INFEASIBLE`, nothing licensed) are research branches and are not on
this branch, not merged by it, and not built into the product by it.

> This file is a snapshot. Every number below was true of `c848f244` on 2026-09-02 and is left as
> written when later commits change the facts. The re-score after the adversarial pass lives in
> `AFTER.md` beside it and quotes this table row for row.

## 1. What was verified at freeze, not inferred

| fact | how it was established |
| --- | --- |
| production serves `c848f244` | `GET https://lichessapp.vercel.app/build-identity.json` -> `200 application/json`, `gitSha c848f244…`, `target production`, built `2026-09-02T12:43:22Z` |
| production API answers | `GET /api/health` -> `200 {"ok":true}` in 2.3 s (cold start); one boolean, no build, no subsystem |
| production is public, previews are not | Vercel deployment protection `ssoProtection: enabled, all_except_custom_domains`; the alias answers 200, deployment URLs 302 to SSO |
| the runtime is Node 24.x, CI runs Node 22 | Vercel project `nodeVersion: "24.x"`; `.github/workflows/*.yml` `node-version: 22` |
| Vercel installs with `npm install` over a restored cache | production build log: `Restored build cache from previous deployment` then `Installing dependencies... up to date in 815ms` |
| runtime logs live one hour | Vercel Hobby plan; `get_runtime_logs` over 7 days returns nothing, over 1 h returns the health probe |
| `verify` has shipped red to production | runs 347 (`fd9d0ce9`, failure) and 361 (`a460b719`, cancelled at the 15-minute timeout) on `main`, both deployed by Vercel on push; `main` is unprotected |
| a rollback candidate exists on Vercel | `dpl_8U9i5BUS28bBDiWHEKArQgwf8gZm` (`dd708a8`) `isRollbackCandidate: true`, created by a dashboard `redeploy`; no procedure in the tree names it |
| the suite is green | `npm run check` exit 0 · `npm run build` exit 0 · `npm test` **2931 passed, 33 skipped** (26 database without `DATABASE_URL`, 7 L6 without `DEPLOYED_ORIGIN`) · `npm run gates` **31 pass** · bundle within budget · falsification inventory 12/12 classified |
| the ladder | `npm run levels`: L1 81 · L2 85 · L3 77 · L4 5 · L5 18 · L6 1 (L5 includes the journey suite this mission added at freeze, see §5) |
| dependency advisories | `npm audit --omit=dev`: **3 moderate** (`qs` 6.15.3 via `express` 4.22.2 / `body-parser`), 7 with dev (`esbuild` via `drizzle-kit`); `--audit-level=high` in CI does not fail on them |

## 2. Method

Fifteen dimensions, scored 0–10. A score records what the repository can **demonstrate**, not what
it documents: a runbook nobody can execute does not move Release/rollback; a log line nobody can
read after an hour does not move Observability. For every row: the evidence, the single thing that
prevents the next point, and whether that gap is code, ops, policy, external configuration, field
evidence or research-gated.

**Overall customer readiness is not an average.** Some rows are blockers for a readiness class and
some are not; the classes are defined in §4 before anything was fixed, so a later score cannot move
by redefining the bar.

Lanes A (SRE), B (release), C (security) had reported when this was frozen; their scores are used
where they overlap. Lanes D–H (privacy, journey, architecture, adversary, claims) were still running
and their findings are reconciled in `GAP_LEDGER.md` without changing this table.

## 3. Scores at `c848f244`

| # | dimension | score | evidence | what prevents the next point | gap kind |
| --: | --- | --: | --- | --- | --- |
| 1 | Testing / falsification | 9.0 | 2,931 tests; 31 gates each with a red positive control; typecheck, bundle and L6 controls inverted in CI; `tests/LEVELS.md` derives the rung of every claim | no test drove the primary journey (front door -> username -> board -> commit -> reveal -> reload) until this mission added one at freeze; `npm test` itself has no systematic control (G-10) | code |
| 2 | Research validity | 8.5 | preregistrations with sha-frozen falsifiers; B3 four gates; D25 `CONSTRUCT-UNDERIDENTIFIED` published; PR #67 verdict preserved and not built; `EXPERIMENTAL_LEARNING_ENABLED` opt-in | zero humans measured on the live calibration record (README, own words); every efficacy question is FIELD_REQUIRED | field |
| 3 | Reproducibility | 5.0 | lockfile v3 with integrity on every entry; `npm ci` in both workflows; migrations generated from `schema.ts` and applied 0000–0018 in CI | production is installed with `npm install` from a cache on Node 24 while CI proves `npm ci` on Node 22; production migrations are applied by hand and recorded nowhere | code |
| 4 | Evidence provenance | 8.0 | `GATE-RESEARCH-RECONCILED` re-hashes 17 sites per run; build identity derived, never typed; harness manifests | the API carries no build identity, so a server log line cannot be tied to a release | code |
| 5 | Architecture | 7.0 | one loop (`shared/record-service.ts`) run by three stores; store contract in `shared/`; owner gate at one middleware; failure vocabularies closed (engine 9, import 6, record-mode 9) | `Home.tsx` 2,349 lines / 53 pieces of state under a ratchet; module-level mutable latches in `record-api.ts` and `local-record-store.ts`; two health endpoints (`/api/health` measured, `system.health` unconditional) | code |
| 6 | Maintainability | 6.5 | ratchets on Home.tsx; register, authority and falsification scanners; README gate table held by test | the same hotspot; `tests/LEVELS.md` says L6 is zero while an L6 suite runs; `VERCEL_DEPLOYMENT.md` says production is behind SSO while the L6 workflow depends on the opposite | code |
| 7 | Security | 6.0 | owner gate on every record procedure; allow-list error formatter (no driver text, no stack on the wire); HttpOnly SameSite=Lax cookie; OAuth nonce in a `__Host-` cookie checked before exchange; fixed upstream origins; 1 MB body cap; headers served as declared (curl-verified); git history clean of secrets | dead `Authorization: Bearer` path on the server (client never sends it) turns any leaked one-year JWT into an unrevocable credential; no `aud`/`iss` on the JWT; no rate limit; `qs` advisories reachable through the default query parser and an unused urlencoded parser | code |
| 8 | Supply chain | 3.0 | `npm ci`; audit at `high` blocking; Actions have positive controls for what they check | no dependabot/renovate (Q36 gap); 3 moderate prod advisories with no owner or age rule; Actions pinned by mutable tag with default token permissions; Node 22/24 drift held by nothing; Vercel bypasses the lockfile | policy |
| 9 | Privacy / data governance | 5.0 | record is browser-local by default and never sent; acquisition ledger forbids FEN/move/text and is never transmitted; `safe-error` keeps the player's sentence off the wire; single tenant declared and enforced (`shared/tenancy.ts`); `GET` tRPC inputs carry FENs into platform request logs (1 h) | no data inventory; Q28 (what MAY be recorded) partial; Q29 (retention, deletion) is a capability gap: no export, no delete for the record, no purge for the server; `db.ts` and `oauth.ts` log whole error objects | policy |
| 10 | Observability | 2.0 | `/api/health` measures DB reachability with a 3 s deadline and cannot hang; `/build-identity.json`; startup configuration faults by name; rich client-side failure vocabulary rendered to the player | only `INTERNAL_SERVER_ERROR` is logged; no request id although `x-vercel-id` is on every response; health body is one boolean; no client failure ever leaves the browser or even reaches the local ledger; nothing outlives one hour; no alert | code |
| 11 | Release / rollback | 3.0 | deployed.yml binds the production check to the deployment SHA and passed once (run #6); wrong-origin control runs first | no rollback procedure (Q26); Vercel instant rollback emits no `deployment_status`, so nothing would verify it; the daily cron asserts no SHA; no control proves the suite refuses the RIGHT app serving the WRONG SHA; `main` unprotected and deployed before `verify` | ops |
| 12 | Customer journey robustness | 6.0 | the primary journey runs end to end in Chromium at freeze (§5: 6 of 7 cases green); every import failure has a named Hebrew cause; engine failure shows a recovery control in 2.7 s; stale-chunk reload once; nine record-mode sentences | a double press of the record button writes **two decisions** (§5); the blitz opponent is deterministic (owner-reported: every game answers `1.e4` with `d5`); no failure is reported to anyone but the player | code |
| 13 | Production failure recovery | 3.0 | stale build -> reload once; server-lost / kept-local refuse a silent store switch; health cannot hang | no runbook; no rollback; no notification; one hour of logs; `/api/health` 503 passes the daily L6 (content-type only) | ops |
| 14 | Field / behavioural efficacy | 1.0 | the instrument exists and its limits are stated on screen | nothing shows the product changes anyone's chess or calibration; one N-of-1 human measurement on a presented bank (PR #66/#67, not on this branch) | field |
| 15 | Overall customer readiness | **5.5** | rows 1–14 read against the classes in §4 | rows 10, 11, 8, 9 are below the class C floor | see §4 |

## 4. Blocker classification, fixed before implementation

| class | rows | floor for class C (paid beta) |
| --- | --- | --- |
| **BLOCKING** | 7 Security · 9 Privacy · 10 Observability · 11 Release/rollback · 12 Journey · 13 Recovery | Security ≥ 6, Privacy ≥ 6, Observability ≥ 5, Release ≥ 5, Journey ≥ 7, Recovery ≥ 5 |
| **NON-BLOCKING** | 1 Testing · 3 Reproducibility · 4 Provenance · 5 Architecture · 6 Maintainability · 8 Supply chain | Supply chain ≥ 5 is required for class D, not C |
| **FIELD-REQUIRED** | 14 Field efficacy, and the human half of 2 Research validity | never a floor for A–D; the floor for E |
| **RESEARCH-GATED** | anything derived from PR #66/#67: OwnExposure, cue efficacy, learning transfer | must stay out of the product regardless of class |

### Readiness class at freeze: **B, design-partner ready, with conditions**

Not **A**: no critical path was found that corrupts data, strands the user without a control, fails
silently on screen, or leaks sensitive data. Not **C**: the product cannot be operated safely for
paying customers because an operator cannot see a failure that happened more than an hour ago, cannot
tell which subsystem failed, has no rollback procedure, and holds data with no retention or deletion
answer. The conditions on B: at most a handful of named users, the operator watching the Vercel log
within the hour after each session, and the two journey defects in §5 disclosed.

## 5. Evidence landed at freeze

**The primary journey, driven in Chromium against the built assets of `c848f244`**
(`tests/layout/a-stranger-takes-their-first-decision.layout.test.ts`, Lichess intercepted, engine
real, `/api/*` answering 503 as a stranger's deployment does):

| case | result at freeze |
| --- | --- |
| front door -> username -> board shows the handed-over position -> move -> four steps -> record -> decision stored before the engine -> reveal -> verdict stored -> reload keeps record and position, no crash | **green** |
| unknown username | green: `אין משתמש`, field kept, button enabled |
| rate limit 429 | green: a wait, not a fault of theirs |
| network absent | green: named, no English internals, the account-less route still offered |
| account with nothing finished | green: `אין משחקים`, still on the front door |
| engine files never arrive | green: `.reveal-failure` in 2.7 s, decision kept, `להחלטה הבאה` returns to deciding |
| record button pressed twice in one gesture | **red: two decisions written**. `CommitmentScreen.submit` has no in-flight guard; `disabled={pending}` arrives one render late |

**Owner-reported at freeze:** every blitz game answers `1.e4` with `d5`. `chooseOpponentMove` takes
the single best line at depth 4 after `ucinewgame`, so the opponent is fully deterministic and every
game repeats the same line for as long as the player does. `drizzle/schema.ts` already says what that
means: *if the opponent's search policy changes between builds the population changes, and nothing
recorded that it did.*

**Lane headlines confirmed by the lead** (full rows in `GAP_LEDGER.md`): no correlation id although
`x-vercel-id` is on every response; only 500s are logged; `system.health` returns `ok` unconditionally
one route over from the health check that fixed exactly that; upstream Lichess fetches have no
timeout; the OAuth callback strands the user on an English JSON 500; the L6 SHA predicate has no
control; `verify` has shipped red; Vercel bypasses the lockfile; `qs` advisories reachable
unauthenticated; no dependency policy; `LEVELS.md` and `VERCEL_DEPLOYMENT.md` each contradict a
running check.

## 6. What this baseline does not claim

That the scores are precise to a half point. That a dimension scored 9 is finished. That any
FIELD-REQUIRED row can be moved by code. That the product improves anyone's chess: nothing here
measures that, and `AFTER.md` will not either.
