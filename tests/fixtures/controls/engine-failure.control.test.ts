// @vitest-environment jsdom
/**
 * POSITIVE CONTROL for GATE-ENGINE-FAILURE-DISTINCT. Expected to FAIL.
 *
 * IT IS THE SCAN AS IT SHIPPED. `readableFailure` has two answers: pass a Hebrew message through,
 * or render one fallback sentence with the raw text behind a disclosure. Six causes reach it, and
 * R-09 arrived as exactly that sentence — which is why the row could say two real defects had been
 * fixed and still not say whether either was the reporter's.
 *
 * The predicate is the gate's own, run over that renderer instead of over the current one. A
 * control with its own weaker predicate proves nothing.
 */
import { describe, expect, it } from "vitest";
import { ENGINE_FAILURES, EngineFailureError } from "@shared/engine-failure";
import { readableFailure } from "@/lib/commit-error";

const FALLBACK = "הסריקה נעצרה לפני שהספיקה למדוד משהו.";

describe("GATE-ENGINE-FAILURE-DISTINCT control", () => {
  it("notices six causes rendering one sentence", () => {
    const said = new Set(
      ENGINE_FAILURES.map(
        (code) => readableFailure(new EngineFailureError(code, "observed"), FALLBACK).message,
      ),
    );
    expect(
      said.size,
      `${ENGINE_FAILURES.length} causes rendered ${said.size} distinct sentence(s)`,
    ).toBe(ENGINE_FAILURES.length);
  });
});
