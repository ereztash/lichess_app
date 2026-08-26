/**
 * "Available" was never measured, and two things believed it.
 *
 * WHAT WAS REPRODUCED, before any of this was written. Point DATABASE_URL at a closed port and
 * `DrizzleRecordStore.isAvailable()` returns **true in 4ms**; the first real query then throws
 * `Failed query: select ...`. `drizzle(url)` builds a mysql2 pool and a pool does not connect --
 * connection happens on first use -- so `Boolean(await getDb())` is a test of whether a string
 * was set in the environment, wearing the name of a test of whether the database is up.
 *
 * WHO BELIEVED IT, AND WHAT IT COST:
 *
 * 1. `record.storageAvailable`. `useRecordMode` exists for exactly one reason, written in its own
 *    comment: "The server is used only when it says it can store." Against an unreachable
 *    database the server said it could, so the client abandoned a working browser-local record,
 *    routed the loop to the server, and every commit failed -- the precise failure the local path
 *    was built to prevent, delivered by the check meant to prevent it.
 *
 * 2. `/api/health`, which answered `{ok: true}` unconditionally. It is the diagnostic this
 *    project actually used during the FUNCTION_INVOCATION_FAILED outage and the evidence cited in
 *    docs/FINDINGS.md that a deployment is alive. What it measured was that a line of code ran.
 *    A deployment whose database is down is "ok" to every monitor watching it.
 *
 * This is the product's own thesis turned on its own infrastructure: a claim must be scoped to
 * what was measured, and "ok" is a much larger word than "this handler executed".
 *
 * WHAT COUNTS AS DOWN. Not "no DATABASE_URL" -- the record runs in the browser by design, and a
 * deployment may be configured that way on purpose. Down is a database that was CONFIGURED and
 * cannot be reached. Absent and broken are different facts about a deployment, and merging them
 * would be the same defect one level up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A port nothing listens on. ECONNREFUSED is immediate, so this does not slow the suite. */
const DEAD = "mysql://nobody:nobody@127.0.0.1:59999/nothing";
const LIVE = process.env.DATABASE_URL;

/** `getDb` memoises its pool at module scope, so each case needs a fresh module graph. */
async function freshStore(url: string | undefined) {
  vi.resetModules();
  if (url === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = url;
  const { DrizzleRecordStore } = await import("../../server/record");
  return new DrizzleRecordStore();
}

afterEach(() => {
  if (LIVE === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = LIVE;
});

describe("the store reports whether it can be reached, not whether it was configured", () => {
  it("says no to a database that is configured and unreachable", async () => {
    const store = await freshStore(DEAD);
    expect(
      await store.isAvailable(),
      "a closed port reported as an available record store",
    ).toBe(false);
  });

  it("says no when nothing is configured", async () => {
    expect(await (await freshStore(undefined)).isAvailable()).toBe(false);
  });

  it("answers within a bound rather than waiting out a TCP timeout", async () => {
    /*
     * MEASURED ON THE DEADLINE ITSELF, not on a dead address. The first version of this timed
     * `isAvailable()` against a closed port and a control that stretched the deadline to ten
     * minutes SURVIVED: every unreachable address available here -- closed port, RFC 5737
     * TEST-NET -- is refused in under 25ms, so the race never needed the timer. The bound existed
     * and nothing tested it. This drives a promise that never settles, which is the case the
     * bound is for: a firewalled host that accepts the packet and says nothing.
     */
    vi.resetModules();
    const { withDeadline, AVAILABILITY_PROBE_MS } = await import("../../server/record");
    expect(AVAILABILITY_PROBE_MS, "the probe may not outlive the function it runs in").toBeLessThan(
      10_000,
    );
    const started = Date.now();
    await expect(withDeadline(new Promise(() => {}), 40)).rejects.toThrow();
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(35);
    expect(elapsed, "a probe that never returns is a probe a monitor cannot use").toBeLessThan(
      2_000,
    );
  });

  it("does not hold a timer open after the work it was racing finished", async () => {
    /*
     * A deadline that leaves its timer pending keeps a serverless function alive for the length of
     * the deadline after it already has its answer -- on every health poll.
     *
     * COUNTED, not inferred. The first version of this asserted only that the call resolved, and
     * a control that deleted the `clearTimeout` SURVIVED: nothing about a resolved promise
     * reveals an orphaned timer. `getTimerCount` is the observable.
     */
    vi.resetModules();
    const { withDeadline } = await import("../../server/record");
    vi.useFakeTimers();
    try {
      await expect(withDeadline(Promise.resolve("done"), 30_000)).resolves.toBe("done");
      expect(vi.getTimerCount(), "the deadline timer outlived the answer").toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.runIf(LIVE)("says yes to a database that is actually there", async () => {
    // The other direction, and the one that makes the assertions above more than "return false".
    expect(await (await freshStore(LIVE)).isAvailable()).toBe(true);
  });

  it.runIf(LIVE)("asks the database rather than reading the environment", async () => {
    /*
     * THE ASSERTION THAT CATCHES THE ORIGINAL. `Boolean(await getDb())` passes every test above
     * that uses a dead port only if the port is dead in a way it happens to notice. This drives a
     * real statement through and requires it to have reached the server.
     */
    const store = await freshStore(LIVE);
    expect(await store.isAvailable()).toBe(true);
    process.env.DATABASE_URL = DEAD; // The pool is already built; the environment is now a lie.
    expect(
      await store.isAvailable(),
      "availability tracked the environment variable instead of the connection",
    ).toBe(true);
  });
});

describe("the health route reports the health it measured", () => {
  let close: () => Promise<void>;
  let origin: string;

  const serve = async (url: string | undefined) => {
    vi.resetModules();
    if (url === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = url;
    const { createApp } = await import("../../server/app");
    const server = (await import("node:http")).createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as { port: number };
    origin = `http://127.0.0.1:${port}`;
    close = () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
  };

  afterEach(async () => close?.());

  it("refuses to call a deployment healthy while its database is unreachable", async () => {
    await serve(DEAD);
    const response = await fetch(`${origin}/api/health`);
    expect(response.status, "a monitor watching this saw a healthy deployment").toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("is healthy with no database configured, because the record runs in the browser", async () => {
    // Absent is not down. A deployment with no database is a supported deployment.
    await serve(undefined);
    const response = await fetch(`${origin}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it("says nothing about the deployment beyond whether it is serving", async () => {
    /*
     * PUBLIC ROUTE, NO AUTH. `system.lichessConfig` is protected precisely because the names of
     * the missing pieces describe the deployment. A health check that lists them has moved that
     * report to an unauthenticated URL.
     */
    await serve(DEAD);
    const body = await (await fetch(`${origin}/api/health`)).text();
    for (const name of [
      "DATABASE_URL",
      "JWT_SECRET",
      "OWNER_OPEN_ID",
      "OAUTH_SERVER_URL",
      "mysql",
      "127.0.0.1",
      "59999",
      "nobody",
    ]) {
      expect(body, `the health route names ${name}`).not.toContain(name);
    }
  });

  it.runIf(LIVE)("is healthy when the database it was given is up", async () => {
    await serve(LIVE);
    const response = await fetch(`${origin}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});
