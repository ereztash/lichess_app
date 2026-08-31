// @vitest-environment jsdom
/**
 * GATE-ENGINE-FAILURE-DISTINCT — no two causes of an engine failure say the same thing.
 *
 * IT IS A GATE RATHER THAN A TEST FOR THE USUAL REASON: it is violated by ADDING something. A tenth
 * code whose remedy is copied from a ninth, or a renderer that starts falling back for one of them,
 * costs nothing at the moment it is written and turns the report back into "it does not work" for
 * whoever hits it next.
 */
import { describe, expect, it } from "vitest";
import { ENGINE_FAILURES, ENGINE_REMEDY, EngineFailureError } from "@shared/engine-failure";
import { scanFailureText } from "@/lib/commit-error";

const FALLBACK = "הסריקה נעצרה לפני שהספיקה למדוד משהו.";

describe("GATE-ENGINE-FAILURE-DISTINCT", () => {
  it("renders a distinct sentence for every cause", () => {
    const said = new Set(
      ENGINE_FAILURES.map(
        (code) => scanFailureText(new EngineFailureError(code, "observed"), FALLBACK).message,
      ),
    );
    expect(said.size, "two causes render the same sentence").toBe(ENGINE_FAILURES.length);
  });

  it("never reaches the generic fallback for a classified cause", () => {
    for (const code of ENGINE_FAILURES) {
      const text = scanFailureText(new EngineFailureError(code, "observed"), FALLBACK);
      expect(text.message, `${code} fell through to the fallback`).not.toBe(FALLBACK);
      expect(text.detail, `${code} is not greppable in a report`).toContain(`[${code}]`);
    }
  });

  it("keeps every remedy distinct, not only every message", () => {
    expect(new Set(Object.values(ENGINE_REMEDY)).size).toBe(ENGINE_FAILURES.length);
  });

  it("has something to measure, so it cannot pass vacuously", () => {
    expect(ENGINE_FAILURES.length).toBeGreaterThan(5);
  });
});
