// @vitest-environment jsdom
/**
 * The diagnostic has to be trustworthy before it is useful.
 *
 * Its whole purpose is to end a guessing loop, so the two ways it could fail are both fatal:
 * reporting a pass for something it never ran, and reporting a failure it cannot substantiate.
 *
 * R2 here is the load-bearing one -- a check that could not run must not render like a check
 * that passed. When the engine never greets, the ready and bestmove checks did not happen, and
 * "skip" with a reason is the only honest thing to say about them.
 */
import { describe, expect, it, vi } from "vitest";
import { formatReport, runSelfCheck, type CheckEnv } from "../../client/src/lib/self-check";

const VALID_WASM = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);

function response(body: BodyInit, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init });
}

/** A browser where everything works, so a test only has to describe what it breaks. */
function healthyEnv(overrides: Partial<CheckEnv> = {}): CheckEnv {
  return {
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(".wasm")) {
        return response(VALID_WASM, { headers: { "content-type": "application/wasm" } });
      }
      /*
       * THE TYPE IS PART OF HEALTHY, and it was missing: `Response` defaults to `text/plain`, so
       * this fixture described a deployment whose engine script a browser would refuse to execute.
       * It passed only because nothing checked the type.
       */
      if (url.endsWith(".js")) {
        return response("// engine", { headers: { "content-type": "application/javascript" } });
      }
      /* A healthy origin names its build, the way a deployed one does at /build-identity.json. */
      if (url.endsWith("/build-identity.json")) {
        return response(
          JSON.stringify({
            gitSha: "c848f244d380e13a8622c590791b22a2bef7a39b",
            builtAt: "2026-09-02T12:43:22.048Z",
            target: "production",
            protocolVersion: "1.0.0",
          }),
          { headers: { "content-type": "application/json; charset=utf-8" } },
        );
      }
      return response("{}", { status: 401 });
    }) as unknown as typeof fetch,
    engineUrls: async () => ({ js: "/assets/engine.js", wasm: "/assets/engine.wasm" }),
    hasWorker: () => true,
    createWorker: () => fakeWorker("healthy"),
    /* A browser that starts workers from both sources. Cases below narrow it. */
    probeWorker: async () => ({ spoke: true, observed: "ענה" }),
    storage: () => ({ available: true, durability: "persistent" }),
    now: () => 0,
    ...overrides,
  };
}

/**
 * A worker that speaks UCI, or refuses to at a chosen step.
 *
 * `silent` is the historical failure this application actually had: the worker is created, the
 * script loads, and then nothing happens at all -- no message, no error. A diagnostic that
 * cannot tell that apart from a slow engine is worth nothing.
 */
type WorkerMode = "healthy" | "silent" | "no-ready" | "no-move" | "no-eval" | "garbled-eval";

/** A real depth-8 `info` line, in the shape Stockfish emits it. */
const INFO = "info depth 8 seldepth 11 multipv 1 score cp 24 nodes 9321 nps 466050 pv e2e4 e7e5 g1f3";

function fakeWorker(mode: WorkerMode): Worker {
  const listeners = new Set<(e: MessageEvent) => void>();
  const say = (text: string) => {
    for (const fn of listeners) fn({ data: text } as MessageEvent);
  };
  return {
    addEventListener: (_: string, fn: (e: MessageEvent) => void) => void listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MessageEvent) => void) => void listeners.delete(fn),
    terminate: () => listeners.clear(),
    postMessage: (message: string) => {
      if (mode === "silent") return;
      queueMicrotask(() => {
        if (message === "uci") say("uciok");
        if (message === "isready" && mode !== "no-ready") say("readyok");
        if (message.startsWith("go")) {
          // The evaluation arrives on `info` lines DURING the search, before bestmove ends it.
          if (mode === "healthy") say(INFO);
          // A move with no evaluation behind it: the failure `bestmove`-only could not see.
          if (mode === "garbled-eval") say("info depth 8 nodes 9321 nps 466050");
          if (mode !== "no-move") say("bestmove e2e4 ponder e7e5");
        }
      });
    },
  } as unknown as Worker;
}

const byId = (results: Awaited<ReturnType<typeof runSelfCheck>>, id: string) => {
  const found = results.find((r) => r.id === id);
  if (!found) throw new Error(`no check with id ${id}`);
  return found;
};

