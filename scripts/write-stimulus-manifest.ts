/**
 * Walk what the build emitted, hash all of it, write the answer beside it.
 *
 * Runs after `write-build-identity.ts` and writes `dist/public/stimulus-manifest.json`, which the
 * static host serves at `/stimulus-manifest.json`. The format, the exclusions and the reason the
 * git sha sits beside the digest rather than inside it are in `stimulus-manifest.ts`. This file is
 * the walk and the IO.
 *
 * WHY A WALK AND NOT A LIST. `research/player-path/field/README.md` used to tell a moderator that
 * one content-hashed JS filename was the whole freeze check. It named one of thirteen emitted
 * things, and nine of the others -- every `.woff2` face -- carry no content hash at all, so no
 * amount of care with that one string could ever have caught a font change. A list of asset kinds
 * is the same bug with a later expiry date. `readdirSync` recursively is the only enumeration that
 * stays true when somebody adds an asset kind nobody here thought of.
 *
 * IT REFUSES RATHER THAN GUESSING, in the same shape as `write-build-identity.ts`: no `dist/public`
 * means no build, and a manifest written now would describe nothing. A stimulus identity that
 * quietly describes an absent build is worse than none, because the pre-session check would then
 * compare a live page against a digest of nothing.
 *
 * Run: npm run build   (wired in, after the build identity)
 * Positive control: STIMULUS_ROOT=tests/fixtures/... npx tsx scripts/write-stimulus-manifest.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { deriveBuildIdentity } from "../shared/build-identity";
import { execFileSync } from "node:child_process";
import {
  NOT_STIMULUS,
  RECORDED_FLAGS,
  stimulusPreimage,
  STIMULUS_MANIFEST_VERSION,
  type StimulusFile,
  type StimulusManifest,
} from "./stimulus-manifest";

const REPO = resolve(import.meta.dirname, "..");

/**
 * The tree to describe. `dist/public` in every ordinary run.
 *
 * `STIMULUS_ROOT` EXISTS FOR THE TESTS AND FOR NOTHING ELSE, on the `BUNDLE_ROOT` precedent in
 * `check_bundle_budget.ts`: a check with no way to demonstrate its own failure is a check nobody
 * has reason to believe. Pointing this at a fixture and watching the digest move is how the
 * sensitivity of the freeze check is shown rather than asserted.
 */
const ROOT = resolve(REPO, process.env.STIMULUS_ROOT ?? join("dist", "public"));
const OUT = join(ROOT, "stimulus-manifest.json");

/** Every file under `dir`, depth first, as paths relative to `ROOT` with forward slashes. */
function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(relative(ROOT, full).split(sep).join("/"));
  }
  return acc;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function localSha(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function main(): number {
  if (!existsSync(ROOT)) {
    console.error(
      `write-stimulus-manifest: ${ROOT} does not exist. Run \`npm run build\` first -- a manifest ` +
        `written now would describe a build that is not there.`,
    );
    return 1;
  }

  const files: StimulusFile[] = walk(ROOT)
    .filter((path) => !NOT_STIMULUS.includes(path))
    .map((path) => {
      const bytes = readFileSync(join(ROOT, path));
      return { path, sha256: sha256(bytes), bytes: bytes.byteLength };
    });

  if (files.length === 0) {
    console.error(
      `write-stimulus-manifest: ${ROOT} holds nothing but generated identity files. A digest over ` +
        `an empty stimulus would be a constant, and a constant cannot detect a change.`,
    );
    return 1;
  }

  const flags: Record<string, string | null> = {};
  for (const name of RECORDED_FLAGS) flags[name] = process.env[name] ?? null;

  const identity = deriveBuildIdentity(process.env, localSha());
  const manifest: StimulusManifest = {
    manifestVersion: STIMULUS_MANIFEST_VERSION,
    stimulus_sha256: sha256(stimulusPreimage(files, flags)),
    gitSha: identity.gitSha,
    builtAt: identity.builtAt,
    target: identity.target,
    flags,
    files,
  };

  writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `stimulus: ${manifest.stimulus_sha256} over ${files.length} files ` +
      `(${files.reduce((n, f) => n + f.bytes, 0).toLocaleString("en-US")} bytes)`,
  );
  return 0;
}

process.exit(main());
