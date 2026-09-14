/**
 * What the browser was actually given, reduced to one number.
 *
 * WHY THIS EXISTS. The FIELD pre-registration named its stimulus with a single content-hashed
 * filename -- `assets/index-ZgOyRttd.js` -- and `research/player-path/field/README.md` told the
 * moderator that "that one string is the whole freeze check". It is not, and the gap is not a
 * detail. A build of this repository emits a dozen other things the browser fetches or obeys: a
 * separately content-hashed stylesheet, nine `.woff2` faces pulled by `url()` out of that
 * stylesheet, a favicon, a share card, `robots.txt`, `_headers` and `_redirects`. **None of the
 * static ones are content-hashed at all**, so a font swap or a header change moves the stimulus
 * while leaving the JS filename exactly where the protocol says it should be. The check would
 * pass. The participant would be looking at something nobody registered.
 *
 * THE FIX IS NOT A LONGER LIST. Adding css and fonts to the sentence reproduces the same defect
 * with a later expiry date: the next asset class nobody thought of escapes it too. The enumeration
 * here is **what the build wrote**, discovered by walking `dist/public`, not what somebody
 * remembered to name. A new asset kind cannot slip past a walk.
 *
 * WHAT IS DELIBERATELY OUTSIDE THE DIGEST, and the reason for each, because a freeze check whose
 * exclusions are undocumented is a freeze check nobody can audit:
 *
 * * `stimulus-manifest.json` -- it carries the digest, so it cannot be inside it.
 * * `build-identity.json` -- it carries `builtAt`, which moves on every rebuild. Hashing it would
 *   give the same source two different stimulus identities and fire the STOP rule on a rebuild
 *   that changed nothing. A check that fires when nothing moved is a check the moderator learns to
 *   override, and an overridden check is worse than an absent one. **The limit of the exclusion:**
 *   the file is still served and `client/src/lib/self-check.ts` reads it, so a change confined to
 *   it is invisible here. It is generated from the environment by `write-build-identity.ts` and
 *   nothing a cold participant is asked to open renders it; that is the whole of the argument.
 *
 * WHAT IS OUTSIDE IT BECAUSE IT CANNOT BE INSIDE IT. The digest covers bytes the build emitted. It
 * cannot cover the two conditions that decide what those bytes then do, because both can change
 * with no deployment at all: whether the origin is publicly reachable, and what `/api/health`
 * reports for `storage`. Those stay runtime checks in the pre-session procedure. Folding them into
 * a build-time hash would be a claim the hash cannot support.
 *
 * `gitSha` IS RECORDED BESIDE THE DIGEST, NOT INSIDE IT. A commit touching only `docs/` produces a
 * byte-identical `dist/public`, and the stimulus genuinely did not move; folding the sha in would
 * report that it had, which is the same false positive that kills the check. The two questions are
 * kept separate and both answered: `stimulus_sha256` is what the person was shown, `gitSha` is
 * what produced it.
 *
 * The hashing lives in `write-stimulus-manifest.ts`. This module is the canonical serialisation and
 * nothing else, so the thing a reviewer has to agree with is a format rather than an IO script.
 */

/**
 * Where the deployed build serves its stimulus identity. Relative to the origin, as
 * `/build-identity.json` is.
 *
 * A BUILD WITHOUT A MANIFEST ANSWERS `200 text/html` HERE, NOT `404`, and anything checking this
 * path has to be written for that. `vercel.json`'s last route sends every unmatched path to
 * `index.html`, so the request succeeds and a browser shows the product.
 * `client/src/lib/self-check.ts` already refuses the same trap for `/build-identity.json`:
 * *"an SPA fallback answers `200 text/html` for any unknown path, and reading that as 'an older
 * build' would be a confident and false diagnosis."* Measured on production at 2026-09-13T21:05Z,
 * where the frozen build predates this generator. **Check the content, never the status.**
 */
export const STIMULUS_MANIFEST_PATH = "/stimulus-manifest.json";

/**
 * The serialisation version, and it is inside the preimage.
 *
 * A change to the format changes every digest, which is correct: a digest produced under different
 * rules is not comparable with one produced under these. Putting the version in the preimage makes
 * that comparison impossible rather than merely inadvisable.
 */
export const STIMULUS_MANIFEST_VERSION = 1;

/** Emitted files the digest excludes. The reason for each is in this file's header. */
export const NOT_STIMULUS: readonly string[] = ["build-identity.json", "stimulus-manifest.json"];

