/**
 * The operator's channel: one JSON line per event, and a closed list of what an event may be.
 *
 * WHAT THIS REPLACES. Four `console.*` call sites, each with its own prose, one of which
 * (`[trpc]`) fired only for INTERNAL_SERVER_ERROR. A Lichess 429, a refused token, an unreachable
 * database, a failed OAuth exchange and a malformed request left no line at all, and the one line
 * that was written carried neither the request it belonged to nor the build that produced it. An
 * operator holding a user's report had nothing to grep for; an operator watching a deploy could not
 * say whether the failure rate moved, because nothing was countable.
 *
 * WHAT A LINE CARRIES, AND WHAT IT MAY NEVER CARRY. A code from `OPERATOR_EVENT_CODES`, a failure
 * class, the tRPC path, the platform request id (`x-vercel-id`, which is already on every response
 * and was logged by nothing), the build, and a `detail` that is either a constructor name, a
 * parameterised statement (`describeForOperator`) or a status code. Never a value: not a decision's
 * text, not a FEN, not a token, not a connection string. `redact` is the belt to the type's braces,
 * because the line goes to a platform log the product does not control and, on this plan, cannot
 * even read back after an hour.
 *
 * WHERE IT GOES. `console.error` for failures and `console.warn` for a fault the operator should
 * act on, both stderr, which on Vercel is the function log. NEVER stdout: the serverless entry is
 * imported by a probe (`tests/server/serverless-entry.test.ts`) that reads its stdout as one JSON
 * value, and a startup line on stdout is what broke it. That log is retained ONE HOUR on the Hobby
 * plan and nothing here forwards it. That is not fixed by code; `docs/OBSERVABILITY.md` names it as
 * the first thing an operator must decide (a log drain or an uptime monitor with a notification),
 * and until then this is what there is.
 */
import type { FailureClass } from "../../shared/failure-class.js";
import { runtimeBuildIdentity } from "./build.js";

export const OPERATOR_EVENT_CODES = [
  /** A tRPC procedure ended in an error, of any code. `failureClass` says which kind. */
  "request-failed",
  /** The configured database refused, or answered with an error, inside the probe. */
  "storage-unreachable",
  /** The configured database did not answer within `AVAILABILITY_PROBE_MS`. */
  "storage-timeout",
  /** `drizzle(url)` itself threw: the connection string could not even be parsed. */
  "storage-init-failed",
  /** Lichess or its explorer answered 429. */
  "upstream-lichess-429",
  /** Lichess or its explorer answered 401/403 to the deployment's token. */
  "upstream-lichess-auth",
  /** Lichess or its explorer answered with any other non-2xx. */
  "upstream-lichess-error",
  /** Lichess or its explorer did not answer within `UPSTREAM_TIMEOUT_MS`. */
  "upstream-lichess-timeout",
  /** The OAuth callback could not exchange the code: the portal did not answer or refused. */
  "oauth-portal-unreachable",
  /** The OAuth callback ran on a deployment without `OAUTH_SERVER_URL`, `VITE_APP_ID` or `JWT_SECRET`. */
  "oauth-not-configured",
  /** The portal answered without an `openId`. */
  "oauth-no-openid",
  /** The `state` did not match the nonce cookie: an expired attempt, or a forged one. */
  "oauth-state-rejected",
  /** The callback was reached without `code` and `state`. */
  "oauth-malformed",
  /** A combination of settings that leaves the deployment unable to do what it was configured for. */
  "config-fault",
  /** A browser reported a failure through `/api/client-event`. */
  "client-failure",
] as const;

export type OperatorEventCode = (typeof OPERATOR_EVENT_CODES)[number];

export interface OperatorEvent {
  code: OperatorEventCode;
  /** Which kind of thing failed, from the shared vocabulary. */
  failureClass?: FailureClass;
  /** The tRPC path, or the route. Never carries input. */
  path?: string;
  /** The platform's request id, so a user's report and a log line can meet. */
  requestId?: string;
  /** A class name, a parameterised statement, a status: something with no value in it. */
  detail?: string;
  /** The client's own code and surface, when the event came from a browser. */
  clientCode?: string;
  surface?: string;
  /** The build the CLIENT reported, which is not necessarily this function's. */
  clientBuild?: string;
  /** Variable NAMES, for a configuration fault. */
  variables?: readonly string[];
}

