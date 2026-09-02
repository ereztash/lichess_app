/**
 * Positive control for the `L6` deployment suite.
 *
 * WHY THE CONTROL IS A WRONG ORIGIN AND NOT A BROKEN DEPLOYMENT. Every other gate here proves
 * itself by running the same predicate over a deliberately broken input. At `L6` the input is the
 * world, and the honest fixture would be a deployment that is actually broken -- which would mean
 * breaking the real one. The mission's own alternative is taken instead: **the same predicates,
 * pointed at an origin that is known not to be this application.**
 *
 * That is a real falsification and not a weaker one. The claim under test is *"the deployed origin
 * serves THIS build of THIS application"*, and the way that claim fails in production is exactly
 * this: a request lands somewhere that answers 200 with a document that is not ours. A parked
 * domain, a stale alias, a rewritten route and a rolled-back deployment all present that way.
 *
 * `example.com` is used because it is stable, exists, answers 200, and is definitely not this
 * repository. An origin that did not answer at all would prove less: any check fails against a dead
 * host, including a check that does nothing.
 *
 * EXPECTED TO FAIL. `vitest.controls.config.ts` collects it; `npm test` does not.
 */
import { describe, expect, it } from "vitest";
import { buildIdentity, get } from "../../deployment/origin";

const WRONG = "https://example.com";

describe("the L6 predicates, pointed at an origin that is not this application", () => {
  it("refuses an origin that cannot name a build of this application", async () => {
    const result = await buildIdentity(WRONG);
    expect(
      "identity" in result ? "" : result.problem,
      "the identity check passed against example.com, so it is not checking identity",
    ).toBe("");
  });

  it("refuses a served document that is not this application's shell", async () => {
    const response = await get("/", WRONG);
    expect(
      response.body,
      "the shell check passed against example.com, so it is matching something every page has",
    ).toMatch(/<div id="root"/);
  });

  it("refuses an origin that does not serve this application's CSP", async () => {
    const response = await get("/", WRONG);
    expect(
      response.headers.get("content-security-policy") ?? "",
      "the CSP check passed against example.com, so it is not reading a served header",
    ).toContain("worker-src 'self'");
  });
});
