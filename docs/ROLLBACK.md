# Rollback

Authority for "how is a bad deployment rolled back?" (`scripts/authority-scan.ts`, Q26). The files
this rests on are `.github/workflows/deployed.yml`, `tests/deployment/origin.ts` and
`vercel.json`; `GATE-ROLLBACK-EVIDENCE` (`scripts/rollback-scan.ts`) reddens when any of them
stops saying what this document says.

## 1. What a deployment is here

`main` deploys on push. Vercel builds the commit with `npm ci` (the lock file exactly, stated in
`vercel.json`), runs the function on the Node major `package.json` names under `engines`, and
moves the production alias `lichessapp.vercel.app` to the new deployment when the build succeeds.
Every deployment stays addressable by its own URL afterwards.

The built assets carry `/build-identity.json` naming the commit; the function answers
`/api/health` naming the same commit from the same variable. That pair is what makes a rollback
checkable rather than believed.

## 2. When to roll back

Roll back when production is worse than the previous deployment for a player and the fix is not
already known and small. Do not debug forward on production. The signals:

- the L6 run bound to the deployment's SHA went red after `deployment_status: success`;
- `/api/health` answers 503, or answers a different `build.gitSha` than `/build-identity.json`;
- a player reports a failure the previous build did not have.

Rolling back is cheap and reversible. Deciding slowly is not.

## 3. How: redeploy the last known good, or instant rollback

Two paths. Both end in the same evidence step.

**Path A, instant rollback (Vercel dashboard or `vercel rollback <deployment-url>`).** Moves the
alias to a previous deployment in seconds. It emits **no** `deployment_status` event, so the L6
workflow does not run on its own. Section 4 is therefore not optional on this path.

**Path B, redeploy.** In the dashboard, or with the CLI, redeploy the last known good deployment.
This rebuilds and emits `deployment_status`, which runs L6 bound to that deployment's SHA
automatically. Slower; leaves a normal trail.

Prefer A when a player is affected now. Prefer B when nobody is and the trail matters more.

**Last known good** is the most recent deployment whose L6 run was green, read from the Actions
tab of `deployed.yml`, not from memory. A deployment that was never checked is not known good.

## 4. What closes the incident

A green L6 run **bound to the commit that was rolled back to**:

```
Actions -> Deployed -> Run workflow
  origin: https://lichessapp.vercel.app
  sha:    <40-hex commit of the good deployment>
```

The suite reads `DEPLOYED_SHA` from that input and refuses any origin serving another commit
(`servesExpectedBuild` in `tests/deployment/origin.ts`). A red run after a rollback means the
alias still serves the bad build, whatever the dashboard says. A run without `sha` proves only
that some coherent build is served, and the suite says so.

The workflow first runs `tests/fixtures/controls/deployed-sha.control.test.ts`, which hands the
predicate a mismatch and must go red, so a binding that has stopped binding cannot report green.

## 5. Data

There is no rollback of data. The record is append-only, the browser-local store versions its
blob (`LOCAL_RECORD_VERSION`), and the database migrations are forward-only. A code rollback that
lands on a build older than a migration that already ran must be safe against columns it does not
know: the rule for every migration is **additive first, remove later, in a separate release**. A
migration that drops or re-means a column is not rollback-safe and is not merged with the code
that stops writing it.

## 6. What is not here, and why

| not built | why |
| --- | --- |
| an automatic rollback on red L6 | it would need a token that can move the production alias, held by a workflow this repository controls; the owner has not decided to grant one |
| a staging environment | one owner, one production; a preview deployment is walled by SSO and is checked by hand |
| a release tag or changelog | `main` is the release; the deployment's SHA is the version and every build says it |

## 7. Rehearsal

The mechanism is rehearsed without touching production: `npm run gates:controls` runs the
SHA-mismatch control and `GATE-ROLLBACK-EVIDENCE` runs the chain check. A rehearsal that moves the
alias is FIELD-REQUIRED: the owner rolls production back to the current build (a no-op alias move)
and dispatches the workflow with its SHA. It has not been done yet, and this document says so
rather than implying it has.
