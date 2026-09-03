// @vitest-environment jsdom
/**
 * A failure that is reported leaves only its name: never a position, a move, a word or an account.
 *
 * THE PROMISE THIS PROTECTS. The front door says the record never leaves the browser. Reporting
 * failures to the server is the one thing this product now sends without being asked, and the way
 * such a channel breaks a promise is not a decision -- it is a `message` field that one day carries
 * a driver's text. So the channel takes a code from a closed list and a surface, and this file
 * holds that no string a person typed can reach the ledger or the wire through it, by trying.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientFailureEventSchema } from "@shared/failure-event";
import { CLIENT_FAILURE_CODES } from "@shared/failure-class";
import {
  attachWindowFailureListeners,
  CLIENT_EVENT_PATH,
  MAX_PER_LOAD,
  reportApiFailure,
  reportEngineFailure,
  reportFailure,
  useSendForTests,
} from "@/lib/error-sink";
import { forgetBuildIdentity } from "@/lib/build-identity";
import { beginVisit, clearProgress, progress } from "@/lib/progress-record";
import { EngineFailureError } from "@shared/engine-failure";
import { authFailureSentence } from "@/components/AuthFailureNotice";

const SHA = "c848f244d380e13a8622c590791b22a2bef7a39b";
const FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

let sent: { path: string; body: string }[];

/** The origin names its build, as a deployed one does. */
function stubIdentity(kind: "json" | "html") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      kind === "json"
        ? new Response(
            JSON.stringify({ gitSha: SHA, builtAt: "2026-09-02T12:43:22Z", target: "production", protocolVersion: "1.0.0" }),
            { status: 200, headers: { "content-type": "application/json" } },
          )
        : new Response("<!doctype html><div id=root></div>", { status: 200, headers: { "content-type": "text/html" } }),
    ),
  );
}

/** Wait for the beacon's own microtasks (identity lookup, then send). */
const settle = () => new Promise((r) => setTimeout(r, 0));

const events = () => progress().flatMap((v) => (v.events ?? []).filter((e) => e.name === "failure_observed"));

beforeEach(() => {
  sent = [];
  useSendForTests((path, body) => sent.push({ path, body }));
  forgetBuildIdentity();
  stubIdentity("json");
  clearProgress();
  beginVisit(new Date("2026-09-02T12:00:00.000Z"));
});

afterEach(() => {
  useSendForTests(null);
  vi.unstubAllGlobals();
});

describe("what a report carries", () => {
  it("writes one ledger row and sends one body, both with exactly five fields and the build", async () => {
    reportFailure("worker-refused", "board", new Date("2026-09-02T12:01:00.000Z"));
    await settle();

    const rows = events();
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["at", "code", "failureClass", "name", "surface"]);
    expect(rows[0]).toMatchObject({ code: "worker-refused", failureClass: "engine", surface: "board" });

    expect(sent).toHaveLength(1);
    expect(sent[0].path).toBe(CLIENT_EVENT_PATH);
    const body = clientFailureEventSchema.parse(JSON.parse(sent[0].body));
    expect(body).toEqual({
      code: "worker-refused",
      failureClass: "engine",
      surface: "board",
      build: SHA,
      at: "2026-09-02T12:01:00.000Z",
    });
  });

  it("cannot be made to carry a string a person wrote: an unknown code becomes a name, not itself", async () => {
    reportFailure(FEN, "board");
    reportFailure("erez281 wrote: I did not see the knight", "import");
    await settle();
    const everything = JSON.stringify(progress()) + sent.map((s) => s.body).join("\n");
    expect(everything).not.toContain("rnbqkbnr");
    expect(everything).not.toContain("erez281");
    expect(everything).not.toContain("knight");
    expect(events().map((e) => e.code)).toEqual(["unhandled-error", "unhandled-error"]);
    for (const s of sent) expect(() => clientFailureEventSchema.parse(JSON.parse(s.body))).not.toThrow();
  });

  it("says `unknown` for the build when the origin does not name one, rather than guessing", async () => {
    forgetBuildIdentity();
    stubIdentity("html");
    reportFailure("no-such-user", "front-door");
    await settle();
    expect(JSON.parse(sent[0].body).build).toBe("unknown");
  });

  it("stops after MAX_PER_LOAD sends, so a failure in a loop cannot become a flood", async () => {
    for (let i = 0; i < MAX_PER_LOAD + 10; i += 1) reportFailure("render-crash", "app");
    await settle();
    expect(sent).toHaveLength(MAX_PER_LOAD);
    /* The ledger, which is a bounded ring of its own, still took every row. */
    expect(events().length).toBeGreaterThan(MAX_PER_LOAD);
  });
});

describe("the two classifiers", () => {
  it("names an engine failure by the code it carries, and `engine-unclassified` otherwise", async () => {
    reportEngineFailure(new EngineFailureError("asset-mistyped", "text/plain"), "import");
    reportEngineFailure(new Error("something the engine said in English"), "board");
    await settle();
    expect(events().map((e) => e.code)).toEqual(["asset-mistyped", "engine-unclassified"]);
    expect(JSON.stringify(progress())).not.toContain("something the engine said");
  });

  it("folds a tRPC error onto api-<class>, and no data onto api-unreachable", async () => {
    reportApiFailure({ data: { code: "UNAUTHORIZED" } }, "app");
    reportApiFailure({ data: { code: "TOO_MANY_REQUESTS" } }, "app");
    reportApiFailure({ data: { code: "INTERNAL_SERVER_ERROR" } }, "app");
    reportApiFailure(new TypeError("Failed to fetch"), "app");
    await settle();
    expect(events().map((e) => e.code)).toEqual([
      "api-auth",
      "api-upstream-provider",
      "api-internal",
      "api-unreachable",
    ]);
  });

  it("reports what the window catches as a code and nothing of the error", async () => {
    attachWindowFailureListeners(window);
    window.dispatchEvent(new ErrorEvent("error", { message: `TypeError near ${FEN}` }));
    await settle();
    expect(events().map((e) => e.code)).toEqual(["unhandled-error"]);
    expect(JSON.stringify(progress())).not.toContain("rnbqkbnr");
  });

  it("has a class for every code, so the server can never be handed one it cannot count", () => {
    for (const code of CLIENT_FAILURE_CODES) {
      expect(() =>
        clientFailureEventSchema.parse({
          code,
          failureClass: "unknown",
          surface: "app",
          build: "unknown",
          at: "2026-09-02T12:00:00.000Z",
        }),
      ).not.toThrow();
    }
  });
});

describe("the front door's sentence for a sign-in that did not complete", () => {
  it("names the cause it recognises", () => {
    expect(authFailureSentence("?auth=failed&reason=oauth-portal-unreachable")).toContain("שרת ההתחברות");
    expect(authFailureSentence("?auth=failed&reason=oauth-not-configured")).toContain("חסרה הגדרה");
    expect(authFailureSentence("?auth=failed&reason=oauth-state-rejected")).toContain("פג תוקף");
  });

  it("never echoes a reason it does not recognise", () => {
    const sentence = authFailureSentence("?auth=failed&reason=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    expect(sentence).toBeTruthy();
    expect(sentence).not.toContain("<script>");
    expect(sentence).not.toContain("alert");
  });

  it("says nothing when no sign-in failed", () => {
    expect(authFailureSentence("")).toBeNull();
    expect(authFailureSentence("?angle=selection")).toBeNull();
  });
});
