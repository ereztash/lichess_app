/**
 * Which build this FUNCTION is, asked at request time.
 *
 * `/build-identity.json` names the build the CDN serves. Nothing named the build the API serves:
 * Vercel bundles the function separately from `vite build`, so the file the build wrote is not in
 * the function's reach, and until now a server log line could not be tied to a release and the L6
 * suite could prove the static assets were commit X while proving nothing about the function that
 * answered beside them. After a rollback, a partial promotion or a stuck alias those two can differ,
 * and the difference was unobservable.
 *
 * DERIVED, NOT WRITTEN, by the same function the build uses (`deriveBuildIdentity`): Vercel exposes
 * `VERCEL_GIT_COMMIT_SHA` and `VERCEL_ENV` to the function at runtime, CI exposes `GITHUB_SHA`, and
 * a local `npm run dev` gets `unknown@local`, which is true.
 *
 * `builtAt` is not known here and is not invented: the function knows when it was asked, not when
 * it was built, and the L6 comparison is on `gitSha`.
 */
import { deriveBuildIdentity } from "../../shared/build-identity.js";

export interface RuntimeBuildIdentity {
  gitSha: string;
  target: string;
  protocolVersion: string;
}

export function runtimeBuildIdentity(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RuntimeBuildIdentity {
  const { gitSha, target, protocolVersion } = deriveBuildIdentity(env, null, "");
  return { gitSha, target, protocolVersion };
}
