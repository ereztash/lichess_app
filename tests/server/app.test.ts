/**
 * The unified Express app, exercised over real HTTP.
 *
 * Before unification there was no way to run the API outside Vercel at all -- `npm run dev` is
 * `vite` only, so every tRPC call 404s locally and the runtime was untested by construction.
 */
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/app";

let server: Server;
let origin: string;

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((done) => {
    server = app.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port assigned");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((done, fail) =>
    server.close((error) => (error ? fail(error) : done())),
  );
});

describe("unified app over HTTP", () => {
  it("serves the health route, and the body says which build and which subsystem", async () => {
    const response = await fetch(`${origin}/api/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      build: { gitSha: string; target: string; protocolVersion: string };
      checks: { storage: string };
      requestId: string;
    };
    expect(body.ok).toBe(true);
    /*
     * BY ROLE, AND BY WHAT THIS RUN HAS. Locally there is no DATABASE_URL and the body says so;
     * in CI the workflow sets one and the service is up, so the same body says `reachable`. The
     * first version asserted `not-configured` unconditionally and went red only on the runner.
     */
    expect(body.checks).toEqual({ storage: process.env.DATABASE_URL ? "reachable" : "not-configured" });
    expect(typeof body.build.gitSha).toBe("string");
    expect(body.build.protocolVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.requestId.length).toBeGreaterThan(0);
  });

  it("mounts the tRPC router", async () => {
    /*
     * `auth.me` rather than `system.health`, which is gone: it answered `{ok:true}` unconditionally,
     * the exact defect `/api/health` was rewritten to remove, one route over. A public query that
     * answers `null` for nobody-signed-in proves the router is mounted and claims nothing else.
     */
    const response = await fetch(`${origin}/api/trpc/auth.me`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: { data: { json: unknown } } };
    expect(body.result.data.json).toBeNull();
  });

  it("registers the OAuth callback route and sends a malformed callback home with a reason", async () => {
    /*
     * This was a 400 with English JSON, on a page with no control. A visitor whose portal sent them
     * back without a state is now sent to the front door, which renders the reason in Hebrew.
     */
    const response = await fetch(`${origin}/api/oauth/callback?code=abc`, { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/?auth=failed&reason=oauth-malformed");
  });

  it("gates Lichess procedures behind auth", async () => {
    const input = encodeURIComponent(JSON.stringify({ json: { max: 5 } }));
    const response = await fetch(`${origin}/api/trpc/lichess.recentGames?input=${input}`);
    expect(response.status).toBe(401);
  });
});
