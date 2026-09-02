# TARGET 3 — L6 runtime truth

| | before | after |
| --- | ---: | ---: |
| `L6` test files | **0** of 264 | **1** of 265 |
| `L6` assertions | 0 | 7 |
| standing mechanism | none | `.github/workflows/deployed.yml`, on every `deployment_status` |
| falsification | none | the same predicates against a known-wrong origin, **required to go red** |

---

## 1. What was missing, and it was not a test

This repository could prove `source → build → local Chromium` and stopped. `npm run levels`
reported **L6 0** for its whole life, and the one run that ever found a deployment defect — a CSP
that broke the engine worker — was a throwaway script that does not re-run.

The missing piece was not a test. It was an **identity**. A test that fetches the deployed site and
asserts something about the response cannot say *which build* it just asserted about, so a green run
proves the claim about whatever happened to be deployed at that moment, including a build from three
days ago that the last deploy failed to replace.

## 2. Build identity, generated and not written

`scripts/write-build-identity.ts` runs after `vite build` and writes `dist/public/build-identity.json`:

```json
{ "gitSha": "…", "builtAt": "…", "target": "production|preview|ci|local", "protocolVersion": "1.0.0" }
```

- **`gitSha`** comes from `VERCEL_GIT_COMMIT_SHA` / `GITHUB_SHA` when a platform built it, because
  the platform's record of which commit it checked out is what the deployment is keyed by; it falls
  back to `git rev-parse HEAD`.
- **`target`** is why an `L6` claim can be honest. A test that fetches a preview URL and reports
  *"production is healthy"* is making a claim about a build no player was ever served. The suite
  names the target in every failure message.
- **`protocolVersion`** is the one field bumped by hand, on purpose. It answers *"may a measurement
  taken against build A be compared with one taken against build B?"*, which serves `RNL-11`.

It is written into `dist/` and not `client/public/`, because a generated file committed into source
is a declaration that drifts the moment somebody builds without running the generator. `package.json`
has said `"version": "1.0.0"` through every deployment this repository has ever made, which is what
a hand-entered identity does.

## 3. What the L6 suite licenses, and what it refuses to

`tests/deployment/the-origin-that-answers.deployment.test.ts`, seven assertions, every one naming
the build it ran against.

| check | licenses |
| --- | --- |
| the origin names its build, **before anything else is asked** | that the rest of the run is a claim about a named commit |
| the served commit equals `DEPLOYED_SHA` when the caller named one | that the deployment carries the code in the diff |
| `/`, `/play`, `/blitz` answer 200 `text/html` on a **cold** request | SPA routing as served, not after client routing |
| the entry `/assets/*` the served HTML names load with the right MIME | asset delivery and `nosniff` compatibility |
| the served CSP contains `worker-src 'self'` and `'wasm-unsafe-eval'` | the policy **as served**, which is the one this repository has already broken once in a way no local test could see |
| `/api/health` answers `application/json` | that the function deployed. **The content type is the point, not the status** — an SPA fallback answers 200 `text/html` for any unknown path, so a check that only asserted 200 would pass on a deployment whose API failed to build |
| the served document is this application's shell | the weakest honest statement about the running product |

**It licenses nothing about product behaviour.** Nothing here plays a game, commits a decision or
reads a record.

**No writes, ever.** A smoke test that committed a decision would be creating production data to
make a test pass, and the record it wrote would be indistinguishable from a player's. The strongest
honest claim over a read-only path is the one this file makes, and it says so in its own words.

## 4. The falsification, and why it is honest

The mission's rule: *do not manufacture an artificial production failure if doing so would require
corrupting the real deployment.* At `L6` the input is the world.

So the control is **the same predicates pointed at an origin known not to be this application**
(`https://example.com`, in `tests/fixtures/controls/deployed-origin.control.test.ts`), and it must
go red. That is a real falsification rather than a weaker one: the claim under test is *"the
deployed origin serves this build of this application"*, and the way that claim fails in production
is exactly this — a request lands somewhere that answers 200 with a document that is not ours. A
parked domain, a stale alias, a rewritten route and a rolled-back deployment all present that way.

`example.com` rather than a dead host, because **any check fails against a dead host, including a
check that does nothing.**

```
npx vitest run --config vitest.controls.config.ts tests/fixtures/controls/deployed-origin.control.test.ts
  3 failed (3)      -- required
```

## 5. It is standing, and it does not gate merges

`.github/workflows/deployed.yml` runs on `deployment_status` (every Vercel deployment, against the
SHA it claims), on a daily schedule against production, and on demand. The control runs **first**,
so a suite that has stopped checking anything cannot report green on the real origin.

It is deliberately not part of `verify`: at the moment `verify` runs there is nothing deployed to
check, because the deployment is a consequence of the merge `verify` is gating. A required check
that cannot run until after the merge blocks every pull request forever.

Locally and in `verify`, `DEPLOYED_ORIGIN` is unset and the suite **skips** — the database suite's
case, not `browser.ts`'s, and `tests/deployment/origin.ts` explains the difference. The workflow
that is meant to run these sets the variable, so a skip there is a failure of the workflow.

## 6. The first real run, reported as it came back

Run by hand against `https://lichessapp.vercel.app`:

```
Tests  2 failed | 5 passed (7)

FAIL  says which build it is serving, before anything else is asked of it
FAIL  serves the commit it was asked for
      https://lichessapp.vercel.app/build-identity.json answered 200 as `text/html; charset=utf-8`,
      not JSON. An SPA fallback answers every unknown path this way, so this origin is serving a
      build that predates the build identity
```

**The two failures are the correct answer.** Production is serving `8c8b331`, the commit before this
branch, so it has no build identity to serve. The five that passed are real `L6` evidence about that
deployment: its SPA routes, its asset MIME types, its served CSP, its API function, and its shell.

That is the suite discriminating on its first run, and it is the reason the identity check comes
first: without it, those five passes would have been reported as evidence about *this* branch.

## 7. Found while writing this, and not by a check

The Vercel project runs **Node 24.x**; `verify-build.yml` pins **22**. Every test result in this
repository is evidence about 22 and every request a player makes is served by 24.x. Recorded in
`docs/SUPPORTED_RUNTIMES.md` rather than closed, because closing it means pinning one to the other
in a place a command reads, and that is `Q36`'s capability gap.

## 8. What this does not establish

- **That production is correct.** It establishes what the *checked* properties of a named deployment
  are, and there are seven of them.
- **That the product works for a player.** No decision is recorded, no game is played, no record is
  read. `L6` here means *the deployment serves what it should serve*, not *the product does what it
  promises*.
- **That every deployment will be checked.** `deployment_status` depends on Vercel reporting it, and
  the daily run covers what the event misses. Neither is proved to fire until one does.
