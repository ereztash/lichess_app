# Gap ledger

The mission's evidence trail, lane by lane. **This is not a second debt register.** Every gap that
stays open after the mission is a row in `docs/MASTER_PRODUCT_DEBT.md` (R-21 to R-28) and this file
points at it; every gap that closed names the commit that closed it. A reader asking "what is open?"
goes to the register. A reader asking "what did the mission find, and what became of each finding?"
reads this.

Dispositions: **closed** (commit named) · **open** (register row named) · **EXTERNAL_CONFIGURATION_REQUIRED**
(closable only in a dashboard or a plan, register row named) · **FIELD-REQUIRED** (needs the world,
register row named) · **declined** (with the reason) · **refuted** (the finding was wrong, with the
evidence).

Lanes A to D reported before the fixes began and their rows are quoted as found. Lanes E to H were
started as a workflow that the container restart killed; their coverage was done by the lead in the
course of the work and is recorded as such, with less independence than A to D. That asymmetry is
stated rather than hidden.

## Lane A, SRE and observability

| # | finding (as reported) | severity | disposition |
| --: | --- | --- | --- |
| A1 | all diagnostics are console lines to a one-hour log, no alert channel | critical | **EXTERNAL_CONFIGURATION_REQUIRED**, R-23; the code half closed in `fa41edb` (structured lines, `docs/OBSERVABILITY.md` section 1 names the three closures) |
| A2 | `x-vercel-id` on every response, read by nothing | high | **closed** `fa41edb`: `requestId` in context, error data, every operator line, the health body |
| A3 | `onError` logs only 500s | high | **closed** `fa41edb`: every code, one line, classified |
| A4 | health body is one boolean | high | **closed** `fa41edb`: build, storage by role, request id; 200/503 unchanged |
| A5 | the function never names its build | medium | **closed** `fa41edb`: `runtimeBuildIdentity` from the same variable the static file uses; L6 asserts they agree (`9b9d690`) |
| A6 | `system.health` returns `ok` unconditionally | medium | **closed** `fa41edb`: removed; no caller |
| A7 | no window error handlers; client failures leave no trace | high | **closed** `fa41edb`: `error-sink.ts`, `failure_observed` in the trial ledger, five-field beacon |
| A8 | self-check report does not name its build | medium | **closed** `fa41edb`: `build=<sha12>` on the first line, `checkBuild` first |
| A9 | no client failure reporting path, and the privacy sentence forbids one | medium | **closed** `fa41edb`: names only, same origin, strict schema, and the sentence now says so |
| A10 | L6 health check is content-type only; a 503 passes the daily run | medium | **closed** `9b9d690`: status 200, `ok === true`, same build as the static identity. The cron cadence is unchanged (daily); moving it is a cost decision for the owner |
| A11 | Q26 rollback is a gap with no procedure | high | **closed** `9b9d690`: `docs/ROLLBACK.md`, `sha` input, SHA control, gate; alias rehearsal is R-26 |
| A12 | upstream Lichess fetches have no timeout | medium | **closed** `fa41edb`: `UPSTREAM_TIMEOUT_MS` 10 s, TimeoutError to an authored BAD_GATEWAY |
| A13 | OAuth failure strands the user on English JSON | medium | **closed** `fa41edb`: redirect home with an enumerated reason, Hebrew sentence, reason never echoed |
| A14 | `getDb` logs the whole error, connection string included | low | **closed** `fa41edb`: `describeForOperator`, code `storage-init-failed` |
| A15 | `tests/LEVELS.md` says L6 is zero in three places | low | **closed** `9b9d690` |

## Lane B, release and rollback

