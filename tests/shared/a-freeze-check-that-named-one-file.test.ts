/**
 * A pre-registration whose stimulus check could not see most of the stimulus.
 *
 * `research/player-path/field/README.md` told the moderator, in the step run immediately before a
 * participant touched the product, that confirming one content-hashed filename was "the whole
 * freeze check". The build emits forty files. Eighteen of them -- nine `.woff2` faces, the favicon,
 * the share card, `index.html`, `robots.txt`, three licence files, `_headers`, `_redirects` --
 * carry no content hash at all, so their names do not move when their bytes do. Swapping a Hebrew
 * face changes what every participant reads and leaves `assets/index-ZgOyRttd.js` exactly where the
 * protocol says it should be. The check passes. The session runs against a stimulus nobody
 * registered, and nothing in the record would ever say so.
 *
 * These tests hold the replacement to the property that failure needed: the digest is over what the
 * build WROTE, not over a list somebody keeps, so a file nobody anticipated cannot escape it.
 */
import { describe, expect, it } from "vitest";
import {
  isStimulusManifest,
  NOT_STIMULUS,
  RECORDED_FLAGS,
  STIMULUS_MANIFEST_VERSION,
  stimulusPreimage,
  type StimulusFile,
} from "../../scripts/stimulus-manifest";

const hash = (seed: string): string => seed.repeat(64).slice(0, 64);
const file = (path: string, seed = "a", bytes = 10): StimulusFile => ({
  path,
  sha256: hash(seed),
  bytes,
});

/** A stand-in for a real build: a hashed entry, a hashed stylesheet, and unhashed static assets. */
const BUILD: StimulusFile[] = [
  file("assets/index-ZgOyRttd.js", "1", 695047),
  file("assets/index-_bGdMEE1.css", "2", 95435),
  file("fonts/noto-sans-hebrew-400-hebrew.woff2", "3", 12264),
  file("favicon.svg", "4", 297),
  file("_headers", "5", 1270),
  file("index.html", "6", 6068),
];
const FLAGS: Record<string, string | null> = Object.fromEntries(
  RECORDED_FLAGS.map((f) => [f, null]),
);

const digestOf = (files: StimulusFile[], flags: Record<string, string | null> = FLAGS): string =>
  stimulusPreimage(files, flags);

describe("the file the old check could not see", () => {
  it("moves the digest when a font's bytes change under an unchanged name", () => {
    const swapped = BUILD.map((f) =>
      f.path === "fonts/noto-sans-hebrew-400-hebrew.woff2" ? { ...f, sha256: hash("9") } : f,
    );

    // The name every participant would still be served is identical. Only the bytes moved.
    expect(swapped.map((f) => f.path)).toEqual(BUILD.map((f) => f.path));
    expect(digestOf(swapped)).not.toBe(digestOf(BUILD));
  });

  it("moves the digest when the stylesheet changes, which the JS hash never reported", () => {
    const restyled = BUILD.map((f) =>
      f.path.endsWith(".css") ? { path: "assets/index-NEWHASH1.css", sha256: hash("7"), bytes: 1 } : f,
    );
    const entry = (fs: StimulusFile[]) => fs.find((f) => f.path.endsWith(".js"))!;

    expect(entry(restyled)).toEqual(entry(BUILD));
    expect(digestOf(restyled)).not.toBe(digestOf(BUILD));
  });

  it("moves the digest when an HTTP header rule changes, which renders nothing and changes behaviour", () => {
    const rehead = BUILD.map((f) => (f.path === "_headers" ? { ...f, sha256: hash("8") } : f));
    expect(digestOf(rehead)).not.toBe(digestOf(BUILD));
  });

  it("moves the digest when a file is added or removed, not only when one is edited", () => {
    expect(digestOf([...BUILD, file("assets/new-chunk-AAAAAAAA.js", "b")])).not.toBe(digestOf(BUILD));
    expect(digestOf(BUILD.slice(1))).not.toBe(digestOf(BUILD));
  });

  it("moves the digest when a surface flag is set differently", () => {
    const on = { ...FLAGS, VITE_EXPERIMENTAL_LEARNING_ENABLED: "true" };
    expect(digestOf(BUILD, on)).not.toBe(digestOf(BUILD));
    // `null` is not `"false"`. Both mean off; recording them as one would lose which the build saw.
    const off = { ...FLAGS, VITE_EXPERIMENTAL_LEARNING_ENABLED: "false" };
    expect(digestOf(BUILD, off)).not.toBe(digestOf(BUILD));
    expect(digestOf(BUILD, off)).not.toBe(digestOf(BUILD, on));
  });
});

