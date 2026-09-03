/**
 * Where a failure goes after the player has been told about it.
 *
 * WHAT WAS MISSING. This client names its failures better than most: nine engine codes with a
 * remedy each, six import kinds, a stale-build reload, an error boundary in the player's language.
 * Every one of them was rendered and then forgotten. Nothing wrote them to the local ledger, so a
 * tester who copied the self-check report could not show what had failed earlier in the visit; and
 * nothing sent them anywhere, so a cohort meeting `worker-refused` on a corporate proxy looked to
 * the operator like a cohort that lost interest. "Can I see that they are failing?" had the answer
 * no.
 *
 * TWO DESTINATIONS, ONE VOCABULARY. The event is written to the trial ledger (`progress-record`),
 * so it travels with the report a person hands over, and it is POSTed to the same origin at
 * `/api/client-event`, so the operator can count it without waiting for anyone. Both carry the
 * same five fields and nothing else: a code from `CLIENT_FAILURE_CODES`, its class, the surface,
 * the build sha, the time. The type makes a message unrepresentable and the server's `.strict()`
 * schema refuses one that arrived anyway.
 *
 * WHY THIS DOES NOT BREAK THE PROMISE. The front door says the decisions never leave the browser.
 * A failure code is not a decision, not a position, not a word the player wrote, not their
 * account; it is the name of a place in this program that stopped. `docs/OBSERVABILITY.md` states
 * the rule and `tests/client/a-failure-leaves-only-its-name.test.ts` holds it: no string a person
 * typed can reach either destination through this module.
 *
 * NEVER THROWS, NEVER LOOPS. A reporter that fails is a second failure the player did not have, and
 * a reporter called from `window.onerror` that itself errors is an infinite one. Every path here is
 * wrapped, and a page load may send at most `MAX_PER_LOAD` events.
 */
import {
  CLIENT_FAILURE_CODES,
  failureClassOfClientCode,
  failureClassOfTrpcCode,
  isClientFailureCode,
  type ClientFailureCode,
  type ClientSurface,
} from "@shared/failure-class";
import { failureCode } from "@shared/engine-failure";
import { loadBuildIdentity } from "./build-identity";
import { recordTrialEvent } from "./progress-record";

export const CLIENT_EVENT_PATH = "/api/client-event";
/** A loop guard, not a quota: a healthy visit sends none, an unhealthy one a handful. */
export const MAX_PER_LOAD = 25;

export type Send = (path: string, body: string) => void;

const beacon: Send = (path, body) => {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(path, new Blob([body], { type: "application/json" }));
      return;
    }
    if (typeof fetch === "function") {
      void fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    /* Nothing: the failure was already shown to the player, and this is only its echo. */
  }
};

let send: Send = beacon;
let sent = 0;

/** Test seam: replace the transport, and reset the per-load counter. */
export function useSendForTests(next: Send | null): void {
  send = next ?? beacon;
  sent = 0;
}

/**
 * Report one named failure. The only entry point that reaches the wire.
 *
 * `code` is checked at runtime as well as by type, because a caller holding a string from an
 * `ImportFailure.kind` or an engine error has a string, and a string that is not on the list is
 * reported as `unknown` rather than as itself.
 */
export function reportFailure(code: string, surface: ClientSurface, now: Date = new Date()): void {
  const known: ClientFailureCode = isClientFailureCode(code) ? code : "unhandled-error";
  const failureClass = failureClassOfClientCode(known);
  const at = now.toISOString();
  try {
    recordTrialEvent({ name: "failure_observed", at, code: known, failureClass, surface });
  } catch {
    /* The ledger refusing a row is its own guard working; the beacon below still goes. */
  }
  if (sent >= MAX_PER_LOAD) return;
  sent += 1;
  void loadBuildIdentity()
    .then((identity) => {
      const build = identity && /^[0-9a-f]{7,40}$/.test(identity.gitSha) ? identity.gitSha : "unknown";
      send(CLIENT_EVENT_PATH, JSON.stringify({ code: known, failureClass, surface, build, at }));
    })
    .catch(() => undefined);
}

/** An engine error, by the code it carries or `engine-unclassified` when it carries none. */
export function reportEngineFailure(error: unknown, surface: ClientSurface): void {
  reportFailure(failureCode(error) ?? "engine-unclassified", surface);
}

/**
 * A tRPC error, folded onto the `api-*` codes by the class its code belongs to.
 *
 * A network failure arrives with no `data`, and that is the `api-unreachable` case rather than an
 * unknown one: the server was not reached, which is a different fact from the server refusing.
 */
export function reportApiFailure(error: unknown, surface: ClientSurface): void {
  const data = (error as { data?: { code?: string } } | null)?.data;
  if (!data?.code) {
    reportFailure("api-unreachable", surface);
    return;
  }
  const code = `api-${failureClassOfTrpcCode(data.code)}`;
  reportFailure((CLIENT_FAILURE_CODES as readonly string[]).includes(code) ? code : "api-unknown", surface);
}

/**
 * The two things a page can catch that nothing else did.
 *
 * Attached once, from `main.tsx`. Both report a code and a surface and nothing of the error: the
 * message of an uncaught exception is exactly the kind of string this module exists to keep out.
 */
export function attachWindowFailureListeners(target: Window = window): void {
  target.addEventListener("error", () => reportFailure("unhandled-error", "app"));
  target.addEventListener("unhandledrejection", () => reportFailure("unhandled-rejection", "app"));
}
