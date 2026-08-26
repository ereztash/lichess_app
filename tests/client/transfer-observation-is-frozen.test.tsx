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
import { transferObservation } from "@shared/learning-record";

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

  it("refuses to build an observation whose application half is unanswered", () => {
    /*
     * The guard has to sit on the COMMIT, not on the advance: blocking the advance would leave a
     * player who skipped the question able to answer it only after the reveal, which is the
     * defect reached by a different route.
     *
     * This used to be asserted with a regex looking for `onCommit` and `learningTransferApplied
     * === null` within 1200 characters of each other in Home.tsx -- satisfied by source that
     * merely mentions both, and it went on passing while the callback holding that value did not
     * depend on it. What replaces it is the refusal itself, run:
     * tests/shared/learning-record.test.ts drives `transferObservation` with a null answer, and
     * tests/client/a-stale-closure-fabricates-an-observation.test.ts parses the dependency lists.
     */
    expect(() =>
      transferObservation({ decision_id: "d-1", recalled_rule: "כלל", applied_rule: null }),
    ).toThrow();
  });
});

describe("the answer key is not on screen during the exam", () => {
  /*
   * `c507a15` removed `action_rule` from the queue so the rule would not sit beside the button
   * that tests recall of it. An adversarial review then found a paraphrase of it rendered INSIDE
   * the test: `refutation_condition` sat outside every stage conditional, visible throughout.
   *
   * That field is written by answering "איזו תוצאה תפריך את הכלל?", and a player answers that by
   * restating the behaviour the rule prescribes. Pasting it as the recall was measured clearing
   * the floor at coverage 0.556 -- so the exam contained an answer that passes it.
   *
   * It stays at the BRIEFING, because that is what preregistering means: fixed and shown before
   * any position is drawn. What it must not do is stay up while recall is being asked for.
   */
  const at = (stage: "briefing" | "running") =>
    render(
      <LearningTransferRunner
        transfer={transfer}
        stage={stage}
        index={0}
        revealed={false}
        recall=""
        applied={null}
        verdict={null}
        onRecall={vi.fn()}
        onApplied={vi.fn()}
        onStart={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

  it("shows the refutation condition before the test starts", () => {
    at("briefing");
    expect(screen.getByText(transfer.refutation_condition)).toBeTruthy();
  });

  it("removes it once the test is running", () => {
    at("running");
    expect(
      screen.queryByText(transfer.refutation_condition),
      "a paraphrase of the rule is on screen while the player is asked to recall it",
    ).toBeNull();
  });

  it("still says what the bar is while running, without restating the rule", () => {
    // Removing the condition must not remove the fact that two of three are needed -- a
    // preregistered bar the player cannot see is not preregistered from their side.
    at("running");
    expect(screen.getByText(/נדרשות 2/)).toBeTruthy();
  });
});

describe("the verdict claims only what three positions can carry", () => {
  const done = (observed: boolean) =>
    render(
      <LearningTransferRunner
        transfer={transfer}
        stage="done"
        index={2}
        revealed
        recall=""
        applied
        verdict={{ observed, successes: observed ? 3 : 0 }}
        onRecall={vi.fn()}
        onApplied={vi.fn()}
        onStart={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

  it("does not tell the player their rule was refuted", () => {
    /*
     * "הכלל הופרך" is a claim about the RULE. Three positions is below every single-case standard
     * consulted; the positions were not chosen for the rule's trigger; and there is no control
     * condition. What is true is that a preregistered condition did not hold.
     */
    done(false);
    expect(screen.queryByText(/הכלל הופרך/)).toBeNull();
    expect(screen.getByText(/התנאי שנרשם מראש לא התקיים/)).toBeTruthy();
  });

  it("does not tell the player their rule survived either", () => {
    // Both directions. A verdict that only softened the bad news would be worse than one that
    // softened neither -- it would read as a product protecting the player from its own findings.
    done(true);
    expect(screen.getByText(/התנאי שנרשם מראש התקיים/)).toBeTruthy();
  });

  it("names all four reasons the number is not a finding about the rule", () => {
    /*
     * Each clause is load-bearing and each is the kind a tidy-up drops: too few positions, not
     * selected for the trigger, no control condition, and a recall check that is word overlap and
     * will mark a correct paraphrase wrong.
     */
    done(true);
    const element = screen.getByText(/זו לא קביעה על הכלל עצמו/);
    /*
     * VISIBLE, not merely present. `hidden` leaves the node in the DOM and `getByText` still finds
     * it, so an assertion that only queried for the text passed with the whole caveat hidden --
     * a positive control proved that by adding the attribute and watching nothing fail.
     */
    expect(element).toBeVisible();
    const limits = element.textContent ?? "";
    expect(limits).toMatch(/שלוש עמדות/);
    expect(limits).toMatch(/לא לפי הטריגר|לא לפי הטריגר של הכלל/);
    expect(limits).toMatch(/עמדות ביקורת/);
    expect(limits).toMatch(/חפיפת מילים/);
  });
});
