/**
 * What the operator gets when a request fails, and what they must never get.
 *
 * BEFORE THIS, ONE LINE. `onError` returned early for every code but INTERNAL_SERVER_ERROR, so a
 * refused token, a rate-limited Lichess and a malformed request left nothing; the one line that was
 * written carried neither the request it belonged to nor the build that produced it, although
 * `x-vercel-id` sits on every response the platform sends. A user pasting a failure and an operator
 * reading a log had no shared word between them. The health route answered one boolean.
 *
 * WHAT IS HELD HERE. Every tRPC failure produces one structured line with a class; the line and the
 * error shape carry the same request id, taken from the platform header when there is one; the
 * health body names the function's build and the storage subsystem by role and still names no
 * variable, host, port or user; the client beacon accepts five enumerated fields and refuses
 * anything else, echoing nothing; and `redact` strips the shapes a value takes when it gets in
 * where a name belongs.
 */
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* `ENV` is a snapshot taken when `server/_core/env` is first imported, so the values must be in
 * place before any import below runs -- imports are hoisted above ordinary statements. */
vi.hoisted(() => {
  process.env.JWT_SECRET ||= "test-secret-for-operator-lines";
  process.env.OWNER_OPEN_ID ||= "operator-owner";
});
import { sdk } from "../../server/_core/sdk";
import { MemoryRecordStore, type RecordStore } from "../../server/record";
import {
  emit,
  redact,
  requestIdFrom,
  useSinkForTests,
  type OperatorLine,
} from "../../server/_core/telemetry";
import {
  CLIENT_FAILURE_CODES,
  FAILURE_CLASSES,
  failureClassOfClientCode,
  failureClassOfTrpcCode,
} from "../../shared/failure-class";

let lines: OperatorLine[];
let server: Server | undefined;
let origin = "";

