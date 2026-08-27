/**
 * The origins the app fetches from, and the origins the deployment lets it fetch from.
 *
 * THIS SHIPPED BROKEN AND EVERY TEST PASSED. Chess.com was added as a second front door with
 * thirteen assertions and eight positive controls, and it was verified against the live API from
 * node. On a phone it failed instantly: `connect-src 'self' https://lichess.org` did not name
 * `api.chess.com`, so the browser refused the request before it left the page.
 *
 * WHY NOTHING CAUGHT IT. Every test injects its own `fetch`, which no policy applies to. The live
 * probe ran in node, which has no CSP. And a CSP violation reaches `fetch` as a plain TypeError,
 * indistinguishable from being offline -- so the app's own error path was reached and it reported,
 * accurately for what it could see, that the browser could not reach Chess.com. Correct code,
 * correct message, and the cause was a JSON file nobody had touched.
 *
 * Two places asserted the same fact -- which origins this product reaches -- and one of them
 * moved. That is the shape of half the defects in this repository, so it is held rather than
 * remembered: the source list is the truth, and the deployment header has to contain it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GAME_SOURCES, SOURCE_ORIGIN } from "@/lib/game-source";

const root = resolve(__dirname, "../..");

/** The deployed `connect-src`, as the browser will read it. */
function connectSrc(): string[] {
  /*
   * `routes[].headers`, not `headers[]`. Both are real Vercel shapes and this project uses the
   * first; the first draft of this helper read the second, found nothing, and failed with "no
   * Content-Security-Policy" on a file that plainly has one -- a check that cannot see its
   * subject fails the same way whether the subject is right or wrong, which makes it useless in
   * exactly the case it exists for. The `policies.length` assertion below is what said so.
   */
  const config = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as {
    routes?: { headers?: Record<string, string> }[];
    headers?: { headers?: { key: string; value: string }[] }[];
  };
  const policies = [
    ...(config.routes ?? []).map((route) => route.headers?.["Content-Security-Policy"]),
    ...(config.headers ?? [])
      .flatMap((entry) => entry.headers ?? [])
      .filter((header) => header.key.toLowerCase() === "content-security-policy")
      .map((header) => header.value),
  ].filter((value): value is string => typeof value === "string");
  expect(policies.length, "vercel.json no longer sets a Content-Security-Policy").toBeGreaterThan(
    0,
  );
  const directive = policies[0]
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("connect-src"));
  expect(directive, "the policy no longer has a connect-src at all").toBeTruthy();
  return directive!.split(/\s+/).slice(1);
}

describe("every origin the page fetches from is one the policy allows", () => {
  it("names each game source's origin in connect-src", () => {
    const allowed = connectSrc();
    for (const source of GAME_SOURCES) {
      expect(
        allowed,
        `${source} is fetched from ${SOURCE_ORIGIN[source]}, which connect-src does not allow -- ` +
          `the browser will refuse it and the app will report being unable to reach the site`,
      ).toContain(SOURCE_ORIGIN[source]);
    }
  });

  it("has a source list worth checking, so a passing check is not an empty one", () => {
    // The loop above passes trivially if the list empties. This is its denominator.
    expect(GAME_SOURCES.length).toBeGreaterThan(1);
    for (const source of GAME_SOURCES)
      expect(SOURCE_ORIGIN[source], `${source} has no origin`).toMatch(/^https:\/\/[a-z0-9.-]+$/);
  });

  it("is the list the clients actually fetch from, not a second copy of it", () => {
    /*
     * A constant nobody reads would satisfy the assertion above while the client kept its own
     * hard-coded origin, which is exactly the two-places-one-fact this file exists to close.
     */
    for (const [file, source] of [
      ["client/src/lib/lichess-public.ts", "lichess"],
      ["client/src/lib/chesscom-public.ts", "chesscom"],
    ] as const) {
      const code = readFileSync(resolve(root, file), "utf8");
      expect(code, `${file} does not read the shared origin`).toContain(
        `SOURCE_ORIGIN.${source}`,
      );
      expect(
        code.includes(`"${SOURCE_ORIGIN[source]}"`),
        `${file} hard-codes ${SOURCE_ORIGIN[source]} beside the shared one`,
      ).toBe(false);
    }
  });
});
