/**
 * `R-27`: THE ENGINE, RUN ON THE DEPLOYED ORIGIN, BY SOMETHING THAT RE-RUNS.
 *
 * WHAT THIS ADDS TO THE `L6` SUITE. Everything else here asserts what the origin SAYS: the headers,
 * the MIME types, the CSP string, the health answer, the build identity. This asserts what the
 * origin DOES. A policy string containing `worker-src 'self'` is strong evidence and it is not the
 * fact; the fact is a worker that starts under it and answers `uciok`.
 *
 * WHY IT BELONGS IN THE POST-DEPLOY RUNG AND NOT IN `verify`. `R-21`: `main` is not protected and
 * `verify-build.yml` runs on push AFTER the merge, so a red build is already serving players by the
 * time anything reports. Until that is fixed in repository settings, `deployed.yml` is the only rung
 * that runs against what people are actually being served, which is where a check on the served
 * artefact has to live.
 *
 * BOUND TO THE COMMIT. The build-identity assertions in this suite already tie the origin to
 * `DEPLOYED_SHA`; this case names the SHA it probed in its own failure message so a red run says
 * which build could not start its engine, not merely that one could not.
 *
 * IT IS READ-ONLY. It fetches the origin's own assets and starts a worker in a throwaway context.
 * The "no writes, ever" rule of this suite holds.
 *
 * WHAT IT DOES NOT COVER, STATED SO NOBODY READS MORE INTO A GREEN RUN THAN IT CARRIES:
 *
 *   - It probes ONE browser engine, the Chromium the runner has. A Safari-specific wasm or worker
 *     failure is invisible to it.
 *   - It proves the engine STARTS. It does not play a game, and a build whose engine starts and
 *     then returns nonsense would pass here and fail `the-instrument-and-the-board-it-measures`.
 *   - It runs when the workflow runs. Between two deployments an origin can change underneath it --
 *     an edge config edited in a dashboard, an alias moved -- and the daily schedule is what
 *     narrows that window, not this file.
 */
import type { Browser } from "@playwright/test";
import { afterAll, beforeAll, describe as vitestDescribe, expect, it } from "vitest";

import { launchChromium } from "../layout/browser";
import { DEPLOYED_ORIGIN, EXPECTED_SHA, hasOrigin } from "./origin";
import { probeEngineAt } from "./engine-probe";

const suite = hasOrigin ? vitestDescribe : vitestDescribe.skip;

let browser: Browser;

beforeAll(async () => {
  if (hasOrigin) browser = await launchChromium();
}, 180_000);

afterAll(async () => {
  await browser?.close();
});

suite("the engine speaks on the deployed origin", () => {
  it(
    "starts a worker under the served policy and answers uciok",
    async () => {
      const result = await probeEngineAt(browser, DEPLOYED_ORIGIN);
      const where = EXPECTED_SHA ? `${DEPLOYED_ORIGIN} at ${EXPECTED_SHA}` : DEPLOYED_ORIGIN;
      expect(
        result.verdict,
        `the shipped engine did not start on ${where}: ${result.detail}` +
          (result.refusals.length ? ` | refused: ${result.refusals[0]}` : "") +
          (result.lines.length ? ` | said: ${result.lines[0]}` : " | said nothing"),
      ).toBe("UCIOK");
      /*
       * A refusal that did not stop the engine is still a fact worth failing on: it means the
       * served policy is narrower than the build expects and the next asset to be added under it
       * will be the one that breaks.
       */
      expect(result.refusals, "the page refused something under the served policy").toEqual([]);
    },
    300_000,
  );
});