async function serve(store: RecordStore = new MemoryRecordStore()) {
  const { createApp } = await import("../../server/app");
  server = createServer(createApp({ store }));
  await new Promise<void>((done) => server!.listen(0, "127.0.0.1", () => done()));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

beforeEach(() => {
  lines = [];
  useSinkForTests((_level, line) => lines.push(JSON.parse(line) as OperatorLine));
});

afterEach(async () => {
  useSinkForTests(null);
  if (server) await new Promise<void>((done) => server!.close(() => done()));
  server = undefined;
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  delete process.env.DATABASE_URL;
});

const trpcGet = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${origin}/api/trpc/${path}`, { headers });

describe("every failed request leaves one line, and the line names the request", () => {
  it("logs a refusal that is not a 500, with the platform's request id on both sides", async () => {
    await serve();
    const response = await trpcGet("lichess.account", { "x-vercel-id": "iad1::test-refused-1" });
    expect(response.status).toBe(401);
    /* superjson wraps the error envelope in `json`. */
    const body = (await response.json()) as { error: { json: { data: { requestId: string; code: string } } } };
    expect(body.error.json.data.code).toBe("UNAUTHORIZED");
    expect(body.error.json.data.requestId, "the wire does not carry the request id").toBe("iad1::test-refused-1");

    const line = lines.find((l) => l.code === "request-failed");
    expect(line, "a refused request left no operator line").toBeTruthy();
    expect(line).toMatchObject({
      kind: "operator",
      failureClass: "auth",
      path: "lichess.account",
      requestId: "iad1::test-refused-1",
      detail: "UNAUTHORIZED",
    });
    expect(typeof line!.build).toBe("string");
    expect(typeof line!.at).toBe("string");
  });

  it("logs a 500 with the parameterised statement and never the bound values", async () => {
    const store = new MemoryRecordStore();
    const SECRET = "לא הבנתי למה הצריח התקוע חשוב";
    store.countDecisions = () =>
      Promise.reject(
        Object.assign(new Error(`Failed query: select count(*) from decisions\nparams: ${SECRET}`), {
          query: "select count(*) from decisions where stated_unknown = ?",
          params: [SECRET],
        }),
      );
    await serve(store);
    const token = await sdk.createSessionToken(process.env.OWNER_OPEN_ID!, { name: "Owner" });
    const response = await trpcGet("record.count", {
      authorization: `Bearer ${token}`,
      "x-vercel-id": "iad1::test-500-1",
    });
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body, "the player's sentence came back on the wire").not.toContain(SECRET);
    expect(body).toContain("iad1::test-500-1");

    const line = lines.find((l) => l.code === "request-failed" && l.failureClass === "internal");
    expect(line).toBeTruthy();
    expect(line!.requestId).toBe("iad1::test-500-1");
    expect(line!.detail, "the operator line carried the value").not.toContain(SECRET);
    expect(line!.detail).toContain("select count(*)");
  });

  it("mints a local id when the platform sent none, so two failures are not one", () => {
    const a = requestIdFrom({});
    const b = requestIdFrom({});
    expect(a).toMatch(/^local-/);
    expect(a).not.toBe(b);
    expect(requestIdFrom({ "x-vercel-id": "fra1::abc" })).toBe("fra1::abc");
    /* An array header (proxies do this) takes the first; an absurdly long one is refused. */
    expect(requestIdFrom({ "x-vercel-id": ["one", "two"] })).toBe("one");
    expect(requestIdFrom({ "x-vercel-id": "x".repeat(500) })).toMatch(/^local-/);
    /* The header is sender-controlled on a direct request: a value that is not an id is not used. */
    expect(requestIdFrom({ "x-vercel-id": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR <script>" })).toMatch(/^local-/);
    expect(requestIdFrom({ "x-vercel-id": "iad1::iad1::ftv9g-1788385416839-787fa53fc372" })).toBe(
      "iad1::iad1::ftv9g-1788385416839-787fa53fc372",
    );
  });
});

describe("the health body says which build and which subsystem, and still nothing it must not", () => {
  const FORBIDDEN = [
    "DATABASE_URL",
    "JWT_SECRET",
    "OWNER_OPEN_ID",
    "OAUTH_SERVER_URL",
    "mysql",
    "127.0.0.1",
    "59999",
    "nobody",
  ];

  it("names the function's build from the platform variable, the same way the static file does", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    await serve();
    const response = await fetch(`${origin}/api/health`, { headers: { "x-vercel-id": "iad1::h1" } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      build: { gitSha: string; protocolVersion: string };
      checks: { storage: string };
      requestId: string;
    };
    expect(body.ok).toBe(true);
    expect(body.build.gitSha).toBe("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
    expect(body.build.protocolVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.checks.storage).toBe("not-configured");
    expect(body.requestId).toBe("iad1::h1");
  });

  it("says the storage is unreachable, by role, and logs why -- without a connection detail in either", async () => {
    process.env.DATABASE_URL = "mysql://nobody:nobody@127.0.0.1:59999/nothing";
    const { DrizzleRecordStore } = await import("../../server/record");
    await serve(new DrizzleRecordStore());
    const response = await fetch(`${origin}/api/health`);
    expect(response.status).toBe(503);
    const text = await response.text();
    const body = JSON.parse(text) as { ok: boolean; checks: { storage: string } };
    expect(body.ok).toBe(false);
    expect(body.checks.storage).toBe("unreachable");
    for (const name of FORBIDDEN) expect(text, `the health body names ${name}`).not.toContain(name);

    const line = lines.find((l) => l.code === "storage-unreachable" || l.code === "storage-timeout");
    expect(line, "the probe failed and no line said so").toBeTruthy();
    const logged = JSON.stringify(line);
    for (const name of ["nobody", "59999", "127.0.0.1", "mysql://"]) {
      expect(logged, `the operator line carries ${name}`).not.toContain(name);
    }
  });
});

describe("the client beacon takes five enumerated fields and nothing else", () => {
  const valid = {
    code: "worker-refused",
    failureClass: "engine",
    surface: "board",
    build: "c848f244d380e13a8622c590791b22a2bef7a39b",
    at: "2026-09-02T12:00:00.000Z",
  };
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${origin}/api/client-event`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("accepts a well-formed report with 204 and writes one line carrying the client's own code", async () => {
    await serve();
    const response = await post(valid, { "x-vercel-id": "iad1::beacon-1" });
    expect(response.status).toBe(204);
    const line = lines.find((l) => l.code === "client-failure");
    expect(line).toMatchObject({
      failureClass: "engine",
      clientCode: "worker-refused",
      surface: "board",
      clientBuild: valid.build,
      requestId: "iad1::beacon-1",
    });
  });

  it("refuses a report with a field it does not name, and echoes none of it", async () => {
    await serve();
    const SECRET = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const response = await post({ ...valid, message: SECRET });
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("");
    expect(lines.some((l) => JSON.stringify(l).includes(SECRET))).toBe(false);
    expect(lines.filter((l) => l.code === "client-failure")).toHaveLength(0);
  });

  it("refuses an own `__proto__` key, which zod's strict mode alone lets through", async () => {
    await serve();
    const response = await post(`{"code":"worker-refused","failureClass":"engine","surface":"board","build":"${valid.build}","at":"${valid.at}","__proto__":{"polluted":true}}`);
    expect(response.status).toBe(400);
    expect(lines.filter((l) => l.code === "client-failure")).toHaveLength(0);
  });

  it("refuses a code, a class, a surface or a build that is not on the list", async () => {
    await serve();
    for (const bad of [
      { ...valid, code: "the player wrote this" },
      { ...valid, failureClass: "catastrophic" },
      { ...valid, surface: "erez281" },
      { ...valid, build: "not a sha; a sentence" },
      { ...valid, at: "yesterday" },
    ]) {
      const response = await post(bad);
      expect(response.status, JSON.stringify(bad)).toBe(400);
    }
    expect(lines.filter((l) => l.code === "client-failure")).toHaveLength(0);
  });

  it("refuses a body over its own two-kilobyte ceiling before parsing it", async () => {
    await serve();
    const response = await post(JSON.stringify({ ...valid, padding: "x".repeat(4000) }));
    expect(response.status).toBe(413);
    expect(lines.filter((l) => l.code === "client-failure")).toHaveLength(0);
  });
});

