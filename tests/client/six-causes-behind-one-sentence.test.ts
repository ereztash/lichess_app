/**
 * R-09: six causes reached one sentence, and the report could not say which.
 *
 * WHAT THE ROW WAS BLOCKED ON. The scan was reported as failing on the deployed preview. Two real
 * defects on that path were found and fixed, and neither could be shown to be the reporter's,
 * because the screen they saw was `readableFailure`'s fallback — one sentence, produced for
 * *anything* whose message is not already Hebrew. The row said so plainly: *"which error the
 * reporter actually hit"* is still not established.
 *
 * A DISCLOSURE WAS THE FIRST ANSWER AND IT IS NOT ENOUGH. Putting the raw text behind a `<details>`
 * lets a reader paste something; it does not let them, or anyone, say what to DO. A browser without
 * Workers, a `worker-src` that forbids the engine's source, a `'wasm-unsafe-eval'` that is missing,
 * an asset served as `text/plain`, an engine that never greeted, and a slow link all arrive at that
 * sentence, and the fixes have nothing in common — two are the deployment's, two are the browser's,
 * one is the network's, one is a game.
 *
 * SO THE TEST OF A CODE IS WHETHER THE SAME PERSON WOULD DO THE SAME THING. That is why
 * `worker-refused` and `wasm-refused` are two codes although both are usually one CSP: one is fixed
 * by `worker-src` and the other by `'wasm-unsafe-eval'`, and no message can tell you which unless
 * the code did.
 */
import { describe, expect, it } from "vitest";
import {
  ENGINE_FAILURES,
  ENGINE_REMEDY,
  EngineFailureError,
  failureCode,
  type EngineFailure,
} from "@shared/engine-failure";
import { readableFailure, scanFailureText } from "@/lib/commit-error";

describe("the vocabulary is closed and every entry earns its place", () => {
  it("names each code exactly once and covers the six causes the row listed", () => {
    expect(new Set(ENGINE_FAILURES).size).toBe(ENGINE_FAILURES.length);
    for (const cause of [
      "worker-unsupported",
      "wasm-refused",
      "worker-refused",
      "asset-mistyped",
      "engine-timeout",
      "position-unreadable",
    ] as const) {
      expect(ENGINE_FAILURES, `${cause} is not in the vocabulary`).toContain(cause);
    }
  });

  it("has no generic code, because a generic code collects what the list exists to separate", () => {
    for (const code of ENGINE_FAILURES) {
      expect(code, "a catch-all crept into the vocabulary").not.toMatch(
        /^(unknown|other|generic|misc|error)$/,
      );
    }
  });

  it("gives every code a remedy that names an act", () => {
    for (const code of ENGINE_FAILURES) {
      const remedy = ENGINE_REMEDY[code];
      expect(remedy, `${code} has no remedy`).toBeTruthy();
      expect(remedy.length, `${code}'s remedy is too short to say anything`).toBeGreaterThan(25);
      /* "An error occurred" is not a remedy. Each says what to do or whose problem it is. */
      expect(remedy, `${code} says nothing actionable`).toMatch(
        /אפשר|לתקן|שווה|שלחו|ממשיכה|לנסות/,
      );
    }
  });

  it("distinguishes the two refusals a single CSP produces", () => {
    /*
     * THE PAIR THAT MATTERS MOST. Both are almost always one header, and they need different
     * directives. A vocabulary that merged them would be a vocabulary that sent every reader to
     * read the wrong line of `vercel.json`.
     */
    expect(ENGINE_REMEDY["worker-refused"]).toContain("worker-src");
    expect(ENGINE_REMEDY["wasm-refused"]).toContain("wasm-unsafe-eval");
    expect(ENGINE_REMEDY["worker-refused"]).not.toBe(ENGINE_REMEDY["wasm-refused"]);
  });

  it("keeps a remedy for the deployment distinguishable from one for the player", () => {
    /* A player told to fix a CSP will correctly conclude the message is not for them. */
    for (const code of ["worker-refused", "wasm-refused", "asset-mistyped"] as const) {
      expect(ENGINE_REMEDY[code], `${code} reads as something the player can do`).toContain(
        "בפריסה",
      );
    }
  });
});

describe("what the scan screen says, per cause", () => {
  const FALLBACK = "הסריקה נעצרה לפני שהספיקה למדוד משהו.";

  it("says a different thing for each code, and carries the code for a report", () => {
    const said = new Map<string, EngineFailure[]>();
    for (const code of ENGINE_FAILURES) {
      const text = scanFailureText(new EngineFailureError(code, "observed"), FALLBACK);
      expect(text.message, `${code} fell through to the generic sentence`).not.toBe(FALLBACK);
      expect(text.detail, `${code} is not greppable in a pasted report`).toContain(`[${code}]`);
      said.set(text.message, [...(said.get(text.message) ?? []), code]);
    }
    const shared = [...said.values()].filter((codes) => codes.length > 1);
    expect(shared, `these codes render the same sentence: ${JSON.stringify(shared)}`).toEqual([]);
  });

  it("keeps the raw observation, because the remedy is not the evidence", () => {
    const text = scanFailureText(
      new EngineFailureError("worker-refused", "נדחה בלי הודעה"),
      FALLBACK,
    );
    expect(text.detail).toContain("נדחה בלי הודעה");
  });

  it("admits to an unclassified failure instead of filing it under a name", () => {
    /*
     * THE HONEST FLOOR. A failure that fits none of the nine is one this list has not learned yet.
     * Inventing a tenth for it would put exactly the cases this vocabulary exists to separate back
     * into one bucket, so the old behaviour is kept unchanged and says so.
     */
    const text = scanFailureText(new Error("something nobody classified"), FALLBACK);
    expect(text.message).toBe(FALLBACK);
    expect(text.detail).toBe("something nobody classified");
    expect(text).toEqual(readableFailure(new Error("something nobody classified"), FALLBACK));
  });

  it("still passes a Hebrew message from the record layer through untouched", () => {
    /* The scan's catch sees record errors too, and those already say the right thing. */
    const written = "ההחלטה נשלחה כבדיקת העברה אבל בלי לומר לאיזו בדיקה.";
    expect(scanFailureText(new Error(written), FALLBACK).message).toBe(written);
  });
});

describe("the code survives the throw", () => {
  it("reads back off the error, and is null when nothing set one", () => {
    expect(failureCode(new EngineFailureError("engine-timeout", "x"))).toBe("engine-timeout");
    expect(failureCode(new Error("plain"))).toBeNull();
    expect(failureCode("not an error at all")).toBeNull();
  });

  it("keeps the message readable, so every existing catch behaves as it did", () => {
    /*
     * ADDITIVE ON PURPOSE. `readableFailure` and six other call sites read `error.message`; a code
     * that arrived by replacing the message would have changed all of them at once.
     */
    const error = new EngineFailureError("engine-timeout", "לא הספיק לענות");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("לא הספיק לענות");
    expect(error.observed).toBe("לא הספיק לענות");
  });
});
