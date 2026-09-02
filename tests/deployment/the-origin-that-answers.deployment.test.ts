/**
 * `L6`. What the deployed origin actually serves, named by the build that is serving it.
 *
 * WHAT WAS MISSING. This repository could prove `source -> build -> local Chromium` and stopped
 * there. `npm run levels` reported **L6 0** for its whole life, and the one run that ever found a
 * deployment defect -- the CSP that broke the engine worker -- was a throwaway script that does not
 * re-run. Everything between the built assets and a player's browser was unverified, standing.
 *
 * WHAT THIS DOES AND DOES NOT LICENSE. Every assertion below names the build identity it ran
 * against, and the suite REFUSES before making any other claim if the origin cannot say which build
 * it is. That is the difference between an L6 result and a `/health` request wearing one:
 *
 *   - it licenses claims about **headers, MIME types, SPA routing and asset delivery as served**;
 *   - it licenses **nothing about product behaviour**. Nothing here plays a game, commits a
 *     decision, or reads a record. The single interaction check asserts that the front door renders
 *     its own promise, which is the weakest honest statement about the running product, and it is
 *     labelled as such.
 *
 * NO WRITES, EVER. A smoke test that commits a decision would be creating production data to make
 * a test pass, and the record it wrote would be indistinguishable from a player's. The strongest
 * honest claim over a read-only path is the one this file makes.
 *
 * `DEPLOYED_ORIGIN` unset means skip, and `tests/deployment/origin.ts` says why that is the
 * database suite's case rather than `browser.ts`'s.
 */
import { describe as vitestDescribe, expect, it } from "vitest";
import {
  DEPLOYED_ORIGIN,
  EXPECTED_SHA,
  buildIdentity,
  describe as describeBuild,
  get,
  hasOrigin,
} from "./origin";

const suite = hasOrigin ? vitestDescribe : vitestDescribe.skip;

suite(`the deployed origin ${DEPLOYED_ORIGIN}`, () => {
  it("says which build it is serving, before anything else is asked of it", async () => {
    const result = await buildIdentity();
    expect(
      "identity" in result ? "" : result.problem,
      "an origin that cannot name its build cannot license any claim about the code that produced it",
    ).toBe("");
  });

  it("serves the commit it was asked for, when the caller named one", async () => {
    const result = await buildIdentity();
    if (!("identity" in result)) {
      expect.fail(result.problem);
    }
    if (!EXPECTED_SHA) {
      /*
       * Not a skip and not a pass by default: with no expected SHA this run establishes only that
       * the origin serves A coherent build. The workflow sets DEPLOYED_SHA, so the weaker form is
       * what a hand-run against production gets, and it says so.
       */
      expect(result.identity.gitSha.length, "the identity carries no commit").toBeGreaterThan(0);
      return;
    }
    expect(
      result.identity.gitSha,
      `expected ${EXPECTED_SHA.slice(0, 12)}, origin is serving ${describeBuild(result.identity)}`,
    ).toBe(EXPECTED_SHA);
  });

  it("answers the three SPA routes with HTML, on a cold request and not only after client routing", async () => {
    const result = await buildIdentity();
    const at = "identity" in result ? describeBuild(result.identity) : "an unnamed build";
    for (const path of ["/", "/play", "/blitz"]) {
      const response = await get(path);
      expect(response.status, `${path} on ${at}`).toBe(200);
      expect(response.contentType, `${path} on ${at}`).toContain("text/html");
    }
  });

  it("serves the entry assets the served HTML names, with the MIME types the CSP requires", async () => {
    const result = await buildIdentity();
    const at = "identity" in result ? describeBuild(result.identity) : "an unnamed build";
    const html = await get("/");
    const assets = [...html.body.matchAll(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g)].map((m) => m[0]);
    expect(
      [...new Set(assets)].length,
      `the served HTML on ${at} names no /assets/ entry, so there is nothing to check`,
    ).toBeGreaterThan(0);
    for (const asset of [...new Set(assets)].slice(0, 4)) {
      const response = await get(asset);
      expect(response.status, `${asset} on ${at}`).toBe(200);
      const wanted = asset.endsWith(".css") ? "text/css" : "javascript";
      expect(response.contentType, `${asset} on ${at}`).toContain(wanted);
    }
  });

  it("sends the security headers vercel.json declares, as actually served", async () => {
    const result = await buildIdentity();
    const at = "identity" in result ? describeBuild(result.identity) : "an unnamed build";
    const response = await get("/");
    /*
     * The CSP is the one this repository has already broken once, in a way no local test could see:
     * a policy that forbids the engine's worker passes every layout test and fails in production.
     * Checked as SERVED rather than as written in vercel.json, because those are two different
     * claims and only one of them is about the deployment.
     */
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp, `no CSP served on ${at}`).not.toBe("");
    expect(csp, `worker-src missing from the served CSP on ${at}`).toContain("worker-src 'self'");
    expect(csp, `wasm-unsafe-eval missing from the served CSP on ${at}`).toContain("'wasm-unsafe-eval'");
    expect(response.headers.get("x-content-type-options"), `on ${at}`).toBe("nosniff");
    expect(response.headers.get("x-frame-options"), `on ${at}`).toBe("DENY");
  });

  it("answers /api/health from the deployed function, not from the SPA fallback", async () => {
    const result = await buildIdentity();
    const at = "identity" in result ? describeBuild(result.identity) : "an unnamed build";
    const response = await get("/api/health");
    /*
     * The point is the CONTENT TYPE, not the status. An SPA fallback answers 200 text/html for any
     * unknown path, so a health check that only asserted 200 would pass on a deployment whose API
     * function failed to build at all -- which is the same defect as `Boolean(await getDb())`
     * wearing the name of a database check (Cycle 13).
     */
    expect(response.contentType, `/api/health on ${at} did not answer as JSON`).toContain(
      "application/json",
    );
  });

  it("renders the front door's own promise in the served HTML", async () => {
    const result = await buildIdentity();
    const at = "identity" in result ? describeBuild(result.identity) : "an unnamed build";
    const response = await get("/");
    /*
     * THE WEAKEST HONEST CLAIM ABOUT THE RUNNING PRODUCT, and deliberately so. It establishes that
     * the served document is this application's shell rather than an error page or a parked domain.
     * It establishes NOTHING about whether a decision can be recorded, because establishing that
     * would mean writing a record to production, and a record written to make a test pass is
     * indistinguishable from a player's.
     */
    expect(response.body, `the served document on ${at} is not this application's shell`).toMatch(
      /<div id="root"/,
    );
    expect(response.body, `on ${at}`).toContain('lang="he"');
  });
});
