// @vitest-environment jsdom
/**
 * Both halves of a transfer observation are frozen before the engine speaks.
 *
 * THE DEFECT. The runner asked "אחרי החשיפה: האם יישמתם את הכלל בהחלטה הזו?" -- literally after
 * the reveal. Once you have been told the move was good, "did I apply my rule?" is answered by
 * the outcome rather than by any memory of process, and the answer runs in the flattering
 * direction. The recall was already collected before the reveal; the application was not, and it
 * is the half that feeds `successes`.
 *
 * THIS IS R3, ONE LAYER OUT. The rule the whole product is built on is that the engine must not
 * speak before the player's decision is recorded. An observation ABOUT that decision, collected
 * after the engine has spoken, is the same leak wearing different clothes.
 *
 * WHAT REPLACES IT is present tense -- "האם אתם מיישמים אותו" -- because that is a question about
 * what you are doing, which is answerable, rather than about what you did, which by then you have
 * been given the answer to.
 */
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { LearningTransfer } from "@shared/learning-record";
import { LearningTransferRunner } from "@/components/LearningTransferRunner";

const root = resolve(__dirname, "../..");

const transfer: LearningTransfer = {
  transfer_id: "transfer-1",
  rule_id: "rule-1",
  fens: ["a", "b", "c"],
  rule_snapshot: {
    trigger: "כשהיריב משנה מבנה רגלים",
    mechanism_class: "threat_scan",
    action_rule: "רשימת שחים והכאות לפני מועמדים שקטים",
    predicted_outcome: "פחות הפסדים במהלך אחד",
  },
  refutation_condition: "פחות משתי הצלחות בשלוש עמדות",
  minimum_successes: 2,
  retrieval_step: 0,
  scheduled_for: "2026-01-02T00:00:00.000Z",
  started_at: "2026-01-02T00:00:00.000Z",
};

const runner = (over: { revealed: boolean; applied?: boolean | null }) =>
  render(
    <LearningTransferRunner
      transfer={transfer}
      stage="running"
      index={0}
      revealed={over.revealed}
      recall=""
      applied={over.applied ?? null}
      verdict={null}
      onRecall={vi.fn()}
      onApplied={vi.fn()}
      onStart={vi.fn()}
      onFinish={vi.fn()}
    />,
  );

describe("the application answer is collected before the engine speaks", () => {
  it("asks it in the same breath as the recall, before the reveal", () => {
    runner({ revealed: false });
    expect(screen.getByText(/מהו כלל הפעולה שאתם זוכרים/)).toBeTruthy();
    expect(
      screen.getByText(/מיישמים/),
      "the application question is not on the pre-reveal panel",
    ).toBeTruthy();
  });

  it("does not ask it after the reveal, where the answer is already known", () => {
    /*
     * THE ASSERTION THAT MATTERS. A control that only checked the pre-reveal panel would pass
     * with the question asked in BOTH places, which is the same contamination plus a duplicate.
     */
    runner({ revealed: true, applied: true });
    expect(screen.queryByText(/אחרי החשיפה/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /כן/ }),
      "the application control is still live after the engine answered",
    ).toBeNull();
  });

  it("never uses the past tense, which is the phrasing that invites hindsight", () => {
    runner({ revealed: false });
    expect(screen.queryByText(/יישמתם/)).toBeNull();
  });
});

describe("the frozen observation is what gets reported", () => {
  it("writes the player's answer at reveal time rather than a placeholder patched later", () => {
    /*
     * Asserted against the source, because the defect is a SEQUENCE and the rendered output looks
     * identical either way. The observation used to be written with `applied_rule: false` and
     * patched in `advanceLearningTransfer` -- after the reveal -- so the value that reached the
     * server was collected at the wrong moment while every screen looked correct.
     */
    const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(home, "the observation is still written with a placeholder").not.toMatch(
      /recalled_rule:[\s\S]{0,80}applied_rule:\s*false\s*,/,
    );
    expect(home, "the application answer is still patched in after the fact").not.toMatch(
      /\.\.\.observation,\s*applied_rule:/,
    );
  });

  it("refuses to commit a transfer decision before both halves are answered", () => {
    // The guard has to sit on the COMMIT, not on the advance. Blocking the advance would leave a
    // player who skipped the question able to answer it only after the reveal -- which is the
    // defect, reached by a different route.
    const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
    expect(home).toMatch(/onCommit[\s\S]{0,1200}learningTransferApplied === null/);
  });
});
