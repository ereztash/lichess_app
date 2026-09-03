# Customer readiness after the mission

**Scored at** the head of `claude/lichess-customer-readiness-uqj2cq`, eleven commits after
`c848f244`, the last of them the adversarial fixes. `BASELINE.md` is the frozen BEFORE and is quoted row for row; nothing there was edited.
The blocker classes and the class floors are the ones §4 of the baseline fixed before any fix landed.

## 1. What was verified at the end, not inferred

| fact | how it was established |
| --- | --- |
| the suite is green | `npm run check` exit 0 · `npm run build` exit 0 · `npm run bundle:budget` within budget · `npm test` **3,002 passed, 35 skipped** (27 database without `DATABASE_URL`, 8 L6 without `DEPLOYED_ORIGIN`) · `npm run gates` **32 pass** · `npm run gates:controls` **32 red** |
| the ladder | `npm run levels`: L1 83 · L2 85 · L3 80 · L4 8 · L5 18 · L6 1; 27 of 275 files run against something the product meets (was 16 of 248 at the time `tests/LEVELS.md` was written) |
| dependency advisories | `npm audit --omit=dev`: **0** (was 3 moderate) |
| production is unchanged | still `c848f244`; this branch is not deployed. Against it, the L6 suite is green with `DEPLOYED_SHA=c848f244…`, red with a wrong SHA, and red on the new health/build assertion because the deployed function predates the health contract, and the failure says exactly that |
| the primary journey in Chromium | 7 of 7 cases green against the built assets of this branch, including the double press that was red at freeze |
| authority | Q26, Q27, Q28, Q29, Q36 reclassified from gap or partial to one current authority; the fixture that must stay red still produces four drifts, the "gap that quietly closed" drift now pointing at Q34 (`.github/CODEOWNERS`), which is still open |

## 2. Scores, before and after

Same fifteen dimensions, same 0–10, same rule: a score records what the repository can demonstrate.

| # | dimension | before | after | what moved it | what prevents the next point now |
| --: | --- | --: | --: | --- | --- |
| 1 | Testing / falsification | 9.0 | 9.0 | the journey suite is green on all seven; 32 gates; three new docs held to code by tests | `npm test` still has no systematic control of its own (G-10); a green run and a run that collected nothing look alike from CI's summary |
| 2 | Research validity | 8.5 | 8.5 | untouched, deliberately | FIELD-REQUIRED: zero humans measured on the live record |
| 3 | Reproducibility | 5.0 | 7.0 | Vercel installs the lock exactly; one Node major read by CI and the runtime; `overrides` written with the advisory | production migrations applied by hand and recorded nowhere (R-22) |
| 4 | Evidence provenance | 8.0 | 9.0 | the function names its build at runtime from the same variable the static file uses; L6 asserts they agree; every operator line carries the build | a hand run against a deployment older than the contract cannot compare the two builds, and says so |
| 5 | Architecture | 7.0 | 7.5 | one failure taxonomy across server, wire and client; one health endpoint; one storage-key registry | `Home.tsx` 2,354 lines / 53 pieces of state (R-13); module latches in two stores |
| 6 | Maintainability | 6.5 | 7.5 | four contradictions between documents and running checks corrected; the register gained eight honest rows; ROLLBACK, OBSERVABILITY, RETENTION and DEPENDENCY_POLICY are each held by a scanner or a test; the bundle budget raise is attributed per commit by measurement | the same hotspot; eight open rows; the branch crossed the bundle budget on its first commit and found out from CI |
| 7 | Security | 6.0 | 7.0 | JWT issuer and audience pinned; `qs` off the parse path and patched; dead Bearer client path gone; actions pinned, token read-only, inputs through env; dev server on loopback | no rate limit (R-24); one-year stateless session revocable only by secret rotation; `main` unprotected (R-21) |
| 8 | Supply chain | 3.0 | 7.0 | dependency policy written and its checkable halves checked; Dependabot; zero shipped advisories; exceptions expire | the policy has not yet met its first Dependabot PR; `stockfish` bumps are by hand and unscheduled |
| 9 | Privacy / data governance | 5.0 | 7.5 | inventory with a registry test; what may and may never be recorded, each prohibition with its mechanism; local export and erase; server purge proven in CI; query inputs out of URLs; the false "no typed text" corrected | no server export for the owner (R-25); `users` table nothing writes (R-28); retention is "until erased" and stated as such |
| 10 | Observability | 2.0 | 6.0 | every failure one classified line with request id and build; health names build and subsystem; client failures reach the server as names and the local ledger as events; OAuth failures named; upstream timeouts | **one hour of retention and no alerting** (R-23, EXTERNAL_CONFIGURATION_REQUIRED). The point above 6 is not code |
| 11 | Release / rollback | 3.0 | 6.5 | a written procedure with a mechanical evidence step; the SHA binding shown to fail; a gate over the chain; `npm ci` in the build; concurrency on verify | the alias rehearsal is undone (R-26, FIELD-REQUIRED); `main` deploys before verify (R-21) |
| 12 | Customer journey robustness | 6.0 | 8.0 | double press fixed and held in Chromium; the opponent varies and says so in the record; OAuth failure lands on a Hebrew sentence at home; upstream timeouts authored | the stale-build path is unit-tested, not driven in a browser; the engine never runs on the deployed origin by anything that re-runs (R-27) |
| 13 | Production failure recovery | 3.0 | 5.5 | rollback procedure and evidence; health that names the subsystem; a request id a player can hand over; a self-check that names the build | no notification (R-23); no rehearsal on the alias (R-26) |
| 14 | Field / behavioural efficacy | 1.0 | 1.0 | nothing here measures it and nothing here claims to | FIELD-REQUIRED |
| 15 | Overall customer readiness | **5.5** | **7.0** | rows 7, 9, 10, 11, 12, 13 all clear the class C floors from §4 of the baseline (6, 6, 5, 5, 7, 5) | see below |

