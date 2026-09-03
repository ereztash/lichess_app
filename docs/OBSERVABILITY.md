# Observability

Authority for the question "where do runtime errors go, and what is observable in production?"
(`scripts/authority-scan.ts`, Q27). The code this document describes is
`server/_core/telemetry.ts`, `shared/failure-class.ts`, `shared/failure-event.ts` and
`client/src/lib/error-sink.ts`. If this document and that code disagree, the code is right and this
document is the defect. `tests/docs/the-observability-vocabulary-is-written-down.test.ts` holds
the vocabulary below to the code.

## 1. What the platform gives, and what it does not

The API is one Vercel function. Anything it writes to stderr appears in the project's runtime log.
On the Hobby plan that log is retained for **one hour** and there is **no alerting** of any kind.
Nothing in this repository forwards the log anywhere.

Consequences, stated plainly:

- A failure nobody looks at within an hour leaves no trace on the server. The client keeps its own
  trace (section 5) and the self-check report carries it.
- There is no page, no on-call, no threshold. An operator learns of a failure from a person.

**EXTERNAL_CONFIGURATION_REQUIRED.** Three things close this, none of them code:

| need | what closes it | who decides |
| --- | --- | --- |
| retention beyond one hour | a Vercel log drain (Pro plan) or an equivalent forwarder | the owner |
| knowing the origin is down | an uptime monitor calling `GET /api/health` and reading `ok` | the owner |
| being told | a notification route from the monitor or the drain | the owner |

Until these exist the honest statement is: production failures are observable for one hour by an
operator who is already looking. This document does not pretend otherwise.

## 2. The health contract

`GET /api/health` answers JSON, always, from the function and never from the SPA fallback. The L6
suite (`tests/deployment/`) checks the content type as served, because a broken function build
would otherwise answer `200 text/html`.

```json
{
  "ok": true,
  "build": { "gitSha": "<40 hex>", "target": "production", "protocolVersion": "1.0.0" },
  "checks": { "storage": "not-configured" | "reachable" | "unreachable" },
  "requestId": "<x-vercel-id>"
}
```

Three questions, three fields:

| question | answered by | how |
| --- | --- | --- |
| liveness: is the function answering? | any JSON answer at all | 200 or 503, both count as alive |
| readiness: can it serve a player? | `ok` | `false` with 503 when a configured dependency is unreachable |
| dependency: which subsystem? | `checks.storage` | by role, never by host, port or variable name |

`checks.storage` is `not-configured` when there is no `DATABASE_URL` and the product runs on the
browser-local record. That is a valid production state, not a degradation, and the body says
`ok: true` for it. `unreachable` covers both a refusal and a timeout; the operator line
(section 3) distinguishes them.

`build.gitSha` is read from `VERCEL_GIT_COMMIT_SHA` at runtime, the same variable
`scripts/write-build-identity.ts` reads at build time. The L6 suite asserts the two agree, so a
static bundle served against a function from another deployment is a red L6 run, not a mystery.

The body names no variable, host, port or user. `tests/server/a-health-check-that-measures-health.test.ts`
and `tests/server/an-operator-can-name-the-request.test.ts` hold a deny-list against it.

## 3. Operator lines

Every failure the server notices produces one JSON line on stderr:

```json
{"kind":"operator","at":"…","build":"<sha>","target":"production","code":"request-failed",
 "failureClass":"auth","path":"lichess.account","requestId":"iad1::…","detail":"UNAUTHORIZED"}
```

`console.error` for failures, `console.warn` for a configuration fault an operator should act on.
Never stdout: the serverless entry is probed by a test that reads stdout as one JSON value.

### 3.1 Event codes

| code | meaning |
| --- | --- |
| `request-failed` | a tRPC procedure ended in an error, of any code; `failureClass` says which kind |
| `storage-unreachable` | the configured database refused or errored inside the availability probe |
| `storage-timeout` | the configured database did not answer within the probe's deadline |
| `storage-init-failed` | the connection string could not be parsed at all |
| `upstream-lichess-429` | Lichess or its explorer rate-limited the deployment |
| `upstream-lichess-auth` | Lichess answered 401 or 403 to the deployment's token |
| `upstream-lichess-error` | Lichess answered any other non-2xx |
| `upstream-lichess-timeout` | Lichess did not answer within `UPSTREAM_TIMEOUT_MS` |
| `oauth-portal-unreachable` | the OAuth callback could not exchange the code |
| `oauth-not-configured` | the callback ran without `OAUTH_SERVER_URL`, `VITE_APP_ID` or `JWT_SECRET` |
| `oauth-no-openid` | the portal answered without an openId |
| `oauth-state-rejected` | the callback's `state` did not match the nonce cookie |
| `oauth-malformed` | the callback arrived without `code` or `state` |
| `config-fault` | the deployment's variables are incoherent; `variables` names which |
| `client-failure` | a browser reported one of the client codes in section 5 |

