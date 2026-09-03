/**
 * The deployed origin, and the identity of the build serving it.
 *
 * `tests/layout/browser.ts` owns the Chromium launch so that no test file names Playwright
 * directly. This owns the same thing one rung up: the origin, and the refusal.
 *
 * WHY A BUILD IDENTITY COMES FIRST. An L6 test that fetches a URL and asserts something about the
 * response cannot say WHICH BUILD it just asserted about. A green run then proves the claim about
 * whatever happened to be deployed at that moment, including a build from three days ago that the
 * last deploy failed to replace. Every check here reads the identity before it reads anything else,
 * and every failure message names it, so a passing L6 run is a claim about a named commit rather
 * than about "the site".
 *
 * WHY IT SKIPS RATHER THAN THROWS, and why that is not the `browser.ts` case. `browser.ts` throws
 * when Chromium is missing because a runner without Chromium is a misconfigured runner: the browser
 * is meant to be there. An origin is different. There is no deployed origin on a developer's laptop
 * and there is none in a CI job that runs before anything has been deployed, so throwing would make
 * `npm test` fail for a reason that is not about the code. It skips when `DEPLOYED_ORIGIN` is
 * unset, exactly as the database suite skips without `DATABASE_URL` -- and, exactly as with the
 * database suite, the skip is temporary because the workflow that is meant to run these SETS the
 * variable. A skip there would be a failure of the workflow, not a licence.
 */
import { BUILD_IDENTITY_PATH, isBuildIdentity, type BuildIdentity } from "@shared/build-identity";

/** Set by `.github/workflows/deployed.yml`, or by hand for a one-off run against a preview. */
export const DEPLOYED_ORIGIN = process.env.DEPLOYED_ORIGIN?.replace(/\/$/, "") ?? "";

/**
 * The commit the origin is REQUIRED to be serving, when the caller knows it.
 *
 * Without it these checks say "the origin serves a coherent build". With it they say "the origin
 * serves THIS build", which is the only form in which an L6 result licenses a claim about the code
 * in the diff.
 */
export const EXPECTED_SHA = process.env.DEPLOYED_SHA ?? "";

export const hasOrigin = DEPLOYED_ORIGIN.length > 0;

const TIMEOUT_MS = 20_000;

export interface Fetched {
  status: number;
  contentType: string;
  headers: Headers;
  body: string;
}

/**
 * REDIRECTS ARE NOT FOLLOWED, and that is a correction rather than a preference.
 *
 * The first version followed them, and the first automatic run pointed at a protected Vercel
 * preview: `/build-identity.json` answered `302` to an SSO login, the fetch followed it, and the
 * suite read `200 text/html` from Vercel's own Next.js login page. It then reported *"this origin
 * is serving a build that predates the build identity"* -- a confident, specific and WRONG
 * diagnosis, produced because following the redirect threw away the one fact that distinguished the
 * two cases.
 *
 * A test that misnames the cause of its own failure is worse than one that fails vaguely, because
 * somebody acts on the name. `manual` keeps the 3xx visible and `buildIdentity` reports it as what
 * it is.
 */
export async function get(path: string, origin = DEPLOYED_ORIGIN): Promise<Fetched> {
  const response = await fetch(`${origin}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    headers: response.headers,
    body: response.status >= 300 && response.status < 400 ? "" : await response.text(),
  };
}

/** Where a 3xx is pointing, host only, so a failure message can name it without leaking a token. */
function redirectHost(fetched: Fetched): string {
  const location = fetched.headers.get("location");
  if (!location) return "somewhere it did not name";
  try {
    return new URL(location, "https://example.invalid").host;
  } catch {
    return location.slice(0, 60);
  }
}

/**
 * The identity the origin serves, or a reason it could not be read.
 *
 * A REASON RATHER THAN A THROW, because "this origin serves no build identity" is itself a finding
 * an L6 test should report as a failed assertion with the URL in it, not as a stack trace. Before
 * this file existed the deployed origin answered `/build-identity.json` with the SPA fallback --
 * `200 text/html` -- which is the shape every unknown path takes, and is precisely why the check
 * cannot be "did it return 200".
 */
export async function buildIdentity(
  origin = DEPLOYED_ORIGIN,
): Promise<{ identity: BuildIdentity } | { problem: string }> {
  let fetched: Fetched;
  try {
    fetched = await get(BUILD_IDENTITY_PATH, origin);
  } catch (error) {
    return { problem: `${origin}${BUILD_IDENTITY_PATH} could not be reached: ${String(error)}` };
  }
  if (fetched.status >= 300 && fetched.status < 400) {
    return {
      problem:
        `${origin}${BUILD_IDENTITY_PATH} answered ${fetched.status} to ` +
        `${redirectHost(fetched)}. The origin is behind deployment protection or is an alias for ` +
        `somewhere else; nothing about this application can be checked through it, and this is NOT ` +
        `a statement about the build`,
    };
  }
  if (fetched.status !== 200) {
    return { problem: `${origin}${BUILD_IDENTITY_PATH} answered ${fetched.status}` };
  }
  if (!fetched.contentType.includes("application/json")) {
    return {
      problem:
        `${origin}${BUILD_IDENTITY_PATH} answered ${fetched.status} as \`${fetched.contentType}\`, ` +
        `not JSON. An SPA fallback answers every unknown path this way, so this origin is serving ` +
        `a build that predates the build identity`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fetched.body);
  } catch {
    return { problem: `${origin}${BUILD_IDENTITY_PATH} is not JSON` };
  }
  if (!isBuildIdentity(parsed)) {
    return { problem: `${origin}${BUILD_IDENTITY_PATH} is JSON but not a build identity` };
  }
  return { identity: parsed };
}

/** `gitSha@target`, for a failure message that names the build rather than the URL. */
export function describe(identity: BuildIdentity): string {
  return `${identity.gitSha.slice(0, 12)}@${identity.target} (protocol ${identity.protocolVersion})`;
}

/**
 * Does the identity the origin served name the commit the caller required?
 *
 * PURE, so the rollback rehearsal can falsify it without a second deployment. The L6 suite calls
 * this with the served identity and `EXPECTED_SHA`; `tests/fixtures/controls/deployed-sha.control.test.ts`
 * calls it with an identity and a SHA that differ and must go red. If this ever answers `ok` for a
 * mismatch, a rollback that failed to replace the build would report as a rollback that worked.
 */
export function servesExpectedBuild(
  identity: BuildIdentity,
  expectedSha: string,
): { ok: true } | { ok: false; problem: string } {
  if (!expectedSha) return { ok: true };
  if (identity.gitSha === expectedSha) return { ok: true };
  return {
    ok: false,
    problem: `expected ${expectedSha.slice(0, 12)}, origin is serving ${describe(identity)}`,
  };
}
