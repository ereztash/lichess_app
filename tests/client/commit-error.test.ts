/**
 * The boundary between the record layer's language and the player's.
 *
 * Home.tsx put `error.message` on screen unchanged, and on the DEFAULT path -- not signed in --
 * the commit runs through LocalRecordStore, whose invariant violations read "append-only:
 * decision_id already exists". English technical text, in an RTL Hebrew app, on the one screen
 * whose job is to say a decision was not recorded.
 *
 * It was found by enumerating user-reachable strings rather than by a test, which is the point
 * worth recording: every one of those messages is correct, nothing throws in the test suite, and
 * no assertion anywhere covered the text of a failed commit.
 */
import { describe, expect, it } from "vitest";
import { commitFailureText } from "../../client/src/lib/commit-error";

const HEBREW = /[֐-׿]/;

describe("what the player is told", () => {
  it("answers in Hebrew for every append-only message the store can throw", async () => {
    /*
     * Read from the store's own source rather than listed here, so a new invariant message is
     * covered the day it is written instead of the day someone remembers this file.
     */
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(process.cwd(), "client/src/lib/local-record-store.ts"),
      "utf8",
    );
    const messages = [...source.matchAll(/new Error\("((?:[^"\\]|\\.)*)"\)/g)].map((m) => m[1]);
    expect(messages.length, "no thrown messages found in local-record-store.ts").toBeGreaterThan(4);

    for (const raw of messages) {
      const text = commitFailureText(new Error(raw));
      if (HEBREW.test(raw)) continue; // already written for the player
      expect(HEBREW.test(text.message), `"${raw}" reaches the player untranslated`).toBe(true);
      expect(text.detail, `"${raw}" was dropped instead of demoted`).toBe(raw);
    }
  });

  it("says the decision was not recorded, which is the only thing that matters here", () => {
    expect(commitFailureText(new Error("append-only: already revealed")).message).toMatch(
      /לא נרשמה/,
    );
  });

  it("keeps the original text rather than dropping it", () => {
    // Deleting it produces a failure nobody can report, and the self-check panel exists to
    // produce reports.
    expect(commitFailureText(new Error("boom")).detail).toBe("boom");
  });
});

describe("what passes through untouched", () => {
  it("leaves a message the record layer wrote for the player alone", () => {
    // Wrapping it would bury a specific, useful sentence inside a generic one.
    const written = "אין חיבור למאגר ההחלטות";
    expect(commitFailureText(new Error(written))).toEqual({ message: written });
  });

  it("adds no empty disclosure when there was no message at all", () => {
    expect(commitFailureText(undefined).detail).toBeUndefined();
    expect(commitFailureText(new Error("")).detail).toBeUndefined();
    expect(HEBREW.test(commitFailureText(undefined).message)).toBe(true);
  });
});

describe("the wiring", () => {
  it("routes the commit catch through this boundary rather than the raw message", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(source, "Home.tsx sets a commit error without the boundary").not.toMatch(
      /setCommitError\(\s*error instanceof Error \? error\.message/,
    );
    expect(source).toMatch(/setCommitError\(commitFailureText\(error\)\)/);
  });
});

describe("the other six screens that rendered the same English", () => {
  it("leaves no call site putting a raw error message on screen", async () => {
    /*
     * The commit screen was the one found first, but the same store throws the same text at the
     * drill, the transfer check, the rule composer, the import scan and the Lichess layers --
     * "append-only: drill already started" reached the drill screen exactly as it reached the
     * commit screen. Asserted across the render path rather than per file, so a seventh site
     * added later is caught rather than merely likely to be noticed.
     */
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join, resolve } = await import("node:path");
    const root = resolve(process.cwd(), "client/src");
    const files: string[] = [];
    (function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(p)) files.push(p);
      }
    })(root);

    // The shapes that put a thrown message into a state setter or straight into JSX.
    const RAW = [
      /\w+ instanceof Error \? \w+\.message\s*:/,
      /\{\s*\w+\.error\.message\s*\|\|/,
    ];
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith("commit-error.ts") || file.endsWith("self-check.ts")) continue;
      const source = readFileSync(file, "utf8");
      if (RAW.some((r) => r.test(source))) offenders.push(file.replace(`${process.cwd()}/`, ""));
    }
    expect(offenders, `these render a raw error message: ${offenders.join(", ")}`).toEqual([]);
    // The scan is worth nothing if it found no files to scan.
    expect(files.length).toBeGreaterThan(20);
  });
});