describe("a browser where everything works", () => {
  it("passes every step it can run", async () => {
    const results = await runSelfCheck(healthyEnv(), { engineTimeoutMs: 500 });
    expect(byId(results, "engine-greet").status).toBe("pass");
    expect(byId(results, "engine-ready").status).toBe("pass");
    expect(byId(results, "engine-move").status).toBe("pass");
    expect(byId(results, "engine-eval").status).toBe("pass");
    expect(byId(results, "storage").status).toBe("pass");
    expect(results.some((r) => r.status === "fail")).toBe(false);
  });

  it("says what the engine actually returned, not that it is good", async () => {
    const results = await runSelfCheck(healthyEnv(), { engineTimeoutMs: 500 });
    // R1: one search at depth 8 licenses "it answered" and nothing about playing strength.
    expect(byId(results, "engine-move").detail).toContain("e2e4");
    expect(byId(results, "engine-move").detail).toMatch(/תקינות/);
  });
});

describe("an engine that loads but never speaks", () => {
  it("names the step that failed and refuses to guess about the rest (R2)", async () => {
    const env = healthyEnv({ createWorker: () => fakeWorker("silent") });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    expect(byId(results, "engine-greet").status).toBe("fail");
    // The two checks downstream did NOT happen. Reporting them as passing would send the next
    // person looking anywhere but at the engine; reporting them as failing would invent
    // evidence. Skipped, with the reason.
    expect(byId(results, "engine-ready").status).toBe("skip");
    expect(byId(results, "engine-move").status).toBe("skip");
    expect(byId(results, "engine-eval").status).toBe("skip");
    expect(byId(results, "engine-ready").detail).toMatch(/לא נבדק/);
  });

  it("still reports the checks that did run", async () => {
    const env = healthyEnv({ createWorker: () => fakeWorker("silent") });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    // A failing engine must not take the storage and asset findings down with it.
    expect(byId(results, "engine-wasm").status).toBe("pass");
    expect(byId(results, "storage").status).toBe("pass");
  });
});

describe("an engine that stalls midway", () => {
  it("distinguishes a greeting from a search", async () => {
    const env = healthyEnv({ createWorker: () => fakeWorker("no-move") });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    expect(byId(results, "engine-greet").status).toBe("pass");
    expect(byId(results, "engine-ready").status).toBe("pass");
    expect(byId(results, "engine-move").status).toBe("fail");
  });
});

describe("a move is not an evaluation", () => {
  /*
   * This check exists because a code review pointed out that the previous version passed on
   * `bestmove` alone while the document used it to claim the engine "produces an evaluation".
   * It does not: an engine can return a move while the `info ... score ... pv ...` line that
   * carries the evaluation never arrives or never parses -- and the evaluation is what the
   * reveal renders. The claim was wider than the measurement (R1), so the measurement grew.
   */
  it("fails when the search returns a move but no evaluation", async () => {
    const env = healthyEnv({ createWorker: () => fakeWorker("no-eval") });
    const results = await runSelfCheck(env, { engineTimeoutMs: 500 });
    // The move arrived, so that check passes...
    expect(byId(results, "engine-move").status).toBe("pass");
    // ...and the thing the application actually renders did not.
    expect(byId(results, "engine-eval").status).toBe("fail");
    expect(byId(results, "engine-eval").detail).toMatch(/אף שורת info/);
  });

  it("fails when info lines arrive but carry no readable score", async () => {
    const env = healthyEnv({ createWorker: () => fakeWorker("garbled-eval") });
    const results = await runSelfCheck(env, { engineTimeoutMs: 500 });
    expect(byId(results, "engine-move").status).toBe("pass");
    expect(byId(results, "engine-eval").status).toBe("fail");
    // Says how many arrived, so "none sent" and "none usable" are distinguishable (R2).
    expect(byId(results, "engine-eval").detail).toMatch(/1 שורות info/);
  });

  it("reports the parsed numbers, and claims nothing about them", async () => {
    const results = await runSelfCheck(healthyEnv(), { engineTimeoutMs: 500 });
    const evaluation = byId(results, "engine-eval");
    expect(evaluation.detail).toContain("24");
    expect(evaluation.detail).toContain("8");
    // R1: the number exists. Whether it is a good number is not something this can say.
    expect(evaluation.detail).toMatch(/קיום בלבד/);
  });

  it("does not run the evaluation check when the search never finished", async () => {
    const env = healthyEnv({ createWorker: () => fakeWorker("no-move") });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    expect(byId(results, "engine-move").status).toBe("fail");
    // Info lines may well have arrived; without a terminated search they are not a result.
    expect(byId(results, "engine-eval").status).toBe("skip");
  });
});

