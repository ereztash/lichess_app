/**
 * One vocabulary for "what kind of failure was that", shared by the server log and the client beacon.
 *
 * WHAT WAS MISSING. The client already names its failures well: nine engine codes with a remedy each
 * (`shared/engine-failure.ts`), six import kinds (`client/src/lib/game-source.ts`), nine record-mode
 * sentences. Every one of them is rendered to the player and then forgotten. The server logged one
 * thing -- an INTERNAL_SERVER_ERROR's class name -- and nothing else: a Lichess 429, a refused
 * token, an unreachable database and a malformed request all left no line. So an operator asked
 * "which subsystem is failing?" had no vocabulary to count in, and a user's report could not be
 * matched to anything.
 *
 * THIS IS THE COUNTING VOCABULARY, NOT A SECOND SENTENCE. A class says which kind of thing broke and
 * therefore who can fix it: the player (input), the deployment (precondition, storage), the world
 * (upstream, network), the build (stale-build, render, internal). It never carries a message. The
 * codes below are closed lists on purpose: a beacon that can carry any string can carry a FEN or a
 * sentence, and this product's promise is that neither leaves the browser.
 *
 * NO `unknown` IS HIDDEN INSIDE ANOTHER CLASS. `shared/engine-failure.ts` refuses an `unknown` code
 * because a generic engine code would collect exactly the cases its list exists to separate. Here
 * `unknown` IS a class, deliberately: the question this vocabulary answers is "how many failures
 * did we fail to classify", and a taxonomy that cannot say so cannot be improved.
 */
import { ENGINE_FAILURES } from "./engine-failure.js";

export const FAILURE_CLASSES = [
  /** The request or input was not acceptable. The player, or a stale client, can fix it. */
  "user-input",
  /** No session, or the wrong account. */
  "auth",
  /** The deployment is missing a piece it was configured to have. The operator fixes it. */
  "precondition",
  /** Lichess or Chess.com answered badly, slowly, or with a refusal. */
  "upstream-provider",
  /** The database, or the browser's storage. */
  "storage",
  /** A bounded wait ran out. */
  "timeout",
  /** The browser-side engine: worker, wasm, assets, silence. */
  "engine",
  /** The browser could not reach an origin at all. */
  "network",
  /** The page holds a build the server no longer serves. */
  "stale-build",
  /** A component threw while rendering. */
  "render",
  /** The product's own code failed in a way it did not author a sentence for. */
  "internal",
  /** Nothing classified it. Counted, so the vocabulary can be grown where it is short. */
  "unknown",
] as const;

export type FailureClass = (typeof FAILURE_CLASSES)[number];

/**
 * tRPC's error codes, folded onto the classes above. Total: every code the framework can produce
 * lands somewhere, and `unknown` is where a code this table has not learned lands.
 */
const TRPC_CLASS: Readonly<Record<string, FailureClass>> = {
  PARSE_ERROR: "user-input",
  BAD_REQUEST: "user-input",
  UNPROCESSABLE_CONTENT: "user-input",
  NOT_FOUND: "user-input",
  CONFLICT: "user-input",
  PAYLOAD_TOO_LARGE: "user-input",
  METHOD_NOT_SUPPORTED: "user-input",
  UNSUPPORTED_MEDIA_TYPE: "user-input",
  UNAUTHORIZED: "auth",
  FORBIDDEN: "auth",
  PRECONDITION_FAILED: "precondition",
  BAD_GATEWAY: "upstream-provider",
  TOO_MANY_REQUESTS: "upstream-provider",
  SERVICE_UNAVAILABLE: "upstream-provider",
  TIMEOUT: "timeout",
  CLIENT_CLOSED_REQUEST: "network",
  INTERNAL_SERVER_ERROR: "internal",
  NOT_IMPLEMENTED: "internal",
};

export function failureClassOfTrpcCode(code: string): FailureClass {
  return TRPC_CLASS[code] ?? "unknown";
}

/**
 * The codes a browser may report, and nothing else.
 *
 * Every entry is either a code the product already emits (engine, import) or the name of a place a
 * failure is caught. None is free text and none can carry one.
 */
export const CLIENT_FAILURE_CODES = [
  ...ENGINE_FAILURES,
  /** The engine failed and `failureCode` could not say which of the nine it was. */
  "engine-unclassified",
  /** The import screen's six kinds, as `ImportFailure.kind` spells them. */
  "empty-username",
  "no-such-user",
  "rate-limited",
  "no-games",
  "blocked",
  "source-error",
  /** The record refused or failed to take a decision. */
  "commit-failed",
  /** The engine spoke and the verdict could not be written beside the decision. */
  "reveal-write-failed",
  /** A hashed chunk was gone; the page reloaded itself once. */
  "stale-build-reload",
  /** A hashed chunk was gone and the one reload did not help. */
  "stale-build-stuck",
  /** A component threw and the boundary caught it. */
  "render-crash",
  /** The API answered with one of tRPC's codes, folded by `failureClassOfTrpcCode`. */
  "api-user-input",
  "api-auth",
  "api-precondition",
  "api-upstream-provider",
  "api-timeout",
  "api-internal",
  "api-unknown",
  /** The API could not be reached at all. */
  "api-unreachable",
  /** `window.onerror` / `unhandledrejection`: nothing caught it. */
  "unhandled-error",
  "unhandled-rejection",
] as const;

export type ClientFailureCode = (typeof CLIENT_FAILURE_CODES)[number];

/** Where on the product the failure was observed. A screen, never a position or a player. */
export const CLIENT_SURFACES = ["front-door", "board", "blitz", "import", "self-check", "app"] as const;
export type ClientSurface = (typeof CLIENT_SURFACES)[number];

const ENGINE_CODES: ReadonlySet<string> = new Set(ENGINE_FAILURES);
const IMPORT_CODES: ReadonlySet<string> = new Set([
  "empty-username",
  "no-such-user",
  "rate-limited",
  "no-games",
  "blocked",
  "source-error",
]);

/** The class of a client code. Total over `CLIENT_FAILURE_CODES`. */
export function failureClassOfClientCode(code: ClientFailureCode): FailureClass {
  if (ENGINE_CODES.has(code) || code === "engine-unclassified") return "engine";
  if (code === "blocked") return "network";
  if (code === "no-such-user" || code === "empty-username" || code === "no-games") return "user-input";
  if (IMPORT_CODES.has(code)) return "upstream-provider";
  if (code === "commit-failed" || code === "reveal-write-failed") return "storage";
  if (code.startsWith("stale-build")) return "stale-build";
  if (code === "render-crash") return "render";
  if (code === "unhandled-error" || code === "unhandled-rejection") return "internal";
  if (code === "api-unreachable") return "network";
  if (code.startsWith("api-")) return code.slice(4) as FailureClass;
  return "unknown";
}

export function isClientFailureCode(value: unknown): value is ClientFailureCode {
  return typeof value === "string" && (CLIENT_FAILURE_CODES as readonly string[]).includes(value);
}

export function isClientSurface(value: unknown): value is ClientSurface {
  return typeof value === "string" && (CLIENT_SURFACES as readonly string[]).includes(value);
}