### Readiness class after: **C, paid-beta ready, with two external conditions**

Every BLOCKING row clears its class C floor: Security 7.0 ≥ 6, Privacy 7.5 ≥ 6, Observability 6.0 ≥ 5,
Release 6.5 ≥ 5, Journey 8.0 ≥ 7, Recovery 5.5 ≥ 5. Supply chain 7.0 ≥ 5 clears the floor class D
would add.

Not **D**: two things a paying customer would reasonably expect are not in this tree and cannot be:
the operator cannot be told of a failure (R-23) and a red build can reach production before its
check runs (R-21). Both are settings, not code, and both are the owner's decision. The class is C
**with** those two named as conditions, not C pretending they are met.

## 3. Adversarial review

Run by an independent reviewer against the branch after the eight implementation commits, with
twenty named attacks. Verdicts as returned, then what was done about each. Two things it found
would have reached production: one would have taken the whole read path down.

| # | attack | verdict | what it found | what was done |
| --: | --- | --- | --- | --- |
| 1 | operator lines carry content | WEAKENED | no call site passes input; `redact` truncated before redacting, so a token straddling the cut kept its first half; `requestId` copied verbatim from a sender-controlled header | redact first, then truncate; a request id must match `[A-Za-z0-9:_.-]{1,120}` or a local one is minted; both held by tests |
| 2 | request id echo | HOLDS | JSON bodies only; the stranger learns their own header | see 1 |
| 3 | `/api/client-event` bypass | WEAKENED | zod `.strict()` let an own `__proto__` key through; nothing read it | own keys checked first: exactly the five names; `__proto__` case in the test; the document says so |
| 4 | hang or leak `/api/health` | HOLDS | non-async handler, both branches answer, deny-list holds | none |
| 5 | build identity divergence | NOT-TESTABLE-HERE | code path found: with system env vars not exposed, the build falls back to `git` and the function to `unknown`, so L6 goes red on a healthy deployment | `docs/OBSERVABILITY.md` section 2 names the setting and what the red means |
| 6 | rollback scanner satisfiable by a wrong doc | WEAKENED | doc check was three `includes`; the `sha:` regex matched any later `sha:` key | regex anchored to `workflow_dispatch.inputs`; the doc must show the dispatch with its `sha:` line; fixture yields 10 findings |
| 7 | `deployed.yml` input safety | HOLDS | 40-hex validation, env indirection, read-only token, `if:` unchanged | none |
| 8 | `node-version-file` + concurrency boolean | HOLDS | setup-node reads `engines.node` ranges; the boolean expression form is documented; SHAs not resolvable from the reviewer's sandbox | the two pins were resolved by the lead with `git ls-remote` against the action repositories: both match `v4.4.0` |
| 9 | `qs` override, lock consistency | HOLDS | one `qs` at 6.16.0, no nested copy; `npm ci --dry-run` exit 0 | none |
| 10 | dependabot config validity | HOLDS | all keys valid against the schema | none |
| 11 | commit guard | **BROKEN, P1** | two synchronous refusal paths in `Home.onCommit` never turn `pending` on, so the ref stayed up and the position could never be committed after a refusal | the guard is released when `onCommit` settles, whatever `pending` does; `onCommit` is called synchronously so the double press is still one commit; a new test holds both halves, and the Chromium double-press case is still green |
| 12 | opponent variety correctness | HOLDS | moves only from the candidate set; mates handled both ways; UCI scores are side-to-move so the band is colour-correct; kind fits the column; strata separate populations | none |
| 13 | export and delete | WEAKENED | `deleteLocalRecord` bypassed the write lock, so an in-flight write could resurrect the record; the download `data:` URL was rebuilt on every render and would fail silently past Chromium's URL ceiling | delete runs under the same lock as every write, with a test that a write already queued cannot resurrect it; the file is built on the press as a Blob, `data:` only as fallback |
| 14 | storage-key registry gaps | WEAKENED | regex only caught `decision-lab` literals; cookies absent from the inventory | the test also fails any `setItem`/`getItem`/`removeItem` literal; `docs/RETENTION.md` section 1 lists both cookies |
| 15 | `scripts/purge.ts` | HOLDS | names from the registry, no FKs, CLI guard fires only under `tsx`, `--yes` forwarded | none |
| 16 | queries as POST | **BROKEN, P0** | the server answered every POSTed query 405: tRPC needs `allowMethodOverride` on the middleware and only the client half had been changed. Nothing ran the real link against the real app. On deploy, sign-in state, storage availability and every Lichess query would have failed | `allowMethodOverride: true`; a test runs the real `httpBatchLink({ methodOverride: "POST" })` against `createApp()` and asserts the request was a POST with no input in the URL |
| 17 | JWT issuer and audience | HOLDS | one mint site; per-app binding is the intended behaviour | none |
| 18 | docs held by tests can pass while wrong | WEAKENED | the vocabulary test accepted a code anywhere in backticks | each event code must be a row of the event table |
| 19 | authority reclassification | HOLDS | fixture yields exactly the four drifts; all authority paths exist; the `tests/LEVELS.md` table still printed the old counts | table regenerated from `npm run levels` |
| 20 | product-claim safety | WEAKENED | "answers JSON, always" contradicted the reason the L6 check exists; "refuses any other field" was false for `__proto__`; no efficacy or OwnExposure claim anywhere | both sentences rewritten to what the code does |

