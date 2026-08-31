/**
 * POSITIVE CONTROL for GATE-SAID-ONCE. Expected to FAIL.
 *
 * The predicate is the gate's own AND SO IS ITS THRESHOLD, run over `tests/fixtures/said-once` --
 * a client tree in miniature holding two lists that render the same sentence in every row. Two
 * rather than one because the gate is a ratchet at one: a fixture with a single repeating list
 * would sit exactly at the ceiling and pass, which would be a control proving the predicate can
 * count to one.
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { CONSTANT_IN_ROW_CEILING, findConstantRowSentences } from "../../../scripts/said-once-scan";

const root = resolve(__dirname, "../said-once");

describe("GATE-SAID-ONCE control", () => {
  it("notices a list that says one thing once per row", () => {
    const found = findConstantRowSentences(root);
    expect(
      found.length,
      `constant row sentences: ${found.map((f) => `${f.file}:${f.line} ${f.text}`).join(" | ")}`,
    ).toBeLessThanOrEqual(CONSTANT_IN_ROW_CEILING);
  });
});
