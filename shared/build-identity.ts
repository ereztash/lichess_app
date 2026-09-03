/**
 * What is running, and which source produced it.
 *
 * WHY THIS EXISTS. The process-mining study found that this repository can prove
 * `source -> build -> local Chromium` and cannot prove `source -> build -> deployed origin`. The
 * missing link is not a test; it is an identity. A test that fetches the deployed site and asserts
 * something about the HTML cannot tell you WHICH BUILD it just asserted about, so a green run
 * proves the claim about whatever happened to be deployed at that moment -- including a build from
 * three days ago that the last deploy failed to replace.
 *
 * The authority for "what code is deployed?" was the Vercel deployment's `githubCommitSha`, which
 * is true and lives outside this repository: you cannot ask the running page. This makes the
 * running page able to answer, and `L6` tests assert against the answer rather than against
 * whatever they find.
 *
 * IT IS GENERATED, NOT WRITTEN. `scripts/write-build-identity.ts` derives every field at build time
 * from the environment the build ran in. Nothing here is hand-entered, because a hand-entered
 * version string is a declaration that drifts -- which is the defect this whole pass is against,
 * and `package.json` has said `"version": "1.0.0"` through every deployment this repository has
 * ever made.
 */

/**
 * The version of the measurement protocol the deployed build implements.
 *
 * BUMPED BY HAND, ON PURPOSE, and it is the one field here that must be. It answers "may a
 * measurement taken against build A be compared with one taken against build B?", which is a
 * judgement about whether an interface change altered what is being measured. `RNL-11` -- do not
 * change the intervention and the instrument at the same time -- is the rule it serves: a bump
 * here says the instrument moved, and a comparison across the bump needs an argument.
 */
export const MEASUREMENT_PROTOCOL_VERSION = "1.0.0";

/** Where the deployed build serves its identity. Relative to the origin, so it works anywhere. */
export const BUILD_IDENTITY_PATH = "/build-identity.json";

export interface BuildIdentity {
  /** The commit the build was produced from. 40 hex characters, or `unknown` if git was unreachable. */
  gitSha: string;
  /** ISO-8601, UTC, at build time. */
  builtAt: string;
  /**
   * Which deployment this build was made for: `production`, `preview`, `development` or `local`.
   *
   * L6 CLAIMS TURN ON THIS FIELD. A test that fetches a preview URL and reports "production is
   * healthy" is making a claim about a build that no player has ever been served. The target is
   * recorded so a test can refuse rather than assume.
   */
  target: string;
  /** `MEASUREMENT_PROTOCOL_VERSION` at build time. */
  protocolVersion: string;
}

/**
 * The identity, derived from the environment a build or a process is running in.
 *
 * ONE DERIVATION, TWO CALLERS. `scripts/write-build-identity.ts` runs it at build time and writes the
 * answer beside the static assets; `server/_core/build.ts` runs it at request time inside the
 * serverless function, whose bundle Vercel produces separately and which therefore cannot read the
 * file the build wrote. Two copies of "which variable names the commit" would drift the first time
 * a platform renamed one, and the L6 suite would then be comparing two different notions of build.
 *
 * `fallbackSha` is what a caller found out on its own -- `git rev-parse` at build time, nothing at
 * runtime -- and `unknown` is the honest answer when neither the platform nor the caller knows.
 */
export function deriveBuildIdentity(
  env: Readonly<Record<string, string | undefined>>,
  fallbackSha: string | null = null,
  builtAt: string = new Date().toISOString(),
): BuildIdentity {
  return {
    gitSha: env.VERCEL_GIT_COMMIT_SHA ?? env.GITHUB_SHA ?? fallbackSha ?? "unknown",
    builtAt,
    target: env.VERCEL_ENV ?? (env.CI ? "ci" : "local"),
    protocolVersion: MEASUREMENT_PROTOCOL_VERSION,
  };
}

/** A shape check with a reason, so a malformed identity fails where it is read rather than later. */
export function isBuildIdentity(value: unknown): value is BuildIdentity {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.gitSha === "string" &&
    v.gitSha.length > 0 &&
    typeof v.builtAt === "string" &&
    typeof v.target === "string" &&
    typeof v.protocolVersion === "string"
  );
}