### 3.2 Failure classes

One vocabulary for the server line, the tRPC error shape and the client beacon:

`user-input`, `auth`, `precondition`, `upstream-provider`, `storage`, `timeout`, `engine`,
`network`, `stale-build`, `render`, `internal`, `unknown`.

`failureClassOfTrpcCode` folds every tRPC code onto one of these; `failureClassOfClientCode` does
the same for the client codes. `unknown` is reserved for a code neither map has a row for, and the
test asserts every listed code maps somewhere else.

### 3.3 What a line may never carry

`detail` is a constructor name, a parameterised statement or a status code. `redact` additionally
strips, before the line is written:

- credentials inside a URL (`mysql://user:pass@…` becomes `mysql://[redacted]@…`)
- anything shaped like a JWT
- Lichess personal tokens (`lip_…`)
- anything shaped like a FEN
- everything past 200 characters

The record's content (a position, a move, a player's sentence) is never an argument to `emit`.
The redaction is the belt; the test that fails a 500 with a player's sentence in the bound
parameters and asserts it reached neither the wire nor the line is the braces.

## 4. The request id

`x-vercel-id` is on every response the platform sends and was logged by nothing. Now:

- `createContext` reads it (or mints `local-…` when absent, so two local failures are not one);
- the tRPC error shape carries it as `error.data.requestId`;
- every operator line carries it as `requestId`;
- the health body carries it.

**Support flow.** A player reports a failure. The self-check report they can copy names the build
(`build=<sha12>`) and, for failures the client observed, the failure class and code. An operator
with the request id searches the runtime log for it within the hour. Without the id, the operator
searches by `code` and `build` in the same window. After the hour, section 1 applies.

## 5. The client beacon

Browsers fail where the server cannot see: the engine worker, a chunk that no longer exists after
a deploy, a render crash. `client/src/lib/error-sink.ts` sends one report per such failure to
`POST /api/client-event`, same origin, by `sendBeacon` or a keepalive fetch.

The body is exactly five enumerated fields and the server refuses anything else with 400 and an
empty body:

| field | domain |
| --- | --- |
| `code` | one of `CLIENT_FAILURE_CODES` |
| `failureClass` | one of the classes in 3.2 |
| `surface` | `front-door`, `board`, `blitz`, `import`, `self-check`, `app` |
| `build` | 7 to 40 hex characters, or `unknown` |
| `at` | ISO timestamp |

Ceilings: 2 kB per body (413 above it), 25 reports per page load. **No content, ever**: no
message text, no stack, no URL, no position, no username. The privacy sentence the product shows a
signed-out player ("if something fails, only the failure's name is sent to the server, without
content") is this rule, and `tests/client/a-failure-leaves-only-its-name.test.ts` holds it.

The same failure is also written to the browser-local trial ledger as `failure_observed`
(`docs/ACQUISITION_EVIDENCE.md`, section 3), so the self-check report carries it even when the
beacon never arrived.

## 6. What is deliberately not built

| not built | why |
| --- | --- |
| metrics aggregation, dashboards | nothing here can hold a series for longer than an hour; a dashboard over a one-hour log is a screenshot |
| distributed tracing | one function, one hop |
| alert thresholds in code | there is nothing to deliver them; section 1 names what would |
| sampling | volumes are single-owner scale; every failure is written |
| a third-party error SDK | it would send content the privacy sentence promises never leaves; the beacon carries names only |

## 7. How to verify this document

```
npx vitest run tests/server/an-operator-can-name-the-request.test.ts \
  tests/server/a-sign-in-that-did-not-complete-goes-home.test.ts \
  tests/client/a-failure-leaves-only-its-name.test.ts \
  tests/docs/the-observability-vocabulary-is-written-down.test.ts
```

Against a deployment: `DEPLOYED_ORIGIN=https://… npx vitest run tests/deployment/` asserts the
health body names the same build as the static identity.