| # | finding | severity | disposition |
| --: | --- | --- | --- |
| B1 | the SHA binding has no control; it has never been shown to fail | high | **closed** `9b9d690`: `servesExpectedBuild` pure, `deployed-sha.control.test.ts` must fail, run in the workflow before the suite |
| B2 | Q26 gap; instant rollback emits no `deployment_status` | high | **closed** `9b9d690` (procedure, evidence step, gate); **FIELD-REQUIRED** R-26 for the alias move itself |
| B3 | `main` unprotected; `verify` runs after the merge; Vercel deploys on push | high | **EXTERNAL_CONFIGURATION_REQUIRED**, R-21. In the tree: `concurrency` on `verify` (`9806b44`) so a superseded run does not hold the queue |
| B4 | production migrations applied by hand, recorded nowhere | high | **open**, R-22, with the gate named |
| B5 | no down migrations, no expand/contract rule | medium | **closed in policy** `9b9d690` (`docs/ROLLBACK.md` section 5); the mechanical check is part of R-22 |
| B6 | only the static file names the commit | medium | **closed** `fa41edb` + `9b9d690` (as A5) |
| B7 | L6 never runs the engine on the deployment | medium | **open**, R-27, gate named |
| B8 | previews walled by SSO; 27 of 33 runs skipped | medium | **declined for now**: an automation-bypass secret is a project setting and a GitHub secret, both outside the tree; the production alias is checked on every deployment and daily. Recorded in `VERCEL_DEPLOYMENT.md` |
| B9 | Vercel installs with `npm install` from a cache; CI proves `npm ci` on a different Node | medium | **closed** `9b9d690` + `9806b44`: `installCommand: npm ci`, `engines.node`, `node-version-file` in both workflows, a test that no workflow names its own Node |
| B10 | run 361 cancelled at the 15-minute timeout; merges landed within a minute | low | **closed** `9806b44`: `concurrency` with cancel-in-progress off `main`. The timeout is unchanged; raising it hides the cost, and the run that timed out did so under contention this removes |
| B11 | `VERCEL_DEPLOYMENT.md` says production is behind SSO | low | **closed** `9b9d690` |
| B12 | `LEVELS.md` "L6 is zero" | low | **closed** `9b9d690` |

## Lane C, security and supply chain

| # | finding | severity | disposition |
| --: | --- | --- | --- |
| C1 | dead `Authorization: Bearer` path; the client reads a sessionStorage key nothing writes | medium | **half closed** `fa41edb`: the client block is gone. The server branch stays because the test suite authenticates through it; a leaked cookie value is the same credential either way. Session length unchanged (one year); revocation is `JWT_SECRET` rotation, stated in `docs/RETENTION.md` |
| C2 | JWT has no `aud`/`iss` | low | **closed** `cc7e524`; existing sessions stop verifying, owner signs in once |
| C3 | `qs` advisories reachable through the query parser and an unused urlencoded parser | medium | **closed** `fa41edb` (`query parser: simple`, urlencoded removed) + `9806b44` (`overrides` to 6.16.0; `npm audit --omit=dev` clean) |
| C4 | no dependency policy, no dependabot | high | **closed** `9806b44`: `dependabot.yml`, `docs/DEPENDENCY_POLICY.md`, exceptions with expiry and a test |
| C5 | actions on mutable tags, default token permissions, input interpolated into `run:` | medium | **closed** `9806b44` + `9b9d690`: SHA pins with version comments, `contents: read`, inputs through `env`, `sha` validated as 40 hex |
| C6 | `main` unprotected, one collaborator, deploys before `verify` | high | **EXTERNAL_CONFIGURATION_REQUIRED**, R-21 |
| C7 | no rate limit; health probe costs a query | medium | **open**, R-24, with the reason memoisation was not done |
| C8 | Node 22 in CI, 24.x in production, nothing holds them | medium | **closed** `9806b44`; `docs/SUPPORTED_RUNTIMES.md` updated |
| C9 | two log sites print the raw error object | low | **closed** `fa41edb` |
| C10 | HSTS without includeSubDomains; Referrer-Policy, COOP, Permissions-Policy not asserted as served | low | **declined for now**: `includeSubDomains` on a `*.vercel.app` alias governs subdomains the project does not own; the served-header assertion is a small L6 extension and is left for the engine check in R-27 |
| C11 | history clean; no gitleaks step | low | **declined for now**: the scan found only fixtures; a gitleaks step adds a pinned action and an allowlist for a repository with one author. Revisit at the second collaborator (Q34) |
| C12 | `npm run dev` binds 0.0.0.0 with the production app and its secrets | low | **closed** `1ea2332`: `dev` is loopback, `dev:lan` opts in by name |

## Lane D, privacy

