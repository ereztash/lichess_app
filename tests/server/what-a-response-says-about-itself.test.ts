/**
 * The headers this deployment did not send, and the one it should not have.
 *
 * Every assertion here is a default a browser or a proxy was otherwise free to pick. None of them
 * needed a decision from anyone -- the deployment simply never said anything, so the defaults
 * applied to responses carrying one person's record and their own prose.
 *
 * THE COOKIE ONE IS NOT A DEFAULT, IT IS A CHOICE THAT WAS MADE. `SameSite=None` was written
 * deliberately, and it switches off the only CSRF defence in this codebase: there is no CSRF token
 * anywhere. Every mutation is owner-gated, and the gate checks WHO -- a cross-site request carries
 * the owner's own cookie, so the gate passes it. Nothing needed `None`: the single cross-site entry
 * is the OAuth provider's redirect to `/api/oauth/callback`, a top-level GET, which `Lax` allows.
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "../../server/_core/cookies";
import { createApp } from "../../server/app";
import { isStorableDiagnostic } from "../../server/recordRouter";

const root = resolve(__dirname, "../..");

let server: Server;
let origin: string;

beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>((done) => server.listen(0, done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((done, fail) => server.close((e) => (e ? fail(e) : done()))));

describe("what every API response says about how it may be treated", () => {
  it("sends the six headers, on a route that needs no session to reach", async () => {
    const { headers } = await fetch(`${origin}/api/health`);
    expect(Object.fromEntries(
      [
        "x-content-type-options",
        "x-frame-options",
        "content-security-policy",
        "referrer-policy",
        "cross-origin-resource-policy",
        "cache-control",
      ].map((name) => [name, headers.get(name)]),
    )).toEqual({
      // A browser that re-guesses the type of a JSON body may execute it, and the bytes it would
      // be guessing about are the player's own words.
      "x-content-type-options": "nosniff",
      // Two headers for one claim, because they are honoured by different browsers.
      "x-frame-options": "DENY",
      "content-security-policy": "frame-ancestors 'none'",
      // These paths carry record ids. Nowhere else needs to know which page asked.
      "referrer-policy": "no-referrer",
      // Embedded-but-unreadable has repeatedly become readable through a side channel.
      "cross-origin-resource-policy": "same-origin",
      // The product's central claim is that this record does not leave the deployment. A shared
      // cache holding a copy would make that false with nothing in the code having changed.
      "cache-control": "no-store",
    });
  });

  it("stops naming the framework and its version to anyone who asks", async () => {
    const response = await fetch(`${origin}/api/health`);
    expect(response.headers.get("x-powered-by")).toBeNull();
  });

  it("still answers -- the headers are added to a working response, not instead of one", async () => {
    // A middleware that returns early would pass every assertion above and serve nothing.
    const response = await fetch(`${origin}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toHaveProperty("ok");
  });
});

describe("the session cookie is the whole of the CSRF defence", () => {
  const req = (headers: Record<string, string>, protocol = "http") =>
    ({ protocol, headers }) as unknown as Parameters<typeof getSessionCookieOptions>[0];

  it("is Lax, so another site's request does not arrive carrying it", () => {
    expect(getSessionCookieOptions(req({}))).toMatchObject({
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
  });

  it("is Secure behind the proxy that terminates TLS, and honest about it when there is none", () => {
    // `None` additionally required `Secure`, which is false over plain http -- so on a local http
    // deployment the browser was rejecting the session cookie rather than storing it.
    expect(getSessionCookieOptions(req({ "x-forwarded-proto": "https" })).secure).toBe(true);
    expect(getSessionCookieOptions(req({})).secure).toBe(false);
  });

  it("matches on the OAuth state nonce, which is the check the callback actually performs", () => {
    /*
     * Set from the browser, not from this server, so it is asserted at its source. It IS the
     * OAuth CSRF check -- `/api/oauth/callback` compares it to the state parameter and returns
     * 403 on a mismatch -- and `None` sent it on any cross-site request that could reach here.
     */
    const source = readFileSync(resolve(root, "client/src/const.ts"), "utf8");
    expect(source).toMatch(/SameSite=Lax/);
    expect(source, "the state nonce is still sent cross-site").not.toMatch(/SameSite=None/);
    const clear = readFileSync(resolve(root, "server/_core/oauth.ts"), "utf8");
    expect(clear).toMatch(/sameSite: "lax"/);
  });
});

/**
 * How much a caller may spend before a validator runs.
 *
 * These two are the same finding at two layers. `express.json({ limit: "10mb" })` was the
 * framework's example number, not a decision, and `z.custom(... typeof value === "object" ...)`
 * accepted an array, a Date, and an object of any size -- so "opaque" was standing in for "any
 * amount of anything". Nothing this API accepts is remotely that large.
 */
describe("what a caller may spend before a validator runs", () => {
  it("refuses a body past the limit, and the limit is 1mb rather than 10", async () => {
    const oversized = JSON.stringify({ pad: "x".repeat(1_200_000) });
    const response = await fetch(`${origin}/api/trpc/record.commitDecision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: oversized,
    });
    expect(response.status, "a 1.2MB body was parsed").toBe(413);
  });

  it("still accepts an ordinary body, which is the half a limit can break", async () => {
    // A limit that rejects everything passes the assertion above and serves nobody.
    const response = await fetch(`${origin}/api/trpc/record.commitDecision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { hello: "world" } }),
    });
    expect(response.status).not.toBe(413);
  });

  it("bounds the opaque import diagnostic by size, since it is not bounded by shape", () => {
    // A real diagnostic: a handful of bucket readings and a dozen counters.
    expect(isStorableDiagnostic({ buckets: [], scored: 0, forced: 0 })).toBe(true);
    // What `typeof value === "object"` used to wave through.
    expect(isStorableDiagnostic([1, 2, 3]), "an array passed as a diagnostic").toBe(false);
    expect(isStorableDiagnostic(null)).toBe(false);
    expect(isStorableDiagnostic({ pad: "x".repeat(70_000) }), "70KB of padding stored").toBe(false);
  });

  it("refuses rather than throws on an object that cannot be serialised at all", () => {
    // A thrown validator is a 500 where a refusal was the honest answer.
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => isStorableDiagnostic(cyclic)).not.toThrow();
    expect(isStorableDiagnostic(cyclic)).toBe(false);
  });
});