describe("the digest a moderator compares", () => {
  it("does not depend on the order the filesystem handed the files back", () => {
    expect(digestOf([...BUILD].reverse())).toBe(digestOf(BUILD));
  });

  it("does not depend on the order the flags were enumerated in", () => {
    const reordered = Object.fromEntries([...Object.entries(FLAGS)].reverse());
    expect(digestOf(BUILD, reordered)).toBe(digestOf(BUILD));
  });

  it("is identical for two builds of the same source, which is what makes a mismatch mean something", () => {
    expect(digestOf(BUILD.map((f) => ({ ...f })))).toBe(digestOf(BUILD));
  });

  it("refuses a path it cannot serialise unambiguously rather than hashing two builds alike", () => {
    expect(() => digestOf([...BUILD, file("assets/od\td.js")])).toThrow(/tab or a newline/);
    expect(() => digestOf([...BUILD, file("assets/od\nd.js")])).toThrow(/tab or a newline/);
  });

  it("carries its format version, so a digest under different rules cannot be compared with one under these", () => {
    expect(digestOf(BUILD).startsWith(`stimulus-manifest/v${STIMULUS_MANIFEST_VERSION}\n`)).toBe(true);
  });
});

describe("what is deliberately outside the digest", () => {
  /*
   * `build-identity.json` carries `builtAt`, which moves on every rebuild of identical source.
   * Inside the digest it would fire the STOP rule on a build that changed nothing, and a check that
   * fires when nothing moved is a check the moderator learns to override.
   */
  it("is exactly the two generated identity files, and they are named", () => {
    expect([...NOT_STIMULUS].sort()).toEqual(["build-identity.json", "stimulus-manifest.json"]);
  });

  it("does not include the git sha or the build time, because neither moves what the person was shown", () => {
    /*
     * A commit touching only `docs/` produces a byte-identical `dist/public`, and a rebuild of one
     * commit produces a new `builtAt`. Folding either in would report a stimulus change that did
     * not happen. The sha is a manifest FIELD, not a digest INPUT: both questions stay answerable
     * and neither answers the other's.
     *
     * Asserted as an allowlist of line kinds rather than by searching for today's field names, so
     * this goes red when a fourth kind of line is added rather than only when one called `sha` is.
     */
    const kinds = new Set(
      stimulusPreimage(BUILD, FLAGS)
        .trimEnd()
        .split("\n")
        .slice(1)
        .map((line) => line.split("\t")[0]),
    );
    expect([...kinds].sort()).toEqual(["file", "flag"]);
  });
});

describe("the shape check", () => {
  const valid = {
    manifestVersion: STIMULUS_MANIFEST_VERSION,
    stimulus_sha256: hash("c"),
    gitSha: "e663ebc6c2493c30ca0d29bb1ce61cdf1f289cab",
    builtAt: "2026-09-13T17:26:33Z",
    target: "production",
    flags: FLAGS,
    files: BUILD,
  };

  it("accepts a manifest this build would write", () => {
    expect(isStimulusManifest(valid)).toBe(true);
  });

  it("refuses a digest that is not a sha256, so a truncated or absent one fails where it is read", () => {
    expect(isStimulusManifest({ ...valid, stimulus_sha256: hash("c").slice(0, 40) })).toBe(false);
    expect(isStimulusManifest({ ...valid, stimulus_sha256: "" })).toBe(false);
  });

  it("refuses a manifest written under a different format version", () => {
    expect(isStimulusManifest({ ...valid, manifestVersion: STIMULUS_MANIFEST_VERSION + 1 })).toBe(false);
  });

  it("refuses a file entry with no hash, which is how an unhashable asset would have to sneak in", () => {
    expect(isStimulusManifest({ ...valid, files: [{ path: "fonts/x.woff2", bytes: 1 }] })).toBe(false);
  });
});