describe("the vocabulary is total and the redaction is real", () => {
  it("folds every tRPC code onto a class, and an unknown code onto `unknown`", () => {
    const codes = [
      "PARSE_ERROR", "BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "TIMEOUT", "CONFLICT",
      "PRECONDITION_FAILED", "PAYLOAD_TOO_LARGE", "UNPROCESSABLE_CONTENT", "TOO_MANY_REQUESTS",
      "CLIENT_CLOSED_REQUEST", "INTERNAL_SERVER_ERROR", "BAD_GATEWAY", "SERVICE_UNAVAILABLE",
      "NOT_IMPLEMENTED", "METHOD_NOT_SUPPORTED", "UNSUPPORTED_MEDIA_TYPE",
    ];
    for (const code of codes) {
      const klass = failureClassOfTrpcCode(code);
      expect(FAILURE_CLASSES, `${code} -> ${klass}`).toContain(klass);
      expect(klass, `${code} was not classified`).not.toBe("unknown");
    }
    expect(failureClassOfTrpcCode("SOMETHING_NEW")).toBe("unknown");
    expect(failureClassOfTrpcCode("TOO_MANY_REQUESTS")).toBe("upstream-provider");
    expect(failureClassOfTrpcCode("PRECONDITION_FAILED")).toBe("precondition");
  });

  it("classifies every client code somewhere other than `unknown`, save the one that says so", () => {
    for (const code of CLIENT_FAILURE_CODES) {
      if (code === "api-unknown") continue; /* the server answered a code the client's map has no row for */
      expect(failureClassOfClientCode(code), code).not.toBe("unknown");
    }
    expect(failureClassOfClientCode("unhandled-error")).toBe("internal");
    expect(failureClassOfClientCode("unhandled-rejection")).toBe("internal");
    expect(failureClassOfClientCode("worker-refused")).toBe("engine");
    expect(failureClassOfClientCode("no-such-user")).toBe("user-input");
    expect(failureClassOfClientCode("stale-build-reload")).toBe("stale-build");
    expect(failureClassOfClientCode("api-upstream-provider")).toBe("upstream-provider");
  });

  it("strips a connection string, a JWT, a Lichess token and a board position from a detail", () => {
    const line = emit({
      code: "storage-init-failed",
      detail:
        "mysql://user:SECRETPW@db.example:3306/x eyJhbGciOiJIUzI1NiJ9.eyJvcGVuSWQiOiJ4In0.abcdefghijklmnop " +
        "lip_ABCDEFGHIJKLMN rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR",
    });
    const logged = JSON.stringify(line);
    for (const value of ["SECRETPW", "eyJhbGciOiJIUzI1NiJ9", "lip_ABCDEFGHIJKLMN", "rnbqkbnr/pppppppp"]) {
      expect(logged, `redact let ${value} through`).not.toContain(value);
    }
    expect(logged).toContain("[redacted]");
    expect(redact("x".repeat(500)).length).toBeLessThan(220);
    /* Redaction runs before truncation, so a token straddling the cut is not half-kept. */
    const straddling = `${"x".repeat(190)} eyJhbGciOiJIUzI1NiJ9.eyJvcGVuSWQiOiJ4In0.abcdefghijklmnop`;
    expect(redact(straddling)).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  it("never throws when the sink does", () => {
    useSinkForTests(() => {
      throw new Error("sink exploded");
    });
    expect(() => emit({ code: "config-fault" })).not.toThrow();
  });
});
