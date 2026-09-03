/**
 * Emit the build's identity beside the build, so the running page can say what produced it.
 *
 * Runs after `vite build` and writes `dist/public/build-identity.json`, which the static host
 * serves at `/build-identity.json`. It writes into `dist/` rather than `client/public/` on purpose:
 * `client/public/` is source, and a generated file committed into source is a declaration that
 * drifts from the thing it describes the moment somebody builds without running this.
 *
 * EVERY FIELD IS DERIVED. On Vercel the git SHA and the environment come from the platform's own
 * variables, which are set from the deployment rather than from the checkout; locally they come
 * from `git`. Nothing is hand-entered except `MEASUREMENT_PROTOCOL_VERSION`, and the reason that
 * one is deliberate is in `shared/build-identity.ts`.
 *
 * IT REFUSES RATHER THAN GUESSING. If `dist/public` does not exist, the build has not run and an
 * identity written now would describe nothing; the script exits non-zero and says so, in the same
 * shape as `tests/layout/browser.ts` throwing when Chromium is missing. A build identity that
 * quietly describes an absent build is worse than none, because an L6 test would then compare a
 * deployed page against a file that was never deployed with it.
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deriveBuildIdentity, type BuildIdentity } from "../shared/build-identity";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "dist", "public");
const OUT = join(OUT_DIR, "build-identity.json");

/**
 * The commit this build came from.
 *
 * Vercel's `VERCEL_GIT_COMMIT_SHA` is preferred over `git rev-parse` because a Vercel build runs
 * against a checkout the platform made, and the platform's own record of which commit that was is
 * the thing the deployment is keyed by. Falling through to `git` covers local builds and CI.
 */
/**
 * What this checkout says about itself, for the case no platform variable does.
 *
 * The preference order -- platform first, then git -- lives in `deriveBuildIdentity`, shared with
 * the serverless function so the static file and the API cannot disagree about which variable
 * names the commit. This is only the fallback the function cannot have: a `git` at build time.
 */
function localSha(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    // A tarball with no .git is a legitimate way to build; `unknown` is honest and an L6 test that
    // requires a specific SHA will refuse on it rather than pass vacuously.
    return null;
  }
}

function main(): number {
  if (!existsSync(OUT_DIR)) {
    console.error(
      `write-build-identity: ${OUT_DIR} does not exist. Run \`npm run build\` first -- an identity ` +
        `written now would describe a build that is not there.`,
    );
    return 1;
  }
  const identity: BuildIdentity = deriveBuildIdentity(process.env, localSha());
  writeFileSync(OUT, `${JSON.stringify(identity, null, 2)}\n`);
  console.log(
    `build identity: ${identity.gitSha.slice(0, 12)} target=${identity.target} ` +
      `protocol=${identity.protocolVersion}`,
  );
  return 0;
}

process.exit(main());
