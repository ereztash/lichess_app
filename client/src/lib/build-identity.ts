/**
 * Which build this page is, asked of the file the build wrote beside it.
 *
 * The page cannot know its own commit: Vite inlines nothing of the kind, and inventing a constant
 * here would be a second derivation beside `scripts/write-build-identity.ts`. So it asks the one
 * authority the deployment has -- `/build-identity.json`, same origin -- once, and remembers.
 *
 * NULL WHEN THE ANSWER IS NOT A BUILD IDENTITY. A static host answers every unknown path with the
 * SPA shell, `200 text/html`, and `tests/deployment/origin.ts` explains at length why reading that
 * as "an older build" would be a confident, specific and false diagnosis. Here null means "this
 * origin did not say", and every caller renders `unknown` for it rather than a guess.
 */
import { BUILD_IDENTITY_PATH, isBuildIdentity, type BuildIdentity } from "@shared/build-identity";

let cached: Promise<BuildIdentity | null> | null = null;

export function loadBuildIdentity(fetchImpl: typeof fetch = fetch): Promise<BuildIdentity | null> {
  if (!cached) {
    cached = (async () => {
      try {
        const response = await fetchImpl(BUILD_IDENTITY_PATH, { cache: "no-store" });
        if (!response.ok || !(response.headers.get("content-type") ?? "").includes("json")) return null;
        const parsed: unknown = await response.json();
        return isBuildIdentity(parsed) ? parsed : null;
      } catch {
        return null;
      }
    })();
  }
  return cached;
}

/** Test seam: the next `loadBuildIdentity` asks again. */
export function forgetBuildIdentity(): void {
  cached = null;
}

/** The sha as a report prints it: twelve characters, or the word for not knowing. */
export function shortSha(identity: BuildIdentity | null): string {
  return identity ? identity.gitSha.slice(0, 12) : "unknown";
}
