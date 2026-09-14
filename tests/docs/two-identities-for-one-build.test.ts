/**
 * The stimulus identity a moderator reads, held against the registration a check reads.
 *
 * WHAT WENT WRONG, in this exact file pair and recently. `research/player-path/field/README.md`
 * records it against itself: *"`6053af2` re-froze the protocol and updated the HASH here without
 * updating the commit identities beside it. Two identities for one build, in the one file a
 * moderator opens before a session."* The repair at the time was prose discipline, which is the
 * same repair that had just failed.
 *
 * `REGISTERED_STIMULUS.json` is now the authority and the deployed check reads it. That fixes the
 * check and does nothing for the moderator, who reads markdown -- so a digest could be corrected in
 * the JSON while both documents kept naming the old one, and the pre-session step would send
 * somebody looking for a string the origin no longer serves. The failure moves rather than closing.
 *
 * So the documents are held to the registration in the direction that matters: every 64-character
 * digest and every 40-character commit that appears in either document must be one the registration
 * names, or must appear in a passage the document itself marks as history.
 *
 * WHAT THIS DELIBERATELY DOES NOT CHECK. The prose around the identity. The identities are the part
 * that has to survive the trip between the two files, and the identities are what is held.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isRegisteredStimulus, REGISTERED_STIMULUS_PATH } from "../../scripts/field-stimulus";

const root = resolve(__dirname, "../..");
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

const parsed: unknown = JSON.parse(read(REGISTERED_STIMULUS_PATH));
if (!isRegisteredStimulus(parsed)) throw new Error(`${REGISTERED_STIMULUS_PATH} is not readable`);
const registration = parsed;

const PROTOCOL = "research/player-path/FIELD_RUN_CURRENT.md";
const MODERATOR = "research/player-path/field/README.md";

/**
 * Identities the documents may name besides the registered one.
 *
 * THE RE-FREEZE LOG IS THE REASON THIS LIST EXISTS. `FIELD_RUN_CURRENT.md` carries a table of every
 * build the stimulus has been pointed at and why it moved, and deleting that history to satisfy a
 * test would destroy the only record of how many times the pre-registration was re-pointed -- which
 * is the finding the table was written to preserve. Superseded identities are listed here, so
 * adding one is a deliberate line in a diff rather than a silent drift.
 */
const SUPERSEDED = new Set([
  "4c39563", // first freeze
  "dd30b3a", // re-freeze 1, the clipped option list on a phone
  "e663ebc", // re-freeze 2, PR #109 merged and production tracked main
  "fce720a", // the PR #111 preview the mechanism was verified on
  "2f3c261", // the deployment N-7 was confirmed against, in PRE_HUMAN_UX_PASS_5
  // The drift `field/README.md` records against itself, in the paragraph that records it. Deleting
  // those identities would delete the account of how a moderator's file came to name a bundle its
  // own commits do not build, which is the finding the paragraph exists to keep.
  "b2d8865",
  "9818a62",
  "6053af2",
  "f1315d7",
  "e6fb2fc",
  "0cbb46a",
  "b9a228c",
]);

/** Every full-length digest a document names, deduplicated. */
const digestsIn = (text: string): string[] => [
  ...new Set([...text.matchAll(/\b[0-9a-f]{64}\b/g)].map((m) => m[0])),
];

/** Every commit-shaped token a document names, at any abbreviation the repository uses. */
const shasIn = (text: string): string[] => [
  ...new Set([...text.matchAll(/\b[0-9a-f]{7}(?:[0-9a-f]{33})?\b/g)].map((m) => m[0])),
];

describe("the digest a moderator is told to look for", () => {
  for (const doc of [PROTOCOL, MODERATOR]) {
    it(`names the registered stimulus, and no other, in ${doc}`, () => {
      const named = digestsIn(read(doc));
      expect(
        named.filter((d) => d !== registration.stimulus_sha256),
        "a document names a stimulus digest the registration does not. One of the two is what the " +
          "origin serves and the moderator cannot tell which",
      ).toEqual([]);
      expect(named, `${doc} names no stimulus digest at all`).toContain(
        registration.stimulus_sha256,
      );
    });
  }
});

describe("the commit the documents say produced it", () => {
  for (const doc of [PROTOCOL, MODERATOR]) {
    it(`names only the registered commit or a superseded one, in ${doc}`, () => {
      const unexplained = shasIn(read(doc)).filter(
        (sha) =>
          !registration.gitSha.startsWith(sha) &&
          !registration.stimulus_sha256.startsWith(sha) &&
          !SUPERSEDED.has(sha.slice(0, 7)),
      );
      expect(
        unexplained,
        "a document names a build identity that is neither the registered one nor a recorded " +
          "re-freeze. Add it to SUPERSEDED with a note, or correct the document",
      ).toEqual([]);
    });
  }
});

describe("the registration and the protocol agree on the run's state", () => {
  it("does not let the protocol claim zero participants while the registration counts some", () => {
    // ONE SENTENCE, TWO PLACES. The protocol's "zero participants have run" is what licenses every
    // re-freeze in its table; the registration's count is what the deployed check obeys. If they
    // ever disagree, the re-freezes were licensed by a sentence no mechanism believed.
    const protocolSaysZero = /[Zz]ero participants have run/.test(read(PROTOCOL));
    if (protocolSaysZero) {
      expect(
        registration.participantsRun,
        "the protocol says zero participants have run and the registration counts some. Every " +
          "re-freeze in the protocol's table was licensed by that sentence",
      ).toBe(0);
    }
  });
});