/** What a written line looks like, so a test can hold the shape rather than the prose. */
export interface OperatorLine extends OperatorEvent {
  kind: "operator";
  at: string;
  build: string;
  target: string;
}

/**
 * Patterns that mean a value got in where only a name belongs.
 *
 * A URL with credentials (the shape of a DATABASE_URL), a JWT, a Lichess personal token, and a FEN.
 * Replaced rather than dropped, so a line that WAS about to leak says so and can be found.
 */
const SECRET_SHAPES: readonly RegExp[] = [
  /[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /\blip_[A-Za-z0-9]{6,}\b/g,
  /(?:[prnbqkPRNBQK1-8]+\/){7}[prnbqkPRNBQK1-8]+/g,
];

const DETAIL_MAX = 200;

export function redact(value: string): string {
  /* Redact FIRST: a token that straddles the cut would otherwise keep its first half. */
  let out = value;
  for (const shape of SECRET_SHAPES) out = out.replace(shape, "[redacted]");
  return out.length > DETAIL_MAX ? `${out.slice(0, DETAIL_MAX)}…` : out;
}

/** What a platform request id looks like: `iad1::iad1::ftv9g-1788385416839-787fa53fc372`. */
const REQUEST_ID_SHAPE = /^[A-Za-z0-9:_.-]{1,120}$/;

/** The sink, replaceable so a test can hold the line rather than scrape stderr. */
export type Sink = (level: "error" | "warn", line: string) => void;

const consoleSink: Sink = (level, line) => {
  if (level === "error") console.error(line);
  else console.warn(line);
};

let sink: Sink = consoleSink;

/** Test seam. Production never calls it. */
export function useSinkForTests(next: Sink | null): void {
  sink = next ?? consoleSink;
}

/** Faults the operator should act on that are not a failed request: warned, not errored. */
const WARNINGS: ReadonlySet<OperatorEventCode> = new Set(["config-fault"]);

/**
 * Write one event. Never throws: a telemetry failure must not become the failure it reports.
 */
export function emit(event: OperatorEvent, now: Date = new Date()): OperatorLine {
  const identity = runtimeBuildIdentity();
  const line: OperatorLine = {
    kind: "operator",
    at: now.toISOString(),
    build: identity.gitSha,
    target: identity.target,
    ...event,
    ...(event.detail === undefined ? {} : { detail: redact(event.detail) }),
    ...(event.path === undefined ? {} : { path: redact(event.path) }),
  };
  try {
    sink(WARNINGS.has(event.code) ? "warn" : "error", JSON.stringify(line));
  } catch {
    /* A sink that throws is not a reason to fail the request. */
  }
  return line;
}

/**
 * The platform's request id, or a short random one when no platform set one.
 *
 * `x-vercel-id` is on every request Vercel routes to the function and on every response it sends
 * back, so a user reading it out of their network tab or a failure disclosure and an operator
 * grepping the log are naming the same request. Locally there is none, and a random id is still
 * better than nothing: two failures in one test run stop being indistinguishable.
 */
export function requestIdFrom(headers: Readonly<Record<string, unknown>>): string {
  const raw = headers["x-vercel-id"];
  const fromPlatform = Array.isArray(raw) ? raw[0] : raw;
  /*
   * SHAPE-CHECKED, because on a direct request the header is whatever the sender put there, and
   * it is copied into the log line and the error body verbatim. An id is letters, digits and
   * `:_.-`; anything else is not an id and gets a local one.
   */
  if (typeof fromPlatform === "string" && REQUEST_ID_SHAPE.test(fromPlatform)) {
    return fromPlatform;
  }
  return `local-${Math.random().toString(36).slice(2, 10)}`;
}