**What the review could not test here, and how to:** whether `VERCEL_GIT_COMMIT_SHA` reaches the
function at runtime and whether the platform overwrites an inbound `x-vercel-id` (one `curl` of
`/api/health` with a forged header after the deploy answers both); the alias rehearsal (R-26).

**What CI found that neither the suite nor the review could see here.** The first `verify` run on the
pull request went red on two things that need the MySQL service the runner has and this sandbox does
not: the health test asserted `not-configured` unconditionally (it now follows `DATABASE_URL`), and
`GATE-CLAIM-ANCHOR` refused R-22 as a P1 row with no anchored proof. R-22 is P2 now, with the
register's own rule as the reason written into the row. Both are the kind of defect the baseline's
row 3 (Reproducibility) is about: a tree that behaves differently where it is decided than where it
is written.

**Effect on the scores.** Attack 16 was a defect this branch introduced and would have shipped; it
is fixed and held by a test that did not exist. Attack 11 was a defect in a fix; the same. Neither
changes a row's score: the rows are scored on the branch as it stands, and the branch as it stands
holds both. What the review changes is the confidence in row 1 (Testing): a privacy change that took
the read path down passed 2,994 tests, because no test ran the real client link against the real
server. That test exists now and the gap it names is the one row 1 still carries.

## 4. What was deliberately not built

| not built | why |
| --- | --- |
| OwnExposure, `PolicyExposure`, a shadow matcher | PR #67's verdict stands (`SYSTEM POLICY VALID, ECOLOGICALLY INFEASIBLE`); research-gated, not on this branch, not merged, not referenced |
| any cue or learning efficacy claim | nothing here measures it |
| a third-party error SDK, analytics, dashboards, alert thresholds in code | they would send content the privacy sentence promises never leaves, or deliver to nothing (`docs/OBSERVABILITY.md` section 6) |
| an automatic rollback | needs a token that can move the production alias; owner's decision (`docs/ROLLBACK.md` section 6) |
| a preview-deployment bypass for L6 | a project setting and a GitHub secret, outside the tree; production is checked on every deployment and daily |
| memoising the health probe | a cached "reachable" is what the health route was rewritten to stop saying (R-24) |
| gitleaks in CI | one author, history clean; revisit at the second collaborator (Q34) |
| a `users` migration | recorded (R-28) rather than dropped in a mission about readiness |

## 5. Handoff checklist for the owner

1. Sign in once after this branch deploys: sessions minted before it stop verifying (issuer and audience).
2. Repository settings: a ruleset on `main` requiring a PR and the `verify` check, blocking force-push. Closes R-21.
3. Vercel: decide on a log drain or an uptime monitor on `GET /api/health` with a notification. Closes R-23.
4. On a quiet hour: roll production back to the current build (a no-op alias move), then `Actions → Deployed → Run workflow` with that SHA. Closes R-26.
5. Merge the first Dependabot PR that `verify` turns green, and read the policy against what happened.
6. After the first migration that ships: build the schema check into `/api/health` (R-22).

## 6. Next five actions, in order

1. Merge this branch, watch `deployment_status` run L6 bound to its SHA, confirm the health/build assertion is green on the new function.
2. Protect `main` (R-21).
3. Point an uptime monitor at `/api/health` (R-23).
4. Rehearse the rollback on the alias (R-26).
5. `record.export` for the owner (R-25), then the engine-on-the-deployment rung (R-27).

## 7. What this does not claim

That a score is precise to a half point. That C is a licence to onboard without the two conditions.
That anything here improves anyone's chess or calibration: nothing measured that, and this document
does not either.
