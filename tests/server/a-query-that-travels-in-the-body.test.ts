/**
 * A tRPC query sent the way the real client sends it, as a POST with the input in the body, is
 * answered.
 *
 * THE FAILURE THIS HOLDS. The privacy commit set `methodOverride: "POST"` on the client link so no
 * input reaches a URL the platform logs. The server was never told to accept that, and tRPC
 * answers 405 to a POSTed query unless `allowMethodOverride` is set. Every server test here used
 * GET, the layout suite answers `/api/*` with 503, so nothing ran the real link against the real
 * app -- and the adversarial review found it a deploy away from taking the whole read path down.
 * This test IS the real link against the real app.
 */
import { createServer, type Server } from "node:http";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppRouter } from "../../server/routers";

vi.hoisted(() => {
  process.env.JWT_SECRET ||= "test-secret-for-posted-queries";
});

let server: Server | undefined;
afterEach(async () => {
  if (server) await new Promise<void>((done) => server!.close(() => done()));
  server = undefined;
});

async function serve(): Promise<string> {
  const { createApp } = await import("../../server/app");
  server = createServer(createApp());
  await new Promise<void>((done) => server!.listen(0, "127.0.0.1", () => done()));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

describe("a query that travels in the body", () => {
  it("is answered when sent by the real client link with methodOverride POST", async () => {
    const origin = await serve();
    const seen: string[] = [];
    const client = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${origin}/api/trpc`,
          transformer: superjson,
          methodOverride: "POST",
          fetch(input, init) {
            seen.push(`${init?.method ?? "GET"} ${String(input)}`);
            return globalThis.fetch(input, init);
          },
        }),
      ],
    });
    const me = await client.auth.me.query();
    expect(me).toBeNull();
    expect(seen).toHaveLength(1);
    expect(seen[0].startsWith("POST "), seen[0]).toBe(true);
    expect(seen[0], "the input rode in the URL after all").not.toContain("input=");
  });

  it("still answers the same query as a GET, so a hand-typed URL keeps working", async () => {
    const origin = await serve();
    const response = await fetch(`${origin}/api/trpc/auth.me`);
    expect(response.status).toBe(200);
  });
});
