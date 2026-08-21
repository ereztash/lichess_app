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
  it("serves the health route", async () => {
    const response = await fetch(`${origin}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("mounts the tRPC router", async () => {
    const input = encodeURIComponent(JSON.stringify({ json: { timestamp: 1 } }));
    const response = await fetch(`${origin}/api/trpc/system.health?input=${input}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: { data: { json: { ok: boolean } } } };
    expect(body.result.data.json).toEqual({ ok: true });
  });

  it("registers the OAuth callback route and rejects a missing state", async () => {
    const response = await fetch(`${origin}/api/oauth/callback?code=abc`, { redirect: "manual" });
    expect(response.status).toBe(400);
  });

  it("gates Lichess procedures behind auth", async () => {
    const input = encodeURIComponent(JSON.stringify({ json: { max: 5 } }));
    const response = await fetch(`${origin}/api/trpc/lichess.recentGames?input=${input}`);
    expect(response.status).toBe(401);
  });
});