describe("a network that answers with something other than the engine", () => {
  it("catches a wasm that is really an error page", async () => {
    const env = healthyEnv({
      fetch: (async (input: RequestInfo | URL) => {
        const url = String(input);
        // 200, plausible length, and HTML. A captive portal or filtering proxy does exactly
        // this, and the engine then fails with a message about the module, not the network.
        if (url.endsWith(".wasm")) {
          return response("<!doctype html><title>Blocked</title>", {
            headers: { "content-type": "text/html" },
          });
        }
        if (url.endsWith(".js")) {
          return response("// engine", { headers: { "content-type": "application/javascript" } });
        }
        return response("{}", { status: 401 });
      }) as unknown as typeof fetch,
    });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    const wasm = byId(results, "engine-wasm");
    expect(wasm.status).toBe("fail");
    expect(wasm.detail).toContain("0061736d");
    expect(wasm.detail).toMatch(/פרוקסי|רשת/);
  });

  it("reads a 500 from the API as the server falling over", async () => {
    const env = healthyEnv({
      fetch: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/")) return response("FUNCTION_INVOCATION_FAILED", { status: 500 });
        if (url.endsWith(".wasm")) {
          return response(VALID_WASM, { headers: { "content-type": "application/wasm" } });
        }
        return response("// engine");
      }) as unknown as typeof fetch,
    });
    const results = await runSelfCheck(env, { engineTimeoutMs: 500 });
    expect(byId(results, "api").status).toBe("fail");
    expect(byId(results, "api").detail).toContain("500");
  });

  it("reads a 401 as the route being alive, because it is", async () => {
    const results = await runSelfCheck(healthyEnv(), { engineTimeoutMs: 500 });
    // record.storageAvailable is a protected procedure. Unauthenticated 401 is the correct
    // answer and proves the function loaded -- calling it a failure would report the healthy
    // deployment as broken.
    expect(byId(results, "api").status).toBe("pass");
    expect(byId(results, "api").detail).toContain("401");
  });
});

describe("a browser that will not run Workers", () => {
  it("says so, and does not blame the engine for it", async () => {
    const env = healthyEnv({ hasWorker: () => false, createWorker: () => fakeWorker("silent") });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    expect(byId(results, "worker").status).toBe("fail");
    expect(byId(results, "worker").detail).toContain("worker-unsupported");
    // The engine's files are fine here. Reporting them as broken would send the fix to the
    // wrong place -- policy, not the deployment.
    expect(byId(results, "engine-js").status).toBe("pass");
    expect(byId(results, "engine-wasm").status).toBe("pass");
  });

  it("reports a construction that is refused rather than missing", async () => {
    const env = healthyEnv({
      probeWorker: async () => ({ spoke: false, observed: "שגיאה: SecurityError" }),
    });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    // The constructor exists and the worker never spoke: a CSP worker-src, not an old browser.
    expect(byId(results, "worker").status).toBe("fail");
    expect(byId(results, "worker").detail).toContain("worker-refused");
    expect(byId(results, "worker").detail).toContain("SecurityError");
  });

  it("FAILS on a worker that was constructed and refused, which is how the refusal really arrives", async () => {
    /*
     * THE DEFECT THIS FILE MISSED, AND THE DEPLOYED ORIGIN FOUND. The old check was
     * `createWorker(url).terminate()` inside a `try`, and the case above -- a constructor that
     * THROWS -- is the only shape it could see. Measured on the deployment: under a `worker-src`
     * that excludes the URL's scheme Chromium does not throw. The constructor returns a Worker, an
     * `error` event with an EMPTY message arrives afterwards, and the old check reported PASS while
     * the console said *"Refused to create a worker from 'blob:…'"*.
     *
     * So the empty message is the fixture. A check that only knows how to fail loudly is a check
     * that passes quietly.
     */
    const env = healthyEnv({
      probeWorker: async (from) =>
        from === "same-origin"
          ? { spoke: false, observed: "נדחה בלי הודעה (חתימה של מדיניות אבטחה)" }
          : { spoke: false, observed: "נדחה בלי הודעה (חתימה של מדיניות אבטחה)" },
    });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    expect(byId(results, "worker").status, "a refused worker reported as a pass").toBe("fail");
    expect(byId(results, "worker").detail).toContain("worker-refused");
  });

  it("passes on a policy that forbids blob: and allows the source the engine uses", async () => {
    /*
     * THE DEPLOYMENT'S ACTUAL POLICY. `worker-src 'self'` forbids `blob:` and allows the engine's
     * own same-origin script, so the honest answer is a PASS with the blob fact recorded beside
     * it. The old probe asked only about `blob:` -- a scheme nothing in this product uses -- and
     * would now have to fail, which would send a reader after a header that is not the problem.
     */
    const env = healthyEnv({
      probeWorker: async (from) =>
        from === "same-origin"
          ? { spoke: true, observed: "ענה" }
          : { spoke: false, observed: "נדחה בלי הודעה (חתימה של מדיניות אבטחה)" },
    });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    expect(byId(results, "worker").status).toBe("pass");
    expect(byId(results, "worker").detail).toContain("blob");
  });
});