| # | finding | severity | disposition |
| --: | --- | --- | --- |
| D1 | no way to erase the local record | high | **closed** `1ea2332`: `deleteLocalRecord`, two-press control, leaves what it says it leaves |
| D2 | no export of the record | high | **half closed** `1ea2332` (browser: stored JSON verbatim); server export is R-25 |
| D3 | no server deletion path; Q29 gap | high | **closed** `1ea2332`: `scripts/purge.ts`, proven in CI against MySQL; Q29 resolved |
| D4 | no data inventory; Q28 partial | high | **closed** `1ea2332`: `docs/RETENTION.md`, `storage-keys.ts` registry with a test that no literal escapes it; Q28 resolved |
| D5 | "no typed text" is false of the trial ledger | medium | **closed** `1ea2332`: the sentence names the one free-text answer |
| D6 | tRPC query inputs (FENs, usernames) in URLs, kept by the platform log | medium | **closed** `1ea2332`: `methodOverride: "POST"`, held by a test |
| D7 | raw error objects in two server sinks | medium | **closed** `fa41edb` |
| D8 | import readings keep the typed username | medium | **closed in policy** `1ea2332`: `docs/RETENTION.md` says they are about the account the player named and go with the record; no cap on kept readings (the number is small and each is a measurement) |
| D9 | `users` table with an email column, written by nothing | low | **open**, R-28 |
| D10 | "does not leave the computer" omits the username sent to Lichess and the failure names | low | **closed** `fa41edb` + `1ea2332`: both sentences now name both |
| D11 | nine keys, two naming schemes, no registry | low | **closed** `1ea2332`; `decision-lab-usage-v1` keeps its name (a rename would orphan every existing browser's count) and the registry says what it is |
| D12 | `manus-cookie` Bearer block in `main.tsx` | low | **closed** `fa41edb` |
| D13 | one-year stateless session; only `JWT_SECRET` rotation revokes | low | **closed in policy** `docs/RETENTION.md`; a not-before check is not built (one owner, one browser) |

## Lane E, customer journey (lead's coverage)

| # | finding | disposition |
| --: | --- | --- |
| E1 | no test drove the primary journey end to end | **closed** `4c4d1f5`: `a-stranger-takes-their-first-decision.layout.test.ts`, seven cases in Chromium against the built assets, Lichess intercepted, `/api/*` answering 503 as a stranger's deployment does |
| E2 | a double press wrote two decisions | **closed** `3f342c1`: synchronous in-flight guard; the `it.fails` case is `it` and green |
| E3 | every blitz game answered 1.e4 with 1...d5 (owner-observed) | **closed** `3f342c1`: variety among the engine's near-equals within a stated band, recorded as a distinct population |
| E4 | OAuth failure landed on English JSON | **closed** `fa41edb` |
| E5 | engine files never arrive | **held** at freeze: `.reveal-failure` in 2.7 s with a way forward; unchanged |
| E6 | unknown user, rate limit, network absent, empty account | **held** at freeze: each named in Hebrew, the account-less route still offered |
| E7 | stale build after a deploy | **held**: one reload, then the boundary; now reported as `stale-build-reload` / `stale-build-stuck` (`fa41edb`). Not driven in Chromium; the reload path is unit-tested |

## Lane F, architecture (lead's coverage)

| # | finding | disposition |
| --: | --- | --- |
| F1 | two health endpoints with different meanings | **closed** `fa41edb` |
| F2 | failure vocabularies closed per surface but not joined | **closed** `fa41edb`: `shared/failure-class.ts` is the one map; both directions total, tested |
| F3 | `Home.tsx` at 2,349 lines under a ratchet | **unchanged by design**: 2,355 after the mission, ceiling 2,400; the register's R-13 owns it |
| F4 | module-level mutable latches in `record-api.ts` and `local-record-store.ts` | **unchanged**: documented in the store; `deleteLocalRecord` resets both the memory copy and the health so the latch cannot resurrect an erased record |
| F5 | operator lines on stdout would have broken the serverless probe | **closed** `fa41edb`: stderr only, and the probe test holds it |

## Lane G, adversary

Run after implementation by an independent reviewer against the twenty attacks in
`AFTER.md` section 3, which records each verdict and what was changed in response.

## Lane H, claims

| # | claim checked | disposition |
| --: | --- | --- |
| H1 | "the record does not leave the computer" | **narrowed** to what is true: the record does not; a failure's name does; the typed username goes to the source the player chose. Both product sentences say so |
| H2 | "no typed text" in the trial ledger | **corrected** (D5) |
| H3 | "L6 is zero" | **corrected** (A15) |
| H4 | "production is behind SSO" | **corrected** (B11) |
| H5 | "0 vulnerabilities" anywhere | not claimed before; `npm audit --omit=dev` is clean now and `docs/DEPENDENCY_POLICY.md` says what that does and does not mean |
| H6 | any efficacy claim (cue, learning, calibration improvement) on a product surface | **none found** on the surfaces touched; the research verdicts stay out of the product (`BASELINE.md`, RESEARCH-GATED) |
| H7 | OwnExposure / PolicyExposure / shadow matcher | **absent** from the branch: `git grep -il "ownexposure\|policyexposure"` on the branch returns only the baseline document that forbids them |