/**
 * The build-time variables that decide what a participant can reach.
 *
 * THEY ARE ALREADY IN THE DIGEST, inlined into the JS by Vite, so this list is not what makes them
 * tamper-evident. It is what makes them **legible**: a moderator can read the manifest and see that
 * experimental learning was off, instead of taking it on faith or diffing a minified chunk.
 *
 * A HAND-KEPT LIST IS THE DEFECT THIS FILE EXISTS TO KILL, so it is not hand-kept.
 * `GATE-STIMULUS-FLAGS` in `run_gates.ts` reads every `import.meta.env.VITE_*` under `client/` and
 * fails when one is missing here. The list cannot silently fall behind the code; the gate refuses
 * first.
 */
export const RECORDED_FLAGS: readonly string[] = [
  "VITE_APP_ID",
  "VITE_EXPERIMENTAL_LEARNING_ENABLED",
  "VITE_OAUTH_PORTAL_URL",
  "VITE_QUIET_EVIDENCE_WINDOW_ENABLED",
  "VITE_VERIFIED_LEARNING_ENABLED",
];

/** One emitted file: its path relative to the served root, its content hash, its size. */
export interface StimulusFile {
  /** Forward-slashed, relative to `dist/public`, no leading slash. */
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface StimulusManifest {
  readonly manifestVersion: number;
  /** The one number the pre-session check compares. Lowercase hex, 64 characters. */
  readonly stimulus_sha256: string;
  /** Provenance, beside the digest rather than inside it. See this file's header. */
  readonly gitSha: string;
  readonly builtAt: string;
  readonly target: string;
  /** `RECORDED_FLAGS` as the build saw them. `null` means the variable was not set. */
  readonly flags: Readonly<Record<string, string | null>>;
  /** Every emitted file except `NOT_STIMULUS`, sorted by path. */
  readonly files: readonly StimulusFile[];
}

/** The marker a `null` flag serialises to. A space keeps it out of the space of real values. */
const UNSET = " unset";

/**
 * The bytes that get hashed.
 *
 * Line-oriented and sorted, so two builds of the same source agree regardless of the order the
 * filesystem handed the files back, and so a human can diff two preimages and see WHICH file moved
 * rather than only that something did.
 *
 * IT REFUSES A PATH IT CANNOT SERIALISE UNAMBIGUOUSLY. A tab or a newline inside a filename would
 * let two different file sets produce one preimage, which is a collision this format would have
 * created itself. No Vite output has ever contained one; the guard is here because the cost of
 * being wrong is a freeze check that cannot tell two stimuli apart.
 */
export function stimulusPreimage(
  files: readonly StimulusFile[],
  flags: Readonly<Record<string, string | null>>,
): string {
  const lines: string[] = [`stimulus-manifest/v${STIMULUS_MANIFEST_VERSION}`];
  for (const name of [...Object.keys(flags)].sort()) {
    const value = flags[name];
    lines.push(`flag\t${name}\t${value === null ? UNSET : value}`);
  }
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const file of sorted) {
    if (/[\t\n\r]/.test(file.path)) {
      throw new Error(
        `stimulus manifest: ${JSON.stringify(file.path)} contains a tab or a newline, which this ` +
          `format cannot tell apart from the fields around it. Two different builds could then ` +
          `hash identically. Rename the asset rather than loosening this.`,
      );
    }
    lines.push(`file\t${file.path}\t${file.sha256}\t${file.bytes}`);
  }
  return `${lines.join("\n")}\n`;
}

/** A shape check with a reason, so a malformed manifest fails where it is read rather than later. */
export function isStimulusManifest(value: unknown): value is StimulusManifest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.manifestVersion !== STIMULUS_MANIFEST_VERSION) return false;
  if (typeof v.stimulus_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(v.stimulus_sha256)) return false;
  if (typeof v.gitSha !== "string" || typeof v.builtAt !== "string" || typeof v.target !== "string") {
    return false;
  }
  if (!v.flags || typeof v.flags !== "object") return false;
  if (!Array.isArray(v.files)) return false;
  return v.files.every((f) => {
    if (!f || typeof f !== "object") return false;
    const file = f as Record<string, unknown>;
    return (
      typeof file.path === "string" &&
      typeof file.sha256 === "string" &&
      /^[0-9a-f]{64}$/.test(file.sha256) &&
      typeof file.bytes === "number"
    );
  });
}