describe("an asset that arrives and cannot be executed", () => {
  it("names the content type rather than reporting a missing file", async () => {
    /*
     * `x-content-type-options: nosniff` is set on this deployment, so a script served as
     * `text/plain` is refused rather than sniffed -- and the refusal reaches the app as an engine
     * that never started, which is indistinguishable from a 404 without the type in the report.
     */
    const env = healthyEnv({
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith(".wasm")) {
          return response(VALID_WASM, { headers: { "content-type": "application/wasm" } });
        }
        if (url.endsWith(".js")) {
          return response("// engine", { headers: { "content-type": "text/plain" } });
        }
        return response("{}", { status: 401 });
      }) as unknown as typeof fetch,
    });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    expect(byId(results, "engine-js").status).toBe("fail");
    expect(byId(results, "engine-js").detail).toContain("asset-mistyped");
    expect(byId(results, "engine-js").detail).toContain("text/plain");
  });

  it("names the type on a wasm that is real and mislabelled", async () => {
    const env = healthyEnv({
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith(".wasm")) {
          return response(VALID_WASM, { headers: { "content-type": "application/octet-stream" } });
        }
        if (url.endsWith(".js")) {
          return response("// engine", { headers: { "content-type": "application/javascript" } });
        }
        return response("{}", { status: 401 });
      }) as unknown as typeof fetch,
    });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    expect(byId(results, "engine-wasm").status).toBe("fail");
    expect(byId(results, "engine-wasm").detail).toContain("asset-mistyped");
  });

  it("still reports a swapped body as a swapped body, not as a header", async () => {
    /* The order matters: magic bytes first, so a proxy that replaced the file is not misfiled. */
    const env = healthyEnv({
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith(".wasm")) {
          return response("<html>blocked</html>", { headers: { "content-type": "text/html" } });
        }
        if (url.endsWith(".js")) {
          return response("// engine", { headers: { "content-type": "application/javascript" } });
        }
        return response("{}", { status: 401 });
      }) as unknown as typeof fetch,
    });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    expect(byId(results, "engine-wasm").status).toBe("fail");
    expect(byId(results, "engine-wasm").detail).not.toContain("asset-mistyped");
    expect(byId(results, "engine-wasm").detail).toContain("0061736d");
  });
});

describe("storage that will not survive the tab", () => {
  it("is neither a pass nor a failure", async () => {
    const env = healthyEnv({
      storage: () => ({ available: true, durability: "session-only" }),
    });
    const results = await runSelfCheck(env, { engineTimeoutMs: 500 });
    // The loop works, so it is not broken; the record dies with the tab, so it is not fine.
    expect(byId(results, "storage").status).toBe("skip");
    expect(byId(results, "storage").detail).toMatch(/נמחקת/);
  });
});

describe("the report that gets pasted into a message", () => {
  it("counts what failed and what never ran, separately", async () => {
    const env = healthyEnv({ createWorker: () => fakeWorker("silent") });
    const results = await runSelfCheck(env, { engineTimeoutMs: 60 });
    const report = formatReport(results, "2026-08-22T00:00:00.000Z");
    expect(report).toContain("1 נכשלו");
    expect(report).toContain("3 לא רצו");
    expect(report).toContain("FAIL");
    expect(report).toContain("SKIP");
  });

  it("carries no part of what the player wrote", async () => {
    localStorage.setItem(
      "decision-lab.record.v1",
      JSON.stringify({ decisions: [{ statedRead: "סוד מסחרי מובהק" }] }),
    );
    const results = await runSelfCheck(healthyEnv(), { engineTimeoutMs: 500 });
    // The record holds a player's reasoning in their own words. A diagnostic they are asked to
    // paste somewhere must not carry any of it.
    expect(formatReport(results, "now")).not.toContain("סוד מסחרי");
  });
});
